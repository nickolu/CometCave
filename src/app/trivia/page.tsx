'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import {
  cleanupOldDays,
  clearTodayResult,
  loadTodayResult,
  saveTodayResult,
} from '@/app/trivia/lib/todayLocalStorage'
import { useAuth } from '@/hooks/useAuth'
import { getTodayPST } from '@/lib/dates'
import { getDailyCategory } from '@/lib/trivia/categories'

import { InfiniteGame } from './components/InfiniteGame'
import { InfiniteLeaderboard } from './components/InfiniteLeaderboard'
import { QuestionLibrary } from './components/QuestionLibrary'
import { TriviaCalendar } from './components/TriviaCalendar'
import { TriviaGame } from './components/TriviaGame'
import { TriviaLanding } from './components/TriviaLanding'
import { TriviaLeaderboard } from './components/TriviaLeaderboard'
import { TriviaResults } from './components/TriviaResults'
import { UnifiedStats } from './components/UnifiedStats'

import type { TriviaGameResult } from './models/trivia'
import type { User } from 'firebase/auth'

type View = 'landing' | 'playing' | 'playing-past' | 'results' | 'stats' | 'leaderboard' | 'infinite' | 'infinite-stats' | 'practice' | 'infinite-leaderboard' | 'library' | 'calendar'

type StatsDefaultTab = 'daily' | 'infinite'

async function submitGameToServer(user: User, result: TriviaGameResult): Promise<void> {
  const token = await user.getIdToken()
  const res = await fetch('/api/v1/trivia/complete-game', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      date: result.date,
      score: result.score,
      correct: result.correct,
      total: result.total,
      answers: result.answers,
      category: getDailyCategory(result.date),
    }),
  })
  // 409 = already submitted today; treat as success (idempotent reconcile)
  if (!res.ok && res.status !== 409) {
    throw new Error(`complete-game failed: ${res.status}`)
  }
}

