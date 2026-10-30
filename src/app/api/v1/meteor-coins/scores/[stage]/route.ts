/**
 * One stage's board: its listed players, best first, plus the player count.
 * Public. With a bearer token, also returns the caller's own standing.
 */
import { type NextRequest, NextResponse } from 'next/server'

import { playableStage } from '@/app/meteor-coins/lib/stages'
import { verifyRequestAuth } from '@/lib/api/auth'
import { loadBoard } from '@/lib/meteor-coins/score-store'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stage: string }> }
) {
  const stage = playableStage((await params).stage)
  if (!stage) return NextResponse.json({ error: 'No such stage.' }, { status: 404 })

  let claims = null
  if (request.headers.get('authorization')) {
    const auth = await verifyRequestAuth(request)
    if ('error' in auth) return auth.error
    claims = auth.claims
  }

  try {
    return NextResponse.json(await loadBoard(stage.slug, claims))
  } catch (error) {
    console.error('meteor-coins board load failed:', error)
    return NextResponse.json({ error: 'Could not load the scores.' }, { status: 500 })
  }
}
