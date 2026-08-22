/**
 * Read and write the singing course progress.
 *
 * Deliberately unauthenticated: the page behind it is unlisted, has no account
 * attached, and exists so one child's check marks follow her between devices.
 * What keeps that safe is not a token but the narrowness of what can be stored
 * — `saveProgress` accepts only known item ids and real dates, so the route
 * cannot be used as free storage. See `progress-store.ts`.
 */
import { type NextRequest, NextResponse } from 'next/server'

import { isPlainObject, loadProgress, saveProgress } from '@/lib/voice-journey/progress-store'

/** Never serve a build-time snapshot — the whole point is the latest state. */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await loadProgress())
  } catch (error) {
    console.error('voice-journey progress read failed:', error)
    return NextResponse.json({ error: 'Could not read your progress.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  // A body that is not an object is a bug or a poke at the endpoint, never a
  // real "she unchecked everything" — sanitizing it would silently wipe the
  // course, so it is refused instead.
  if (!isPlainObject(body)) {
    return NextResponse.json({ error: 'Expected a progress object.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await saveProgress(body))
  } catch (error) {
    console.error('voice-journey progress write failed:', error)
    return NextResponse.json({ error: 'Could not save your progress.' }, { status: 500 })
  }
}

/**
 * The same write, for `navigator.sendBeacon`.
 *
 * A tab closing mid-flush is exactly when a check mark is most likely to be
 * lost, and a beacon is the only request the browser promises to finish — but
 * it can only ever be a POST.
 */
export const POST = PUT
