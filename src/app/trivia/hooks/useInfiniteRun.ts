'use client'
import { useCallback, useRef, useState } from 'react'

import { type AnswerResult, LIVES_START, SKIPS_PER_RUN } from '@/app/trivia/lib/infiniteScoring'
import { useAuth } from '@/hooks/useAuth'
import { getCategoryIdByName } from '@/lib/trivia/categories'
import type { MedalEarned } from '@/lib/trivia/medals'

export type InfinitePhase = 'idle' | 'loading' | 'awaiting-ready' | 'playing' | 'answering' | 'answered' | 'exhausted' | 'ended' | 'error'
export type InfiniteMode = 'scored' | 'practice'

// If a between-question fetch takes longer than this, gate the next question
// behind a Ready click — so a player who wandered off doesn't burn the
// per-question timer the moment the question lands.
const READY_GATE_THRESHOLD_MS = 1200

export interface InfiniteQuestion {
  id: string
  question: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  timesShown: number
}

export interface InfiniteRunState {
  phase: InfinitePhase
  mode: InfiniteMode
  // Empty array = all categories.
  categoryIds: number[]
  // Custom topic for on-the-fly question generation. Mutually exclusive with categoryIds.
  customCategory: string | null
  // When true, custom-category runs sample from existing questions only (no generation).
  sampleExistingOnly: boolean
  runId: string | null
  question: InfiniteQuestion | null
  livesRemaining: number
  currentStreak: number
  longestStreak: number
  score: number
  questionsAnswered: number
  trailblazes: number
  bonusLivesEarned: number
  skipsRemaining: number
  skipsUsed: number
  flaggedQuestionIds: string[]
  lastAnswer: (AnswerResult & { trailblazer: boolean; correctAnswer: string; explanation: string | null; timesShown?: number; timesCorrect?: number; medalEarned?: MedalEarned | null; topWrongAnswers?: Array<{ text: string; count: number }> }) | null
  // Per-category correct-answer deltas accumulated within the current run.
  // Combined with each category's lifetime baseline (from the category-stats
  // API), this gives the player's live count for any question.
  correctsByCategoryThisRun: Record<number, number>
  answers: Array<{
    questionId: string
    correct: boolean
    points: number
    timeMs: number
    trailblazer: boolean
    userAnswer: string
    questionText: string
    category: string
    difficulty: 'easy' | 'medium' | 'hard'
    correctAnswer: string
    explanation: string | null
  }>
  error: string | null
}

