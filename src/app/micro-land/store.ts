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
import {
  TUNING,
  type Tuning,
  type TuningKey,
  clearStoredTuning,
  loadTuning,
  resetTuning,
  saveTuning,
  setTuning,
} from './domain/tuning'

import type { SaveState } from './chronicle/chronicle'
import type { ElderRecord, SpeciesRecord } from './chronicle/types'
import type { CreatureBlueprint, MaterialId } from './domain/types'
import type { ShelfState } from './worlds/shelf'

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
  /** How far back its line goes; 1 means it was placed rather than born. */
  generation: number
  /** Player-given name, if this one earned the right to have one. */
  name: string | null
  /** True while this creature holds the land's longevity record. */
  isElder: boolean
}

/**
 * Records for the land currently on screen, as the UI wants them.
 *
 * Flattened out of the chronicle rather than exposing it directly: the panels
 * want "best ever here" and "how it's going right now" side by side, and those
 * come from two different places.
 */
export interface RecordsView {
  /** Best ever in this land. */
  elder: ElderRecord | null
  bestSteadySeconds: number
  bestGenerations: number
  bestGenerationsSpeciesName: string | null
  /** How this run is going. */
  steadySeconds: number
  deepestGeneration: number
}

export interface EarnedMilestone {
  id: string
  text: string
  /** Epoch ms it was first reached. */
  at: number
}

const EMPTY_RECORDS: RecordsView = {
  elder: null,
  bestSteadySeconds: 0,
  bestGenerations: 0,
  bestGenerationsSpeciesName: null,
  steadySeconds: 0,
  deepestGeneration: 0,
}

export interface PopulationEntry {
  blueprintId: string
  name: string
  count: number
}

export interface Notice {
  id: number
  text: string
  /**
   * An optional one-tap follow-up, used for undo.
   *
   * Lives on the notice rather than in a dialog because the audience is a child
   * mid-play: a strip that says what happened and offers to take it back costs
   * no reading and no dismissal, and a wrong tap costs exactly one more tap.
   * Running it dismisses the notice.
   */
  action?: { label: string; run: () => void }
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
  /**
   * The hand-drawing panel.
   *
   * Its own flag rather than a fourth `summonMode`: drawing is a session the
   * player comes back to, not a one-shot request, and it has to survive the
   * summon panel being opened and closed around it.
   */
  builderOpen: boolean
  guideOpen: boolean
  settingsOpen: boolean
  /**
   * A copy of the live tuning knobs, kept only so React can draw the sliders.
   *
   * The simulation reads the mutable `TUNING` object directly and never looks at
   * this. Two representations of the same thing is normally a smell; here it is
   * the same trade the world itself makes — the thing that runs sixty times a
   * second stays out of React, and React gets a snapshot it can render.
   */
  tuning: Tuning
  inspected: Inspected | null

  /** Records for the land on screen. */
  records: RecordsView
  /**
   * Every species ever seen alive, including summoned ones from past visits.
   *
   * Pushed only when it actually changes rather than on every stats tick — it
   * turns over rarely and re-rendering the guide three times a second for a list
   * that hasn't moved is wasted work.
   */
  archive: SpeciesRecord[]
  milestones: EarnedMilestone[]
  /**
   * Whether the world is wider than the view.
   *
   * Almost always true, but an ultrawide display can fit all 672 tiles at once,
   * and scroll buttons that visibly do nothing are worse than no buttons.
   */
  canPan: boolean

  notices: Notice[]

  /**
   * What the chronicle's storage layer is doing.
   *
   * Mirrored into the store rather than read through a hook so the field guide
   * can render it like any other piece of state. Kept deliberately factual —
   * whether records are safe, and where — because a player who cannot tell the
   * difference between "kept forever" and "kept until you clear your browser"
   * cannot make a sensible decision about signing up.
   */
  saveState: SaveState

