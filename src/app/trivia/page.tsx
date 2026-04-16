'use client'

import { useState, useEffect } from 'react'
import { TriviaLanding } from './components/TriviaLanding'
import { TriviaGame } from './components/TriviaGame'
import { TriviaResults } from './components/TriviaResults'
import { TriviaStats } from './components/TriviaStats'
import { useTriviaStore } from './hooks/useTriviaStore'
import { getTodayPST } from './lib/triviaUtils'
import type { TriviaGameResult } from './models/trivia'

type View = 'landing' | 'playing' | 'results' | 'stats'

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

  const handleFinish = (result: TriviaGameResult) => {
    recordGame(result)
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
      />
    )
  }

  if (view === 'stats') {
    return <TriviaStats onBack={handleBackToLanding} />
  }

  return <TriviaLanding onStartGame={handleStartGame} onViewStats={handleViewStats} />
}
