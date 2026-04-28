import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import {
  NicknameInUseError,
  sanitizeNickname,
  setNickname,
} from '@/lib/users/profile'

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  let body: { nickname?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.nickname !== 'string') {
    return NextResponse.json({ error: 'nickname must be a string.' }, { status: 400 })
  }

  const clean = sanitizeNickname(body.nickname)
  if (!clean) {
    return NextResponse.json({ error: 'Nickname cannot be empty.' }, { status: 400 })
  }

  try {
    const result = await setNickname(auth.claims.uid, clean)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof NicknameInUseError) {
      return NextResponse.json({ error: 'That nickname is taken.' }, { status: 409 })
    }
    console.error('Failed to set nickname:', err)
    return NextResponse.json({ error: 'Failed to set nickname.' }, { status: 500 })
  }
}