  /**
   * The shelf of saved worlds, mirrored out of `worlds/shelf.ts`.
   *
   * Same arrangement as `saveState`: the module owns it because it outlives any
   * React tree and the game instance reads it imperatively, and the store gets a
   * copy so panels can render it like any other state.
   */
  shelf: ShelfState
  worldsOpen: boolean

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
  setBuilderOpen: (open: boolean) => void
  setGuideOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  /** Move one knob. Takes effect on the very next tick and is remembered. */
  setTuningKnob: (key: TuningKey, value: number) => void
  /** Put every knob back to what the game shipped with. */
  resetTuningKnobs: () => void
  /**
   * Pull remembered knobs out of storage.
   *
   * Called once from the client rather than done when this module loads: the
   * store is built during the server render too, and reading `localStorage`
   * there gives a different answer than the browser will, which is a hydration
   * mismatch waiting to happen.
   */
  hydrateTuning: () => void
  setInspected: (snapshot: Inspected | null) => void
  setRecords: (records: RecordsView) => void
  setArchive: (archive: SpeciesRecord[]) => void
  setMilestones: (milestones: EarnedMilestone[]) => void
  setCanPan: (canPan: boolean) => void
  setSaveState: (state: SaveState) => void
  setShelf: (shelf: ShelfState) => void
  setWorldsOpen: (open: boolean) => void
  notify: (text: string, action?: Notice['action']) => void
  dismissNotice: (id: number) => void
}

let noticeId = 0
let pendingId = 0

export const useMicroLand = create<MicroLandState>(set => ({
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
  builderOpen: false,
  guideOpen: false,
  settingsOpen: false,
  tuning: { ...TUNING },
  inspected: null,
  canPan: true,

  records: EMPTY_RECORDS,
  archive: [],
  milestones: [],

  notices: [],
  saveState: { kind: 'idle' },
  shelf: { worlds: [], activeId: null, busy: false, error: null },
  worldsOpen: false,

  setTheme: themeId => set({ themeId }),
  setTool: tool => set({ tool }),
  setBrush: brush => set({ brush }),
  togglePaused: () => set(s => ({ paused: !s.paused })),
  setSpeed: speed => set({ speed }),
  setBlueprints: blueprints => set({ blueprints }),
  setStats: (population, totalCreatures, elapsed) => set({ population, totalCreatures, elapsed }),
  setSummonOpen: summonOpen => set({ summonOpen }),
  setSummonBusy: summonBusy => set({ summonBusy }),
  setSummonMode: summonMode => set({ summonMode }),
  setSummonedLand: summonedLand => set({ summonedLand }),
  setSummonError: summonError => set({ summonError }),
  addPendingSummon: prompt => {
    const id = ++pendingId
    set(s => ({ pendingSummons: [...s.pendingSummons, { id, prompt }] }))
    return id
  },
  removePendingSummon: id =>
    set(s => ({ pendingSummons: s.pendingSummons.filter(p => p.id !== id) })),
  setBuilderOpen: builderOpen => set({ builderOpen }),
  setGuideOpen: guideOpen => set({ guideOpen }),
  setSettingsOpen: settingsOpen => set({ settingsOpen }),

  // Every one of these writes the mutable object first and mirrors it after,
  // never the other way round: `setTuning` clamps and can hold one knob against
  // another, so the snapshot has to be taken of what actually landed.
  setTuningKnob: (key, value) => {
    setTuning({ [key]: value })
    saveTuning()
    set({ tuning: { ...TUNING } })
  },
  resetTuningKnobs: () => {
    resetTuning()
    clearStoredTuning()
    set({ tuning: { ...TUNING } })
  },
  hydrateTuning: () => {
    loadTuning()
    set({ tuning: { ...TUNING } })
  },
  setInspected: inspected => set({ inspected }),
  setRecords: records => set({ records }),
  setArchive: archive => set({ archive }),
  setMilestones: milestones => set({ milestones }),
  setCanPan: canPan => set({ canPan }),

  setSaveState: saveState => set({ saveState }),
  setShelf: shelf => set({ shelf }),
  setWorldsOpen: worldsOpen => set({ worldsOpen }),

  notify: (text, action) =>
    set(s => ({
      // Keep the last few — a population crash can fire several at once.
      notices: [...s.notices, { id: ++noticeId, text, action }].slice(-3),
    })),
  dismissNotice: id => set(s => ({ notices: s.notices.filter(n => n.id !== id) })),
}))
