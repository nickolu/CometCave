import { type NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

import { getStorageBucket } from '@/lib/firebase/server'

const VALID_RATINGS = ['up', 'down'] as const

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { questionId, rating, date, question, correctAnswer, userAnswer, wasCorrect, difficulty, category } = body

  if (!questionId || typeof questionId !== 'string') {
    return NextResponse.json({ error: 'questionId is required.' }, { status: 400 })
  }
  if (!VALID_RATINGS.includes(rating as typeof VALID_RATINGS[number])) {
    return NextResponse.json({ error: 'rating must be "up" or "down".' }, { status: 400 })
  }
  if (!date || typeof date !== 'string') {
    return NextResponse.json({ error: 'date is required.' }, { status: 400 })
  }

  const ratingData = {
    date,
    questionId,
    question: question ?? '',
    correctAnswer: correctAnswer ?? '',
    userAnswer: userAnswer ?? '',
    wasCorrect: !!wasCorrect,
    rating,
    difficulty: difficulty ?? 'unknown',
    category: category ?? 'unknown',
    timestamp: new Date().toISOString(),
  }

  try {
    const bucket = getStorageBucket()
    const suffix = randomBytes(2).toString('hex')
    const filename = `trivia-ratings/${date}/rating-${Date.now()}-${suffix}.json`
    await bucket.file(filename).save(JSON.stringify(ratingData, null, 2), {
      contentType: 'application/json',
    })
    return NextResponse.json({ stored: true })
  } catch (err) {
    console.error('Failed to store rating:', err)
    // Don't fail the user experience — return success anyway
    // The rating data is best-effort for training purposes
    return NextResponse.json({ stored: false })
  }
}
