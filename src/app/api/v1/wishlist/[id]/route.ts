/**
 * One family wish list with its bought marks.
 *
 * Unauthenticated on purpose: the list id in the path is the secret, carried
 * only in the link Nick shares. See `src/lib/wishlist/store.ts`.
 */
import { NextResponse } from 'next/server'

import { isValidListId, loadWishlistView } from '@/lib/wishlist/store'

/** The whole point is the latest marks, never a build-time snapshot. */
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isValidListId(id)) return NextResponse.json({ error: 'No such list.' }, { status: 404 })
  try {
    const view = await loadWishlistView(id)
    if (!view) return NextResponse.json({ error: 'No such list.' }, { status: 404 })
    return NextResponse.json(view, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('wishlist read failed:', error)
    return NextResponse.json({ error: 'Could not load the list.' }, { status: 500 })
  }
}
