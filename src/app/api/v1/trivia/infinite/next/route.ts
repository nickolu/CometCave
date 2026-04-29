import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import type { AIQuestion } from '@/lib/trivia/aiQuestions'
import { saveAIQuestion } from '@/lib/trivia/aiQuestions'
import { generateInfiniteQuestion } from '@/lib/trivia/generateQuestion'
import { checkAndIncrementGenerationLimit } from '@/lib/trivia/generationLimit'
import { sampleNextQuestion } from '@/lib/trivia/sampler'
import { trackExhaustion } from '@/lib/trivia/triviaStats'
import { CATEGORY_META } from '@/lib/trivia/categories'

// GET /api/v1/trivia/infinite/next?streak=N&categoryId=N
export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(request.url)
  const streakParam = searchParams.get('streak')
  const streak = streakParam !== null ? parseInt(streakParam, 10) : 0
  const parsedStreak = isNaN(streak) || streak < 0 ? 0 : streak

  // Parse optional categoryId
  let categoryId: number | undefined
  const categoryIdParam = searchParams.get('categoryId')
  if (categoryIdParam !== null) {
    const parsed = parseInt(categoryIdParam, 10)
    if (!isNaN(parsed) && parsed in CATEGORY_META) {
      categoryId = parsed
    }
  }

  try {
    let question = await sampleNextQuestion({
      uid: auth.claims.uid,
      streak: parsedStreak,
      type: 'free-text',
      categoryId,
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
          limitWindowMs: 60 * 60 * 1000,
          maxPerWindow: 30,
        })
        return NextResponse.json(
          { error: 'Generation rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }

      try {
        const generated = await generateInfiniteQuestion({ streak: parsedStreak, categoryId })
        await saveAIQuestion(generated)
        question = {
          ...generated,
          status: 'active',
          timesShown: 0,
          timesCorrect: 0,
          flaggedCount: 0,
          avgTimeMs: null,
        }
      } catch (genErr) {
        console.error('On-demand question generation failed:', genErr)
        await trackExhaustion(auth.claims.uid)
        return new NextResponse(null, { status: 204 })
      }
    }

    // Strip correctAnswer before sending to client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { correctAnswer, ...safeQuestion }: AIQuestion = question

    return NextResponse.json(safeQuestion)
  } catch (err) {
    console.error('Failed to sample next infinite trivia question:', err)
    return NextResponse.json({ error: 'Failed to fetch question.' }, { status: 500 })
  }
}
