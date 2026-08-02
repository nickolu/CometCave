/**
 * A player's Micro Land records.
 *
 * GET reads them, PUT replaces them, and both act on the caller's own uid taken
 * from the verified token — there is no uid in the path or the body, so one
 * player cannot address another's document at all.
 *
 * Anonymous callers are first-class here, not tolerated. `useAuth` mints an
 * anonymous uid for everyone on arrival, so a child who has never signed up
 * still has somewhere to keep the creature they just drew, and signing up later
 * links the credential to that same uid and carries the records with it.
 */
import { type NextRequest, NextResponse } from 'next/server'

import {
  MAX_CHRONICLE_BYTES,
  chronicleBytes,
  validateChronicle,
} from '@/app/micro-land/chronicle/wire'
import { verifyRequestAuth } from '@/lib/api/auth'
import { loadChronicle, saveChronicle } from '@/lib/micro-land/chronicle-store'

export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  try {
    const chronicle = await loadChronicle(auth.claims.uid)
    // A player with no stored records is the ordinary first-visit case, not a
    // 404 — the client wants "nothing yet", which is what null already means.
    return NextResponse.json({ chronicle })
  } catch (error) {
    console.error('micro-land chronicle load failed:', error)
    return NextResponse.json({ error: 'Could not read your records.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  let body: { chronicle?: unknown }
  try {
    body = (await request.json()) as { chronicle?: unknown }
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const chronicle = validateChronicle(body.chronicle)
  if (!chronicle) {
    return NextResponse.json({ error: 'That is not a chronicle.' }, { status: 400 })
  }

  // The client trims to fit before sending. Anything still over the line is not
  // this game's client, so it is refused rather than trimmed for them.
  const bytes = chronicleBytes(chronicle)
  if (bytes > MAX_CHRONICLE_BYTES) {
    return NextResponse.json({ error: 'Those records are too large to store.' }, { status: 413 })
  }

  try {
    await saveChronicle(auth.claims.uid, chronicle)
    return NextResponse.json({ ok: true, bytes })
  } catch (error) {
    console.error('micro-land chronicle save failed:', error)
    return NextResponse.json({ error: 'Could not save your records.' }, { status: 500 })
  }
}
