import { type NextRequest, NextResponse } from 'next/server'
import { verifyRequestAuth } from '@/lib/api/auth'
import { getOrCreateProfile } from '@/lib/users/profile'
import { getLeaderboard, saveGlobalSpeedRun } from '@/lib/micro-land/speed-run-store'

export async function GET(request: NextRequest) {
  const targetGen = Number(request.nextUrl.searchParams.get('targetGen'))
  const limit = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? '10')))
  if (!Number.isFinite(targetGen) || targetGen <= 0) {
    return NextResponse.json({ error: 'targetGen is required.' }, { status: 400 })
  }
  try {
    const entries = await getLeaderboard(targetGen, limit)
    return NextResponse.json({ targetGen, entries })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('FAILED_PRECONDITION') || msg.includes('requires an index')) {
      return NextResponse.json({ targetGen, entries: [], notice: 'Leaderboard index is building.' })
    }
    console.error('speed-run leaderboard failed:', error)
    return NextResponse.json({ error: 'Could not fetch leaderboard.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error
  if (auth.claims.isAnonymous) {
    return NextResponse.json({ error: 'Sign in to appear on the leaderboard.' }, { status: 403 })
  }
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  if (typeof body !== 'object' || body === null) return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  const { targetGen, theme, seconds } = body as Record<string, unknown>
  if (typeof targetGen !== 'number' || typeof theme !== 'string' || typeof seconds !== 'number') {
    return NextResponse.json({ error: 'targetGen, theme, seconds required.' }, { status: 400 })
  }
  try {
    const profile = await getOrCreateProfile(auth.claims)
    const displayName = profile.nickname || 'Explorer'
    await saveGlobalSpeedRun({ uid: auth.claims.uid, displayName, theme, targetGen, seconds })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('speed-run save failed:', error)
    return NextResponse.json({ error: 'Could not save run.' }, { status: 500 })
  }
}
