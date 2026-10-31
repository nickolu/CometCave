/**
 * Meteor Coins player scores.
 *
 * GET                               the caller's standing on every stage played
 * POST { results: ScoreResult[] }   save bests (any stages); an empty list only
 *                                   refreshes the caller's name on the boards
 *
 * Both need a token. Anonymous players have one (useAuth mints a uid on
 * arrival), so everyone is recorded; only signed-up players with a nickname
 * are listed on a board.
 */
import { type NextRequest, NextResponse } from 'next/server'

import { parseResults } from '@/app/meteor-coins/lib/scoreboard'
import { verifyRequestAuth } from '@/lib/api/auth'
import { loadMyScores, recordResults } from '@/lib/meteor-coins/score-store'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(await loadMyScores(auth.claims))
  } catch (error) {
    console.error('meteor-coins scores load failed:', error)
    return NextResponse.json({ error: 'Could not load your scores.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }
  const results = parseResults(body)
  if (!results) return NextResponse.json({ error: 'Invalid results.' }, { status: 400 })

  try {
    return NextResponse.json(await recordResults(auth.claims, results))
  } catch (error) {
    console.error('meteor-coins scores save failed:', error)
    return NextResponse.json({ error: 'Could not save your score.' }, { status: 500 })
  }
}
