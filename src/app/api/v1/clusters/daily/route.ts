import { type NextRequest, NextResponse } from 'next/server'

import type { DailyResponse } from '@/app/clusters/models/clusters'
import { verifyRequestAuth } from '@/lib/api/auth'
import { resolvePlayDate } from '@/lib/clusters/dateMap'
import { getPuzzle } from '@/lib/clusters/puzzleDb'
import { readSession, toClientState } from '@/lib/clusters/session'
import { getTodayPST } from '@/lib/dates'

/**
 * The board, and the player's run on it so far.
 *
 * Returns sixteen words and nothing else: no groups, no titles, no tiers.
 * The solution appears only once the run is over — that is the whole point
 * of checking guesses on the server, so do not "helpfully" add it here.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  const today = getTodayPST()
  const resolved = resolvePlayDate(request.nextUrl.searchParams.get('date'), today)
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }
  const date = resolved.date

  try {
    const puzzle = await getPuzzle(date)
    if (!puzzle) {
      return NextResponse.json({ error: 'No puzzle for this day.' }, { status: 404 })
    }

    const session = await readSession(auth.claims.uid, date)
    const finished = session != null && session.status !== 'in_progress'

    const body: DailyResponse = {
      date,
      puzzleNumber: puzzle.puzzleNumber,
      words: puzzle.layout,
      state: session ? toClientState(session) : null,
      playable: !finished,
      ...(finished ? { solution: puzzle.groups } : {}),
      ...(puzzle.source?.editor ? { editor: puzzle.source.editor } : {}),
      ...(puzzle.source?.date ? { sourceDate: puzzle.source.date } : {}),
    }
    return NextResponse.json(body)
  } catch (err) {
    console.error('Failed to load Clusters puzzle:', err)
    return NextResponse.json({ error: 'Could not load the puzzle.' }, { status: 500 })
  }
}
