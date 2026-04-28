'use client'

import { useEffect, useRef, useState } from 'react'

import { useAuth } from '@/app/trivia/hooks/useAuth'
import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import {
  cleanupOldDays,
  clearTodayResult,
  loadTodayResult,
  saveTodayResult,
} from '@/app/trivia/lib/todayLocalStorage'
import { getTodayPST } from '@/app/trivia/lib/triviaUtils'

import { TriviaGame } from './components/TriviaGame'
import { TriviaLanding } from './components/TriviaLanding'
import { TriviaLeaderboard } from './components/TriviaLeaderboard'
import { TriviaResults } from './components/TriviaResults'
import { TriviaStats } from './components/TriviaStats'

import type { TriviaGameResult } from './models/trivia'

type View = 'landing' | 'playing' | 'results' | 'stats' | 'leaderboard'

export default function TriviaPage() {
  const { user } = useAuth()
  const {
    userData: firestoreUser,
    saveGameResult: saveToFirestore,
    loading: firestoreLoading,
  } = useTriviaUser()

  const today = getTodayPST()
  const firestoreToday = user
    ? firestoreUser.history.find((h) => h.date === today) ?? null
    : null

  const [view, setView] = useState<View>('landing')
  const [lastResult, setLastResult] = useState<TriviaGameResult | null>(null)
  const [localToday, setLocalToday] = useState<TriviaGameResult | null>(null)
  const [autoResultsShown, setAutoResultsShown] = useState(false)
  const prevUserUid = useRef<string | null>(null)

  useEffect(() => {
    cleanupOldDays(today)
    setLocalToday(loadTodayResult(today))
  }, [today])

  const todayResult = firestoreToday ?? localToday

  useEffect(() => {
    if (autoResultsShown) return
    if (user && firestoreLoading) return
    if (todayResult && view === 'landing') {
      setLastResult(todayResult)
      setView('results')
    }
    setAutoResultsShown(true)
  }, [autoResultsShown, user, firestoreLoading, todayResult, view])

  useEffect(() => {
    const uid = user?.uid ?? null
    const prevUid = prevUserUid.current
    prevUserUid.current = uid

    if (!uid) return
    if (firestoreLoading) return

    const local = loadTodayResult(today)
    if (!local) return

    if (firestoreToday) {
      clearTodayResult(today)
      setLocalToday(null)
      return
    }

    if (prevUid === uid) return

    saveToFirestore(local)
      .then(() => {
        clearTodayResult(today)
        setLocalToday(null)
      })
      .catch((err) => console.error('Failed to reconcile local trivia result:', err))
  }, [user, firestoreLoading, firestoreToday, today, saveToFirestore])

  const handleStartGame = () => setView('playing')
  const handleViewStats = () => setView('stats')
  const handleViewLeaderboard = () => setView('leaderboard')

  const handleFinish = (result: TriviaGameResult) => {
    saveTodayResult(result)
    setLocalToday(result)
    if (user) {
      saveToFirestore(result)
        .then(() => clearTodayResult(today))
        .catch((err) =>
          console.error('Failed to save trivia result to Firestore:', err)
        )
    }
    setLastResult(result)
    setView('results')
  }

  const handleBackToLanding = () => setView('landing')

  if (view === 'playing') {
    return <TriviaGame onFinish={handleFinish} />
  }

  if (view === 'results' && lastResult) {
    return (
      <TriviaResults
        result={lastResult}
        onBack={handleBackToLanding}
        onViewStats={handleViewStats}
        onViewLeaderboard={handleViewLeaderboard}
      />
    )
  }

  if (view === 'stats') {
    return <TriviaStats onBack={handleBackToLanding} />
  }

  if (view === 'leaderboard') {
    return <TriviaLeaderboard onBack={handleBackToLanding} />
  }

  return (
    <TriviaLanding
      onStartGame={handleStartGame}
      onViewStats={handleViewStats}
      onViewLeaderboard={handleViewLeaderboard}
      todayResult={todayResult}
    />
  )
}
