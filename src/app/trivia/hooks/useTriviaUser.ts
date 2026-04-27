'use client'

import { type DocumentData, doc, getDoc, setDoc } from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/app/trivia/hooks/useAuth'
import { getFirebaseFirestore } from '@/app/trivia/lib/firebaseClient'
import { getTodayPST, hasPlayedToday } from '@/app/trivia/lib/triviaUtils'
import type { TriviaGameResult } from '@/app/trivia/models/trivia'

interface FirestoreStats {
  gamesPlayed: number
  totalScore: number
  totalCorrect: number
  totalQuestions: number
  currentStreak: number
  bestStreak: number
}

export interface TriviaUserDocument {
  displayName: string
  stats: FirestoreStats
  history: TriviaGameResult[]
  lastPlayedDate: string | null
}

const EMPTY_STATS: FirestoreStats = {
  gamesPlayed: 0,
  totalScore: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  currentStreak: 0,
  bestStreak: 0,
}

const EMPTY_USER: TriviaUserDocument = {
  displayName: '',
  stats: EMPTY_STATS,
  history: [],
  lastPlayedDate: null,
}

function getYesterdayPST(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const pst = new Date(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const yyyy = pst.getFullYear()
  const mm = String(pst.getMonth() + 1).padStart(2, '0')
  const dd = String(pst.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function computeNextState(
  existing: TriviaUserDocument,
  result: TriviaGameResult,
  displayName: string
): TriviaUserDocument {
  const today = getTodayPST()
  const yesterday = getYesterdayPST()
  const wasYesterday = existing.lastPlayedDate === yesterday
  const newStreak = wasYesterday ? existing.stats.currentStreak + 1 : 1
  const bestStreak = Math.max(newStreak, existing.stats.bestStreak)

  return {
    displayName,
    lastPlayedDate: today,
    stats: {
      gamesPlayed: existing.stats.gamesPlayed + 1,
      totalScore: existing.stats.totalScore + result.score,
      totalCorrect: existing.stats.totalCorrect + result.correct,
      totalQuestions: existing.stats.totalQuestions + result.total,
      currentStreak: newStreak,
      bestStreak,
    },
    history: [...existing.history, result],
  }
}

function normalizeDoc(data: DocumentData | undefined): TriviaUserDocument {
  if (!data) return EMPTY_USER
  return {
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    stats: { ...EMPTY_STATS, ...(data.stats ?? {}) },
    history: Array.isArray(data.history) ? (data.history as TriviaGameResult[]) : [],
    lastPlayedDate:
      typeof data.lastPlayedDate === 'string' || data.lastPlayedDate === null
        ? data.lastPlayedDate
        : null,
  }
}

export interface UseTriviaUserResult {
  userData: TriviaUserDocument
  loading: boolean
  isLoggedIn: boolean
  canPlayToday: () => boolean
  saveGameResult: (result: TriviaGameResult) => Promise<void>
  refresh: () => Promise<void>
}

export function useTriviaUser(): UseTriviaUserResult {
  const { user, loading: authLoading } = useAuth()
  const [userData, setUserData] = useState<TriviaUserDocument>(EMPTY_USER)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setUserData(EMPTY_USER)
      setLoading(false)
      return
    }
    try {
      const ref = doc(getFirebaseFirestore(), 'trivia-users', user.uid)
      const snap = await getDoc(ref)
      setUserData(normalizeDoc(snap.data()))
    } catch (err) {
      console.error('Failed to load trivia user data:', err)
      setUserData(EMPTY_USER)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    setLoading(true)
    refresh()
  }, [authLoading, refresh])

  const saveGameResult = useCallback(
    async (result: TriviaGameResult) => {
      if (!user) return
      const ref = doc(getFirebaseFirestore(), 'trivia-users', user.uid)
      const snap = await getDoc(ref)
      const existing = normalizeDoc(snap.data())
      const displayName = user.displayName ?? user.email ?? existing.displayName
      const next = computeNextState(existing, result, displayName)
      await setDoc(ref, next)
      setUserData(next)
    },
    [user]
  )

  const canPlayToday = useCallback((): boolean => {
    if (!user) return true
    return !hasPlayedToday(userData.lastPlayedDate)
  }, [user, userData.lastPlayedDate])

  return {
    userData,
    loading,
    isLoggedIn: !!user,
    canPlayToday,
    saveGameResult,
    refresh,
  }
}
