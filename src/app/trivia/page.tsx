'use client'

import { useState } from 'react'
import { TriviaLanding } from './components/TriviaLanding'
import { TriviaGame } from './components/TriviaGame'
import { TriviaResults } from './components/TriviaResults'
import { useTriviaStore } from './hooks/useTriviaStore'
import type { TriviaGameResult } from './models/trivia'

type View = 'landing' | 'playing' | 'results'

export default function TriviaPage() {
  const [view, setView] = useState<View>('landing')
  const [lastResult, setLastResult] = useState<TriviaGameResult | null>(null)
  const { recordGame } = useTriviaStore()

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
    setLastResult(null)
  }

  if (view === 'playing') {
    return <TriviaGame onFinish={handleFinish} />
  }

  if (view === 'results' && lastResult) {
    return <TriviaResults result={lastResult} onBack={handleBackToLanding} />
  }

  return <TriviaLanding onStartGame={handleStartGame} />
}
