'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

import { TIER_EMOJI, useCategoryMedals } from '@/app/trivia/hooks/useCategoryMedals'
import { useInfiniteRun } from '@/app/trivia/hooks/useInfiniteRun'
import type { InfiniteMode } from '@/app/trivia/hooks/useInfiniteRun'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'
import { CATEGORY_META } from '@/lib/trivia/categories'

import { InfiniteExhaustedScreen } from './InfiniteExhaustedScreen'
import { InfiniteHUD } from './InfiniteHUD'
import { InfiniteQuestionCard } from './InfiniteQuestionCard'
import { InfiniteRunSummary } from './InfiniteRunSummary'

const TIME_LIMIT = 60 // 60 seconds for AI free-text
const RULES_SEEN_KEY = 'cometcave-infinite-rules-seen-v1'

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
  const [showPreGame, setShowPreGame] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined)
  const [showRulesOverlay, setShowRulesOverlay] = useState(false)
  const [bonusLifeToast, setBonusLifeToast] = useState<string | null>(null)
  const [medalToast, setMedalToast] = useState<string | null>(null)
  const prevLivesRef = useRef<number | null>(null)
  const lastMedalAnswerIdRef = useRef<string | null>(null)

  const categoryEntries = Object.entries(CATEGORY_META).map(([id, meta]) => ({
    id: Number(id),
    ...meta,
  }))

  const { byCategoryId: medalsByCategoryId } = useCategoryMedals()

  const handleStart = useCallback((chosenMode: InfiniteMode) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RULES_SEEN_KEY, '1')
      if (chosenMode !== mode) {
        const url = new URL(window.location.href)
        url.searchParams.set('mode', chosenMode)
        window.history.replaceState({}, '', url.toString())
      }
    }
    hasStartedRef.current = true
    setShowPreGame(false)
    startRun(chosenMode, selectedCategoryId)
  }, [mode, startRun, selectedCategoryId])

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

  // Detect streak bonus life — compare lives before and after answering
  useEffect(() => {
    if (state.phase === 'answered' && state.lastAnswer?.correct && prevLivesRef.current !== null) {
      if (state.livesRemaining > prevLivesRef.current) {
        setBonusLifeToast(`🔥 ${state.lastAnswer.currentStreak}-streak! +1 Bonus Life`)
        setTimeout(() => setBonusLifeToast(null), 3000)
      }
    }
    if (state.phase === 'playing' || state.phase === 'answered') {
      prevLivesRef.current = state.livesRemaining
    }
  }, [state.phase, state.livesRemaining, state.lastAnswer])

  // Show medal toast when an answer crosses a tier line. Track the question
  // id so the toast doesn't re-fire if the same answered state lingers.
  useEffect(() => {
    if (state.phase !== 'answered') return
    const earned = state.lastAnswer?.medalEarned
    if (!earned) return
    const answerKey = state.answers[state.answers.length - 1]?.questionId ?? null
    if (answerKey === lastMedalAnswerIdRef.current) return
    lastMedalAnswerIdRef.current = answerKey
    const tierEmoji =
      earned.tier === 'bronze' ? '🥉'
      : earned.tier === 'silver' ? '🥈'
      : earned.tier === 'gold' ? '🥇'
      : earned.tier === 'platinum' ? '🏅'
      : '💎'
    setMedalToast(`${tierEmoji} ${earned.label} — ${earned.categoryName}`)
    setTimeout(() => setMedalToast(null), 4000)
  }, [state.phase, state.lastAnswer, state.answers])

  const handlePlayAgain = useCallback(() => {
    setShowPreGame(true)
  }, [])

  // Pre-game screen — inline, not a modal
  if (showPreGame) {
    return (
      <div className="flex flex-col gap-4 max-w-lg mx-auto py-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-on-surface mb-1">Infinite Trivia</h2>
          <button
            type="button"
            onClick={() => setShowRulesOverlay(true)}
            className="text-ds-primary text-xs hover:underline"
          >
            How to play →
          </button>
        </div>

        {/* Category selector — always visible, inline */}
        <ChunkyCard variant="surface-variant">
          <ChunkyCardContent className="pt-4 pb-4 flex flex-col gap-3">
            <p className="text-on-surface/70 text-sm font-medium">Category</p>
            <button
              type="button"
              onClick={() => setSelectedCategoryId(undefined)}
              className={`flex items-center justify-center gap-2 py-2 rounded-ds-md text-sm font-medium transition-colors ${
                selectedCategoryId === undefined
                  ? 'bg-ds-primary text-on-primary'
                  : 'bg-surface-container text-on-surface/80 hover:bg-surface-container-highest'
              }`}
            >
              <span aria-hidden="true">🌐</span>
              All Categories
            </button>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categoryEntries.map(({ id, name, icon }) => {
                const medal = medalsByCategoryId.get(id)
                const earnedTier = medal && medal.tier !== 'none' ? medal.tier : null
                const tierEmoji = earnedTier ? TIER_EMOJI[earnedTier] : null
                const isSelected = selectedCategoryId === id
                const titleText = medal && medal.label
                  ? `${medal.label} — ${medal.correctCount} correct${medal.nextThreshold ? ` (next tier at ${medal.nextThreshold})` : ''}`
                  : medal
                    ? `${medal.correctCount} correct${medal.nextThreshold ? ` (first tier at ${medal.nextThreshold})` : ''}`
                    : undefined
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedCategoryId(id)}
                    title={titleText}
                    className={`flex flex-col items-center justify-between gap-2 p-3 rounded-ds-md text-xs font-medium transition-colors min-h-[120px] ${
                      isSelected
                        ? 'bg-ds-primary text-on-primary ring-2 ring-ds-primary'
                        : 'bg-surface-container text-on-surface/80 hover:bg-surface-container-highest'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span aria-hidden="true" className="text-2xl">{icon}</span>
                      <span className="text-center leading-tight">{name}</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      {earnedTier ? (
                        <>
                          <span aria-label={`${medal?.label ?? earnedTier} medal`} className="text-2xl">
                            {tierEmoji}
                          </span>
                          <span className={`text-[10px] ${isSelected ? 'text-on-primary/80' : 'text-on-surface/60'}`}>
                            {medal?.label ?? ''}
                          </span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true" className="text-2xl opacity-25 grayscale">🥉</span>
                          <span className={`text-[10px] ${isSelected ? 'text-on-primary/70' : 'text-on-surface/40'}`}>
                            No medal
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </ChunkyCardContent>
        </ChunkyCard>

        {/* Start buttons */}
        <div className="flex flex-col gap-2">
          <ChunkyButton variant="primary" size="lg" className="w-full" onClick={() => handleStart(mode === 'practice' ? 'practice' : 'scored')}>
            Start
          </ChunkyButton>
          <ChunkyButton variant="secondary" size="sm" className="w-full" onClick={() => handleStart('practice')}>
            Practice Mode
          </ChunkyButton>
        </div>

        <ChunkyButton variant="ghost" size="sm" onClick={onBack}>
          ← Back to Trivia
        </ChunkyButton>

        {/* Rules overlay — dismissible modal, separate from category selection */}
        {showRulesOverlay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 backdrop-blur-sm p-4" onClick={() => setShowRulesOverlay(false)}>
            <div className="bg-surface-container-high rounded-ds-lg p-6 max-w-md w-full shadow-hero" onClick={e => e.stopPropagation()}>
              <h3 className="text-on-surface text-lg font-bold mb-3">How to Play</h3>
              <ul className="text-on-surface/80 text-sm flex flex-col gap-2 mb-4">
                <li className="flex gap-2">
                  <span>❤️</span>
                  <span><strong>5 lives.</strong> A wrong answer costs one. Zero lives ends the run.</span>
                </li>
                <li className="flex gap-2">
                  <span>🔥</span>
                  <span><strong>Streak multiplier.</strong> ×1.5 at 5 correct → ×2 at 10 → ×3 at 20.</span>
                </li>
                <li className="flex gap-2">
                  <span>🩹</span>
                  <span><strong>Bonus life.</strong> Every 3-streak refunds a life (cap of 5).</span>
                </li>
                <li className="flex gap-2">
                  <span>⏭️</span>
                  <span><strong>Two skips.</strong> Skip a question — no life lost. Two per run.</span>
                </li>
              </ul>
              <ChunkyButton variant="primary" size="sm" className="w-full" onClick={() => setShowRulesOverlay(false)}>
                Got it
              </ChunkyButton>
            </div>
          </div>
        )}
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
        onFlagged={(questionId, result) => {
          handleQuestionFlagged(questionId, result)
          if (result.bonusLifeGranted) {
            setBonusLifeToast('❤️ +1 Bonus Life for reporting!')
            setTimeout(() => setBonusLifeToast(null), 3000)
          }
        }}
        skipsRemaining={state.skipsRemaining}
        onSkip={skipQuestion}
      />

      {/* Bonus life toast — shows for streak refund or flag reward */}
      {bonusLifeToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-ds-primary text-on-primary px-5 py-3 rounded-ds-md shadow-hero text-base font-semibold animate-bounce">
          {bonusLifeToast}
        </div>
      )}

      {/* Medal toast — shows when an answer crosses a tier line */}
      {medalToast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-50 bg-ds-tertiary text-on-tertiary px-5 py-3 rounded-ds-md shadow-hero text-base font-semibold animate-bounce ${
            bonusLifeToast ? 'top-40' : 'top-24'
          }`}
        >
          {medalToast}
        </div>
      )}

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
