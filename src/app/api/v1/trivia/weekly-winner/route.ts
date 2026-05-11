import { NextResponse } from 'next/server'

import { ensureCrownsAwarded } from '@/lib/trivia/crowns'
import { getFirestoreDb } from '@/lib/firebase/server'
import { getTodayPST, getWeekKey } from '@/lib/dates'

function getPreviousWeekKey(): string {
  const today = getTodayPST()
  const d = new Date(today + 'T12:00:00')
  d.setDate(d.getDate() - 7)
  return getWeekKey(d.toISOString().slice(0, 10))
}

export async function GET() {
  try {
    await ensureCrownsAwarded()

    const previousWeekKey = getPreviousWeekKey()
    const db = getFirestoreDb()
    const crownSnap = await db.doc(`weeklyCrowns/${previousWeekKey}`).get()

    if (!crownSnap.exists) {
      return NextResponse.json({ weekKey: null, podium: [] })
    }

    const data = crownSnap.data()!
    return NextResponse.json({
      weekKey: previousWeekKey,
      podium: data.podium ?? [],
    })
  } catch (err) {
    console.error('Failed to fetch weekly winner:', err)
    return NextResponse.json(
      { error: 'Failed to fetch weekly winner' },
      { status: 500 }
    )
  }
}
