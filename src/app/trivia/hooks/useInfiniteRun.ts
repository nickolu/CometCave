'use client'
import { useCallback, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LIVES_START, SKIPS_PER_RUN, type AnswerResult } from '@/app/trivia/lib/infiniteScoring'

export type InfinitePhase = 'idle' | 'loading' | 'playing' | 'answering' | 'answered' | 'exhausted' | 'ended' | 'error'
export type InfiniteMode = 'scored' | 'practice'

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
  categoryId: number | null
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
  lastAnswer: (AnswerResult & { trailblazer: boolean; correctAnswer: string; explanation: string | null }) | null
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
    categoryId: null,
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
    answers: [],
    error: null,
  })
  const { user } = useAuth()
  const startTimeRef = useRef<number>(0)
  const prefetchRef = useRef<Promise<InfiniteQuestion | null> | null>(null)
  const prefetchAbortRef = useRef<AbortController | null>(null)

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
    prefetchRef.current = null
  }, [])

  const startPrefetch = useCallback((streak: number, categoryId?: number | null) => {
    cancelPrefetch()
    const controller = new AbortController()
    prefetchAbortRef.current = controller
    prefetchRef.current = (async (): Promise<InfiniteQuestion | null> => {
      try {
        const headers = await getAuthHeaders()
        const params = new URLSearchParams({ streak: String(streak) })
        if (categoryId != null) params.set('categoryId', String(categoryId))
        const qRes = await fetch(`/api/v1/trivia/infinite/next?${params.toString()}`, {
          headers,
          signal: controller.signal,
        })
        if (qRes.status === 204 || !qRes.ok) return null
        return (await qRes.json()) as InfiniteQuestion
      } catch {
        return null
      }
    })()
  }, [cancelPrefetch, getAuthHeaders])

  const startRun = useCallback(async (mode: InfiniteMode = 'scored', categoryId?: number) => {
    cancelPrefetch()
    setState(s => ({ ...s, phase: 'loading', mode, categoryId: categoryId ?? null, error: null }))
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/v1/trivia/infinite/runs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode, categoryId: categoryId ?? null }),
      })
      if (!res.ok) throw new Error('Failed to start run')
      const data = await res.json()

      // Immediately fetch first question
      const firstParams = new URLSearchParams({ streak: '0' })
      if (categoryId != null) firstParams.set('categoryId', String(categoryId))
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

      startTimeRef.current = Date.now()
      setState(s => ({
        ...s,
        phase: 'playing',
        mode,
        categoryId: categoryId ?? null,
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
        startPrefetch(result.currentStreak, state.categoryId)
      }

      // Always show the answer feedback (correct answer + explanation + rating)
      // before transitioning to the summary, even when this answer ended the
      // run. The player clicks through to view the summary.
      setState(s => ({
        ...s,
        phase: 'answered',
        lastAnswer: result,
        livesRemaining: result.livesRemaining,
        currentStreak: result.currentStreak,
        longestStreak: result.longestStreak,
        score: result.score,
        questionsAnswered: s.questionsAnswered + 1,
        trailblazes: result.trailblazer ? s.trailblazes + 1 : s.trailblazes,
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
      }))
    } catch (err) {
      console.error('[infinite] submitAnswer failed:', err)
      setState(s => ({ ...s, phase: 'error', error: 'Failed to submit answer.' }))
    }
  }, [state.phase, state.runId, state.question, state.categoryId, getAuthHeaders, startPrefetch, cancelPrefetch])

  const nextQuestion = useCallback(async () => {
    if (state.phase !== 'answered' || !state.runId) return

    // If a prefetch is in-flight or already complete, await/consume it before
    // falling back to a fresh request.
    if (prefetchRef.current) {
      const pending = prefetchRef.current
      prefetchRef.current = null
      prefetchAbortRef.current = null
      const prefetched = await pending
      if (prefetched) {
        startTimeRef.current = Date.now()
        setState(s => ({ ...s, phase: 'playing', question: prefetched, lastAnswer: null }))
        return
      }
    }

    setState(s => ({ ...s, phase: 'loading' }))
    try {
      const headers = await getAuthHeaders()
      const nextParams = new URLSearchParams({ streak: String(state.currentStreak) })
      if (state.categoryId != null) nextParams.set('categoryId', String(state.categoryId))
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

      startTimeRef.current = Date.now()
      setState(s => ({ ...s, phase: 'playing', question, lastAnswer: null }))
    } catch (err) {
      console.error('[infinite] nextQuestion failed:', err)
      setState(s => ({ ...s, phase: 'error', error: 'Failed to fetch next question.' }))
    }
  }, [state.phase, state.runId, state.currentStreak, state.categoryId, getAuthHeaders])

  const skipQuestion = useCallback(async () => {
    if (state.phase !== 'playing' || state.skipsRemaining <= 0 || !state.question || !state.runId) return

    const questionId = state.question.id
    cancelPrefetch()

    setState(s => ({
      ...s,
      phase: 'loading',
      skipsRemaining: s.skipsRemaining - 1,
      skipsUsed: s.skipsUsed + 1,
    }))

    // Fire-and-forget: record skip on the server
    getAuthHeaders().then(headers =>
      fetch(`/api/v1/trivia/infinite/runs/${state.runId}/skip`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ questionId }),
      })
    ).catch(() => {
      // Best effort
    })

    try {
      const headers = await getAuthHeaders()
      const nextParams = new URLSearchParams({ streak: String(state.currentStreak) })
      if (state.categoryId != null) nextParams.set('categoryId', String(state.categoryId))
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

      startTimeRef.current = Date.now()
      setState(s => ({ ...s, phase: 'playing', question, lastAnswer: null }))
    } catch (err) {
      console.error('[infinite] skipQuestion failed:', err)
      setState(s => ({ ...s, phase: 'error', error: 'Failed to fetch next question.' }))
    }
  }, [state.phase, state.skipsRemaining, state.question, state.runId, state.currentStreak, state.categoryId, getAuthHeaders, cancelPrefetch])

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

  const handleQuestionFlagged = useCallback((questionId: string, result: { wasFirstFlag: boolean; bonusLifeGranted: boolean }) => {
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

  return { state, startRun, submitAnswer, nextQuestion, skipQuestion, endRun, handleQuestionFlagged }
}
