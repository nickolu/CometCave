import { type NextRequest, NextResponse } from 'next/server'

import { getFirebaseAuthAdmin } from '@/lib/firebase/server'
import type { AuthClaims } from '@/lib/users/profile'

export async function verifyRequestAuth(
  request: NextRequest
): Promise<{ claims: AuthClaims } | { error: NextResponse }> {
  const authHeader =
    request.headers.get('authorization') ?? request.headers.get('Authorization')
  const match = authHeader?.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  }
  try {
    const decoded = await getFirebaseAuthAdmin().verifyIdToken(match[1])
    return {
      claims: {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      },
    }
  } catch {
    return { error: NextResponse.json({ error: 'Invalid auth token.' }, { status: 401 }) }
  }
}
