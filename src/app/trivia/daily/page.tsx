'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { TriviaGame } from '@/app/trivia/components/TriviaGame'
import { TriviaResults } from '@/app/trivia/components/TriviaResults'
import { submitGameToServer } from '@/app/trivia/lib/submitGame'
import {
  clearTodayResult,
  saveTodayResult,
} from '@/app/trivia/lib/todayLocalStorage'
import type { TriviaGameResult } from '@/app/trivia/models/trivia'
import { useAuth } from '@/hooks/useAuth'
import { getTodayPST } from '@/lib/dates'

function DailyTriviaPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const dateParam = searchParams.get('date')
  const isPastDate = !!dateParam
  const today = getTodayPST()
  const playDate = dateParam ?? today

  const [view, setView] = useState<'playing' | 'results'>('playing')
  const [result, setResult] = useState<TriviaGameResult | null>(null)

  function handleFinish(res: TriviaGameResult) {
    if (!isPastDate) {
      saveTodayResult(res)
    }
    setResult(res)
    setView('results')
    if (user) {
      submitGameToServer(user, res)
        .then(() => {
          if (!isPastDate) clearTodayResult(today)
        })
        .catch((err) =>
          console.error('Failed to submit completed game:', err)
        )
    }
  }

  function handleFlee() {
    if (isPastDate) {
      router.push('/trivia/calendar')
    } else {
      router.push('/trivia')
    }
  }

  if (view === 'results' && result) {
    return (
      <TriviaResults
        result={result}
        onBack={() => router.push('/trivia')}
        onViewStats={() => router.push('/trivia/stats')}
        onViewLeaderboard={() => router.push('/trivia/leaderboard')}
        onStartInfinite={() => router.push('/trivia/infinite')}
      />
    )
  }

  return (
    <TriviaGame
      date={isPastDate ? playDate : undefined}
      onFinish={handleFinish}
      onFlee={handleFlee}
    />
  )
}

export default function DailyTriviaPage() {
  return (
    <Suspense fallback={null}>
      <DailyTriviaPageInner />
    </Suspense>
  )
}
