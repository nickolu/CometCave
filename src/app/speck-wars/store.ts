import { create } from 'zustand'
import type { HudData } from './domain/types'

type GamePhase = 'menu' | 'playing' | 'paused' | 'victory' | 'defeat'
export type Difficulty = 'easy' | 'medium' | 'hard' | 'very-hard'

interface SpeckWarsStore {
  phase: GamePhase
  setPhase: (phase: GamePhase) => void
  togglePause: () => void
  winnerId: string | null
  setWinnerId: (id: string) => void
  victoryType: 'destruction' | 'domination' | null
  setVictoryType: (t: 'destruction' | 'domination') => void
  hud: HudData | null
  setHud: (data: HudData) => void
  difficulty: Difficulty
  setDifficulty: (d: Difficulty) => void
  elapsedMs: number
  setElapsedMs: (ms: number) => void
  speed: 1 | 2 | 4
  cycleSpeed: () => void
  notification: { message: string; color: string } | null
  setNotification: (n: { message: string; color: string } | null) => void
  kills: number
  losses: number
  addKill: () => void
  addLoss: () => void
  spawnMode: 'basic' | 'heavy'
  cycleSpawnMode: () => 'basic' | 'heavy'
  isNewBest: boolean
  setIsNewBest: (v: boolean) => void
  resetGame: () => void
}

export const useSpeckWarsStore = create<SpeckWarsStore>()(set => ({
  phase: 'menu',
  setPhase: phase => set({ phase }),
  togglePause: () => set(s => ({
    phase: s.phase === 'playing' ? 'paused' : s.phase === 'paused' ? 'playing' : s.phase,
  })),
  winnerId: null,
  setWinnerId: winnerId => set({ winnerId }),
  victoryType: null,
  setVictoryType: victoryType => set({ victoryType }),
  hud: null,
  setHud: hud => set({ hud }),
  difficulty: 'medium',
  setDifficulty: difficulty => set({ difficulty }),
  elapsedMs: 0,
  setElapsedMs: elapsedMs => set({ elapsedMs }),
  speed: 1 as 1 | 2 | 4,
  cycleSpeed: () => set(s => ({
    speed: s.speed === 1 ? 2 : s.speed === 2 ? 4 : 1,
  })),
  notification: null,
  setNotification: n => set({ notification: n }),
  kills: 0,
  losses: 0,
  addKill: () => set(s => ({ kills: s.kills + 1 })),
  addLoss: () => set(s => ({ losses: s.losses + 1 })),
  spawnMode: 'basic' as 'basic' | 'heavy',
  cycleSpawnMode: () => {
    let next: 'basic' | 'heavy' = 'basic'
    set(s => {
      next = s.spawnMode === 'basic' ? 'heavy' : 'basic'
      return { spawnMode: next }
    })
    return next
  },
  isNewBest: false,
  setIsNewBest: v => set({ isNewBest: v }),
  resetGame: () => set(s => ({
    phase: 'menu' as GamePhase,
    winnerId: null,
    victoryType: null,
    hud: null,
    elapsedMs: 0,
    speed: 1 as 1 | 2 | 4,
    notification: null,
    kills: 0,
    losses: 0,
    spawnMode: 'basic' as 'basic' | 'heavy',
    isNewBest: false,
    difficulty: s.difficulty,
  })),
}))
