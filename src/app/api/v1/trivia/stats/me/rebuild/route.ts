import { type NextRequest, NextResponse } from 'next/server'
import { verifyRequestAuth } from '@/lib/api/auth'
import { rebuildAggregateStats } from '@/lib/trivia/triviaStats'

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  try {
    await rebuildAggregateStats(auth.claims.uid)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Failed to rebuild stats:', err)
    return NextResponse.json({ error: 'Failed to rebuild stats.' }, { status: 500 })
  }
}
