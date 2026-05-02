import { getFirestoreDb } from '@/lib/firebase/server'
import type { AIQuestion } from '@/lib/trivia/aiQuestions'
import { CATEGORY_META } from '@/lib/trivia/categories'
import {
  computeTrim,
  ensureMigratedTriviaState,
  readTriviaState,
  trimRecentSeen,
} from '@/lib/trivia/triviaState'

export interface SamplerOptions {
  uid: string
  streak: number
  type?: 'free-text' // v1 only free-text
  // List of category ids to draw from. Empty/undefined = all categories.
  // Single-element arrays behave the same as the old single-category mode.
  categoryIds?: number[]
}

// Number of candidates to fetch around a random cursor. Large enough that
// difficulty bucketing + freshness bias still produces a reasonable
// distribution; small enough that reads-per-/next stays in low double
// digits. Tunable; bump if buckets routinely come back thin.
const CANDIDATE_WINDOW = 50

/**
 * Difficulty-bias curve for the sampler.
 *
 * Designed to feel progressively harder without sudden cliff-edges.
 * The bands are:
 *
 *   Streak 0-4   → 60% easy, 30% medium, 10% hard   (onboarding)
 *   Streak 5-9   → 30% easy, 40% medium, 30% hard   (warming up)
 *   Streak 10-19 → 10% easy, 30% medium, 60% hard   (challenge zone)
 *   Streak 20+   → 5% easy, 25% medium, 70% hard    (expert territory)
 *
 * Tuning notes (v1 — 2026-04-28):
 * - No telemetry data yet; these are design estimates.
 * - The 20+ band caps hard at 70% rather than 100% to prevent
 *   frustration spirals where a single hard miss ends a long run.
 * - Freshness bias (1/(1+timesShown)) ensures under-seen questions
 *   surface first, preventing "greatest hits" stagnation.
 * - Revisit after ~1 week of real run data using:
 *     SELECT difficulty, AVG(correct::int), COUNT(*)
 *     FROM answers JOIN questions ON ...
 *     GROUP BY difficulty, streak_band
 */
function getDifficultyWeights(streak: number): [number, number, number] {
  if (streak >= 20) return [0.05, 0.25, 0.70]
  if (streak >= 10) return [0.10, 0.30, 0.60]
  if (streak >= 5)  return [0.30, 0.40, 0.30]
  return [0.60, 0.30, 0.10]
}

// Weighted random selection over an array of items with numeric weights
function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let rand = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return items[i]
  }
  return items[items.length - 1]
}

// Compute per-question weight within a difficulty bucket.
// Lower timesShown → higher weight (freshness bias).
function freshnessWeight(timesShown: number): number {
  return 1 / (1 + timesShown)
}

// Build the base candidate query (status + type + optional category filter).
// Returned as a Query so callers can layer ordering/cursors on top.
function buildCandidateQuery(
  db: FirebaseFirestore.Firestore,
  type: 'free-text',
  categoryIds: number[] | undefined,
): FirebaseFirestore.Query {
  let query: FirebaseFirestore.Query = db
    .collection('aiQuestions')
    .where('status', '==', 'active')
    .where('type', '==', type)

  // Resolve the optional category filter to category-name strings (the
  // shape stored on aiQuestions docs). Firestore `in` clause caps at 30
  // values, which is comfortably more than our 24 categories.
  if (categoryIds && categoryIds.length > 0) {
    const names = categoryIds
      .map((id) => CATEGORY_META[id]?.name)
      .filter((name): name is string => !!name)
    if (names.length === 1) {
      query = query.where('category', '==', names[0])
    } else if (names.length > 1) {
      query = query.where('category', 'in', names)
    }
  }
  return query
}

