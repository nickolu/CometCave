import { getFirestoreDb } from '@/lib/firebase/server'
import { saveAIQuestion } from '@/lib/trivia/aiQuestions'
import { CATEGORY_META } from '@/lib/trivia/categories'
import { generateInfiniteQuestion } from '@/lib/trivia/generateQuestion'
import { readTriviaState } from '@/lib/trivia/triviaState'

// Target number of unanswered active questions a player should always
// have available before they hit the on-demand generation path.
// Background warming kicks in when their (approximate) unanswered count
// drops below this threshold.
const TARGET_UNANSWERED = 25

// Module-memory cache for active-question counts. Keys are category ids
// (numbers) or 'all' for the global total. Counts change only when
// admins flag/remove docs or the warmer itself adds one, so a 5-minute
// TTL is plenty. A cold serverless instance pays the count() per scope
// it touches; subsequent hits are free.
const ACTIVE_COUNT_TTL_MS = 5 * 60 * 1000
type CountKey = number | 'all'
const activeCountCache = new Map<CountKey, { value: number; expiresAt: number }>()

async function getActiveCount(
  db: FirebaseFirestore.Firestore,
  scope: CountKey,
): Promise<number> {
  const now = Date.now()
  const cached = activeCountCache.get(scope)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }
  let q: FirebaseFirestore.Query = db.collection('aiQuestions').where('status', '==', 'active')
  if (scope !== 'all') {
    const name = CATEGORY_META[scope]?.name
    if (!name) return 0
    q = q.where('category', '==', name)
  }
  const agg = await q.count().get()
  const value = agg.data().count
  activeCountCache.set(scope, { value, expiresAt: now + ACTIVE_COUNT_TTL_MS })
  return value
}

// Fire-and-forget background top-up of the question pool for a single
// player. Call from inside an `after()` block so it runs after the
// /next response has been sent.
//
// When `categoryIds` is non-empty, warming is scoped to the categories
// the player is actively running: pick one at random, count active
// questions in just that category, and generate inside it if it's
// running low. A global warmer was a no-op for niche / exhausted
// single-category runs because it refilled some other category — the
// player stayed exhausted in the one they were actually playing.
//
// The "running low" check is intentionally conservative: we use the
// player's TOTAL seen count (not their per-category seen count) so a
// player who has answered 1000 questions globally but only 5 in the
// niche category they're now playing will look exhausted there even
// when they aren't. The penalty is over-warming small categories;
// under-warming drops them into the slow on-demand generation path,
// so we err on the side of over-warm here.
//
// When `categoryIds` is empty (all-category runs), keeps the global
// behavior: count() the whole bank, generate batched questions with
// no category constraint.
//
// Errors are logged, not thrown — this is best-effort and must never
// fail the request that scheduled it.
export async function warmQuestionPoolForUser(
  uid: string,
  categoryIds: number[] = [],
): Promise<void> {
  const db = getFirestoreDb()

  try {
    // Pick a category to warm against, if any. Random pick among the
    // active filters keeps multi-category runs from biasing toward the
    // first id over many requests.
    const targetCategoryId = categoryIds.length > 0
      ? categoryIds[Math.floor(Math.random() * categoryIds.length)]
      : null
    const scope: CountKey = targetCategoryId ?? 'all'

    const [activeCount, state] = await Promise.all([
      getActiveCount(db, scope),
      readTriviaState(uid),
    ])

    // If the state doc isn't materialized yet, the sampler will populate
    // it on the next /next call. Skip warming until we have a real
    // totalSeenCount — over-warming a brand-new user has no value.
    const seenCount = state?.totalSeenCount ?? 0
    const approxUnanswered = Math.max(0, activeCount - seenCount)

    if (approxUnanswered >= TARGET_UNANSWERED) {
      return
    }

    const gap = TARGET_UNANSWERED - approxUnanswered
    // Generate up to BATCH_SIZE questions in parallel when pool is low.
    const BATCH_SIZE = 3
    const toGenerate = Math.min(gap, BATCH_SIZE)

    console.info('[warmQuestionPool] generating', {
      uid,
      approxUnanswered,
      activeCount,
      seenCount,
      target: TARGET_UNANSWERED,
      toGenerate,
      targetCategoryId,
    })

    const results = await Promise.allSettled(
      Array.from({ length: toGenerate }, () => {
        const genOptions: Parameters<typeof generateInfiniteQuestion>[0] = {}
        if (targetCategoryId !== null) genOptions.categoryId = targetCategoryId
        return generateInfiniteQuestion(genOptions).then((generated) =>
          saveAIQuestion({ ...generated, createdBy: uid })
        )
      })
    )

    const saved = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    // Bust the scoped count + the global count so the next call sees
    // the new totals on whichever scope it queries next.
    activeCountCache.delete(scope)
    activeCountCache.delete('all')

    console.info('[warmQuestionPool] batch done', { uid, saved, failed, targetCategoryId })
  } catch (err) {
    console.warn('[warmQuestionPool] failed', {
      uid,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
