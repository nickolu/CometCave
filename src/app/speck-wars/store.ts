import { create } from 'zustand'
import type { HudData } from './domain/types'
import { resetWinStreak, recordGameResult } from './lib/personal-best'

type GamePhase = 'menu' | 'playing' | 'paused' | 'victory' | 'defeat'
export type Difficulty = 'easy' | 'medium' | 'hard' | 'very-hard'

interface SpeckWarsStore {
  phase: GamePhase
  setPhase: (phase: GamePhase) => void
  togglePause: () => void
  countdown: number | null
  setCountdown: (n: number | null) => void
  winnerId: string | null
  setWinnerId: (id: string) => void
  victoryType: 'destruction' | 'domination' | 'surrender' | null
  setVictoryType: (t: 'destruction' | 'domination' | 'surrender') => void
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
  spawnMode: 'basic' | 'heavy' | 'scout'
  cycleSpawnMode: () => 'basic' | 'heavy' | 'scout'
  setSpawnMode: (mode: 'basic' | 'heavy' | 'scout') => void
  peakArmySize: number
  setPeakArmySize: (n: number) => void
  outpostsCaptured: number
  addOutpostCaptured: () => void
  isNewBest: boolean
  setIsNewBest: (v: boolean) => void
  gameActions: { defend: (() => void) | null; advance: (() => void) | null; rush: (() => void) | null; clearRally: (() => void) | null; surge: (() => void) | null; rally: ((x: number, y: number) => void) | null; sacrifice: (() => void) | null; setSpawnType: ((type: 'basic' | 'heavy' | 'scout') => void) | null; patrol: (() => void) | null }
  setGameActions: (actions: { defend: () => void; advance: () => void; rush: () => void; clearRally: () => void; surge: () => void; rally: (x: number, y: number) => void; sacrifice: () => void; setSpawnType: (type: 'basic' | 'heavy' | 'scout') => void; patrol: () => void } | null) => void
  surrender: () => void
  resetGame: () => void
}

export const useSpeckWarsStore = create<SpeckWarsStore>()((set, get) => ({
  phase: 'menu',
  setPhase: phase => set({ phase }),
  togglePause: () => set(s => ({
    phase: s.phase === 'playing' ? 'paused' : s.phase === 'paused' ? 'playing' : s.phase,
  })),
  countdown: null,
  setCountdown: n => set({ countdown: n }),
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
  spawnMode: 'basic' as 'basic' | 'heavy' | 'scout',
  cycleSpawnMode: () => {
    let next: 'basic' | 'heavy' | 'scout' = 'basic'
    set(s => {
      next = s.spawnMode === 'basic' ? 'heavy' : s.spawnMode === 'heavy' ? 'scout' : 'basic'
      return { spawnMode: next }
    })
    return next
  },
  setSpawnMode: mode => set({ spawnMode: mode }),
  peakArmySize: 0,
  setPeakArmySize: n => set(s => ({ peakArmySize: Math.max(s.peakArmySize, n) })),
  outpostsCaptured: 0,
  addOutpostCaptured: () => set(s => ({ outpostsCaptured: s.outpostsCaptured + 1 })),
  isNewBest: false,
  setIsNewBest: v => set({ isNewBest: v }),
  gameActions: { defend: null, advance: null, rush: null, clearRally: null, surge: null, rally: null, sacrifice: null, setSpawnType: null, patrol: null },
  setGameActions: (actions) => set({ gameActions: actions ?? { defend: null, advance: null, rush: null, clearRally: null, surge: null, rally: null, sacrifice: null, setSpawnType: null, patrol: null } }),
  surrender: () => {
    const s = get()
    resetWinStreak()
    recordGameResult(s.difficulty, false, s.elapsedMs, s.kills)
    set({ phase: 'defeat', winnerId: 'ai', victoryType: 'surrender', isNewBest: false })
  },
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
    spawnMode: 'basic' as 'basic' | 'heavy' | 'scout',
    isNewBest: false,
    peakArmySize: 0,
    outpostsCaptured: 0,
    difficulty: s.difficulty,
  })),
}))
