import { getFirestoreDb } from '@/lib/firebase/server'
import { saveAIQuestion } from '@/lib/trivia/aiQuestions'
import { generateInfiniteQuestion } from '@/lib/trivia/generateQuestion'

// Target number of unanswered active questions a player should always
// have available before they hit the on-demand generation path.
// Background warming kicks in when their (approximate) unanswered count
// drops below this threshold.
const TARGET_UNANSWERED = 10

// Fire-and-forget background top-up of the question pool for a single
// player. Call from inside an `after()` block so it runs after the
// /next response has been sent.
//
// Approximation rationale: counting "active questions this user has not
// seen" exactly would require reading both collections in full. Instead
// we use Firestore aggregation count() on each side and subtract — this
// over-counts unanswered when the user has seen since-flagged
// questions, which means we'll occasionally skip warming when we
// shouldn't, but never warm when we shouldn't. Acceptable bias.
//
// Errors are logged, not thrown — this is best-effort and must never
// fail the request that scheduled it.
export async function warmQuestionPoolForUser(uid: string): Promise<void> {
  const db = getFirestoreDb()

  try {
    const [activeAgg, seenAgg] = await Promise.all([
      db.collection('aiQuestions').where('status', '==', 'active').count().get(),
      db.collection(`users/${uid}/seenQuestions`).count().get(),
    ])

    const activeCount = activeAgg.data().count
    const seenCount = seenAgg.data().count
    const approxUnanswered = Math.max(0, activeCount - seenCount)

    if (approxUnanswered >= TARGET_UNANSWERED) {
      return
    }

    console.info('[warmQuestionPool] generating', {
      uid,
      approxUnanswered,
      activeCount,
      seenCount,
      target: TARGET_UNANSWERED,
    })

    const generated = await generateInfiniteQuestion({})
    await saveAIQuestion(generated)

    console.info('[warmQuestionPool] saved', { uid, questionId: generated.id, category: generated.category })
  } catch (err) {
    console.warn('[warmQuestionPool] failed', {
      uid,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
