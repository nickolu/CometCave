'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  type ClusterGroup,
  type ClustersProfile,
  type DailyResponse,
  GROUP_SIZE,
  type GuessRecord,
  type GuessResponse,
  type GuessResult,
  MAX_MISTAKES,
  type SessionStatus,
  TIER_LABEL,
} from '@/app/clusters/models/clusters'
import { useAuth } from '@/hooks/useAuth'

export type LoadPhase = 'loading' | 'ready' | 'missing' | 'error'

export interface Flash {
  kind: GuessResult
  /** Bumped on every guess so the same result can re-trigger the animation. */
  id: number
}

export interface ClustersGame {
  phase: LoadPhase
  error: string | null

  date: string
  puzzleNumber: number
  editor: string | null
  sourceDate: string | null

  /** Unsolved words, in display order. Shuffling reorders only this. */
  board: string[]
  selection: string[]
  solved: ClusterGroup[]
  mistakes: number
  mistakesLeft: number
  guesses: GuessRecord[]
  status: SessionStatus
  /** All four groups, only once the run is over. */
  solution: ClusterGroup[] | null
  finishedProfile: ClustersProfile | null

  submitting: boolean
  canSubmit: boolean
  flash: Flash | null
  /** Text for the polite live region. */
  announcement: string

  toggle: (word: string) => void
  shuffle: () => void
  deselectAll: () => void
  submit: () => Promise<void>
  reload: () => void
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function newGuessId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `g-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useClustersGame(requestedDate?: string): ClustersGame {
  const { user, loading: authLoading } = useAuth()

  const [phase, setPhase] = useState<LoadPhase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(requestedDate ?? '')
  const [puzzleNumber, setPuzzleNumber] = useState(0)
  const [editor, setEditor] = useState<string | null>(null)
  const [sourceDate, setSourceDate] = useState<string | null>(null)

  const [board, setBoard] = useState<string[]>([])
  const [selection, setSelection] = useState<string[]>([])
  const [solved, setSolved] = useState<ClusterGroup[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [guesses, setGuesses] = useState<GuessRecord[]>([])
  const [status, setStatus] = useState<SessionStatus>('in_progress')
  const [solution, setSolution] = useState<ClusterGroup[] | null>(null)
  const [finishedProfile, setFinishedProfile] = useState<ClustersProfile | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const flashSeq = useRef(0)

  /* ── load the board and any run already in progress ─────────────── */
  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false

    async function load() {
      setPhase('loading')
      setError(null)
      try {
        const token = await user!.getIdToken()
        const url = requestedDate
          ? `/api/v1/clusters/daily?date=${requestedDate}`
          : '/api/v1/clusters/daily'
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

        if (res.status === 404) {
          if (!cancelled) setPhase('missing')
          return
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || 'Could not load the puzzle.')
        }

        const data = (await res.json()) as DailyResponse
        if (cancelled) return

        const solvedGroups: ClusterGroup[] = (data.state?.solved ?? []).map(
          ({ tier, title, words }) => ({ tier, title, words })
        )
        const solvedWords = new Set(solvedGroups.flatMap((g) => g.words))

        setDate(data.date)
        setPuzzleNumber(data.puzzleNumber)
        setEditor(data.editor ?? null)
        setSourceDate(data.sourceDate ?? null)
        setSolved(solvedGroups)
        setMistakes(data.state?.mistakes ?? 0)
        setGuesses(data.state?.guesses ?? [])
        setStatus(data.state?.status ?? 'in_progress')
        setSolution(data.solution ?? null)
        setBoard(data.words.filter((w) => !solvedWords.has(w)))
        setSelection([])
        setPhase('ready')
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load Clusters:', err)
        setError(err instanceof Error ? err.message : 'Could not load the puzzle.')
        setPhase('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, requestedDate, reloadKey])

  /* ── selection ──────────────────────────────────────────────────── */
  const toggle = useCallback(
    (word: string) => {
      if (status !== 'in_progress' || submitting) return
      setSelection((current) => {
        if (current.includes(word)) return current.filter((w) => w !== word)
        if (current.length >= GROUP_SIZE) return current
        return [...current, word]
      })
    },
    [status, submitting]
  )

  const deselectAll = useCallback(() => setSelection([]), [])

  const shuffle = useCallback(() => {
    setBoard((current) => (current.length > 1 ? shuffled(current) : current))
    // A board that silently reorders itself is disorienting without this.
    setAnnouncement('Board shuffled.')
  }, [])

  /* ── submitting a guess ─────────────────────────────────────────── */
  const submit = useCallback(async () => {
    if (!user || selection.length !== GROUP_SIZE || submitting || status !== 'in_progress') return

    setSubmitting(true)
    setError(null)
    // Minted here so a retry replays the original answer instead of
    // charging a second mistake.
    const guessId = newGuessId()
    const words = [...selection]

    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/v1/clusters/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date, words, guessId }),
      })

      const data = (await res.json()) as GuessResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not submit that guess.')

      flashSeq.current += 1
      setFlash({ kind: data.result, id: flashSeq.current })
      setGuesses((current) => [...current, { words, result: data.result, guessId }])

      if (data.result === 'duplicate') {
        setAnnouncement('You already tried that group.')
        return
      }

      if (data.result === 'correct' && data.group) {
        const group = data.group
        setSolved((current) => [...current, group])
        setBoard((current) => current.filter((w) => !group.words.includes(w)))
        setSelection([])
        setAnnouncement(
          `Correct. ${TIER_LABEL[group.tier]}: ${group.title}. ${group.words.join(', ')}.`
        )
      } else {
        const left = data.mistakesLeft
        setMistakes(MAX_MISTAKES - left)
        setAnnouncement(
          data.result === 'one-away'
            ? `One away. ${left} ${left === 1 ? 'mistake' : 'mistakes'} left.`
            : `Not a group. ${left} ${left === 1 ? 'mistake' : 'mistakes'} left.`
        )
      }

      if (data.status !== 'in_progress' && data.solution) {
        const full = data.solution
        setStatus(data.status)
        setSolution(full)
        setFinishedProfile(data.profile ?? null)
        setBoard([])
        setSelection([])
        // The server may have auto-resolved the forced last group, and on a
        // loss it reveals everything left. Either way, append what we do
        // not already have, in tier order.
        setSolved((current) => {
          const have = new Set(current.map((g) => g.tier))
          return [...current, ...full.filter((g) => !have.has(g.tier))]
        })
        setAnnouncement(
          data.status === 'won'
            ? 'Solved. All four groups found.'
            : 'Out of mistakes. The remaining groups are revealed.'
        )
      }
    } catch (err) {
      console.error('Failed to submit guess:', err)
      setError(err instanceof Error ? err.message : 'Could not submit that guess.')
      setAnnouncement('That guess did not go through. Try again.')
    } finally {
      setSubmitting(false)
    }
  }, [user, selection, submitting, status, date])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  return useMemo(
    () => ({
      phase,
      error,
      date,
      puzzleNumber,
      editor,
      sourceDate,
      board,
      selection,
      solved,
      mistakes,
      mistakesLeft: Math.max(0, MAX_MISTAKES - mistakes),
      guesses,
      status,
      solution,
      finishedProfile,
      submitting,
      canSubmit: selection.length === GROUP_SIZE && !submitting && status === 'in_progress',
      flash,
      announcement,
      toggle,
      shuffle,
      deselectAll,
      submit,
      reload,
    }),
    [
      phase, error, date, puzzleNumber, editor, sourceDate, board, selection, solved, mistakes,
      guesses, status, solution, finishedProfile, submitting, flash, announcement,
      toggle, shuffle, deselectAll, submit, reload,
    ]
  )
}
