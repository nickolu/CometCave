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
  lastAnswer: (AnswerResult & { trailblazer: boolean }) | null
  answers: Array<{ questionId: string; correct: boolean; points: number; timeMs: number; trailblazer: boolean }>
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

  const getAuthHeaders = useCallback(async () => {
    if (!user) throw new Error('Not authenticated')
    const token = await user.getIdToken()
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }
  }, [user])

  const startRun = useCallback(async (mode: InfiniteMode = 'scored') => {
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
    } catch {
      setState(s => ({ ...s, phase: 'error', error: 'Failed to start run.' }))
    }
  }, [getAuthHeaders])

  const submitAnswer = useCallback(async (answer: string) => {
    if (state.phase !== 'playing' || !state.runId || !state.question) return

    const currentQuestionId = state.question.id
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
        setState(s => ({ ...s, phase: 'ended' }))
        return
      }
      if (!res.ok) throw new Error('Failed to submit answer')
      const result = await res.json()

      setState(s => ({
        ...s,
        phase: result.runOver ? 'ended' : 'answered',
        lastAnswer: result,
        livesRemaining: result.livesRemaining,
        currentStreak: result.currentStreak,
        longestStreak: result.longestStreak,
        score: result.score,
        questionsAnswered: s.questionsAnswered + 1,
        trailblazes: result.trailblazer ? s.trailblazes + 1 : s.trailblazes,
        answers: [...s.answers, { questionId: currentQuestionId, correct: result.correct, points: result.points, timeMs: elapsedMs, trailblazer: result.trailblazer }],
      }))
    } catch {
      setState(s => ({ ...s, phase: 'error', error: 'Failed to submit answer.' }))
    }
  }, [state.phase, state.runId, state.question, getAuthHeaders])

  const nextQuestion = useCallback(async () => {
    if (state.phase !== 'answered' || !state.runId) return

    setState(s => ({ ...s, phase: 'loading' }))
    try {
      const headers = await getAuthHeaders()
      const qRes = await fetch(`/api/v1/trivia/infinite/next?streak=${state.currentStreak}`, { headers })
      if (qRes.status === 204) {
        setState(s => ({ ...s, phase: 'exhausted' }))
        return
      }
      if (!qRes.ok) throw new Error('Failed to fetch question')
      const question = await qRes.json()

      startTimeRef.current = Date.now()
      setState(s => ({ ...s, phase: 'playing', question, lastAnswer: null }))
    } catch {
      setState(s => ({ ...s, phase: 'error', error: 'Failed to fetch next question.' }))
    }
  }, [state.phase, state.runId, state.currentStreak, getAuthHeaders])

  const endRun = useCallback(async () => {
    if (!state.runId) {
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
  }, [state.runId, getAuthHeaders])

  return { state, startRun, submitAnswer, nextQuestion, endRun }
}
