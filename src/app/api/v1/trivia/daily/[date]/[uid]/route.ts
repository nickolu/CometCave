import { type NextRequest, NextResponse } from 'next/server'

import { getFirestoreDb } from '@/lib/firebase/server'

interface PageParams {
  params: Promise<{ date: string; uid: string }>
}

export async function GET(_request: NextRequest, { params }: PageParams) {
  const { date, uid } = await params

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }

  try {
    const db = getFirestoreDb()
    const snap = await db.doc(`users/${uid}/triviaGames/${date}`).get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    }

    const data = snap.data()!
    // Get nickname
    const userSnap = await db.doc(`users/${uid}`).get()
    const nickname = userSnap.exists ? (userSnap.data()?.nickname ?? '') : ''

    // Build emoji grid from answers (correct/incorrect only, no question content)
    const grid = Array.isArray(data.answers)
      ? data.answers.map((a: { correct: boolean }) => (a.correct ? '🟩' : '🟥')).join('')
      : ''

    return NextResponse.json({
      date: data.date,
      score: data.score,
      correct: data.correct,
      total: data.total,
      grid,
      category: data.category ?? null,
      nickname,
    })
  } catch (error) {
    console.error('Error fetching daily result:', error)
    return NextResponse.json({ error: 'Failed to fetch result' }, { status: 500 })
  }
}
