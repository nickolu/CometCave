import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import { getAggregateStats } from '@/lib/trivia/triviaStats'

export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  try {
    const stats = await getAggregateStats(auth.claims.uid)
    return NextResponse.json(stats)
  } catch (err) {
    console.error('Failed to fetch stats:', err)
    return NextResponse.json({ error: 'Failed to fetch stats.' }, { status: 500 })
  }
}
