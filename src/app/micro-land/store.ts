/**
 * UI state.
 *
 * The world itself is *not* in here — it's a mutable object owned by the game
 * instance, ticked 60 times a second. Putting 300 creatures into React state
 * would re-render the tree every frame for no reason. The game pushes a small
 * summary (population, clock, notices) into this store a few times a second,
 * and that's all the UI ever needs.
 */
import { create } from 'zustand'

import { DEFAULT_THEME } from './domain/config/themes'

import type { CreatureBlueprint, MaterialId } from './domain/types'

/** Theme id standing for "the land the player summoned". */
export const SUMMONED_THEME_ID = 'summoned'

export type Tool =
  | { kind: 'material'; material: MaterialId }
  | { kind: 'erase' }
  | { kind: 'creature'; blueprintId: string }
  | { kind: 'inspect' }

/**
 * A live read-out of one creature.
 *
 * Snapshotted out of the simulation a few times a second rather than exposing
 * the mutable Creature object, so the panel can re-render without dragging the
 * whole world into React state.
 */
export interface Inspected {
  id: number
  blueprintId: string
  mood: string
  /** 0 = stuffed, 1 = starving. */
  hunger: number
  ageSeconds: number
  lifespanSeconds: number
  mealsEaten: number
  children: number
  tilesDug: number
  /** Seconds spent somewhere it can't survive; 0 when it's fine. */
  distress: number
  starving: number
  speed: number
  inWater: boolean
  grounded: boolean
  /** What it's chasing or running from right now. */
  targetName: string | null
}

export interface PopulationEntry {
  blueprintId: string
  name: string
  count: number
}

export interface Notice {
  id: number
  text: string
}

/**
 * A creature that has been asked for but hasn't arrived yet.
 *
 * A single creature is summoned without blocking the game, so the wait has to
 * be visible somewhere the player isn't using: an empty slot holds its place in
 * the creature strip until the response lands. More than one can be in flight —
 * nothing stops a player from asking for a second while the first is coming.
 */
export interface PendingSummon {
  id: number
  prompt: string
}

interface MicroLandState {
  themeId: string
  tool: Tool
  brush: number
  paused: boolean
  speed: number

  /** Every creature that exists in this world, built-in and summoned. */
  blueprints: CreatureBlueprint[]
  population: PopulationEntry[]
  totalCreatures: number
  elapsed: number

  summonOpen: boolean
  summonBusy: boolean
  summonMode: 'creature' | 'scene' | 'terrain'
  /** Name of the summoned land, if there is one — shown in the world picker. */
  summonedLand: string | null
  summonError: string | null
  /** Creature summons in flight, in the order they were asked for. */
  pendingSummons: PendingSummon[]
  guideOpen: boolean
  inspected: Inspected | null

  notices: Notice[]

  setTheme: (id: string) => void
  setTool: (tool: Tool) => void
  setBrush: (n: number) => void
  togglePaused: () => void
  setSpeed: (n: number) => void
  setBlueprints: (list: CreatureBlueprint[]) => void
  setStats: (population: PopulationEntry[], total: number, elapsed: number) => void
  setSummonOpen: (open: boolean) => void
  setSummonBusy: (busy: boolean) => void
  setSummonMode: (mode: 'creature' | 'scene' | 'terrain') => void
  setSummonedLand: (name: string | null) => void
  setSummonError: (message: string | null) => void
  /** Opens a slot for a creature on its way; returns the id to close it with. */
  addPendingSummon: (prompt: string) => number
  removePendingSummon: (id: number) => void
  setGuideOpen: (open: boolean) => void
  setInspected: (snapshot: Inspected | null) => void
  notify: (text: string) => void
  dismissNotice: (id: number) => void
}

let noticeId = 0
let pendingId = 0

export const useMicroLand = create<MicroLandState>((set) => ({
  themeId: DEFAULT_THEME,
  tool: { kind: 'material', material: 'dirt' },
  brush: 4,
  paused: false,
  speed: 1,

  blueprints: [],
  population: [],
  totalCreatures: 0,
  elapsed: 0,

  summonOpen: false,
  summonBusy: false,
  summonMode: 'creature',
  summonedLand: null,
  summonError: null,
  pendingSummons: [],
  guideOpen: false,
  inspected: null,

  notices: [],

  setTheme: (themeId) => set({ themeId }),
  setTool: (tool) => set({ tool }),
  setBrush: (brush) => set({ brush }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  setSpeed: (speed) => set({ speed }),
  setBlueprints: (blueprints) => set({ blueprints }),
  setStats: (population, totalCreatures, elapsed) =>
    set({ population, totalCreatures, elapsed }),
  setSummonOpen: (summonOpen) => set({ summonOpen }),
  setSummonBusy: (summonBusy) => set({ summonBusy }),
  setSummonMode: (summonMode) => set({ summonMode }),
  setSummonedLand: (summonedLand) => set({ summonedLand }),
  setSummonError: (summonError) => set({ summonError }),
  addPendingSummon: (prompt) => {
    const id = ++pendingId
    set((s) => ({ pendingSummons: [...s.pendingSummons, { id, prompt }] }))
    return id
  },
  removePendingSummon: (id) =>
    set((s) => ({ pendingSummons: s.pendingSummons.filter((p) => p.id !== id) })),
  setGuideOpen: (guideOpen) => set({ guideOpen }),
  setInspected: (inspected) => set({ inspected }),

  notify: (text) =>
    set((s) => ({
      // Keep the last few — a population crash can fire several at once.
      notices: [...s.notices, { id: ++noticeId, text }].slice(-3),
    })),
  dismissNotice: (id) =>
    set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}))