// Fetch up to LIMIT candidates near a random cursor, wrapping around to
// the start of the random ordering if the forward window comes back short
// (happens when r is close to 1 or the pool is small). De-dupes by id.
async function fetchCandidateWindow(
  query: FirebaseFirestore.Query,
  limit: number,
): Promise<AIQuestion[]> {
  const r = Math.random()
  const fwd = await query.orderBy('random').startAt(r).limit(limit).get()

  const seen = new Set<string>()
  const out: AIQuestion[] = []
  for (const d of fwd.docs) {
    if (seen.has(d.id)) continue
    seen.add(d.id)
    out.push({ id: d.id, ...(d.data() as Omit<AIQuestion, 'id'>) })
  }

  if (out.length < limit) {
    const more = await query.orderBy('random').limit(limit - out.length).get()
    for (const d of more.docs) {
      if (seen.has(d.id)) continue
      seen.add(d.id)
      out.push({ id: d.id, ...(d.data() as Omit<AIQuestion, 'id'>) })
    }
  }

  return out
}

export async function sampleNextQuestion(options: SamplerOptions): Promise<AIQuestion | null> {
  const { uid, streak, type = 'free-text', categoryIds } = options
  const db = getFirestoreDb()

  // 1. Load the per-user state doc. Lazily migrate users who pre-date the
  //    state doc (one-time full subcollection scan, then never again).
  let state = await readTriviaState(uid)
  if (state === null || state.migrated !== true) {
    state = await ensureMigratedTriviaState(uid)
  }
  const recentSeenSet = new Set(state.recentSeen)

  // 2. Fetch a bounded candidate window around a random cursor instead of
  //    scanning the whole pool. Reads ~CANDIDATE_WINDOW docs regardless of
  //    pool size. Selection precision drops slightly — freshness bias now
  //    ranks within the window, not globally — but with a 1000-doc pool
  //    the effect is small.
  const query = buildCandidateQuery(db, type, categoryIds)
  const candidates = await fetchCandidateWindow(query, CANDIDATE_WINDOW)
  if (candidates.length === 0) return null

  // 3. Filter out questions the user has recently seen.
  const unseen = candidates.filter((q) => !recentSeenSet.has(q.id))
  if (unseen.length === 0) return null

  // 4. Opportunistically trim recentSeen if it has grown past the cap. Use
  //    arrayRemove (not overwrite) so concurrent writes in flight aren't
  //    clobbered. Fire-and-forget; never blocks the response.
  const evict = computeTrim(state.recentSeen)
  if (evict !== null) {
    void trimRecentSeen(uid, evict)
  }

  // 5. Bucket by difficulty
  const byDifficulty: Record<'easy' | 'medium' | 'hard', AIQuestion[]> = {
    easy: [],
    medium: [],
    hard: [],
  }
  for (const q of unseen) {
    byDifficulty[q.difficulty].push(q)
  }

  // 6. Determine which difficulty to pick from, weighted by streak
  const [easyW, mediumW, hardW] = getDifficultyWeights(streak)

  // Only include difficulty levels that have available questions
  const availableDifficulties: Array<{ key: 'easy' | 'medium' | 'hard'; weight: number }> = []
  if (byDifficulty.easy.length > 0)   availableDifficulties.push({ key: 'easy',   weight: easyW })
  if (byDifficulty.medium.length > 0) availableDifficulties.push({ key: 'medium', weight: mediumW })
  if (byDifficulty.hard.length > 0)   availableDifficulties.push({ key: 'hard',   weight: hardW })

  if (availableDifficulties.length === 0) return null

  const chosenDifficulty = weightedRandom(
    availableDifficulties.map((d) => d.key),
    availableDifficulties.map((d) => d.weight)
  )

  // 7. Within the chosen bucket, apply freshness bias (lower timesShown → higher weight)
  const bucket = byDifficulty[chosenDifficulty]
  const bucketWeights = bucket.map((q) => freshnessWeight(q.timesShown))

  // 8. Select one question
  const selected = weightedRandom(bucket, bucketWeights)

  return selected
}
