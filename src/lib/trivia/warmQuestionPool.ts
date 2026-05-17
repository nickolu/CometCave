import { getFirestoreDb } from '@/lib/firebase/server'
import { saveAIQuestion } from '@/lib/trivia/aiQuestions'
import { CATEGORY_META } from '@/lib/trivia/categories'
import { generateInfiniteQuestion } from '@/lib/trivia/generateQuestion'
import { readTriviaState } from '@/lib/trivia/triviaState'

// Target number of unanswered active questions a player should always
// have available before they hit the on-demand generation path.
// Background warming kicks in when their (approximate) unanswered count
// drops below this threshold.
const TARGET_UNANSWERED = 10

// Module-memory cache for active-question counts. Keys are category ids,
// or 'all' for the unfiltered total. Counts change only when admins
// flag/remove docs or the warmer adds one — rare on the timescale of
// /next requests, so a 5-minute TTL is plenty.
const ACTIVE_COUNT_TTL_MS = 5 * 60 * 1000
type CountKey = number | 'all'
const activeCountCache = new Map<CountKey, { value: number; expiresAt: number }>()

async function getActiveCount(
  db: FirebaseFirestore.Firestore,
  categoryId: CountKey = 'all',
): Promise<number> {
  const now = Date.now()
  const cached = activeCountCache.get(categoryId)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }
  let q: FirebaseFirestore.Query = db.collection('aiQuestions').where('status', '==', 'active')
  if (categoryId !== 'all') {
    const name = CATEGORY_META[categoryId]?.name
    if (!name) return 0
    q = q.where('category', '==', name)
  }
  const agg = await q.count().get()
  const value = agg.data().count
  activeCountCache.set(categoryId, { value, expiresAt: now + ACTIVE_COUNT_TTL_MS })
  return value
}

// Fire-and-forget background top-up of the question pool for a single
// player. Call from inside an `after()` block so it runs after the
// /next response has been sent.
//
// When `categoryIds` is non-empty, warming is scoped to the categories
// the player is actively running: pick one, count active questions in
// that category, and generate inside it if it's running low. The
// "running low" check is intentionally conservative — we can't tell
// from `state.totalSeenCount` how many of the player's seen questions
// fall inside this category, so we assume the worst case (all of them)
// and may over-warm small/niche categories. Over-warming costs an
// extra generation; under-warming drops the player into the slow
// on-demand path, so we err this way on purpose.
//
// When `categoryIds` is empty (all-category runs / legacy callers),
// keeps the original global behavior.
//
// Errors are logged, not thrown — this is best-effort and must never
// fail the request that scheduled it.
export async function warmQuestionPoolForUser(
  uid: string,
  categoryIds: number[] = [],
): Promise<void> {
  const db = getFirestoreDb()

  try {
    const state = await readTriviaState(uid)
    const seenCount = state?.totalSeenCount ?? 0

    // Pick the category to warm against (if any). Mirrors the route's
    // generation-fallback selection so warming biases toward the same
    // bucket the player will hit next.
    const targetCategoryId = categoryIds.length > 0
      ? categoryIds[Math.floor(Math.random() * categoryIds.length)]
      : null

    const countKey: CountKey = targetCategoryId ?? 'all'
    const activeCount = await getActiveCount(db, countKey)
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
      targetCategoryId,
    })

    const genOptions: Parameters<typeof generateInfiniteQuestion>[0] = {}
    if (targetCategoryId !== null) genOptions.categoryId = targetCategoryId
    const generated = await generateInfiniteQuestion(genOptions)
    await saveAIQuestion({ ...generated, createdBy: uid })

    // The pool just grew. Bust the category-scoped count and the
    // global count so the next call sees the new totals.
    activeCountCache.delete(countKey)
    activeCountCache.delete('all')

    console.info('[warmQuestionPool] saved', { uid, questionId: generated.id, category: generated.category })
  } catch (err) {
    console.warn('[warmQuestionPool] failed', {
      uid,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
