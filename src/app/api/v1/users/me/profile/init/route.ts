import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import { getOrCreateProfile } from '@/lib/users/profile'

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  try {
    const profile = await getOrCreateProfile(auth.claims)
    return NextResponse.json({
      uid: profile.uid,
      nickname: profile.nickname,
      authDisplayName: profile.authDisplayName,
      email: profile.email,
      photoURL: profile.photoURL,
    })
  } catch (err) {
    console.error('Failed to init profile:', err)
    return NextResponse.json({ error: 'Failed to initialize profile.' }, { status: 500 })
  }
}
