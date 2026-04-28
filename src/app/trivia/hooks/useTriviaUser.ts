'use client'

import {
  type DocumentData,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { TriviaGameResult } from '@/app/trivia/models/trivia'
import { useAuth } from '@/hooks/useAuth'
import { hasPlayedToday } from '@/lib/dates'
import { getFirebaseFirestore } from '@/lib/firebase/client'

export interface TriviaStats {
  gamesPlayed: number
  totalScore: number
  totalCorrect: number
  totalQuestions: number
  currentStreak: number
  bestStreak: number
  lastPlayedDate: string | null
}

const EMPTY_STATS: TriviaStats = {
  gamesPlayed: 0,
  totalScore: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPlayedDate: null,
}

export const NICKNAME_MAX_LENGTH = 20

export function sanitizeNickname(raw: string): string {
  return raw.trim().slice(0, NICKNAME_MAX_LENGTH)
}

export class NicknameInUseError extends Error {
  constructor() {
    super('Nickname is already taken')
    this.name = 'NicknameInUseError'
  }
}

function normalizeStats(data: DocumentData | undefined): TriviaStats {
  if (!data) return EMPTY_STATS
  return {
    gamesPlayed: typeof data.gamesPlayed === 'number' ? data.gamesPlayed : 0,
    totalScore: typeof data.totalScore === 'number' ? data.totalScore : 0,
    totalCorrect: typeof data.totalCorrect === 'number' ? data.totalCorrect : 0,
    totalQuestions: typeof data.totalQuestions === 'number' ? data.totalQuestions : 0,
    currentStreak: typeof data.currentStreak === 'number' ? data.currentStreak : 0,
    bestStreak: typeof data.bestStreak === 'number' ? data.bestStreak : 0,
    lastPlayedDate:
      typeof data.lastPlayedDate === 'string' ? data.lastPlayedDate : null,
  }
}

function normalizeGame(data: DocumentData): TriviaGameResult {
  return {
    date: typeof data.date === 'string' ? data.date : '',
    score: typeof data.score === 'number' ? data.score : 0,
    correct: typeof data.correct === 'number' ? data.correct : 0,
    total: typeof data.total === 'number' ? data.total : 0,
    answers: Array.isArray(data.answers) ? data.answers : [],
  }
}

export interface UseTriviaUserResult {
  loading: boolean
  isLoggedIn: boolean
  displayName: string
  nickname: string
  needsNickname: boolean
  stats: TriviaStats
  history: TriviaGameResult[]
  canPlayToday: () => boolean
  setNickname: (raw: string) => Promise<void>
}

export function useTriviaUser(): UseTriviaUserResult {
  const { user, loading: authLoading } = useAuth()
  const [nickname, setNicknameState] = useState('')
  const [stats, setStats] = useState<TriviaStats>(EMPTY_STATS)
  const [history, setHistory] = useState<TriviaGameResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNicknameState('')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStats(EMPTY_STATS)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistory([])
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const db = getFirebaseFirestore()
    const userRef = doc(db, 'users', user.uid)
    const profileRef = doc(db, 'users', user.uid, 'triviaProfile', 'current')
    const gamesQuery = query(
      collection(db, 'users', user.uid, 'triviaGames'),
      orderBy('date', 'desc'),
      limit(30)
    )

    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        const data = snap.data() as { nickname?: string } | undefined
        setNicknameState(data?.nickname ?? '')
        setLoading(false)
      },
      (err) => {
        console.error('user doc subscription error:', err)
        setLoading(false)
      }
    )
    const unsubProfile = onSnapshot(
      profileRef,
      (snap) => setStats(normalizeStats(snap.data())),
      (err) => console.error('triviaProfile subscription error:', err)
    )
    const unsubGames = onSnapshot(
      gamesQuery,
      (snap) => setHistory(snap.docs.map((d) => normalizeGame(d.data()))),
      (err) => console.error('triviaGames subscription error:', err)
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
      const clean = sanitizeNickname(raw)
      if (!clean) return
      const token = await user.getIdToken()
      const res = await fetch('/api/v1/users/me/nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nickname: clean }),
      })
      if (res.status === 409) throw new NicknameInUseError()
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || 'Failed to set nickname.')
      }
    },
    [user]
  )

  const canPlayToday = useCallback((): boolean => {
    if (!user) return true
    return !hasPlayedToday(stats.lastPlayedDate)
  }, [user, stats.lastPlayedDate])

  const fallbackName = user?.displayName ?? user?.email ?? ''
  const displayName = nickname || fallbackName
  const needsNickname = !!user && !loading && !nickname

  return useMemo(
    () => ({
      loading,
      isLoggedIn: !!user,
      displayName,
      nickname,
      needsNickname,
      stats,
      history,
      canPlayToday,
      setNickname,
    }),
    [
      loading,
      user,
      displayName,
      nickname,
      needsNickname,
      stats,
      history,
      canPlayToday,
      setNickname,
    ]
  )
}