export function useInfiniteRun() {
  const [state, setState] = useState<InfiniteRunState>({
    phase: 'idle',
    mode: 'scored',
    categoryIds: [],
    customCategory: null,
    sampleExistingOnly: false,
    runId: null,
    question: null,
    livesRemaining: LIVES_START,
    currentStreak: 0,
    longestStreak: 0,
    score: 0,
    questionsAnswered: 0,
    trailblazes: 0,
    bonusLivesEarned: 0,
    skipsRemaining: SKIPS_PER_RUN,
    skipsUsed: 0,
    flaggedQuestionIds: [],
    lastAnswer: null,
    correctsByCategoryThisRun: {},
    answers: [],
    error: null,
  })
  const { user } = useAuth()
  const startTimeRef = useRef<number>(0)
  const prefetchAbortRef = useRef<AbortController | null>(null)
  // Resolved prefetch value, written by the in-flight prefetch IIFE when it
  // succeeds. nextQuestion checks this first for the synchronous fast path.
  const prefetchedQuestionRef = useRef<InfiniteQuestion | null>(null)
  // Promise handle for the in-flight prefetch. nextQuestion awaits this
  // (with a bounded timeout) when the prefetch hasn't resolved yet, instead
  // of cancelling it and firing a redundant /next — generation that's
  // already on the server keeps running, and the player avoids paying a
  // second round-trip + a second generation budget on top of the first.
  // The timeout exists because a stuck server call would otherwise wedge
  // the click handler indefinitely (the latched-in-flight bug).
  const prefetchPromiseRef = useRef<Promise<InfiniteQuestion | null> | null>(null)
  // Guards against a second nextQuestion firing while the first is still
  // running (a stray re-tap would otherwise kick off a parallel fetch whose
  // late-arriving response clobbers the question the player is already
  // reading).
  const nextQuestionInFlightRef = useRef(false)

  const getAuthHeaders = useCallback(async () => {
    if (!user) throw new Error('Not authenticated')
    const token = await user.getIdToken()
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }
  }, [user])

  const cancelPrefetch = useCallback(() => {
    if (prefetchAbortRef.current) {
      prefetchAbortRef.current.abort()
      prefetchAbortRef.current = null
    }
    prefetchedQuestionRef.current = null
    prefetchPromiseRef.current = null
  }, [])

  // Detach the in-flight prefetch refs WITHOUT aborting the request. Used
  // when nextQuestion has decided to fall through to a fresh fetch after
  // a prefetch timed out — we let the server-side call finish so the
  // generated question still lands in the bank for someone (rather than
  // burning the generation budget on nothing), but stop the IIFE from
  // writing into our refs after we've moved on.
  const detachPrefetch = useCallback(() => {
    prefetchAbortRef.current = null
    prefetchedQuestionRef.current = null
    prefetchPromiseRef.current = null
  }, [])

  const startPrefetch = useCallback((streak: number, categoryIds: number[], customCategory: string | null, sampleExistingOnly = false) => {
    cancelPrefetch()
    const controller = new AbortController()
    prefetchAbortRef.current = controller
    const promise = (async (): Promise<InfiniteQuestion | null> => {
      try {
        const headers = await getAuthHeaders()
        const params = new URLSearchParams({ streak: String(streak) })
        if (customCategory) {
          params.set('customCategory', customCategory)
        } else if (categoryIds.length > 0) {
          params.set('categoryIds', categoryIds.join(','))
        }
        if (sampleExistingOnly) params.set('sampleExistingOnly', '1')
        const qRes = await fetch(`/api/v1/trivia/infinite/next?${params.toString()}`, {
          headers,
          signal: controller.signal,
        })
        if (qRes.status === 204 || !qRes.ok) return null
        const question = (await qRes.json()) as InfiniteQuestion
        // Only stash if this prefetch is still the active one — a
        // newer cancelPrefetch/startPrefetch may have superseded us
        // while we were awaiting the network.
        if (prefetchAbortRef.current === controller) {
          prefetchedQuestionRef.current = question
        }
        return question
      } catch {
        return null
      }
    })()
    prefetchPromiseRef.current = promise
  }, [cancelPrefetch, getAuthHeaders])

  const startRun = useCallback(async (mode: InfiniteMode = 'scored', categoryIds: number[] = [], customCategory: string | null = null, sampleExistingOnly = false) => {
    cancelPrefetch()
    setState(s => ({ ...s, phase: 'loading', mode, categoryIds, customCategory, sampleExistingOnly, error: null }))
    try {
      const headers = await getAuthHeaders()
      const body: Record<string, unknown> = { mode, categoryIds }
      if (customCategory) body.customCategory = customCategory
      const res = await fetch('/api/v1/trivia/infinite/runs', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to start run')
      const data = await res.json()

      // Immediately fetch first question
      const firstParams = new URLSearchParams({ streak: '0' })
      if (customCategory) {
        firstParams.set('customCategory', customCategory)
      } else if (categoryIds.length > 0) {
        firstParams.set('categoryIds', categoryIds.join(','))
      }
      if (sampleExistingOnly) firstParams.set('sampleExistingOnly', '1')
      const qRes = await fetch(`/api/v1/trivia/infinite/next?${firstParams.toString()}`, { headers })
      if (qRes.status === 204) {
        setState(s => ({ ...s, phase: 'exhausted', runId: data.runId }))
        return
      }
      if (qRes.status === 429) {
        setState(s => ({ ...s, phase: 'error', error: 'Too many fresh questions generated for now. Try again in a bit.' }))
        return
      }
      if (!qRes.ok) throw new Error('Failed to fetch question')
      const question = await qRes.json()

      // First question always gates behind a Ready click — starting a run is
      // a deliberate moment and the player may have stepped away during setup.
      setState(s => ({
        ...s,
        phase: 'awaiting-ready',
        mode,
        categoryIds,
        customCategory,
        sampleExistingOnly,
        runId: data.runId,
        question,
        livesRemaining: data.livesRemaining,
        currentStreak: 0,
        longestStreak: 0,
        score: 0,
        questionsAnswered: 0,
        trailblazes: 0,
        bonusLivesEarned: 0,
        skipsRemaining: SKIPS_PER_RUN,
        skipsUsed: 0,
        flaggedQuestionIds: [],
        lastAnswer: null,
        correctsByCategoryThisRun: {},
        answers: [],
      }))
    } catch (err) {
      console.error('[infinite] startRun failed:', err)
      setState(s => ({ ...s, phase: 'error', error: 'Failed to start run.' }))
    }
  }, [getAuthHeaders, cancelPrefetch])

  const submitAnswer = useCallback(async (answer: string) => {
    if (state.phase !== 'playing' || !state.runId || !state.question) return

    const currentQuestion = state.question
    const currentQuestionId = currentQuestion.id
    setState(s => ({ ...s, phase: 'answering' }))
    const elapsedMs = Date.now() - startTimeRef.current

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/v1/trivia/infinite/runs/${state.runId}/answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          questionId: currentQuestionId,
          answer,
          elapsedMs,
        }),
      })
      if (res.status === 409) {
        cancelPrefetch()
        setState(s => ({ ...s, phase: 'ended' }))
        return
      }
      if (!res.ok) throw new Error('Failed to submit answer')
      const result = await res.json()

      // Kick off the next question fetch in the background while the player
      // reads their feedback — only when the run is continuing.
      if (!result.runOver) {
        startPrefetch(result.currentStreak, state.categoryIds, state.customCategory, state.sampleExistingOnly)
      }

      // If this was a correct answer in scored mode, increment the live
      // per-category counter (HUD shows it as the player's current count).
      const answeredCategoryId = getCategoryIdByName(currentQuestion.category)

      // Always show the answer feedback (correct answer + explanation + rating)
      // before transitioning to the summary, even when this answer ended the
      // run. The player clicks through to view the summary.
      setState(s => {
        const shouldBump = result.correct && s.mode === 'scored' && answeredCategoryId !== null
        return {
        ...s,
        phase: 'answered',
        lastAnswer: result,
        livesRemaining: result.livesRemaining,
        currentStreak: result.currentStreak,
        longestStreak: result.longestStreak,
        score: result.score,
        questionsAnswered: s.questionsAnswered + 1,
        trailblazes: result.trailblazer ? s.trailblazes + 1 : s.trailblazes,
        correctsByCategoryThisRun: shouldBump && answeredCategoryId !== null
          ? { ...s.correctsByCategoryThisRun, [answeredCategoryId]: (s.correctsByCategoryThisRun[answeredCategoryId] ?? 0) + 1 }
          : s.correctsByCategoryThisRun,
        answers: [...s.answers, {
          questionId: currentQuestionId,
          correct: result.correct,
          points: result.points,
          timeMs: elapsedMs,
          trailblazer: result.trailblazer,
          userAnswer: answer,
          questionText: currentQuestion.question,
          category: currentQuestion.category,
          difficulty: currentQuestion.difficulty,
          correctAnswer: result.correctAnswer,
          explanation: result.explanation,
        }],
        }
      })
    } catch (err) {
      console.error('[infinite] submitAnswer failed:', err)
      setState(s => ({ ...s, phase: 'error', error: 'Failed to submit answer.' }))
    }
  }, [state.phase, state.runId, state.question, state.categoryIds, state.customCategory, state.sampleExistingOnly, getAuthHeaders, startPrefetch, cancelPrefetch])

  const nextQuestion = useCallback(async () => {
    if (state.phase !== 'answered' || !state.runId) return
    if (nextQuestionInFlightRef.current) return
    nextQuestionInFlightRef.current = true

    // After every await, a second nextQuestion call (or stray click) may
    // have already settled the run; only apply our setState if the run is
    // still in a phase we own (answered → loading → playing/awaiting-ready).
    const applyQuestion = (question: InfiniteQuestion, elapsed: number) => {
      setState(s => {
        if (s.phase !== 'answered' && s.phase !== 'loading') return s
        if (elapsed > READY_GATE_THRESHOLD_MS) {
          return { ...s, phase: 'awaiting-ready', question, lastAnswer: null }
        }
        startTimeRef.current = Date.now()
        return { ...s, phase: 'playing', question, lastAnswer: null }
      })
    }

    // Flip to 'loading' synchronously so the answered card disappears the
    // instant the player taps Next Question.
    setState(s => (s.phase === 'answered' ? { ...s, phase: 'loading' } : s))

    // Upper bound on how long we'll wait for an in-flight prefetch before
    // falling through to a fresh fetch. Tuned to cover the AI-generation
    // path on cache-miss (~3-8s) without letting a stuck server call wedge
    // the click handler — the prefetch IIFE is detached past this point,
    // and a fresh /next is fired so the player isn't stranded.
    const PREFETCH_WAIT_BUDGET_MS = 8000

    try {
      const fetchStartedAt = Date.now()

      // Fast path: the background prefetch already resolved. Use it
      // synchronously.
      const cachedPrefetch = prefetchedQuestionRef.current
      if (cachedPrefetch) {
        cancelPrefetch()
        applyQuestion(cachedPrefetch, Date.now() - fetchStartedAt)
        return
      }

      // Prefetch is still in flight. Wait for it with a bounded timeout
      // instead of cancelling and re-issuing — the in-flight request will
      // almost always beat a fresh round trip, and aborting would force the
      // player to pay a second generation budget on cache-miss /next calls.
      const inflight = prefetchPromiseRef.current
      if (inflight) {
        const timeout = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), PREFETCH_WAIT_BUDGET_MS)
        })
        const resolved = await Promise.race([inflight, timeout])
        if (resolved) {
          cancelPrefetch()
          applyQuestion(resolved, Date.now() - fetchStartedAt)
          return
        }
        // Wait budget exhausted. Detach (don't abort) so the in-flight
        // call still benefits the bank if it eventually completes server-
        // side, then fall through to a fresh fetch.
        detachPrefetch()
      }

      try {
        const headers = await getAuthHeaders()
        const nextParams = new URLSearchParams({ streak: String(state.currentStreak) })
        if (state.customCategory) {
          nextParams.set('customCategory', state.customCategory)
        } else if (state.categoryIds.length > 0) {
          nextParams.set('categoryIds', state.categoryIds.join(','))
        }
        if (state.sampleExistingOnly) nextParams.set('sampleExistingOnly', '1')
        const qRes = await fetch(`/api/v1/trivia/infinite/next?${nextParams.toString()}`, { headers })
        if (qRes.status === 204) {
          setState(s => ({ ...s, phase: 'exhausted' }))
          return
        }
        if (qRes.status === 429) {
          setState(s => ({ ...s, phase: 'error', error: 'Too many fresh questions generated for now. Try again in a bit.' }))
          return
        }
        if (!qRes.ok) throw new Error('Failed to fetch question')
        const question = await qRes.json()

        applyQuestion(question, Date.now() - fetchStartedAt)
      } catch (err) {
        console.error('[infinite] nextQuestion failed:', err)
        setState(s => ({ ...s, phase: 'error', error: 'Failed to fetch next question.' }))
      }
    } finally {
      nextQuestionInFlightRef.current = false
    }
  }, [state.phase, state.runId, state.currentStreak, state.categoryIds, state.customCategory, state.sampleExistingOnly, getAuthHeaders, cancelPrefetch, detachPrefetch])

  // Player clicked "Ready" on the gated loading screen — start the
  // per-question timer now and reveal the question.
  const confirmReady = useCallback(() => {
    setState(s => {
      if (s.phase !== 'awaiting-ready' || !s.question) return s
      startTimeRef.current = Date.now()
      return { ...s, phase: 'playing' }
    })
  }, [])

  const skipQuestion = useCallback(async () => {
    if (state.phase !== 'playing' || state.skipsRemaining <= 0 || !state.question || !state.runId) return

    const questionId = state.question.id
    cancelPrefetch()

    setState(s => ({
      ...s,
      phase: 'answering',
      skipsRemaining: s.skipsRemaining - 1,
      skipsUsed: s.skipsUsed + 1,
    }))

    try {
      // Record skip on server and get the correct answer
      const headers = await getAuthHeaders()
      const skipRes = await fetch(`/api/v1/trivia/infinite/runs/${state.runId}/skip`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ questionId }),
      })
      const skipData: { correctAnswer: string | null; explanation: string | null; timesShown?: number; timesCorrect?: number } = skipRes.ok
        ? await skipRes.json()
        : { correctAnswer: null, explanation: null }

      const correctAnswer: string = skipData.correctAnswer ?? 'Unknown'
      const explanation: string | null = skipData.explanation ?? null

      // Show the result as incorrect (skipped) but don't deduct a life
      setState(s => {
        const lastAnswer: InfiniteRunState['lastAnswer'] = {
          correct: false,
          points: 0,
          trailblazer: false,
          livesRemaining: s.livesRemaining, // No life deducted for skip
          currentStreak: 0,
          longestStreak: s.longestStreak,
          score: s.score,
          runOver: false,
          correctAnswer,
          explanation,
          timesShown: skipData.timesShown,
          timesCorrect: skipData.timesCorrect,
        }
        return {
          ...s,
          phase: 'answered' as const,
          questionsAnswered: s.questionsAnswered + 1,
          lastAnswer,
          currentStreak: 0,
          answers: [
            ...s.answers,
            { questionId, correct: false, points: 0, timeMs: 0, trailblazer: false, userAnswer: '(skipped)', questionText: s.question?.question ?? '', category: s.question?.category ?? '', difficulty: s.question?.difficulty ?? 'medium', correctAnswer, explanation },
          ],
        }
      })

      // Next question will be fetched when the user clicks "Next Question"
    } catch (err) {
      console.error('[infinite] skipQuestion failed:', err)
      setState(s => ({ ...s, phase: 'error', error: 'Failed to skip question.' }))
    }
  }, [state.phase, state.skipsRemaining, state.question, state.runId, getAuthHeaders, cancelPrefetch])

  const endRun = useCallback(async () => {
    cancelPrefetch()
    // If the server already auto-finalized this run (lives reached 0), skip
    // the redundant /end call and just navigate to the summary.
    const alreadyEnded = state.lastAnswer?.runOver === true
    if (!state.runId || alreadyEnded) {
      setState(s => ({ ...s, phase: 'ended' }))
      return
    }
    try {
      const headers = await getAuthHeaders()
      await fetch(`/api/v1/trivia/infinite/runs/${state.runId}/end`, {
        method: 'POST',
        headers,
      })
    } catch {
      // Best effort
    }
    setState(s => ({ ...s, phase: 'ended' }))
  }, [state.runId, state.lastAnswer, getAuthHeaders, cancelPrefetch])

  const resumeRun = useCallback(async (activeRun: {
    runId: string
    mode: InfiniteMode
    categoryIds: number[]
    customCategory: string | null
    score: number
    livesRemaining: number
    currentStreak: number
    longestStreak: number
    questionsAnswered: number
    skipsUsed: number
  }) => {
    cancelPrefetch()
    setState(s => ({ ...s, phase: 'loading', mode: activeRun.mode, error: null,
      runId: activeRun.runId,
      categoryIds: activeRun.categoryIds,
      customCategory: activeRun.customCategory,
      sampleExistingOnly: false,
      score: activeRun.score,
      livesRemaining: activeRun.livesRemaining,
      currentStreak: activeRun.currentStreak,
      longestStreak: activeRun.longestStreak,
      questionsAnswered: activeRun.questionsAnswered,
      skipsUsed: activeRun.skipsUsed,
      skipsRemaining: Math.max(0, SKIPS_PER_RUN - activeRun.skipsUsed),
    }))
    try {
      const headers = await getAuthHeaders()
      const params = new URLSearchParams({ streak: String(activeRun.currentStreak) })
      if (activeRun.customCategory) {
        params.set('customCategory', activeRun.customCategory)
      } else if (activeRun.categoryIds.length > 0) {
        params.set('categoryIds', activeRun.categoryIds.join(','))
      }
      const qRes = await fetch(`/api/v1/trivia/infinite/next?${params.toString()}`, { headers })
      if (qRes.status === 204) {
        setState(s => ({ ...s, phase: 'exhausted', runId: activeRun.runId }))
        return
      }
      if (!qRes.ok) throw new Error('Failed to fetch question for resumed run')
      const question = await qRes.json()

      setState(s => ({
        ...s,
        phase: 'awaiting-ready',
        question,
        lastAnswer: null,
        correctsByCategoryThisRun: {},
        answers: [],
        flaggedQuestionIds: [],
        trailblazes: activeRun.questionsAnswered,
        bonusLivesEarned: 0,
      }))
    } catch (err) {
      console.error('[infinite] resumeRun failed:', err)
      setState(s => ({ ...s, phase: 'error', error: 'Failed to resume run.' }))
    }
  }, [getAuthHeaders, cancelPrefetch])

  const handleQuestionFlagged = useCallback((questionId: string, result: { bonusLifeGranted: boolean }) => {
    setState(s => {
      const newFlaggedQuestionIds = s.flaggedQuestionIds.includes(questionId)
        ? s.flaggedQuestionIds
        : [...s.flaggedQuestionIds, questionId]

      // Remove flagged answer from answers array (stats scrub)
      const newAnswers = s.answers.filter(a => a.questionId !== questionId)
      const answersRemoved = s.answers.length - newAnswers.length

      return {
        ...s,
        livesRemaining: result.bonusLifeGranted ? s.livesRemaining + 1 : s.livesRemaining,
        bonusLivesEarned: result.bonusLifeGranted ? s.bonusLivesEarned + 1 : s.bonusLivesEarned,
        flaggedQuestionIds: newFlaggedQuestionIds,
        answers: newAnswers,
        questionsAnswered: Math.max(0, s.questionsAnswered - answersRemoved),
      }
    })
  }, [])

  return { state, startRun, resumeRun, submitAnswer, nextQuestion, confirmReady, skipQuestion, endRun, handleQuestionFlagged }
}
