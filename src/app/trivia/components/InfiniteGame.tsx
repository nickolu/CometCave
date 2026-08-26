'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

import { TIER_EMOJI, useCategoryMedals } from '@/app/trivia/hooks/useCategoryMedals'
import { useInfiniteRun } from '@/app/trivia/hooks/useInfiniteRun'
import type { InfiniteMode } from '@/app/trivia/hooks/useInfiniteRun'
import { getAuth } from 'firebase/auth'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'
import { CATEGORY_META, getCategoryIdByName } from '@/lib/trivia/categories'
import { getMedalTier, getNextThreshold } from '@/lib/trivia/medals'

import { InfiniteExhaustedScreen } from './InfiniteExhaustedScreen'
import { InfiniteHUD } from './InfiniteHUD'
import { InfiniteLoadingState } from './InfiniteLoadingState'
import { InfiniteQuestionCard } from './InfiniteQuestionCard'
import { InfiniteRunSummary } from './InfiniteRunSummary'
import { RateGate } from './RateGate'

const TIME_LIMIT = 60 // 60 seconds for AI free-text
const RULES_SEEN_KEY = 'cometcave-infinite-rules-seen-v1'

interface Props {
  onBack: () => void
  onViewStats?: () => void
  onViewLeaderboard?: () => void
  mode?: InfiniteMode
  initialCustomCategory?: string | null
  sampleExistingOnly?: boolean
}

