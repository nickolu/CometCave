import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import {
  getCategoryMedalsForUser,
  getCustomCategoryMedalsForUser,
} from '@/lib/trivia/categoryMedals'

export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  try {
    const [medals, customMedals] = await Promise.all([
      getCategoryMedalsForUser(auth.claims.uid),
      getCustomCategoryMedalsForUser(auth.claims.uid),
    ])
    return NextResponse.json({ medals, customMedals })
  } catch (err) {
    console.error('Failed to fetch category medals:', err)
    return NextResponse.json({ error: 'Failed to fetch category medals.' }, { status: 500 })
  }
}
