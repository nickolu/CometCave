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
  nickname: string
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
  nickname: '',
  stats: EMPTY_STATS,
  history: [],
  lastPlayedDate: null,
}

export const NICKNAME_MAX_LENGTH = 20

export function sanitizeNickname(raw: string): string {
  return raw.trim().slice(0, NICKNAME_MAX_LENGTH)
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
    nickname: existing.nickname,
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
    nickname: typeof data.nickname === 'string' ? data.nickname : '',
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
  displayName: string
  needsNickname: boolean
  canPlayToday: () => boolean
  saveGameResult: (result: TriviaGameResult) => Promise<void>
  setNickname: (raw: string) => Promise<void>
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
      const resolvedName =
        existing.nickname ||
        user.displayName ||
        user.email ||
        existing.displayName ||
        ''
      const next = computeNextState(existing, result, resolvedName)
      await setDoc(ref, next)
      setUserData(next)
    },
    [user]
  )

  const setNickname = useCallback(
    async (raw: string) => {
      if (!user) return
      const clean = sanitizeNickname(raw)
      if (!clean) return
      const ref = doc(getFirebaseFirestore(), 'trivia-users', user.uid)
      await setDoc(ref, { nickname: clean, displayName: clean }, { merge: true })
      setUserData((prev) => ({ ...prev, nickname: clean, displayName: clean }))
    },
    [user]
  )

  const canPlayToday = useCallback((): boolean => {
    if (!user) return true
    return !hasPlayedToday(userData.lastPlayedDate)
  }, [user, userData.lastPlayedDate])

  const fallbackName = user?.displayName ?? user?.email ?? ''
  const displayName = userData.nickname || fallbackName
  const needsNickname = !!user && !loading && !userData.nickname

  return {
    userData,
    loading,
    isLoggedIn: !!user,
    displayName,
    needsNickname,
    canPlayToday,
    saveGameResult,
    setNickname,
    refresh,
  }
}
