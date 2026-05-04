import { after } from 'next/server'
import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import type { AIQuestion } from '@/lib/trivia/aiQuestions'
import { saveAIQuestion } from '@/lib/trivia/aiQuestions'
import { CATEGORY_META } from '@/lib/trivia/categories'
import { generateInfiniteQuestion } from '@/lib/trivia/generateQuestion'
import { MAX_GENERATIONS_PER_WINDOW, WINDOW_MS, checkAndIncrementGenerationLimit } from '@/lib/trivia/generationLimit'
import { sampleNextQuestion } from '@/lib/trivia/sampler'
import { trackExhaustion } from '@/lib/trivia/triviaStats'
import { warmQuestionPoolForUser } from '@/lib/trivia/warmQuestionPool'

// GET /api/v1/trivia/infinite/next?streak=N[&categoryIds=12,13,15][&customCategory=roman+empire]
// Backward-compat: also accepts the legacy single ?categoryId=N param.
export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(request.url)
  const streakParam = searchParams.get('streak')
  const streak = streakParam !== null ? parseInt(streakParam, 10) : 0
  const parsedStreak = isNaN(streak) || streak < 0 ? 0 : streak

  // Parse optional customCategory param.
  const customCategoryParam = searchParams.get('customCategory')
  const customCategory = customCategoryParam && customCategoryParam.trim().length >= 3
    ? customCategoryParam.trim()
    : null

  // Parse optional categoryIds (comma-separated). Legacy single
  // ?categoryId= is honored too. Ignored when customCategory is set.
  const categoryIdsParam = searchParams.get('categoryIds')
  const legacyCategoryIdParam = searchParams.get('categoryId')
  const rawIds = !customCategory && categoryIdsParam !== null
    ? categoryIdsParam.split(',')
    : !customCategory && legacyCategoryIdParam !== null
      ? [legacyCategoryIdParam]
      : []
  const categoryIds = rawIds
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n) && n in CATEGORY_META)

  try {
    // Custom category runs always generate fresh questions — no pre-existing
    // question pool exists for arbitrary topics.
    let question = customCategory ? null : await sampleNextQuestion({
      uid: auth.claims.uid,
      streak: parsedStreak,
      type: 'free-text',
      categoryIds,
    })

    if (question === null) {
      // Pool exhausted for this player — generate a fresh question on demand,
      // gated by a per-uid rate limit so a single client can't burn the
      // OpenAI budget by hammering /next.
      const { limited, remaining } = await checkAndIncrementGenerationLimit(auth.claims.uid)
      if (limited) {
        console.warn('[trivia/infinite/next] 429 rate limit hit', {
          uid: auth.claims.uid,
          remaining,
          limitWindowMs: WINDOW_MS,
          maxPerWindow: MAX_GENERATIONS_PER_WINDOW,
        })
        return NextResponse.json(
          { error: 'Generation rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }

      try {
        const genOptions: Parameters<typeof generateInfiniteQuestion>[0] = { streak: parsedStreak }
        if (customCategory) {
          genOptions.customCategory = customCategory
        } else {
          // For multi-category runs, pick a random selected category to
          // generate within. (Single-category runs reuse the same id.)
          genOptions.categoryId = categoryIds.length > 0
            ? categoryIds[Math.floor(Math.random() * categoryIds.length)]
            : undefined
        }
        const generated = await generateInfiniteQuestion(genOptions)
        question = await saveAIQuestion(generated)
      } catch (genErr) {
        console.error('[trivia/infinite/next] generation failed', {
          uid: auth.claims.uid,
          streak: parsedStreak,
          requestedCategoryIds: categoryIds,
          customCategory,
          rateRemaining: remaining,
          error: genErr instanceof Error ? genErr.message : String(genErr),
          stack: genErr instanceof Error ? genErr.stack : undefined,
        })
        await trackExhaustion(auth.claims.uid)
        return new NextResponse(null, { status: 204 })
      }
    }

    // Strip correctAnswer before sending to client. Also strip `seed` —
    // it often contains the answer word verbatim (e.g. seed
    // "phoenix :: random" → answer "Phoenix"), so shipping it would leak
    // the answer to the client. seed is server-only diagnostic data.
    // The non-null assertion is safe: either the sampler returned a
    // question, or the inner try assigned one (catch branch returns
    // early).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { correctAnswer, seed, ...safeQuestion }: AIQuestion = question!

    // Background top-up: keep the player ahead of pool exhaustion by
    // pre-generating one question per /next when their unanswered
    // pool drops below the target. Runs after the response is sent.
    after(() => warmQuestionPoolForUser(auth.claims.uid))

    return NextResponse.json(safeQuestion)
  } catch (err) {
    console.error('Failed to sample next infinite trivia question:', err)
    return NextResponse.json({ error: 'Failed to fetch question.' }, { status: 500 })
  }
}
