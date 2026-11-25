/**
 * One product photo, served from Firestore.
 *
 * The page links to `?v=<hash>`, and a republished photo gets a new hash, so
 * the response can be cached for a long time by browsers and the CDN alike.
 */
import { NextResponse } from 'next/server'

import { isValidItemId, isValidListId, loadImage } from '@/lib/wishlist/store'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params
  if (!isValidListId(id) || !isValidItemId(itemId)) return new NextResponse(null, { status: 404 })
  try {
    const image = await loadImage(id, itemId)
    if (!image) return new NextResponse(null, { status: 404 })
    return new NextResponse(Buffer.from(image.data, 'base64'), {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${image.hash}"`,
      },
    })
  } catch (error) {
    console.error('wishlist image read failed:', error)
    return new NextResponse(null, { status: 500 })
  }
}
