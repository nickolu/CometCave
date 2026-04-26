'use client'

import { useState, useEffect } from 'react'
import { TriviaLanding } from './components/TriviaLanding'
import { TriviaGame } from './components/TriviaGame'
import { TriviaResults } from './components/TriviaResults'
import { TriviaStats } from './components/TriviaStats'
import { TriviaLeaderboard } from './components/TriviaLeaderboard'
import { useTriviaStore } from './hooks/useTriviaStore'
import { getTodayPST } from './lib/triviaUtils'
import type { TriviaGameResult } from './models/trivia'

type View = 'landing' | 'playing' | 'results' | 'stats' | 'leaderboard'

export default function TriviaPage() {
  const { recordGame, userData } = useTriviaStore()

  const getTodayResult = (): TriviaGameResult | null => {
    const today = getTodayPST()
    return userData.history.find((h) => h.date === today) ?? null
  }

  const todayResult = getTodayResult()
  const [view, setView] = useState<View>(todayResult ? 'results' : 'landing')
  const [lastResult, setLastResult] = useState<TriviaGameResult | null>(todayResult)

  useEffect(() => {
    const result = getTodayResult()
    if (result && view === 'landing') {
      setLastResult(result)
      setView('results')
    }
  }, [userData.history])

  const handleStartGame = () => setView('playing')
  const handleViewStats = () => setView('stats')
  const handleViewLeaderboard = () => setView('leaderboard')

  const handleFinish = (result: TriviaGameResult) => {
    recordGame(result)
    setLastResult(result)
    setView('results')

    // Submit score to leaderboard if user has a display name (fire and forget)
    if (userData.displayName) {
      fetch('/api/v1/trivia/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: userData.displayName,
          date: result.date,
          score: result.score,
          correct: result.correct,
          total: result.total,
        }),
      }).catch((err) => console.error('Failed to submit score:', err))
    }
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
