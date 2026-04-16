import { type NextRequest, NextResponse } from 'next/server'
import { getTodayPST } from '@/app/trivia/lib/triviaUtils'
import { submitScore } from '@/app/trivia/lib/leaderboardStore'

const MAX_SCORE = 3000
const MAX_NAME_LENGTH = 20

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { displayName, date, score, correct, total } = body

    // Validation
    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json({ error: 'displayName is required.' }, { status: 400 })
    }
    const trimmedName = displayName.trim()
    if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `displayName must be 1-${MAX_NAME_LENGTH} characters.` },
        { status: 400 }
      )
    }

    if (typeof score !== 'number' || score < 0 || score > MAX_SCORE) {
      return NextResponse.json(
        { error: `score must be a number between 0 and ${MAX_SCORE}.` },
        { status: 400 }
      )
    }

    if (typeof correct !== 'number' || typeof total !== 'number') {
      return NextResponse.json({ error: 'correct and total must be numbers.' }, { status: 400 })
    }

    if (date !== getTodayPST()) {
      return NextResponse.json(
        { error: 'Can only submit scores for today.' },
        { status: 400 }
      )
    }

    const result = submitScore({
      displayName: trimmedName,
      date,
      score,
      correct,
      total,
      submittedAt: Date.now(),
    })

    return NextResponse.json({
      stored: result.stored,
      previousScore: result.previous?.score ?? null,
    })
  } catch (error) {
    console.error('Error submitting score:', error)
    return NextResponse.json({ error: 'Failed to submit score.' }, { status: 500 })
  }
}
