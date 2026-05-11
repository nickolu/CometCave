import { NextResponse } from 'next/server'

import { ensureCrownsAwarded } from '@/lib/trivia/crowns'

export async function GET() {
  try {
    const crowns = await ensureCrownsAwarded()

    const winners = crowns
      .filter((c) => c.podium && c.podium.length > 0)
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
      .map((c) => ({
        weekKey: c.weekKey,
        podium: c.podium,
      }))

    return NextResponse.json({ winners })
  } catch (err) {
    console.error('Failed to fetch weekly winners:', err)
    return NextResponse.json(
      { error: 'Failed to fetch weekly winners' },
      { status: 500 }
    )
  }
}
