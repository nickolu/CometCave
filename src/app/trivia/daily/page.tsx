'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState } from 'react'

import { TriviaGame } from '@/app/trivia/components/TriviaGame'
import { TriviaResults } from '@/app/trivia/components/TriviaResults'
import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { submitGameToServer } from '@/app/trivia/lib/submitGame'
import {
  clearTodayResult,
  saveTodayResult,
} from '@/app/trivia/lib/todayLocalStorage'
import type { TriviaGameResult } from '@/app/trivia/models/trivia'
import { useAuth } from '@/hooks/useAuth'
import { getTodayPST } from '@/lib/dates'

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function DailyTriviaPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { history } = useTriviaUser()

  const dateParam = searchParams.get('date')
  const isPastDate = !!dateParam
  const today = getTodayPST()
  const playDate = dateParam ?? today

  const [view, setView] = useState<'playing' | 'results'>('playing')
  const [result, setResult] = useState<TriviaGameResult | null>(null)

  const nextUnplayedDay = useMemo(() => {
    if (!isPastDate) return null
    const playedSet = new Set(history.map((h) => h.date))
    // Include the date we just played (result may not be in history yet)
    if (result) playedSet.add(result.date)
    let candidate = addDaysToDate(playDate, 1)
    while (playedSet.has(candidate) && candidate < today) {
      candidate = addDaysToDate(candidate, 1)
    }
    if (candidate <= today && !playedSet.has(candidate)) return candidate
    return null
  }, [isPastDate, playDate, history, today, result])

  const prevUnplayedDay = useMemo(() => {
    if (!isPastDate) return null
    const playedSet = new Set(history.map((h) => h.date))
    if (result) playedSet.add(result.date)
    const limit = addDaysToDate(today, -90)
    let candidate = addDaysToDate(playDate, -1)
    while (playedSet.has(candidate) && candidate > limit) {
      candidate = addDaysToDate(candidate, -1)
    }
    if (candidate >= limit && !playedSet.has(candidate)) return candidate
    return null
  }, [isPastDate, playDate, history, today, result])

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
        onBack={() => router.push(isPastDate ? '/trivia/calendar' : '/trivia')}
        onViewStats={() => router.push('/trivia/stats')}
        onViewLeaderboard={() => router.push('/trivia/leaderboard')}
        onStartInfinite={() => router.push('/trivia/infinite')}
        isRetroactive={isPastDate}
        onNextDay={nextUnplayedDay ? () => {
          const path = nextUnplayedDay === today
            ? '/trivia/daily'
            : `/trivia/daily?date=${nextUnplayedDay}`
          router.push(path)
        } : undefined}
        onPreviousDay={prevUnplayedDay ? () => {
          router.push(`/trivia/daily?date=${prevUnplayedDay}`)
        } : undefined}
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
