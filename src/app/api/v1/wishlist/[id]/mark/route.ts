/**
 * Mark an item bought, or unmark it.
 *
 * Body: `{ key: "Shopper/itemId", bought: true | false, by?: "Grandma" }`.
 * Answers with the list's current marks so the page can settle on the truth.
 * The key must name an item on the list and `by` is capped, so the open route
 * cannot be used as free storage; the worst a stranger with the link can do is
 * flip a mark the family can flip back.
 */
import { type NextRequest, NextResponse } from 'next/server'

import {
  applyMark,
  isValidListId,
  loadMarks,
  loadWishlist,
  parseMarkRequest,
} from '@/lib/wishlist/store'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isValidListId(id)) return NextResponse.json({ error: 'No such list.' }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  try {
    const list = await loadWishlist(id)
    if (!list) return NextResponse.json({ error: 'No such list.' }, { status: 404 })
    const parsed = parseMarkRequest(body, list)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    await applyMark(id, parsed.mark)
    return NextResponse.json(
      { marks: await loadMarks(id) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('wishlist mark failed:', error)
    return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 500 })
  }
}
