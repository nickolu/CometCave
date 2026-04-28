import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import { sampleNextQuestion } from '@/lib/trivia/sampler'
import type { AIQuestion } from '@/lib/trivia/aiQuestions'
import { trackExhaustion } from '@/lib/trivia/triviaStats'

// GET /api/v1/trivia/infinite/next?streak=N
export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(request.url)
  const streakParam = searchParams.get('streak')
  const streak = streakParam !== null ? parseInt(streakParam, 10) : 0
  const parsedStreak = isNaN(streak) || streak < 0 ? 0 : streak

  try {
    const question = await sampleNextQuestion({
      uid: auth.claims.uid,
      streak: parsedStreak,
      type: 'free-text',
    })

    if (question === null) {
      // Library exhausted — no unseen questions remain
      await trackExhaustion(auth.claims.uid)
      return new NextResponse(null, { status: 204 })
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
