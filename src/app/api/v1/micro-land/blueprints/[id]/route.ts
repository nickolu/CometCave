import { type NextRequest, NextResponse } from 'next/server'
import { getSharedBlueprint } from '@/lib/micro-land/blueprint-store'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })
  try {
    const shared = await getSharedBlueprint(id)
    if (!shared) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    return NextResponse.json({ shared })
  } catch (error) {
    console.error('blueprint fetch failed:', error)
    return NextResponse.json({ error: 'Could not fetch blueprint.' }, { status: 500 })
  }
}
