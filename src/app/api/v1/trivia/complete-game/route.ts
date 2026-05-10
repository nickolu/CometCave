import { type NextRequest, NextResponse } from 'next/server'

import type { TriviaAnswer } from '@/app/trivia/models/trivia'
import { verifyRequestAuth } from '@/lib/api/auth'
import { getTodayPST } from '@/lib/dates'
import { recordCompletedGame } from '@/lib/trivia/transactions'


const MAX_SCORE = 1530

interface Body {
  date?: string
  score?: number
  correct?: number
  total?: number
  answers?: TriviaAnswer[]
  category?: { id: number; name: string; icon: string }
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { date, score, correct, total, answers, category } = body

  const today = getTodayPST()
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 })
  }
  if (date > today) {
    return NextResponse.json({ error: 'Cannot submit scores for a future date.' }, { status: 400 })
  }
  const isRetroactive = date !== today
  if (typeof score !== 'number' || score < 0 || score > MAX_SCORE) {
    return NextResponse.json(
      { error: `score must be a number between 0 and ${MAX_SCORE}.` },
      { status: 400 }
    )
  }
  if (typeof correct !== 'number' || typeof total !== 'number') {
    return NextResponse.json({ error: 'correct and total must be numbers.' }, { status: 400 })
  }
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: 'answers must be an array.' }, { status: 400 })
  }
  if (
    !category ||
    typeof category.id !== 'number' ||
    typeof category.name !== 'string' ||
    typeof category.icon !== 'string'
  ) {
    return NextResponse.json({ error: 'category is required.' }, { status: 400 })
  }

  try {
    const result = await recordCompletedGame(auth.claims, {
      uid: auth.claims.uid,
      date,
      score,
      correct,
      total,
      answers,
      category,
      isRetroactive,
    })
    return NextResponse.json(result, { status: result.alreadySubmitted ? 409 : 200 })
  } catch (err) {
    console.error('Failed to record completed game:', err)
    return NextResponse.json({ error: 'Failed to record game.' }, { status: 500 })
  }
}
