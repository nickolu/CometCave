'use client'
import { create } from 'zustand'
import {
  type BlitzRun,
  startBlitz,
  pickUnit,
  resolveBattle,
  resolveEvolution,
} from './domain/blitz/run'

interface BlitzStore {
  run: BlitzRun | null
  /** Start a new run with the given seed */
  startRun: (seed: number) => void
  /** Start a run with today's UTC date seed */
  startDailyRun: () => void
  /** Pick a unit from the current draft offers */
  pick: (dexId: number) => void
  /** Resolve the current battle */
  battle: () => void
  /** Apply the evolution after a won battle */
  evolve: () => void
  /** Reset back to idle */
  reset: () => void
}

/** Returns a deterministic seed for today's UTC date (YYYYMMDD as integer) */
export function getDailySeed(): number {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return Number(`${y}${m}${d}`)
}

export const useBlitzStore = create<BlitzStore>((set, get) => ({
  run: null,

  startRun: (seed) => set({ run: startBlitz(seed) }),

  startDailyRun: () => set({ run: startBlitz(getDailySeed()) }),

  pick: (dexId) => {
    const { run } = get()
    if (!run || run.phase !== 'draft') return
    set({ run: pickUnit(run, dexId) })
  },

  battle: () => {
    const { run } = get()
    if (!run || run.phase !== 'battle') return
    set({ run: resolveBattle(run) })
  },

  evolve: () => {
    const { run } = get()
    if (!run || run.phase !== 'evolve') return
    set({ run: resolveEvolution(run) })
  },

  reset: () => set({ run: null }),
}))
