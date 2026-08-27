'use client'
import { create } from 'zustand'
import {
  type BlitzRun,
  startBlitz,
  pickUnit,
  resolveBattle,
  resolveEvolution,
  rerollOffers,
  buyXP as buyXPFn,
  swapTeamPositions,
} from './domain/blitz/run'

const DAILY_PLAYED_KEY = 'badge-run-daily-played'

interface BlitzStore {
  run: BlitzRun | null
  /** True if the player has already completed today's daily run */
  alreadyPlayedToday: boolean
  /** Start a new run with the given seed */
  startRun: (seed: number) => void
  /** Start a run with today's UTC date seed */
  startDailyRun: () => void
  /** Skip the "already played" gate and start a fresh daily run anyway */
  playAgain: () => void
  /** Pick a unit from the current draft offers */
  pick: (dexId: number) => void
  /** Resolve the current battle */
  battle: () => void
  /** Apply the evolution after a won battle */
  evolve: () => void
  /** Reroll the shop offers for REROLL_COST gold */
  reroll: () => void
  /** Buy XP for XP_COST gold */
  buyXP: () => void
  /** Swap two team slots by board position index (0-5) */
  swap: (fromIdx: number, toIdx: number) => void
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

/** Today's YYYYMMDD string key */
function todayKey(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function hasPlayedToday(): boolean {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(DAILY_PLAYED_KEY) === todayKey()
  } catch {
    return false
  }
}

function markPlayedToday(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DAILY_PLAYED_KEY, todayKey())
    }
  } catch {
    // localStorage unavailable — ignore
  }
}

export const useBlitzStore = create<BlitzStore>((set, get) => ({
  run: null,
  alreadyPlayedToday: false,

  startRun: (seed) => set({ run: startBlitz(seed), alreadyPlayedToday: false }),

  startDailyRun: () => {
    const played = hasPlayedToday()
    if (played) {
      set({ alreadyPlayedToday: true })
    } else {
      set({ run: startBlitz(getDailySeed()), alreadyPlayedToday: false })
    }
  },

  playAgain: () => set({ run: startBlitz(getDailySeed()), alreadyPlayedToday: false }),

  pick: (dexId) => {
    const { run } = get()
    if (!run || run.phase !== 'draft') return
    set({ run: pickUnit(run, dexId) })
  },

  battle: () => {
    const { run } = get()
    if (!run || run.phase !== 'battle') return
    const newRun = resolveBattle(run)
    // Mark played when the run reaches summary (win or elimination)
    if (newRun.phase === 'summary') {
      markPlayedToday()
    }
    set({ run: newRun })
  },

  evolve: () => {
    const { run } = get()
    if (!run || run.phase !== 'evolve') return
    set({ run: resolveEvolution(run) })
  },

  reroll: () => {
    const run = get().run
    if (!run || run.phase !== 'draft') return
    try {
      set({ run: rerollOffers(run) })
    } catch {
      // Insufficient gold — no-op
    }
  },

  buyXP: () => {
    const run = get().run
    if (!run) return
    try {
      set({ run: buyXPFn(run) })
    } catch {
      // Insufficient gold — no-op
    }
  },

  swap: (fromIdx, toIdx) => {
    const run = get().run
    if (!run) return
    set({ run: swapTeamPositions(run, fromIdx, toIdx) })
  },

  reset: () => set({ run: null }),
}))