export function InfiniteGame({ onBack, onViewStats, onViewLeaderboard, mode = 'scored', initialCustomCategory, sampleExistingOnly = false }: Props) {
  const { user, loading: authLoading } = useAuth()
  const { state, startRun, resumeRun, submitAnswer, nextQuestion, confirmReady, skipQuestion, endRun, handleQuestionFlagged } = useInfiniteRun()
  const [timeRemaining, setTimeRemaining] = useState(TIME_LIMIT)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStartRef = useRef<number>(0)
  const hasStartedRef = useRef(false)
  const autoStartedRef = useRef(false)
  const [showPreGame, setShowPreGame] = useState(true)
  // Empty set = "All Categories" (no filter). Players toggle individual
  // tiles to build up a multi-category selection.
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())
  const [customCategoryInput, setCustomCategoryInput] = useState('')
  const [showRulesOverlay, setShowRulesOverlay] = useState(false)
  const [bonusLifeToast, setBonusLifeToast] = useState<string | null>(null)
  const [medalToast, setMedalToast] = useState<string | null>(null)
  const prevLivesRef = useRef<number | null>(null)
  const flagBonusRef = useRef(false)
  const lastMedalAnswerIdRef = useRef<string | null>(null)
  const ratingsRef = useRef<Map<string, 'up' | 'down'>>(new Map())
  const bonusLifeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const medalTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [activeRun, setActiveRun] = useState<{
    runId: string
    mode: InfiniteMode
    categoryFilters: number[]
    customCategory: string | null
    score: number
    livesRemaining: number
    currentStreak: number
    longestStreak: number
    questionsAnswered: number
    skipsUsed: number
  } | null>(null)
  const [activeRunLoading, setActiveRunLoading] = useState(false)
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false)
  const pendingNavigateRef = useRef<(() => void) | null>(null)

  const categoryEntries = Object.entries(CATEGORY_META).map(([id, meta]) => ({
    id: Number(id),
    ...meta,
  }))

  const { byCategoryId: medalsByCategoryId } = useCategoryMedals()

  // Auto-start when launched from the question library with a custom topic.
  // Wait for auth to resolve before firing so the run fetch has credentials.
  useEffect(() => {
    if (!initialCustomCategory || autoStartedRef.current || authLoading) return
    autoStartedRef.current = true
    setShowPreGame(false)
    startRun(mode === 'practice' ? 'practice' : 'scored', [], initialCustomCategory, sampleExistingOnly)
  }, [initialCustomCategory, sampleExistingOnly, mode, startRun, authLoading])

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
    const trimmedCustom = customCategoryInput.trim().toLowerCase()
    const customCategory = trimmedCustom.length >= 3 ? trimmedCustom : null
    startRun(chosenMode, customCategory ? [] : Array.from(selectedCategoryIds), customCategory)
  }, [mode, startRun, selectedCategoryIds, customCategoryInput])

  const toggleCategoryId = useCallback((id: number) => {
    setCustomCategoryInput('')
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

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

  // Detect streak bonus life — compare lives before and after answering.
  // Skip when a flag bonus just granted the extra life (flagBonusRef).
  useEffect(() => {
    if (state.phase === 'answered' && state.lastAnswer?.correct && prevLivesRef.current !== null) {
      if (state.livesRemaining > prevLivesRef.current && !flagBonusRef.current) {
        setBonusLifeToast(`🔥 ${state.lastAnswer.currentStreak}-streak! +1 Bonus Life`)
        clearTimeout(bonusLifeTimerRef.current)
        bonusLifeTimerRef.current = setTimeout(() => setBonusLifeToast(null), 3000)
      }
      flagBonusRef.current = false
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
    clearTimeout(medalTimerRef.current)
    medalTimerRef.current = setTimeout(() => setMedalToast(null), 4000)
  }, [state.phase, state.lastAnswer, state.answers])

  useEffect(() => () => {
    clearTimeout(bonusLifeTimerRef.current)
    clearTimeout(medalTimerRef.current)
  }, [])

  const handlePlayAgain = useCallback(() => {
    setShowPreGame(true)
  }, [])

  // Fetch active (in-progress) run when the pre-game screen is shown.
  useEffect(() => {
    if (!showPreGame || !user || user.isAnonymous || authLoading) return
    setActiveRunLoading(true)
    const fetchActive = async () => {
      try {
        const token = await getAuth().currentUser?.getIdToken()
        if (!token) return
        const res = await fetch('/api/v1/trivia/infinite/runs?active=true', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) return
        const data = await res.json()
        setActiveRun(data.activeRun ?? null)
      } catch {
        setActiveRun(null)
      } finally {
        setActiveRunLoading(false)
      }
    }
    fetchActive()
  }, [showPreGame, user, authLoading])

  const handleSafeBack = useCallback(() => {
    const isRunning = ['playing', 'answered', 'answering', 'loading', 'awaiting-ready'].includes(state.phase)
    if (isRunning) {
      pendingNavigateRef.current = onBack
      setShowAbandonConfirm(true)
    } else {
      onBack()
    }
  }, [state.phase, onBack])

  const handleAbandonConfirm = useCallback(() => {
    setShowAbandonConfirm(false)
    if (timerRef.current) clearInterval(timerRef.current)
    endRun()
    const nav = pendingNavigateRef.current
    pendingNavigateRef.current = null
    nav?.()
  }, [endRun])

  const handleAbandonCancel = useCallback(() => {
    setShowAbandonConfirm(false)
    pendingNavigateRef.current = null
  }, [])

  // Warn on browser close/refresh during an active run
  useEffect(() => {
    const isRunning = ['playing', 'answered', 'answering'].includes(state.phase)
    if (!isRunning) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state.phase])

  // Pre-game screen — inline, not a modal
  if (showPreGame) {
    const selectionCount = selectedCategoryIds.size
    const trimmedCustom = customCategoryInput.trim()
    const hasValidCustom = trimmedCustom.length >= 3
    const isAllMode = selectionCount === 0 && !hasValidCustom
    const startLabel = hasValidCustom
      ? `Start: "${trimmedCustom}"`
      : isAllMode
        ? 'Start'
        : `Start (${selectionCount} categor${selectionCount === 1 ? 'y' : 'ies'})`
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

        {/* Resume card — shown when an in-progress run is found */}
        {activeRun && !activeRunLoading && (
          <div className="bg-ds-primary/10 border border-ds-primary/30 rounded-ds-md p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">⏸</span>
              <div>
                <div className="font-medium text-on-surface text-sm">Run in progress</div>
                <div className="text-on-surface/60 text-xs">
                  Score: {activeRun.score.toLocaleString()} · Streak: {activeRun.currentStreak} · {activeRun.questionsAnswered} questions answered
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <ChunkyButton
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setShowPreGame(false)
                  resumeRun({
                    ...activeRun,
                    categoryIds: activeRun.categoryFilters,
                  })
                }}
              >
                Resume
              </ChunkyButton>
              <ChunkyButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  const token = getAuth().currentUser?.getIdToken()
                  token?.then(t => {
                    fetch(`/api/v1/trivia/infinite/runs/${activeRun.runId}/end`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }
                    })
                  })
                  setActiveRun(null)
                }}
              >
                Discard
              </ChunkyButton>
            </div>
          </div>
        )}

        {/* All Categories quick-pick stays above the scrollable grid so
            it doesn't get hidden when the player scrolls through tiles. */}
        <button
          type="button"
          onClick={() => { setSelectedCategoryIds(new Set()); setCustomCategoryInput('') }}
          className={`flex items-center justify-center gap-2 py-2 rounded-ds-md text-sm font-medium transition-colors ${
            isAllMode
              ? 'bg-ds-primary text-on-primary'
              : 'bg-surface-container text-on-surface/80 hover:bg-surface-container-highest'
          }`}
        >
          <span aria-hidden="true">🌐</span>
          All Categories
        </button>

        {/* Browse + multi-select categories. Grid is constrained to
            ~half the viewport and scrolls internally so the Start button
            below stays in view on every device. */}
        <ChunkyCard variant="surface-variant">
          <ChunkyCardContent className="pt-4 pb-4 flex flex-col gap-3">
            <p className="text-on-surface/70 text-sm font-medium">
              Pick categories
              {selectionCount > 0 && (
                <span className="ml-2 text-on-surface/50 text-xs">
                  · {selectionCount} selected
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto pr-1">
              {categoryEntries.map(({ id, name, icon }) => {
                const medal = medalsByCategoryId.get(id)
                const earnedTier = medal && medal.tier !== 'none' ? medal.tier : null
                const tierEmoji = earnedTier ? TIER_EMOJI[earnedTier] : null
                const isSelected = selectedCategoryIds.has(id)
                const titleText = medal && medal.label
                  ? `${medal.label} — ${medal.correctCount} correct${medal.nextThreshold ? ` (next tier at ${medal.nextThreshold})` : ''}`
                  : medal
                    ? `${medal.correctCount} correct${medal.nextThreshold ? ` (first tier at ${medal.nextThreshold})` : ''}`
                    : undefined
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCategoryId(id)}
                    title={titleText}
                    aria-pressed={isSelected}
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
            <div className="pt-2 border-t border-outline/20">
              <p className="text-on-surface/70 text-sm font-medium mb-2">Or type your own topic:</p>
              <input
                type="text"
                value={customCategoryInput}
                onChange={(e) => {
                  setCustomCategoryInput(e.target.value)
                  if (e.target.value.trim().length > 0) {
                    setSelectedCategoryIds(new Set())
                  }
                }}
                placeholder="e.g. Roman Empire, Pokemon Gen 1"
                className="w-full px-3 py-2 rounded-ds-md bg-surface-container-highest text-on-surface text-sm border border-outline/30 focus:outline-none focus:ring-2 focus:ring-ds-primary placeholder:text-on-surface/40"
              />
              {customCategoryInput.trim().length > 0 && customCategoryInput.trim().length < 3 && (
                <p className="text-ds-error text-xs mt-1">Topic must be at least 3 characters.</p>
              )}
            </div>
          </ChunkyCardContent>
        </ChunkyCard>

        {/* Primary call-to-action sits below the scrollable grid; the
            grid's max-height keeps these buttons visible without
            requiring any page scroll. */}
        <div className="flex flex-col gap-2">
          <ChunkyButton
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => handleStart(mode === 'practice' ? 'practice' : 'scored')}
            disabled={trimmedCustom.length > 0 && !hasValidCustom}
          >
            {startLabel}
          </ChunkyButton>
          <ChunkyButton
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => handleStart('practice')}
            disabled={trimmedCustom.length > 0 && !hasValidCustom}
          >
            Practice Mode
          </ChunkyButton>
        </div>

        <ChunkyButton variant="ghost" size="sm" onClick={onBack}>
          ← Back to Trivia
        </ChunkyButton>

        {/* Rules overlay — dismissible modal, separate from category selection */}
        {showRulesOverlay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 backdrop-blur-sm p-4" onClick={() => setShowRulesOverlay(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="rules-overlay-title"
              className="bg-surface-container-high rounded-ds-lg p-6 max-w-md w-full shadow-hero"
              onClick={e => e.stopPropagation()}
              onKeyDown={e => { if (e.key === 'Escape') setShowRulesOverlay(false) }}
            >
              <h3 id="rules-overlay-title" className="text-on-surface text-lg font-bold mb-3">How to Play</h3>
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

  // Abandon confirmation dialog — shown on top of all game states
  if (showAbandonConfirm) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 max-w-lg mx-auto text-center">
        <h2 className="font-headline text-xl text-on-surface">Abandon this run?</h2>
        <p className="text-on-surface/60 text-sm">
          Your progress (score: {state.score.toLocaleString()}, streak: {state.longestStreak}) will be saved, but the run will end.
        </p>
        <div className="flex gap-3">
          <ChunkyButton variant="secondary" onClick={handleAbandonCancel}>Keep playing</ChunkyButton>
          <ChunkyButton variant="primary" onClick={handleAbandonConfirm}>End run</ChunkyButton>
        </div>
      </div>
    )
  }

  // Idle — pre-fetch / pre-start. Bare placeholder; pre-game screen above
  // catches the actual "ready to start" state.
  if (state.phase === 'idle') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 max-w-lg mx-auto">
        <div className="text-on-surface/60 text-lg">Loading Infinite Trivia…</div>
      </div>
    )
  }

  // Loading or ready-to-reveal: cosmic spinner + researchy copy. The loading
  // component escalates from a brief spinner to the full research treatment
  // after a short delay; awaiting-ready always renders the full treatment
  // with a Ready CTA so a player who walked away doesn't burn the timer.
  if (state.phase === 'loading' || state.phase === 'awaiting-ready') {
    return (
      <InfiniteLoadingState
        phase={state.phase}
        onReady={confirmReady}
      />
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
    return <InfiniteRunSummary state={state} onPlayAgain={handlePlayAgain} onBack={onBack} onViewStats={onViewStats} onViewLeaderboard={onViewLeaderboard} mode={state.mode} runId={state.runId} onFlagged={handleQuestionFlagged} ratings={ratingsRef.current} />
  }

  // Playing or answered
  if (!state.question) return null

  // Live per-category progress for the question currently on screen.
  // Lifetime baseline comes from the category-stats fetch on mount; in-run
  // delta is tracked by useInfiniteRun. Combined they give the count we
  // display, plus the next-tier threshold for the "47 / 64" suffix.
  const currentQuestionCategoryId = state.question
    ? getCategoryIdByName(state.question.category)
    : null
  const currentQuestionCategoryMeta =
    currentQuestionCategoryId !== null ? CATEGORY_META[currentQuestionCategoryId] : null
  const baselineCount =
    currentQuestionCategoryId !== null
      ? medalsByCategoryId.get(currentQuestionCategoryId)?.correctCount ?? 0
      : 0
  const runDelta =
    currentQuestionCategoryId !== null
      ? state.correctsByCategoryThisRun[currentQuestionCategoryId] ?? 0
      : 0
  const liveCorrectCount = baselineCount + runDelta
  const categoryProgress =
    currentQuestionCategoryId !== null && currentQuestionCategoryMeta && state.mode === 'scored'
      ? {
          name: currentQuestionCategoryMeta.name,
          icon: currentQuestionCategoryMeta.icon,
          correctCount: liveCorrectCount,
          nextThreshold: getNextThreshold(getMedalTier(liveCorrectCount)),
        }
      : null

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
        categoryName={
          state.customCategory
            ? state.customCategory
            : state.categoryIds.length === 1
              ? CATEGORY_META[state.categoryIds[0]]?.name
              : state.categoryIds.length > 1
                ? `${state.categoryIds.length} categories`
                : undefined
        }
        categoryProgress={categoryProgress}
        skipsRemaining={state.skipsRemaining}
      />

      <InfiniteQuestionCard
        key={state.question.id}
        question={state.question}
        onSubmit={submitAnswer}
        isSubmitting={state.phase === 'answering'}
        answerResult={state.lastAnswer}
        questionsAnswered={state.questionsAnswered}
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
          // End-of-run is an emotional beat — let the player see their
          // summary without a forced rating step. They can still rate
          // each question inside the summary view.
          <ChunkyButton variant="primary" size="lg" className="w-full" onClick={endRun}>
            View Run Summary
          </ChunkyButton>
        ) : (
          (() => {
            // Capture id outside the flag callback so the closure
            // doesn't reach back into a possibly-null state.question
            // after a phase transition.
            const qid = state.question.id
            return (
              <RateGate
                questionId={qid}
                runId={state.runId}
                onComplete={nextQuestion}
                onRated={(id, vote) => ratingsRef.current.set(id, vote)}
                onFlagged={(result) => {
                  handleQuestionFlagged(qid, result)
                  if (result.bonusLifeGranted) {
                    flagBonusRef.current = true
                    setBonusLifeToast('❤️ +1 Bonus Life for reporting!')
                    clearTimeout(bonusLifeTimerRef.current)
                    bonusLifeTimerRef.current = setTimeout(() => setBonusLifeToast(null), 3000)
                  }
                }}
              />
            )
          })()
        )
      )}
    </div>
  )
}
