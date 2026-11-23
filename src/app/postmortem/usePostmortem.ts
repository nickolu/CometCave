'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { incidents as ALL_INCIDENTS } from './data/incidents'
import {
  HAND_SIZE,
  CLUE_COUNT,
  buildHand,
  createRng,
  isNewHighScore,
  multiplierFor,
  pickIncidents,
  scoreIncident,
  summarizeRun,
  toResult,
} from './lib/rules'
import { highScore } from './lib/storage'
import { getStoredData, saveFinishedRun } from './useStoredData'

import type { Incident } from './data/incidents'
import type { IncidentResult, IncidentScore, RunSummaryStats } from './lib/rules'

export type Run = {
  incidents: Incident[]
  hands: string[][]
  index: number
  selected: string[]
  cluesRevealed: number
  /** Set once the player has committed this incident. */
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
    selected: [],
    cluesRevealed: 1,
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

export function usePostmortem({ keysActive }: { keysActive: boolean }) {
  const [run, setRun] = useState<Run>(() => startRun())
  const [finished, setFinished] = useState<FinishedRun | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const toggleIndex = useCallback((cardIndex: number) => {
    setRun(r => {
      const id = r.hands[r.index]?.[cardIndex]
      if (!id || r.outcome) return r
      const selected = r.selected.includes(id) ? r.selected.filter(s => s !== id) : [...r.selected, id]
      return { ...r, selected }
    })
    setNotice(null)
  }, [])

  const revealNext = useCallback(() => {
    setRun(r => (r.outcome || r.cluesRevealed >= CLUE_COUNT ? r : { ...r, cluesRevealed: r.cluesRevealed + 1 }))
  }, [])

  const commit = useCallback(() => {
    if (run.outcome) return
    const incident = run.incidents[run.index]
    const result = scoreIncident(incident, run.hands[run.index], run.selected, run.cluesRevealed)
    if (!result.ok) {
      setNotice('Pick at least one card before you commit.')
      return
    }
    setNotice(null)
    const { score } = result
    setRun({
      ...run,
      outcome: score,
      cluesRevealed: CLUE_COUNT,
      results: [...run.results, toResult(incident, score)],
      totalScore: run.totalScore + score.points,
    })
  }, [run])

  const next = useCallback(() => {
    if (!run.outcome) return
    if (run.index + 1 < run.incidents.length) {
      setRun({ ...run, index: run.index + 1, selected: [], cluesRevealed: 1, outcome: null })
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
  const handlers = useRef({ toggleIndex, revealNext, commit, next })
  useEffect(() => {
    handlers.current = { toggleIndex, revealNext, commit, next }
  })

  useEffect(() => {
    if (!keysActive || finished) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isNativeControl(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === ' ') {
        // Always stop the page from scrolling.
        e.preventDefault()
        if (!e.repeat) handlers.current.revealNext()
        return
      }
      if (e.repeat) return
      if (e.key === 'Enter') {
        // Take over Enter so a focused card or button is not also clicked.
        e.preventDefault()
        if (run.outcome) handlers.current.next()
        else handlers.current.commit()
        return
      }
      if (/^[1-8]$/.test(e.key) && Number(e.key) <= HAND_SIZE) {
        handlers.current.toggleIndex(Number(e.key) - 1)
      }
    }
    // Some browsers fire a click for Space on keyup, even if keydown was cancelled.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isTypingTarget(e.target) && !isNativeControl(e.target)) e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [keysActive, finished, run.outcome])

  return {
    run,
    finished,
    notice,
    multiplier: multiplierFor(run.cluesRevealed),
    toggleIndex,
    revealNext,
    commit,
    next,
    playAgain,
  }
}
