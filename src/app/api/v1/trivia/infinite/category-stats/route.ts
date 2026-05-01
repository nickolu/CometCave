import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import { getCategoryMedalsForUser } from '@/lib/trivia/categoryMedals'

export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  try {
    const medals = await getCategoryMedalsForUser(auth.claims.uid)
    return NextResponse.json({ medals })
  } catch (err) {
    console.error('Failed to fetch category medals:', err)
    return NextResponse.json({ error: 'Failed to fetch category medals.' }, { status: 500 })
  }
}
