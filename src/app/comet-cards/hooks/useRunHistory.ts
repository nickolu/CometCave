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
const EMPTY_HISTORY: RunHistory = { runs: [], bestScore: '0', wins: 0, losses: 0 }

function readFromStorage(): RunHistory {
  if (typeof window === 'undefined') return EMPTY_HISTORY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_HISTORY
    return JSON.parse(raw) as RunHistory
  } catch {
    return EMPTY_HISTORY
  }
}

// Cached snapshot — useSyncExternalStore requires referentially stable
// return values from getSnapshot. Without caching, JSON.parse creates
// a new object each call, causing infinite re-render loops.
let cachedSnapshot: RunHistory = EMPTY_HISTORY
let snapshotInitialized = false

function getSnapshot(): RunHistory {
  if (!snapshotInitialized && typeof window !== 'undefined') {
    cachedSnapshot = readFromStorage()
    snapshotInitialized = true
  }
  return cachedSnapshot
}

function getServerSnapshot(): RunHistory {
  return EMPTY_HISTORY
}

// Simple external store for useSyncExternalStore
let listeners: Array<() => void> = []
function subscribe(listener: () => void) {
  listeners.push(listener)
  return () => { listeners = listeners.filter(l => l !== listener) }
}
function emitChange() {
  cachedSnapshot = readFromStorage()
  listeners.forEach(l => l())
}

export function useRunHistory() {
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const today = typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : ''
  const todayRun = history.runs.find(r => r.date === today) ?? null

  const addRun = useCallback((run: RunSummary) => {
    const current = readFromStorage()
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
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory))
    emitChange()
  }, [])

  return { history, todayRun, addRun }
}
