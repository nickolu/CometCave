import { create } from 'zustand'
import type { HudData } from './domain/types'
import { resetWinStreak, recordGameResult } from './lib/personal-best'
import type { AIPersonality } from './domain/ai/ai-controller'

type GamePhase = 'menu' | 'playing' | 'paused' | 'victory' | 'defeat'
export type Difficulty = 'easy' | 'medium' | 'hard' | 'very-hard'
export type MapPreset = 'random' | 'open' | 'canyon' | 'river' | 'pillars' | 'walls'
export type { AIPersonality }

export interface KillFeedEntry {
  id: number
  ts: number
  icon: string
  label: string
  color: string
}

interface SpeckWarsStore {
  phase: GamePhase
  setPhase: (phase: GamePhase) => void
  togglePause: () => void
  countdown: number | null
  setCountdown: (n: number | null) => void
  winnerId: string | null
  setWinnerId: (id: string) => void
  victoryType: 'destruction' | 'surrender' | 'domination' | null
  setVictoryType: (t: 'destruction' | 'surrender' | 'domination') => void
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
  peakArmySize: number
  setPeakArmySize: (n: number) => void
  peakVeteranCount: number
  setPeakVeteranCount: (n: number) => void
  peakEliteCount: number
  setPeakEliteCount: (n: number) => void
  peakLegendCount: number
  setPeakLegendCount: (n: number) => void
  surgesUsed: number
  addSurgeUsed: () => void
  outpostsCaptured: number
  addOutpostCaptured: () => void
  isNewBest: boolean
  setIsNewBest: (v: boolean) => void
  killFeed: KillFeedEntry[]
  pushKillFeedEntry: (entry: Omit<KillFeedEntry, 'id' | 'ts'>) => void
  pruneKillFeed: () => void
  stance: 'aggressive' | 'defensive' | 'hold'
  setStance: (s: 'aggressive' | 'defensive' | 'hold') => void
  aiPersonality: AIPersonality | null
  setAiPersonality: (p: AIPersonality) => void
  fogEnabled: boolean
  setFogEnabled: (v: boolean) => void
  mapPreset: MapPreset
  setMapPreset: (p: MapPreset) => void
  gameActions: { defend: (() => void) | null; advance: (() => void) | null; rush: (() => void) | null; clearRally: (() => void) | null; surge: (() => void) | null; rally: ((x: number, y: number) => void) | null; setSpawnType: ((type: 'basic' | 'heavy' | 'scout') => void) | null; panCamera: ((x: number, y: number) => void) | null; stop: (() => void) | null; hold: (() => void) | null; guard: (() => void) | null; cycleStance: (() => void) | null; saveControlGroup?: ((slot: number) => void) | null; recallControlGroup?: ((slot: number) => void) | null; selectAll?: (() => void) | null; snapToBase?: (() => void) | null; snapToAction?: (() => void) | null; activatePatrol?: (() => void) | null; activateSelectMode?: (() => void) | null; selectByType?: ((typeId: string) => void) | null; selectBuilding?: ((buildingId: string) => void) | null; commandAt?: ((x: number, y: number) => void) | null; clearSelection?: (() => void) | null }
  setGameActions: (actions: { defend: () => void; advance: () => void; rush: () => void; clearRally: () => void; surge: () => void; rally: (x: number, y: number) => void; setSpawnType: (type: 'basic' | 'heavy' | 'scout') => void; panCamera: (x: number, y: number) => void; stop: () => void; hold: () => void; guard: () => void; cycleStance: () => void; saveControlGroup?: (slot: number) => void; recallControlGroup?: (slot: number) => void; selectAll?: () => void; snapToBase?: () => void; snapToAction?: () => void; activatePatrol?: () => void; activateSelectMode?: () => void; selectByType?: (typeId: string) => void; selectBuilding?: (buildingId: string) => void; commandAt?: (x: number, y: number) => void; clearSelection?: () => void } | null) => void
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
  peakArmySize: 0,
  setPeakArmySize: n => set(s => ({ peakArmySize: Math.max(s.peakArmySize, n) })),
  peakVeteranCount: 0,
  setPeakVeteranCount: n => set(s => ({ peakVeteranCount: Math.max(s.peakVeteranCount, n) })),
  peakEliteCount: 0,
  setPeakEliteCount: n => set(s => ({ peakEliteCount: Math.max(s.peakEliteCount, n) })),
  peakLegendCount: 0,
  setPeakLegendCount: n => set(s => ({ peakLegendCount: Math.max(s.peakLegendCount, n) })),
  surgesUsed: 0,
  addSurgeUsed: () => set(s => ({ surgesUsed: s.surgesUsed + 1 })),
  outpostsCaptured: 0,
  addOutpostCaptured: () => set(s => ({ outpostsCaptured: s.outpostsCaptured + 1 })),
  isNewBest: false,
  setIsNewBest: v => set({ isNewBest: v }),
  killFeed: [],
  pushKillFeedEntry: entry => set(s => {
    const id = Date.now() + Math.random()
    const next = [{ ...entry, id, ts: Date.now() }, ...s.killFeed].slice(0, 6)
    return { killFeed: next }
  }),
  pruneKillFeed: () => set(s => {
    const cutoff = Date.now() - 4500
    const next = s.killFeed.filter(e => e.ts > cutoff)
    return next.length === s.killFeed.length ? s : { killFeed: next }
  }),
  stance: 'aggressive' as 'aggressive' | 'defensive' | 'hold',
  setStance: stance => set({ stance }),
  aiPersonality: null,
  setAiPersonality: p => set({ aiPersonality: p }),
  fogEnabled: false,
  setFogEnabled: v => set({ fogEnabled: v }),
  mapPreset: 'random' as MapPreset,
  setMapPreset: p => set({ mapPreset: p }),
  gameActions: { defend: null, advance: null, rush: null, clearRally: null, surge: null, rally: null, setSpawnType: null, panCamera: null, stop: null, hold: null, guard: null, cycleStance: null, saveControlGroup: null, recallControlGroup: null, selectAll: null, snapToBase: null, snapToAction: null, activatePatrol: null, activateSelectMode: null, selectByType: null, selectBuilding: null, commandAt: null, clearSelection: null },
  setGameActions: (actions) => set({ gameActions: actions ?? { defend: null, advance: null, rush: null, clearRally: null, surge: null, rally: null, setSpawnType: null, panCamera: null, stop: null, hold: null, guard: null, cycleStance: null, saveControlGroup: null, recallControlGroup: null, selectAll: null, snapToBase: null, snapToAction: null, activatePatrol: null, activateSelectMode: null, selectByType: null, selectBuilding: null, commandAt: null, clearSelection: null } }),
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
    isNewBest: false,
    peakArmySize: 0,
    peakVeteranCount: 0,
    peakEliteCount: 0,
    peakLegendCount: 0,
    surgesUsed: 0,
    outpostsCaptured: 0,
    killFeed: [],
    aiPersonality: null,
    stance: 'aggressive' as 'aggressive' | 'defensive' | 'hold',
    difficulty: s.difficulty,
  })),
}))
