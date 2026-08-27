/**
 * Badge Run daily leaderboard.
 *
 * GET  ?date=YYYY-MM-DD    public — no auth required
 *
 * Returns the top-100 entries for the requested day (or today if omitted).
 * Leaderboard entries contain no PII beyond display names — any player can
 * see any day's board.
 */
import { type NextRequest, NextResponse } from 'next/server'

import { runDateKey } from '@/app/badge-run/domain/run-record'
import { loadLeaderboard } from '@/lib/badge-run/run-store'

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get('date')
  const date = dateParam ?? runDateKey(new Date())

  // Basic date format sanity check (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
  }

  try {
    const leaderboard = await loadLeaderboard(date)
    return NextResponse.json(leaderboard)
  } catch (error) {
    console.error('badge-run leaderboard load failed:', error)
    return NextResponse.json({ error: 'Could not load the leaderboard.' }, { status: 500 })
  }
}
