/**
 * One saved world: read it, write it, throw it away.
 *
 * The id in the path is the one place a player-supplied string reaches a
 * Firestore document id, so it is checked against `isSaveId` before it is used
 * for anything — that rejects path separators, the reserved `__…__` form, and
 * anything long enough to be an attempt at something.
 *
 * PUT is a full replace rather than a merge. The client holds the authoritative
 * copy of a world in memory and sends all of it; merging here would splice a
 * creature the player's own client had already buried back into the population.
 */
import { type NextRequest, NextResponse } from 'next/server'

import {
  MAX_SAVED_WORLDS,
  MAX_WORLD_BYTES,
  isSaveId,
  validateWorldSave,
  worldSaveBytes,
} from '@/app/micro-land/worlds/wire'
import { verifyRequestAuth } from '@/lib/api/auth'
import { deleteWorld, loadWorld, saveWorld } from '@/lib/micro-land/world-store'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  if (!isSaveId(id)) return NextResponse.json({ error: 'No such world.' }, { status: 400 })

  try {
    const world = await loadWorld(auth.claims.uid, id)
    // Null is the ordinary answer for a world that has been deleted on another
    // device, which is a shelf that needs refreshing rather than an error.
    return NextResponse.json({ world })
  } catch (error) {
    console.error('micro-land world load failed:', error)
    return NextResponse.json({ error: 'Could not open that world.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  if (!isSaveId(id)) return NextResponse.json({ error: 'No such world.' }, { status: 400 })

  let body: { world?: unknown }
  try {
    body = (await request.json()) as { world?: unknown }
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const world = validateWorldSave(body.world)
  if (!world) {
    return NextResponse.json({ error: 'That is not a world.' }, { status: 400 })
  }
  // The document is addressed by the path; a body claiming a different id would
  // otherwise store a world under a name that disagrees with what is inside it.
  if (world.id !== id) {
    return NextResponse.json({ error: 'That world belongs somewhere else.' }, { status: 400 })
  }

  const bytes = worldSaveBytes(world)
  if (bytes > MAX_WORLD_BYTES) {
    return NextResponse.json({ error: 'That world is too large to keep.' }, { status: 413 })
  }

  try {
    const stored = await saveWorld(auth.claims.uid, world)
    if (!stored) {
      return NextResponse.json(
        { error: `A shelf holds ${MAX_SAVED_WORLDS} worlds. Let one go first.` },
        { status: 409 }
      )
    }
    return NextResponse.json({ ok: true, bytes })
  } catch (error) {
    console.error('micro-land world save failed:', error)
    return NextResponse.json({ error: 'Could not keep that world.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  if (!isSaveId(id)) return NextResponse.json({ error: 'No such world.' }, { status: 400 })

  try {
    await deleteWorld(auth.claims.uid, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('micro-land world delete failed:', error)
    return NextResponse.json({ error: 'Could not let go of that world.' }, { status: 500 })
  }
}
