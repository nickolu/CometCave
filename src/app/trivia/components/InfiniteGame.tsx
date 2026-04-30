'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useInfiniteRun } from '@/app/trivia/hooks/useInfiniteRun'
import type { InfiniteMode } from '@/app/trivia/hooks/useInfiniteRun'
import { InfiniteHUD } from './InfiniteHUD'
import { InfiniteQuestionCard } from './InfiniteQuestionCard'
import { InfiniteRunSummary } from './InfiniteRunSummary'
import { InfiniteExhaustedScreen } from './InfiniteExhaustedScreen'
import { InfiniteRulesModal } from './InfiniteRulesModal'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { CATEGORY_META } from '@/lib/trivia/categories'

const TIME_LIMIT = 60 // 60 seconds for AI free-text

interface Props {
  onBack: () => void
  onViewStats?: () => void
  onViewLeaderboard?: () => void
  mode?: InfiniteMode
}

export function InfiniteGame({ onBack, onViewStats, onViewLeaderboard, mode = 'scored' }: Props) {
  const { user, loading: authLoading } = useAuth()
  const { state, startRun, submitAnswer, nextQuestion, skipQuestion, endRun, handleQuestionFlagged } = useInfiniteRun()
  const [timeRemaining, setTimeRemaining] = useState(TIME_LIMIT)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStartRef = useRef<number>(0)
  const hasStartedRef = useRef(false)
  // Always show the pre-game screen until the player clicks Start
  const [showPreGame, setShowPreGame] = useState(true)

  const handlePreGameContinue = useCallback((chosenMode: InfiniteMode, categoryId?: number) => {
    if (chosenMode !== mode && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('mode', chosenMode)
      window.history.replaceState({}, '', url.toString())
    }
    hasStartedRef.current = true
    setShowPreGame(false)
    startRun(chosenMode, categoryId)
  }, [mode, startRun])

  // Timer logic
  useEffect(() => {
    if (state.phase !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerStartRef.current = Date.now()
    setTimeRemaining(TIME_LIMIT)
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - timerStartRef.current) / 1000
      const remaining = Math.max(0, TIME_LIMIT - elapsed)
      setTimeRemaining(remaining)
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        // Auto-submit empty on timeout
        submitAnswer('')
      }
    }, 100)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.question?.id])

  const handleFlee = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    endRun()
  }, [endRun])

  const handlePlayAgain = useCallback(() => {
    setShowPreGame(true)
  }, [])

  // Pre-game screen — always shown until the player clicks Start
  if (showPreGame) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 max-w-lg mx-auto">
        <InfiniteRulesModal defaultMode={mode} onContinue={handlePreGameContinue} onCancel={onBack} />
      </div>
    )
  }

  // Loading state
  if (state.phase === 'loading' || state.phase === 'idle') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 max-w-lg mx-auto">
        <div className="text-on-surface/60 text-lg">Loading Infinite Trivia...</div>
      </div>
    )
  }

  // Error state
  if (state.phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 max-w-lg mx-auto">
        <p className="text-ds-error">{state.error}</p>
        <ChunkyButton variant="secondary" onClick={() => startRun()}>Try Again</ChunkyButton>
        <ChunkyButton variant="ghost" size="sm" onClick={onBack}>Back to Trivia</ChunkyButton>
      </div>
    )
  }

  // Exhausted state
  if (state.phase === 'exhausted') {
    return (
      <InfiniteExhaustedScreen
        onBack={onBack}
        score={state.score}
        questionsAnswered={state.questionsAnswered}
      />
    )
  }

  // End of run
  if (state.phase === 'ended') {
    return <InfiniteRunSummary state={state} onPlayAgain={handlePlayAgain} onBack={onBack} onViewStats={onViewStats} onViewLeaderboard={onViewLeaderboard} mode={state.mode} runId={state.runId} onFlagged={handleQuestionFlagged} />
  }

  // Playing or answered
  if (!state.question) return null

  return (
    <div className="flex flex-col gap-3 sm:gap-4 max-w-lg mx-auto py-2 sm:py-4">
      <InfiniteHUD
        livesRemaining={state.livesRemaining}
        currentStreak={state.currentStreak}
        score={state.score}
        timeRemaining={timeRemaining}
        timeLimit={TIME_LIMIT}
        onFlee={handleFlee}
        isPlaying={state.phase === 'playing'}
        mode={state.mode}
        categoryName={state.categoryId != null ? CATEGORY_META[state.categoryId]?.name : undefined}
        skipsRemaining={state.skipsRemaining}
      />

      <InfiniteQuestionCard
        key={state.question.id}
        question={state.question}
        onSubmit={submitAnswer}
        isSubmitting={state.phase === 'answering'}
        answerResult={state.lastAnswer}
        questionsAnswered={state.questionsAnswered}
        runId={state.runId}
        onFlagged={handleQuestionFlagged}
        skipsRemaining={state.skipsRemaining}
        onSkip={skipQuestion}
      />

      {state.phase === 'answered' && (
        state.lastAnswer?.runOver ? (
          <ChunkyButton variant="primary" size="lg" className="w-full" onClick={endRun}>
            View Run Summary
          </ChunkyButton>
        ) : (
          <ChunkyButton variant="primary" size="lg" className="w-full" onClick={nextQuestion}>
            Next Question
          </ChunkyButton>
        )
      )}
    </div>
  )
}
