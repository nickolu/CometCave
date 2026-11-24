'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { incidents as ALL_INCIDENTS } from './data/incidents'
import {
  HAND_SIZE,
  MAX_ELIMINATIONS,
  buildHand,
  canClose,
  cluesRevealedFor,
  createRng,
  eliminateCard,
  isNewHighScore,
  pickIncidents,
  playCard,
  roundMultiplier,
  scoreIncident,
  summarizeRun,
  toResult,
} from './lib/rules'
import { highScore } from './lib/storage'
import { getStoredData, saveFinishedRun } from './useStoredData'

import type { Incident } from './data/incidents'
import type { IncidentResult, IncidentScore, Rng, Round, RunSummaryStats } from './lib/rules'

export type Run = {
  incidents: Incident[]
  hands: string[][]
  index: number
  /** Cards locked in for this incident, in play order. Results stay hidden until the case closes. */
  played: string[]
  /** Cards removed by Eliminate this incident. */
  eliminated: string[]
  /** The selected card, waiting for Lock in. Selecting never plays it. */
  armed: string | null
  /** Set once the player has closed this incident. */
  outcome: IncidentScore | null
  results: IncidentResult[]
  totalScore: number
}

export type FinishedRun = {
  score: number
  previousBest: number | null
  isNewHighScore: boolean
  stats: RunSummaryStats
  dateIso: string
}

function newSeed(): string {
  return `${Date.now()}-${Math.random()}`
}

