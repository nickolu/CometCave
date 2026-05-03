import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import {
  type DailyResetResult,
  type InfiniteResetResult,
  resetDailyStats,
  resetInfiniteStats,
} from '@/lib/trivia/resetStats'

interface Body {
  daily?: boolean
  infinite?: boolean
}

interface ResponsePayload {
  daily?: DailyResetResult
  infinite?: InfiniteResetResult
  partialFailure?: { scope: 'daily' | 'infinite'; message: string }
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const wantDaily = body?.daily === true
  const wantInfinite = body?.infinite === true
  if (!wantDaily && !wantInfinite) {
    return NextResponse.json({ error: 'Nothing to reset.' }, { status: 400 })
  }

  const payload: ResponsePayload = {}

  if (wantDaily) {
    try {
      payload.daily = await resetDailyStats(auth.claims.uid)
    } catch (err) {
      console.error('resetDailyStats failed:', err)
      payload.partialFailure = { scope: 'daily', message: 'Failed to reset daily stats.' }
      return NextResponse.json(payload, { status: 500 })
    }
  }

  if (wantInfinite) {
    try {
      payload.infinite = await resetInfiniteStats(auth.claims.uid)
    } catch (err) {
      console.error('resetInfiniteStats failed:', err)
      payload.partialFailure = { scope: 'infinite', message: 'Failed to reset infinite stats.' }
      return NextResponse.json(payload, { status: 500 })
    }
  }

  return NextResponse.json(payload)
}
