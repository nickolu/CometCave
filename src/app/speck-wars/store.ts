import { create } from 'zustand'
import type { HudData } from './domain/types'

type GamePhase = 'menu' | 'playing' | 'paused' | 'victory' | 'defeat'
export type Difficulty = 'easy' | 'medium' | 'hard'

interface SpeckWarsStore {
  phase: GamePhase
  setPhase: (phase: GamePhase) => void
  togglePause: () => void
  winnerId: string | null
  setWinnerId: (id: string) => void
  hud: HudData | null
  setHud: (data: HudData) => void
  difficulty: Difficulty
  setDifficulty: (d: Difficulty) => void
  elapsedMs: number
  setElapsedMs: (ms: number) => void
}

export const useSpeckWarsStore = create<SpeckWarsStore>()(set => ({
  phase: 'menu',
  setPhase: phase => set({ phase }),
  togglePause: () => set(s => ({
    phase: s.phase === 'playing' ? 'paused' : s.phase === 'paused' ? 'playing' : s.phase,
  })),
  winnerId: null,
  setWinnerId: winnerId => set({ winnerId }),
  hud: null,
  setHud: hud => set({ hud }),
  difficulty: 'medium',
  setDifficulty: difficulty => set({ difficulty }),
  elapsedMs: 0,
  setElapsedMs: elapsedMs => set({ elapsedMs }),
}))
