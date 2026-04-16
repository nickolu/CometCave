'use client'

import { useState, useEffect } from 'react'
import { TriviaLanding } from './components/TriviaLanding'
import { TriviaGame } from './components/TriviaGame'
import { TriviaResults } from './components/TriviaResults'
import { useTriviaStore } from './hooks/useTriviaStore'
import { getTodayPST } from './lib/triviaUtils'
import type { TriviaGameResult } from './models/trivia'

type View = 'landing' | 'playing' | 'results'

export default function TriviaPage() {
  const { recordGame, canPlayToday, userData } = useTriviaStore()

  // Determine initial view: if already played today, show results
  const getTodayResult = (): TriviaGameResult | null => {
    const today = getTodayPST()
    return userData.history.find((h) => h.date === today) ?? null
  }

  const todayResult = getTodayResult()
  const [view, setView] = useState<View>(todayResult ? 'results' : 'landing')
  const [lastResult, setLastResult] = useState<TriviaGameResult | null>(todayResult)

  // Also sync on hydration (Zustand persist loads async)
  useEffect(() => {
    const result = getTodayResult()
    if (result && view === 'landing') {
      setLastResult(result)
      setView('results')
    }
  }, [userData.history])

  const handleStartGame = () => {
    setView('playing')
  }

  const handleFinish = (result: TriviaGameResult) => {
    recordGame(result)
    setLastResult(result)
    setView('results')
  }

  const handleBackToLanding = () => {
    setView('landing')
  }

  if (view === 'playing') {
    return <TriviaGame onFinish={handleFinish} />
  }

  if (view === 'results' && lastResult) {
    return <TriviaResults result={lastResult} onBack={handleBackToLanding} />
  }

  return <TriviaLanding onStartGame={handleStartGame} />
}