export default function TriviaPage() {
  const { user } = useAuth()
  const { history, loading: triviaLoading } = useTriviaUser()

  const today = getTodayPST()
  const firestoreToday = user ? history.find((h) => h.date === today) ?? null : null

  const [view, setView] = useState<View>('landing')
  const [statsDefaultTab, setStatsDefaultTab] = useState<StatsDefaultTab>('daily')
  const [playingDate, setPlayingDate] = useState<string | null>(null)
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
    if (user && triviaLoading) return
    if (todayResult && view === 'landing') {
      setLastResult(todayResult)
      setView('results')
    }
    setAutoResultsShown(true)
  }, [autoResultsShown, user, triviaLoading, todayResult, view])

  useEffect(() => {
    const uid = user?.uid ?? null
    const prevUid = prevUserUid.current
    prevUserUid.current = uid

    if (!uid || !user) return
    if (triviaLoading) return

    const local = loadTodayResult(today)
    if (!local) return

    if (firestoreToday) {
      clearTodayResult(today)
      setLocalToday(null)
      return
    }

    if (prevUid === uid) return

    submitGameToServer(user, local)
      .then(() => {
        clearTodayResult(today)
        setLocalToday(null)
      })
      .catch((err) =>
        console.error('Failed to reconcile local trivia result:', err)
      )
  }, [user, triviaLoading, firestoreToday, today])

  const handleLibrary = () => setView('library')
  const handleViewCalendar = () => setView('calendar')
  const handleStartGame = () => setView('playing')
  const handleViewStats = () => { setStatsDefaultTab('daily'); setView('stats') }
  const handleViewLeaderboard = () => setView('leaderboard')
  const handleStartInfinite = () => setView('infinite')
  const handleViewInfiniteStats = () => { setStatsDefaultTab('infinite'); setView('stats') }
  const handleStartPractice = () => setView('practice')
  const handleViewInfiniteLeaderboard = () => setView('infinite-leaderboard')

  const handleSelectPastDate = useCallback((date: string) => {
    const alreadyPlayed = history.some((h) => h.date === date)
    if (alreadyPlayed) return
    setPlayingDate(date)
    setView('playing-past')
  }, [history])

  const handleFinishPast = useCallback(
    (result: TriviaGameResult) => {
      setLastResult(result)
      setView('results')
      setPlayingDate(null)
      if (user) {
        submitGameToServer(user, result)
          .catch((err) =>
            console.error('Failed to submit retroactive game:', err)
          )
      }
    },
    [user]
  )

  const handleStatsReset = useCallback(
    (scopes: { daily: boolean; infinite: boolean }) => {
      if (scopes.daily) {
        setLocalToday(null)
        setLastResult(null)
        setAutoResultsShown(true)
      }
    },
    []
  )

  const handleFinish = useCallback(
    (result: TriviaGameResult) => {
      saveTodayResult(result)
      setLocalToday(result)
      setLastResult(result)
      setView('results')
      if (user) {
        submitGameToServer(user, result)
          .then(() => clearTodayResult(today))
          .catch((err) =>
            console.error('Failed to submit completed game:', err)
          )
      }
    },
    [user, today]
  )

  const handleBackToLanding = () => setView('landing')

  // Bundle of nav targets the persistent footer needs. Defined once so
  // each view can drop in <TriviaFooter {...nav} /> without re-deriving
  // handlers.
  const nav = {
    onHome: handleBackToLanding,
    onViewStats: handleViewStats,
    onViewLeaderboard: handleViewLeaderboard,
    onViewInfiniteStats: handleViewInfiniteStats,
    onViewInfiniteLeaderboard: handleViewInfiniteLeaderboard,
    onLibrary: handleLibrary,
    onCalendar: handleViewCalendar,
  }

  if (view === 'infinite') {
    return <InfiniteGame onBack={handleBackToLanding} onViewStats={handleViewInfiniteStats} onViewLeaderboard={handleViewInfiniteLeaderboard} />
  }

  if (view === 'practice') {
    return <InfiniteGame onBack={handleBackToLanding} onViewStats={handleViewInfiniteStats} onViewLeaderboard={handleViewInfiniteLeaderboard} mode="practice" />
  }

  if (view === 'infinite-stats') {
    return <UnifiedStats onBack={handleBackToLanding} defaultTab="infinite" nav={nav} />
  }

  if (view === 'playing') {
    return <TriviaGame onFinish={handleFinish} />
  }

  if (view === 'playing-past' && playingDate) {
    return <TriviaGame date={playingDate} onFinish={handleFinishPast} onFlee={() => { setPlayingDate(null); setView('calendar') }} />
  }

  if (view === 'results' && lastResult) {
    return (
      <TriviaResults
        result={lastResult}
        onBack={handleBackToLanding}
        onViewStats={handleViewStats}
        onViewLeaderboard={handleViewLeaderboard}
        onStartInfinite={handleStartInfinite}
        nav={nav}
      />
    )
  }

  if (view === 'stats') {
    return <UnifiedStats onBack={handleBackToLanding} defaultTab={statsDefaultTab} nav={nav} />
  }

  if (view === 'leaderboard') {
    return <TriviaLeaderboard onBack={handleBackToLanding} nav={nav} />
  }

  if (view === 'infinite-leaderboard') {
    return <InfiniteLeaderboard onBack={handleBackToLanding} nav={nav} />
  }

  if (view === 'library') {
    return <QuestionLibrary onBack={handleBackToLanding} nav={nav} />
  }

  if (view === 'calendar') {
    return (
      <TriviaCalendar
        onPlayToday={handleStartGame}
        onSelectDate={handleSelectPastDate}
        onBack={handleBackToLanding}
        nav={nav}
      />
    )
  }

  return (
    <TriviaLanding
      onStartGame={handleStartGame}
      onViewStats={handleViewStats}
      onViewLeaderboard={handleViewLeaderboard}
      onStartInfinite={handleStartInfinite}
      onViewInfiniteStats={handleViewInfiniteStats}
      onStartPractice={handleStartPractice}
      onViewInfiniteLeaderboard={handleViewInfiniteLeaderboard}
      onLibrary={handleLibrary}
      onCalendar={handleViewCalendar}
      onStatsReset={handleStatsReset}
      todayResult={todayResult}
    />
  )
}
