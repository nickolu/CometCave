import { getFirestoreDb } from '@/lib/firebase/server'
import type { AIQuestion } from '@/lib/trivia/aiQuestions'
import { CATEGORY_META } from '@/lib/trivia/categories'

export interface SamplerOptions {
  uid: string
  streak: number
  type?: 'free-text' // v1 only free-text
  categoryId?: number
}

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

export async function sampleNextQuestion(options: SamplerOptions): Promise<AIQuestion | null> {
  const { uid, streak, type = 'free-text', categoryId } = options
  const db = getFirestoreDb()

  // 1. Query active questions of the requested type
  let query = db
    .collection('aiQuestions')
    .where('status', '==', 'active')
    .where('type', '==', type)

  // If a category filter is provided, restrict to that category by name
  if (categoryId !== undefined) {
    const categoryMeta = CATEGORY_META[categoryId]
    if (categoryMeta) {
      query = query.where('category', '==', categoryMeta.name)
    }
  }

  const questionsSnap = await query.get()

  if (questionsSnap.empty) return null

  // 2. Get IDs already seen by this user
  const seenSnap = await db.collection(`users/${uid}/seenQuestions`).get()
  const seenIds = new Set(seenSnap.docs.map((d) => d.id))

  // 3. Filter out seen questions
  const unseen = questionsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AIQuestion, 'id'>) }))
    .filter((q) => !seenIds.has(q.id))

  if (unseen.length === 0) return null

  // 4. Bucket by difficulty
  const byDifficulty: Record<'easy' | 'medium' | 'hard', AIQuestion[]> = {
    easy: [],
    medium: [],
    hard: [],
  }
  for (const q of unseen) {
    byDifficulty[q.difficulty].push(q)
  }

  // 5. Determine which difficulty to pick from, weighted by streak
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

  // 6. Within the chosen bucket, apply freshness bias (lower timesShown → higher weight)
  const bucket = byDifficulty[chosenDifficulty]
  const bucketWeights = bucket.map((q) => freshnessWeight(q.timesShown))

  // 7. Select one question
  const selected = weightedRandom(bucket, bucketWeights)

  return selected
}
