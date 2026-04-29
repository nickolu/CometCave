'use client'
import { useCallback, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LIVES_START, type AnswerResult } from '@/app/trivia/lib/infiniteScoring'

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
  runId: string | null
  question: InfiniteQuestion | null
  livesRemaining: number
  currentStreak: number
  longestStreak: number
  score: number
  questionsAnswered: number
  trailblazes: number
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
    runId: null,
    question: null,
    livesRemaining: LIVES_START,
    currentStreak: 0,
    longestStreak: 0,
    score: 0,
    questionsAnswered: 0,
    trailblazes: 0,
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

  const startPrefetch = useCallback((streak: number) => {
    cancelPrefetch()
    const controller = new AbortController()
    prefetchAbortRef.current = controller
    prefetchRef.current = (async (): Promise<InfiniteQuestion | null> => {
      try {
        const headers = await getAuthHeaders()
        const qRes = await fetch(`/api/v1/trivia/infinite/next?streak=${streak}`, {
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

  const startRun = useCallback(async (mode: InfiniteMode = 'scored') => {
    cancelPrefetch()
    setState(s => ({ ...s, phase: 'loading', mode, error: null }))
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/v1/trivia/infinite/runs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode }),
      })
      if (!res.ok) throw new Error('Failed to start run')
      const data = await res.json()

      // Immediately fetch first question
      const qRes = await fetch(`/api/v1/trivia/infinite/next?streak=0`, { headers })
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
        runId: data.runId,
        question,
        livesRemaining: data.livesRemaining,
        currentStreak: 0,
        longestStreak: 0,
        score: 0,
        questionsAnswered: 0,
        trailblazes: 0,
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
        startPrefetch(result.currentStreak)
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
  }, [state.phase, state.runId, state.question, getAuthHeaders, startPrefetch, cancelPrefetch])

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
      const qRes = await fetch(`/api/v1/trivia/infinite/next?streak=${state.currentStreak}`, { headers })
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
  }, [state.phase, state.runId, state.currentStreak, getAuthHeaders])

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

  return { state, startRun, submitAnswer, nextQuestion, endRun }
}
