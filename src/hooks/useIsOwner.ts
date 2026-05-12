'use client'

import { isOwnerEmail } from '@/lib/auth/owner'

import { useAuth } from './useAuth'

export function useIsOwner(): { isOwner: boolean; loading: boolean } {
  const { user, loading } = useAuth()
  return { isOwner: isOwnerEmail(user?.email), loading }
}
