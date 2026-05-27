'use client'

import { useCallback, useSyncExternalStore } from 'react'

export interface RunSummary {
  seed: string
  date: string           // ISO date string (YYYY-MM-DD)
  totalScore: string     // bigint stored as string for JSON safety
  handsPlayed: number
  roundsCompleted: number
  totalRounds: number
  won: boolean
}

export interface RunHistory {
  runs: RunSummary[]
  bestScore: string      // bigint as string
  wins: number
  losses: number
}

const STORAGE_KEY = 'comet-cards-run-history'
const MAX_RUNS = 50

function getRunHistory(): RunHistory {
  if (typeof window === 'undefined') return { runs: [], bestScore: '0', wins: 0, losses: 0 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { runs: [], bestScore: '0', wins: 0, losses: 0 }
    return JSON.parse(raw) as RunHistory
  } catch {
    return { runs: [], bestScore: '0', wins: 0, losses: 0 }
  }
}

function saveRunHistory(history: RunHistory): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

// Simple external store for useSyncExternalStore
let listeners: Array<() => void> = []
function subscribe(listener: () => void) {
  listeners.push(listener)
  return () => { listeners = listeners.filter(l => l !== listener) }
}
function emitChange() {
  listeners.forEach(l => l())
}

export function useRunHistory() {
  const history = useSyncExternalStore(subscribe, getRunHistory, () => ({ runs: [], bestScore: '0', wins: 0, losses: 0 }))

  const addRun = useCallback((run: RunSummary) => {
    const current = getRunHistory()
    const newRuns = [run, ...current.runs].slice(0, MAX_RUNS)
    const currentBest = BigInt(current.bestScore)
    const runScore = BigInt(run.totalScore)
    const newBest = runScore > currentBest ? run.totalScore : current.bestScore
    const newHistory: RunHistory = {
      runs: newRuns,
      bestScore: newBest,
      wins: current.wins + (run.won ? 1 : 0),
      losses: current.losses + (run.won ? 0 : 1),
    }
    saveRunHistory(newHistory)
    emitChange()
  }, [])

  return { history, addRun }
}
