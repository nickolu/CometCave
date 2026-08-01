import { FieldValue } from 'firebase-admin/firestore'
import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import { isOwnerEmail } from '@/lib/auth/owner'
import { getFirestoreDb } from '@/lib/firebase/server'

type ValidationStatus = 'validated' | 'failed'
type ValidationKind = 'joker' | 'voucher' | 'tag' | 'bossBlind'

interface ValidationState {
  joker: Record<string, ValidationStatus>
  voucher: Record<string, ValidationStatus>
  tag: Record<string, ValidationStatus>
  bossBlind: Record<string, ValidationStatus>
}

const KINDS: ValidationKind[] = ['joker', 'voucher', 'tag', 'bossBlind']
const STATUSES: ValidationStatus[] = ['validated', 'failed']
const EMPTY: ValidationState = { joker: {}, voucher: {}, tag: {}, bossBlind: {} }

function docPath(uid: string) {
  return `users/${uid}/cometCardsSandbox/validations`
}

function sanitize(raw: unknown): ValidationState {
  const out: ValidationState = { joker: {}, voucher: {}, tag: {}, bossBlind: {} }
  if (!raw || typeof raw !== 'object') return out
  const obj = raw as Record<string, unknown>
  for (const kind of KINDS) {
    const entries = obj[kind]
    if (!entries || typeof entries !== 'object') continue
    for (const [id, status] of Object.entries(entries as Record<string, unknown>)) {
      if (typeof id !== 'string' || id.length === 0 || id.length > 200) continue
      if (typeof status !== 'string' || !STATUSES.includes(status as ValidationStatus)) continue
      out[kind][id] = status as ValidationStatus
    }
  }
  return out
}

async function authorize(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return { error: auth.error }
  if (!isOwnerEmail(auth.claims.email)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }
  return { uid: auth.claims.uid }
}

export async function GET(request: NextRequest) {
  const res = await authorize(request)
  if ('error' in res) return res.error

  const db = getFirestoreDb()
  const snap = await db.doc(docPath(res.uid)).get()
  const state = snap.exists ? sanitize(snap.data()?.state) : EMPTY
  return NextResponse.json({ state }, { status: 200 })
}

export async function PUT(request: NextRequest) {
  const res = await authorize(request)
  if ('error' in res) return res.error

  let body: { state?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  if (!body.state || typeof body.state !== 'object' || Array.isArray(body.state)) {
    return NextResponse.json({ error: 'state must be a non-null object' }, { status: 400 })
  }

  const state = sanitize(body.state)
  const db = getFirestoreDb()
  await db.doc(docPath(res.uid)).set(
    { state, updatedAt: FieldValue.serverTimestamp() },
    { merge: false }
  )
  return NextResponse.json({ state }, { status: 200 })
}
