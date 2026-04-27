import { type NextRequest, NextResponse } from 'next/server'

import { getFirebaseAuthAdmin } from '@/app/trivia/lib/firebase'
import { submitScore } from '@/app/trivia/lib/leaderboardStore'
import { getTodayPST } from '@/app/trivia/lib/triviaUtils'

const MAX_SCORE = 3150
const MAX_NAME_LENGTH = 20

function deriveDisplayName(token: { name?: string; email?: string }): string | null {
  const candidate = (token.name ?? token.email ?? '').trim()
  if (!candidate) return null
  return candidate.slice(0, MAX_NAME_LENGTH)
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization')
    const match = authHeader?.match(/^Bearer\s+(.+)$/i)
    if (!match) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const idToken = match[1]

    let decoded: { uid: string; name?: string; email?: string }
    try {
      decoded = await getFirebaseAuthAdmin().verifyIdToken(idToken)
    } catch {
      return NextResponse.json({ error: 'Invalid auth token.' }, { status: 401 })
    }

    const displayName = deriveDisplayName(decoded)
    if (!displayName) {
      return NextResponse.json(
        { error: 'Account is missing a display name. Update your profile and try again.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { date, score, correct, total } = body

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
      return NextResponse.json({ error: 'Can only submit scores for today.' }, { status: 400 })
    }

    const result = await submitScore({
      displayName,
      date,
      score,
      correct,
      total,
      submittedAt: Date.now(),
    })

    return NextResponse.json({
      stored: result.stored,
      previousScore: result.previous?.score ?? null,
      displayName,
    })
  } catch (error: unknown) {
    console.error('Error submitting score:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes('FAILED_PRECONDITION') || errMsg.includes('index')) {
      return NextResponse.json({
        stored: false,
        previousScore: null,
        notice: 'Leaderboard is initializing.',
      })
    }
    return NextResponse.json({ error: 'Failed to submit score.' }, { status: 500 })
  }
}
