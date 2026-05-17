import { getFirestoreDb } from '@/lib/firebase/server'
import { saveAIQuestion } from '@/lib/trivia/aiQuestions'
import { generateInfiniteQuestion } from '@/lib/trivia/generateQuestion'
import { readTriviaState } from '@/lib/trivia/triviaState'

// Target number of unanswered active questions a player should always
// have available before they hit the on-demand generation path.
// Background warming kicks in when their (approximate) unanswered count
// drops below this threshold.
const TARGET_UNANSWERED = 25

// Module-memory cache for the active-question count. The number changes
// only when admins flag/remove docs or the warmer itself adds one — both
// rare on the timescale of /next requests. A cold serverless instance
// pays one count() aggregation; subsequent hits are free.
const ACTIVE_COUNT_TTL_MS = 5 * 60 * 1000
let activeCountCache: { value: number; expiresAt: number } | null = null

async function getActiveCount(db: FirebaseFirestore.Firestore): Promise<number> {
  const now = Date.now()
  if (activeCountCache && activeCountCache.expiresAt > now) {
    return activeCountCache.value
  }
  const agg = await db.collection('aiQuestions').where('status', '==', 'active').count().get()
  const value = agg.data().count
  activeCountCache = { value, expiresAt: now + ACTIVE_COUNT_TTL_MS }
  return value
}

// Fire-and-forget background top-up of the question pool for a single
// player. Call from inside an `after()` block so it runs after the
// /next response has been sent.
//
// Reads: 1 state doc (cheap) + an occasional cached count() aggregation.
// Replaces the prior pattern of two count() aggregations per request.
//
// Errors are logged, not thrown — this is best-effort and must never
// fail the request that scheduled it.
export async function warmQuestionPoolForUser(uid: string): Promise<void> {
  const db = getFirestoreDb()

  try {
    const [activeCount, state] = await Promise.all([
      getActiveCount(db),
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
    })

    const results = await Promise.allSettled(
      Array.from({ length: toGenerate }, () =>
        generateInfiniteQuestion({}).then((generated) =>
          saveAIQuestion({ ...generated, createdBy: uid })
        )
      )
    )

    const saved = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    // Bust the cache so the next call sees the new total.
    activeCountCache = null

    console.info('[warmQuestionPool] batch done', { uid, saved, failed })
  } catch (err) {
    console.warn('[warmQuestionPool] failed', {
      uid,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
