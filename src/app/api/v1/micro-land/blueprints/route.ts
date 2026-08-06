import { type NextRequest, NextResponse } from 'next/server'
import { verifyRequestAuth } from '@/lib/api/auth'
import { getOrCreateProfile } from '@/lib/users/profile'
import { listRecentBlueprints, saveSharedBlueprint } from '@/lib/micro-land/blueprint-store'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

export async function GET() {
  try {
    const blueprints = await listRecentBlueprints(20)
    return NextResponse.json({ blueprints: blueprints.map(b => ({ ...b, blueprintJson: undefined })) })
  } catch (error) {
    console.error('blueprint list failed:', error)
    return NextResponse.json({ error: 'Could not list blueprints.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }
  const { blueprint } = body as Record<string, unknown>
  if (typeof blueprint !== 'object' || blueprint === null || typeof (blueprint as Record<string, unknown>).name !== 'string') {
    return NextResponse.json({ error: 'blueprint object with name is required.' }, { status: 400 })
  }

  try {
    const profile = await getOrCreateProfile(auth.claims)
    const nickname = profile.nickname || 'Explorer'
    const id = await saveSharedBlueprint(blueprint as CreatureBlueprint, nickname)
    return NextResponse.json({ id })
  } catch (error) {
    console.error('blueprint save failed:', error)
    return NextResponse.json({ error: 'Could not save blueprint.' }, { status: 500 })
  }
}
