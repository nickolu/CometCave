/**
 * Badge Run run records.
 *
 * GET  ?date=YYYY-MM-DD           load caller's run for the date (or today)
 * POST { record: RunRecord }      save a completed run (auth required)
 *
 * Anonymous players are supported — `useAuth` mints an anonymous uid on
 * arrival, so a run written before sign-up carries the same uid afterward.
 */
import { type NextRequest, NextResponse } from 'next/server'

import { validateRunRecord, runDateKey, runDocId } from '@/app/badge-run/domain/run-record'
import { verifyRequestAuth } from '@/lib/api/auth'
import { loadRunRecord, saveRunRecord } from '@/lib/badge-run/run-store'

export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  const dateParam = request.nextUrl.searchParams.get('date')
  const date = dateParam ?? runDateKey(new Date())

  try {
    const record = await loadRunRecord(date, auth.claims.uid)
    return NextResponse.json({ record })
  } catch (error) {
    console.error('badge-run run load failed:', error)
    return NextResponse.json({ error: 'Could not load your run.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  let body: { record?: unknown }
  try {
    body = (await request.json()) as { record?: unknown }
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const record = validateRunRecord(body.record)
  if (!record) {
    return NextResponse.json({ error: 'Invalid run record.' }, { status: 400 })
  }

  // Enforce: the caller can only write their own uid
  if (record.uid !== auth.claims.uid) {
    return NextResponse.json({ error: 'uid mismatch.' }, { status: 403 })
  }

  // Enforce: document ID must match uid + date
  const expectedId = runDocId(record.date, record.uid)
  if (record.id !== expectedId) {
    record.id = expectedId
  }

  try {
    await saveRunRecord(record)
    return NextResponse.json({ ok: true, id: record.id })
  } catch (error) {
    console.error('badge-run run save failed:', error)
    return NextResponse.json({ error: 'Could not save your run.' }, { status: 500 })
  }
}