export function startRun(seed: string = newSeed()): Run {
  const rng = createRng(seed)
  const picked = pickIncidents(ALL_INCIDENTS, rng)
  return {
    incidents: picked,
    hands: picked.map(i => buildHand(i, rng)),
    index: 0,
    played: [],
    eliminated: [],
    armed: null,
    outcome: null,
    results: [],
    totalScore: 0,
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/** Links and buttons marked data-pm-native keep their own Enter/Space behavior. */
function isNativeControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('a, [data-pm-native]') !== null
}

export function roundOf(run: Pick<Run, 'hands' | 'index' | 'played' | 'eliminated'>): Round {
  return { hand: run.hands[run.index] ?? [], played: run.played, eliminated: run.eliminated }
}

export function usePostmortem({
  keysActive,
  onOpenInfo,
  rng = Math.random,
}: {
  keysActive: boolean
  /** Called with the selected card's id when the player presses ?. */
  onOpenInfo?: (cardId: string) => void
  /** Injectable so Eliminate is testable. */
  rng?: Rng
}) {
  const [run, setRun] = useState<Run>(() => startRun())
  const [finished, setFinished] = useState<FinishedRun | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const round = roundOf(run)
  const multiplier = roundMultiplier(round)
  const cluesRevealed = run.outcome ? 3 : cluesRevealedFor(run.played.length)

  /** Toggles selection. Pressing never plays a card; use lockIn for that. */
  const pressCard = useCallback(
    (cardIndex: number) => {
      const id = run.hands[run.index]?.[cardIndex]
      if (!id || run.outcome) return
      if (run.played.includes(id)) {
        setNotice('That card is already played.')
        return
      }
      if (run.eliminated.includes(id)) {
        setNotice('That card was eliminated.')
        return
      }
      setNotice(null)
      setRun({ ...run, armed: run.armed === id ? null : id })
    },
    [run]
  )

  /** Plays the selected card. It is locked in and cannot be taken back. */
  const lockIn = useCallback(() => {
    if (run.outcome) return
    if (!run.armed) {
      setNotice('Select a card first.')
      return
    }
    const played = playCard(roundOf(run), run.armed)
    if (!played.ok) return
    setNotice(null)
    setRun({ ...run, played: [...played.round.played], armed: null })
  }, [run])

  const disarm = useCallback(() => {
    setRun(r => (r.armed ? { ...r, armed: null } : r))
    setNotice(null)
  }, [])

  const eliminate = useCallback(() => {
    if (run.outcome) return
    if (run.armed) {
      setNotice('Unselect your card to use the lifeline.')
      return
    }
    const result = eliminateCard(run.incidents[run.index], roundOf(run), rng)
    if (!result.ok) {
      setNotice(result.reason === 'min-multiplier' ? 'No eliminations left: the multiplier is already at ×1.' : 'No safe card left to eliminate.')
      return
    }
    setNotice(null)
    setRun({ ...run, eliminated: [...result.round.eliminated], armed: null })
  }, [run, rng])

  const openArmedInfo = useCallback(() => {
    if (run.armed) onOpenInfo?.(run.armed)
    else setNotice('Select a card, then press ? for its info.')
  }, [run.armed, onOpenInfo])

  const commit = useCallback(() => {
    if (run.outcome) return
    if (!canClose(roundOf(run))) {
      setNotice('Play at least one card before you close the case.')
      return
    }
    const incident = run.incidents[run.index]
    const result = scoreIncident(incident, run.hands[run.index], run.played, roundMultiplier(roundOf(run)))
    if (!result.ok) {
      setNotice('Play at least one card before you close the case.')
      return
    }
    setNotice(null)
    const { score } = result
    setRun({
      ...run,
      armed: null,
      outcome: score,
      results: [...run.results, toResult(incident, score)],
      totalScore: run.totalScore + score.points,
    })
  }, [run])

  const next = useCallback(() => {
    if (!run.outcome) return
    if (run.index + 1 < run.incidents.length) {
      setRun({ ...run, index: run.index + 1, played: [], eliminated: [], armed: null, outcome: null })
      return
    }
    // Last incident: save, then show the summary.
    const previousBest = highScore(getStoredData())
    const dateIso = new Date().toISOString()
    saveFinishedRun(run.results, run.totalScore, dateIso)
    setFinished({
      score: run.totalScore,
      previousBest,
      isNewHighScore: isNewHighScore(run.totalScore, previousBest),
      stats: summarizeRun(run.results),
      dateIso,
    })
  }, [run])

  const playAgain = useCallback(() => {
    setRun(startRun())
    setFinished(null)
    setNotice(null)
  }, [])

  // Keep the latest handlers reachable from one stable key listener.
  const handlers = useRef({ pressCard, lockIn, disarm, eliminate, openArmedInfo, commit, next })
  useEffect(() => {
    handlers.current = { pressCard, lockIn, disarm, eliminate, openArmedInfo, commit, next }
  })

  useEffect(() => {
    if (!keysActive || finished) return
    const onKeyDown = (e: KeyboardEvent) => {
      // Radix calls preventDefault on the Esc that closes a dialog; don't also clear the selection.
      if (e.defaultPrevented || isTypingTarget(e.target) || isNativeControl(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.repeat) return
      if (e.key === 'Enter') {
        // Take over Enter so a focused card or button is not also clicked.
        e.preventDefault()
        if (run.outcome) handlers.current.next()
        else handlers.current.commit()
        return
      }
      if (run.outcome) return
      if (e.key === 'Escape') {
        handlers.current.disarm()
      } else if (e.key === 'l' || e.key === 'L' || e.key === ' ') {
        // Take over Space so a focused button is not also clicked.
        e.preventDefault()
        handlers.current.lockIn()
      } else if (e.key === 'e' || e.key === 'E') {
        handlers.current.eliminate()
      } else if (e.key === '?') {
        handlers.current.openArmedInfo()
      } else if (/^[1-8]$/.test(e.key) && Number(e.key) <= HAND_SIZE) {
        // Take over so a focused card is not also clicked by the same key.
        handlers.current.pressCard(Number(e.key) - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keysActive, finished, run.outcome])

  return {
    run,
    finished,
    notice,
    multiplier,
    cluesRevealed,
    eliminationsLeft: MAX_ELIMINATIONS - run.eliminated.length,
    pressCard,
    lockIn,
    disarm,
    eliminate,
    commit,
    next,
    playAgain,
  }
}
