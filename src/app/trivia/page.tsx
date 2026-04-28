'use client'

import { useEffect, useState } from 'react'

import { useAuth } from '@/app/trivia/hooks/useAuth'
import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
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
  const todayResult = user
    ? firestoreUser.history.find((h) => h.date === today) ?? null
    : null

  const [view, setView] = useState<View>('landing')
  const [lastResult, setLastResult] = useState<TriviaGameResult | null>(null)
  const [autoResultsShown, setAutoResultsShown] = useState(false)

  useEffect(() => {
    if (autoResultsShown) return
    if (user && firestoreLoading) return
    if (todayResult && view === 'landing') {
      setLastResult(todayResult)
      setView('results')
    }
    setAutoResultsShown(true)
  }, [autoResultsShown, user, firestoreLoading, todayResult, view])

  const handleStartGame = () => setView('playing')
  const handleViewStats = () => setView('stats')
  const handleViewLeaderboard = () => setView('leaderboard')

  const handleFinish = (result: TriviaGameResult) => {
    if (user) {
      saveToFirestore(result).catch((err) =>
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
    />
  )
}
