/**
 * A player's shelf of saved worlds.
 *
 * Listing only. One world is read, written and deleted through `[id]/route.ts`.
 *
 * Like the chronicle route, this acts on the caller's own uid taken from the
 * verified token — there is no uid in the path or the body, so one player cannot
 * address another's shelf at all. Anonymous callers are first-class: `useAuth`
 * mints an anonymous uid for everyone on arrival, so a child who has never
 * signed up can still keep the world they made, and signing up later links the
 * credential to that same uid and brings the whole shelf with it.
 */
import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import { listWorlds } from '@/lib/micro-land/world-store'

export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  try {
    const worlds = await listWorlds(auth.claims.uid)
    return NextResponse.json({ worlds })
  } catch (error) {
    console.error('micro-land worlds list failed:', error)
    return NextResponse.json({ error: 'Could not read your worlds.' }, { status: 500 })
  }
}
