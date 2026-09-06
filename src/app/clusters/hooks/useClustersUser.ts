'use client'

import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  type ClustersProfile,
  EMPTY_PROFILE,
  type SessionStatus,
} from '@/app/clusters/models/clusters'
import { useAuth } from '@/hooks/useAuth'
import { normalizeProfile } from '@/lib/clusters/profile'
import { getFirebaseFirestore } from '@/lib/firebase/client'
import { saveNickname } from '@/lib/users/nickname'

export interface ClustersGameRecord {
  date: string
  puzzleNumber: number
  status: SessionStatus
  mistakes: number
  purpleFirst: boolean
}

export interface UseClustersUserResult {
  loading: boolean
  isLoggedIn: boolean
  isAnonymous: boolean
  nickname: string
  displayName: string
  /** A name is required before the first guess, but never an account. */
  needsNickname: boolean
  profile: ClustersProfile
  history: ClustersGameRecord[]
  setNickname: (raw: string) => Promise<void>
}

export function useClustersUser(): UseClustersUserResult {
  const { user, loading: authLoading } = useAuth()
  const [nickname, setNicknameState] = useState('')
  const [profile, setProfile] = useState<ClustersProfile>(EMPTY_PROFILE)
  const [history, setHistory] = useState<ClustersGameRecord[]>([])
  // Which uid the state below actually belongs to. Tracking this instead of
  // clearing state on sign-out keeps every write inside a subscription
  // callback, and means a uid switch can never show the old user's stats.
  const [loadedUid, setLoadedUid] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return

    const uid = user.uid
    const db = getFirebaseFirestore()

    const unsubUser = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const data = snap.data() as { nickname?: string } | undefined
        setNicknameState(data?.nickname ?? '')
        setLoadedUid(snap.ref.id)
      },
      (err) => {
        console.error('user doc subscription error:', err)
        setLoadedUid(uid)
      }
    )

    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid, 'clustersProfile', 'current'),
      (snap) => setProfile(normalizeProfile(snap.data() as Partial<ClustersProfile> | undefined)),
      (err) => console.error('clustersProfile subscription error:', err)
    )

    const unsubGames = onSnapshot(
      query(
        collection(db, 'users', user.uid, 'clustersGames'),
        orderBy('date', 'desc'),
        limit(30)
      ),
      (snap) =>
        setHistory(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              date: typeof data.date === 'string' ? data.date : d.id,
              puzzleNumber: typeof data.puzzleNumber === 'number' ? data.puzzleNumber : 0,
              status: data.status === 'lost' ? 'lost' : 'won',
              mistakes: typeof data.mistakes === 'number' ? data.mistakes : 0,
              purpleFirst: data.purpleFirst === true,
            }
          })
        ),
      (err) => console.error('clustersGames subscription error:', err)
    )

    return () => {
      unsubUser()
      unsubProfile()
      unsubGames()
    }
  }, [authLoading, user])

  const setNickname = useCallback(
    async (raw: string) => {
      if (!user) return
      await saveNickname(user, raw)
    },
    [user]
  )

  // Anything loaded for a different uid is not this user's, so it reads as
  // empty rather than briefly showing someone else's streak.
  const fresh = !!user && loadedUid === user.uid
  const loading = authLoading || (!!user && !fresh)

  return useMemo(
    () => ({
      loading,
      isLoggedIn: !!user,
      isAnonymous: user?.isAnonymous ?? true,
      nickname: fresh ? nickname : '',
      displayName: (fresh && nickname) || user?.displayName || user?.email || '',
      needsNickname: fresh && !nickname,
      profile: fresh ? profile : EMPTY_PROFILE,
      history: fresh ? history : [],
      setNickname,
    }),
    [loading, fresh, user, nickname, profile, history, setNickname]
  )
}
