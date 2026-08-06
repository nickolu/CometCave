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

export interface SpeedRunState {
  active: boolean
  targetGeneration: number
  timeLimitSeconds: number
  /** World elapsed time (seconds) when the run started — so countdown = timeLimit - (elapsed - startElapsed). */
  startElapsed: number
  result: 'none' | 'won' | 'lost'
}

import type { SaveState } from './chronicle/chronicle'
import type { ElderRecord, SpeciesRecord } from './chronicle/types'
import type { Creature, CreatureBlueprint, CreatureThumb, HistoryEntry, LifeKind, MaterialId, NamedCreatureEntry, Traits } from './domain/types'
import type { ShelfState } from './worlds/shelf'

/** One entry in the time-lapse snapshot ring buffer. */
export interface CreatureSnapshot {
  elapsed: number
  creatures: Creature[]
}

/** Theme id standing for "the land the player summoned". */
export const SUMMONED_THEME_ID = 'summoned'

export type Tool =
  | { kind: 'material'; material: MaterialId }
  | { kind: 'erase' }
  | { kind: 'biome'; biomeId: string }
  | { kind: 'corridor' }
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
  /** Seconds spent somewhere it can't survive; 0 when it's fine. */
  distress: number
  starving: number
  /** Seconds of disease remaining; 0 when healthy. */
  sick: number
  /** Sprint fatigue 0–1; 0 when rested. */
  fatigue: number
  speed: number
  inWater: boolean
  grounded: boolean
  /** What it's chasing or running from right now. */
  targetName: string | null
  /** How far back its line goes; 1 means it was placed rather than born. */
  generation: number
  /** BlueprintIds of the parents, if this creature was born here (not placed). */
  parentBlueprintIds?: readonly [string, string | null] | null
  /** What it inherited, as multipliers on its species. Neutral at generation 1. */
  traits: Traits
  /** Player-given name, if this one earned the right to have one. */
  name: string | null
  /** True while this creature holds the land's longevity record. */
  isElder: boolean
  /** True while this creature is navigating toward a scent left by kin. */
  followingScent: boolean
  lifeLog: Array<{ elapsed: number; text: string }>
  packSize: number
  hostName: string | null
  /** Rolling history of recent mood states, oldest first, max 40 entries. */
  moodHistory: string[]
}

/** One column of the guide's record book — see `KindRecord`. */
export interface KindRecordsView {
  elder: ElderRecord | null
  bestGenerations: number
  bestGenerationsSpeciesName: string | null
}

/**
 * Records for the land currently on screen, as the UI wants them.
 *
 * Flattened out of the chronicle rather than exposing it directly: the panels
 * want "best ever here" and "how it's going right now" side by side, and those
 * come from two different places.
 */
export interface RecordsView {
  /** Best ever in this land, of any kind. Backs the crown, not the panel. */
  elder: ElderRecord | null
  bestSteadySeconds: number
  bestGenerations: number
  bestGenerationsSpeciesName: string | null
  /** How this run is going. */
  steadySeconds: number
  deepestGeneration: number
  /**
   * The two records again, split plant against animal — what the guide shows.
   *
   * Flat copies rather than the chronicle's own objects: those are mutated in
   * place several times a second, and a store value that changes without being
   * re-set is one React will never re-render for.
   */
  byKind: Record<LifeKind, KindRecordsView>
}

function emptyKindRecords(): KindRecordsView {
  return { elder: null, bestGenerations: 0, bestGenerationsSpeciesName: null }
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
  byKind: { plant: emptyKindRecords(), animal: emptyKindRecords() },
}

export interface PopulationEntry {
  blueprintId: string
  name: string
  count: number
  /** Highest generation number among living creatures of this species. */
  maxGeneration: number
}

export interface ExtinctionRecord {
  blueprintId: string
  name: string
  /** Sim time when the last one died, seconds. */
  elapsed: number
  /** How many sim seconds it was alive in this world. */
  livedFor: number
  /** Highest generation reached. */
  maxGeneration: number
}

/** Session-level lifetime statistics. */
export interface WorldStats {
  totalBorn: number
  totalDeaths: number
  totalEats: number
  peakPopulation: number
  /** Age in seconds of the longest-lived creature that died this session. */
  longestLived: number
  /** Name of the most prolific species (most children from one creature). */
  mostProlificName: string | null
  mostProlificChildren: number
}

const EMPTY_STATS: WorldStats = {
  totalBorn: 0,
  totalDeaths: 0,
  totalEats: 0,
  peakPopulation: 0,
  longestLived: 0,
  mostProlificName: null,
  mostProlificChildren: 0,
}

/** One time-series data point for the population graph. */
export interface PopulationSnapshot {
  /** Sim time in seconds when this snapshot was taken. */
  elapsed: number
  /** Creature count per blueprintId at this moment. */
  counts: Record<string, number>
}

/** One sample in the trait evolution history for a species. */
export interface TraitHistoryEntry {
  elapsed: number
  speed: number
  sight: number
  size: number
}

/** Average trait values for the species the player has focused in the graph. */
export interface FocusedSpeciesStats {
  blueprintId: string
  avgSpeed: number
  avgSight: number
  avgSize: number
  avgToxicity: number
  avgImmunity: number
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

export interface WorkshopSpawnRequest {
  /** The blueprint to introduce (will be sanitized in game-instance). */
  blueprint: CreatureBlueprint
  /** Initial traits for all spawned creatures. */
  traits: Traits
  /** Incremented to trigger the subscribe handler even for the same blueprint. */
  serial: number
}

interface MicroLandState {
  themeId: string
  tool: Tool
  brush: number
  brushShape: 'circle' | 'square'
  paused: boolean
  speed: number

  /** Every creature that exists in this world, built-in and summoned. */
  blueprints: CreatureBlueprint[]
  population: PopulationEntry[]
  totalCreatures: number
  elapsed: number
  /** Rolling history for the population graph. Cleared on world load. */
  populationHistory: PopulationSnapshot[]
  /** Species that went extinct in this session, newest last. */
  extinctions: ExtinctionRecord[]
  /**
   * Observed predator → prey relationships in this world.
   *
   * Key = eater blueprintId, value = array of eaten blueprintIds (unique).
   * Updated on every eat event (live prey and carcasses).
   */
  foodWeb: Record<string, string[]>
  worldStats: WorldStats
  namedCreatures: NamedCreatureEntry[]

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
  graphOpen: boolean
  challengesOpen: boolean
  challengeActive: { name: string; goal: string } | null
  workshopOpen: boolean
  workshopSpawnRequest: WorkshopSpawnRequest | null
  speedRun: SpeedRunState
  /** Incremented each time a world reshuffle is needed; watched by MicroLandGame. */
  reshuffleToken: number
  setChallengesOpen: (open: boolean) => void
  setChallengeActive: (c: { name: string; goal: string } | null) => void
  setWorkshopOpen: (open: boolean) => void
  requestWorkshopSpawn: (blueprint: CreatureBlueprint, traits: Traits) => void
  clearWorkshopSpawnRequest: () => void
  startSpeedRun: (targetGeneration: number, timeLimitSeconds: number, currentElapsed: number) => void
  endSpeedRun: (result: 'won' | 'lost') => void
  cancelSpeedRun: () => void
  requestReshuffle: () => void
  /**
   * Whether the tool drawer along the bottom is unrolled.
   *
   * On a phone the drawer is most of the screen, and the world it is there to
   * change is the part you came to watch. Folding it away leaves the tool
   * already in hand still armed, so tapping to place goes on working — you lose
   * the picker, not the game.
   */
  toolbarOpen: boolean
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
   * Whether there is any world off screen to scroll to.
   *
   * Almost always true, but an ultrawide display can fit all 672 tiles at once,
   * and so can any display once the player has zoomed all the way out. Scroll
   * buttons that visibly do nothing are worse than no buttons.
   */
  canPan: boolean
  /**
   * Whether the zoom has anywhere left to go in each direction.
   *
   * Both ends are reachable — a couple of presses of − on a wide monitor is the
   * whole world — so the buttons have to be able to say so rather than going
   * quietly dead under a finger.
   */
  canZoomIn: boolean
  canZoomOut: boolean
  /** Player's preferred zoom preset. Controls the canvas zoom level. */
  viewScale: 'wide' | 'standard' | 'close'
  setViewScale: (scale: 'wide' | 'standard' | 'close') => void

  /** Creature under the cursor when not actively interacting. */
  hoveredCreature: { id: number; mood: string; hunger: number; name: string; screenX: number; screenY: number } | null
  setHoveredCreature: (c: { id: number; mood: string; hunger: number; name: string; screenX: number; screenY: number } | null) => void

  notices: Notice[]

  /** Event history log, newest first, capped at 500 entries. */
  historyLog: HistoryEntry[]
  historyOpen: boolean

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

  /** Set when the field guide asks to find a species in the world. */
  locateRequest: { blueprintId: string; serial: number } | null
  /** Close the guide and emit a locate request for the game instance to handle. */
  requestLocate: (blueprintId: string) => void

  /**
   * Per-creature thumbnail data for the Field Guide sidebar population viewer.
   * Sorted longest-living → shortest. Updated by pushStats() each tick.
   */
  populationItems: CreatureThumb[]
  setPopulationItems: (items: CreatureThumb[]) => void
  /** Set when the Field Guide circle is clicked — game instance centers + inspects. */
  locateCreatureRequest: { id: number; serial: number } | null
  requestLocateCreature: (id: number) => void

  /**
   * When set, the renderer draws each creature with a color overlay based on
   * this trait's value — blue for weak, red for strong. Null means no overlay.
   */
  traitOverlay: string | null
  /** Toggle the trait overlay. Passing the current trait turns it off. */
  setTraitOverlay: (trait: string | null) => void
  /** Species pinned for comparison (first selection). */
  compareId: string | null
  setCompareId: (id: string | null) => void
  /**
   * Mean trait values sampled every 30s for each living species.
   *
   * Ring buffer — at most 60 entries per species. Pushed by game-instance.
   * Sparse — species that went extinct no longer receive new samples.
   */
  traitHistory: Record<string, TraitHistoryEntry[]>
  setTraitHistory: (h: Record<string, TraitHistoryEntry[]>) => void
  /** Blueprint id of the species clicked in the population graph — drives the detail panel. */
  graphFocusId: string | null
  setGraphFocusId: (id: string | null) => void
  /** Live average traits for the focused species, pushed on each stats tick. */
  focusedSpeciesStats: FocusedSpeciesStats | null
  setFocusedSpeciesStats: (stats: FocusedSpeciesStats | null) => void
  trailsEnabled: boolean
  setTrailsEnabled: (on: boolean) => void
  /** The species whose activity is shown as a heatmap overlay; null = off. */
  heatmapBlueprintId: string | null
  setHeatmapBlueprint: (id: string | null) => void
  soundEnabled: boolean
  setSoundEnabled: (on: boolean) => void

  /** Creature snapshots for time-lapse. Null = not in replay mode. */
  replaySnapshots: CreatureSnapshot[] | null
  replayIndex: number
  enterReplay: (snapshots: CreatureSnapshot[]) => void
  setReplayIndex: (i: number) => void
  exitReplay: () => void

  setTheme: (id: string) => void
  setTool: (tool: Tool) => void
  setBrush: (n: number) => void
  setBrushShape: (shape: 'circle' | 'square') => void
  togglePaused: () => void
  setSpeed: (n: number) => void
  setBlueprints: (list: CreatureBlueprint[]) => void
  /** Add a single blueprint without resetting population history. */
  addBlueprint: (bp: CreatureBlueprint) => void
  setStats: (population: PopulationEntry[], total: number, elapsed: number) => void
  addExtinction: (record: ExtinctionRecord) => void
  clearExtinctions: () => void
  updateWorldStats: (patch: Partial<WorldStats>) => void
  resetWorldStats: () => void
  logEat: (eaterId: string, preyId: string) => void
  clearFoodWeb: () => void
  setNamedCreatures: (entries: NamedCreatureEntry[]) => void
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
  setGraphOpen: (open: boolean) => void
  /** Roll the tool drawer up or down. Remembered for the next visit. */
  setToolbarOpen: (open: boolean) => void
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
  /**
   * Pull the remembered drawer state out of storage.
   *
   * Separate from the initial value for the same reason as `hydrateTuning`: this
   * store is built during the server render too, and a `localStorage` read there
   * answers differently than the browser will. The drawer starts unrolled on
   * both sides and folds itself on the client if that is how it was left.
   */
  hydrateToolbar: () => void
  setInspected: (snapshot: Inspected | null) => void
  setRecords: (records: RecordsView) => void
  setArchive: (archive: SpeciesRecord[]) => void
  setMilestones: (milestones: EarnedMilestone[]) => void
  setCanPan: (canPan: boolean) => void
  setZoomState: (canZoomIn: boolean, canZoomOut: boolean) => void
  setSaveState: (state: SaveState) => void
  setShelf: (shelf: ShelfState) => void
  setWorldsOpen: (open: boolean) => void
  notify: (text: string, action?: Notice['action']) => void
  dismissNotice: (id: number) => void
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id'>) => void
  setHistoryOpen: (open: boolean) => void
}

let noticeId = 0
let pendingId = 0
let locateSerial = 0
let locateCreatureSerial = 0
let historyEntryId = 0

const TOOLBAR_KEY = 'micro-land:toolbar:v1'

/**
 * Remember whether the drawer was left folded away.
 *
 * Both halves swallow everything: `localStorage` *throws on read as well as on
 * write* in private-mode Safari, and a drawer that cannot remember its state is
 * a far smaller loss than a game that will not start.
 */
function storeToolbarOpen(open: boolean): void {
  try {
    if (open) localStorage.removeItem(TOOLBAR_KEY)
    else localStorage.setItem(TOOLBAR_KEY, 'closed')
  } catch {
    // Nothing to do; the drawer just starts unrolled next time.
  }
}

function readToolbarOpen(): boolean {
  try {
    return localStorage.getItem(TOOLBAR_KEY) !== 'closed'
  } catch {
    return true
  }
}

export const useMicroLand = create<MicroLandState>(set => ({
  themeId: DEFAULT_THEME,
  tool: { kind: 'material', material: 'dirt' },
  brush: 4,
  brushShape: 'circle',
  paused: false,
  speed: 1,

  blueprints: [],
  population: [],
  totalCreatures: 0,
  elapsed: 0,
  populationHistory: [],
  extinctions: [],
  foodWeb: {},
  worldStats: { ...EMPTY_STATS },
  namedCreatures: [],

  summonOpen: false,
  summonBusy: false,
  summonMode: 'creature',
  summonedLand: null,
  summonError: null,
  pendingSummons: [],
  builderOpen: false,
  guideOpen: false,
  settingsOpen: false,
  graphOpen: false,
  challengesOpen: false,
  challengeActive: null,
  workshopOpen: false,
  workshopSpawnRequest: null,
  speedRun: { active: false, targetGeneration: 10, timeLimitSeconds: 300, startElapsed: 0, result: 'none' },
  reshuffleToken: 0,
  toolbarOpen: true,
  tuning: { ...TUNING },
  inspected: null,
  canPan: true,
  canZoomIn: true,
  canZoomOut: true,
  viewScale: 'standard',
  hoveredCreature: null,

  records: EMPTY_RECORDS,
  archive: [],
  milestones: [],

  notices: [],
  historyLog: [],
  historyOpen: false,
  saveState: { kind: 'idle' },
  shelf: { worlds: [], activeId: null, busy: false, error: null },
  worldsOpen: false,
  locateRequest: null,
  populationItems: [],
  locateCreatureRequest: null,
  traitOverlay: null,
  compareId: null,
  traitHistory: {},
  graphFocusId: null,
  focusedSpeciesStats: null,
  replaySnapshots: null,
  replayIndex: 0,
  trailsEnabled: false,
  heatmapBlueprintId: null,
  soundEnabled: false,

  setTheme: themeId => set({ themeId }),
  setTool: tool => set({ tool }),
  setBrush: brush => set({ brush }),
  setBrushShape: brushShape => set({ brushShape }),
  togglePaused: () => set(s => ({ paused: !s.paused })),
  setSpeed: speed => set({ speed }),
  setBlueprints: blueprints => set({ blueprints, populationHistory: [], extinctions: [], worldStats: { ...EMPTY_STATS }, foodWeb: {}, historyLog: [] }),
  addBlueprint: bp =>
    set(s => ({
      blueprints: s.blueprints.some(b => b.id === bp.id)
        ? s.blueprints.map(b => (b.id === bp.id ? bp : b))
        : [...s.blueprints, bp],
    })),
  setStats: (population, totalCreatures, elapsed) =>
    set(s => {
      const last = s.populationHistory[s.populationHistory.length - 1]
      const shouldSnapshot = !last || elapsed - last.elapsed >= 1
      const snapshot: PopulationSnapshot | undefined = shouldSnapshot
        ? { elapsed, counts: Object.fromEntries(population.map(p => [p.blueprintId, p.count])) }
        : undefined
      return {
        population,
        totalCreatures,
        elapsed,
        ...(snapshot !== undefined && {
          populationHistory: [...s.populationHistory.slice(-299), snapshot],
        }),
      }
    }),
  addExtinction: record => set(s => ({ extinctions: [...s.extinctions, record] })),
  clearExtinctions: () => set({ extinctions: [] }),
  updateWorldStats: patch => set(s => ({ worldStats: { ...s.worldStats, ...patch } })),
  resetWorldStats: () => set({ worldStats: { ...EMPTY_STATS } }),
  logEat: (eaterId, preyId) => set(s => {
    const existing = s.foodWeb[eaterId] ?? []
    if (existing.includes(preyId)) return {}
    return { foodWeb: { ...s.foodWeb, [eaterId]: [...existing, preyId] } }
  }),
  clearFoodWeb: () => set({ foodWeb: {} }),
  setNamedCreatures: entries => set({ namedCreatures: entries }),
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
  setGraphOpen: graphOpen => set({ graphOpen }),
  setChallengesOpen: open => set({ challengesOpen: open }),
  setChallengeActive: c => set({ challengeActive: c }),
  setWorkshopOpen: open => set({ workshopOpen: open }),
  requestWorkshopSpawn: (blueprint, traits) =>
    set(s => ({ workshopSpawnRequest: { blueprint, traits, serial: (s.workshopSpawnRequest?.serial ?? 0) + 1 } })),
  clearWorkshopSpawnRequest: () => set({ workshopSpawnRequest: null }),
  startSpeedRun: (targetGeneration, timeLimitSeconds, currentElapsed) =>
    set({ speedRun: { active: true, targetGeneration, timeLimitSeconds, startElapsed: currentElapsed, result: 'none' } }),
  endSpeedRun: result =>
    set(s => ({ speedRun: { ...s.speedRun, active: false, result } })),
  cancelSpeedRun: () =>
    set(s => ({ speedRun: { ...s.speedRun, active: false, result: 'none' } })),
  requestReshuffle: () => set(s => ({ reshuffleToken: s.reshuffleToken + 1 })),
  setToolbarOpen: toolbarOpen => {
    storeToolbarOpen(toolbarOpen)
    set({ toolbarOpen })
  },
  hydrateToolbar: () => set({ toolbarOpen: readToolbarOpen() }),

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
  setZoomState: (canZoomIn, canZoomOut) => set({ canZoomIn, canZoomOut }),
  setViewScale: viewScale => set({ viewScale }),
  setHoveredCreature: c => set({ hoveredCreature: c }),

  setSaveState: saveState => set({ saveState }),
  setShelf: shelf => set({ shelf }),
  setWorldsOpen: worldsOpen => set({ worldsOpen }),
  requestLocate: blueprintId =>
    set({ locateRequest: { blueprintId, serial: ++locateSerial }, guideOpen: false }),
  setPopulationItems: items => set({ populationItems: items }),
  requestLocateCreature: id =>
    set({ locateCreatureRequest: { id, serial: ++locateCreatureSerial } }),
  setTraitOverlay: trait => set(s => ({ traitOverlay: s.traitOverlay === trait ? null : trait })),
  setCompareId: id => set({ compareId: id }),
  setTraitHistory: h => set({ traitHistory: h }),
  setGraphFocusId: id => set({ graphFocusId: id, ...(id === null && { focusedSpeciesStats: null }) }),
  setFocusedSpeciesStats: stats => set({ focusedSpeciesStats: stats }),
  setTrailsEnabled: on => set({ trailsEnabled: on }),
  setHeatmapBlueprint: id => set({ heatmapBlueprintId: id }),
  setSoundEnabled: on => set({ soundEnabled: on }),

  enterReplay: snapshots =>
    set({ replaySnapshots: snapshots, replayIndex: snapshots.length - 1, paused: true }),
  setReplayIndex: i => set({ replayIndex: i }),
  exitReplay: () => set({ replaySnapshots: null, replayIndex: 0, paused: false }),

  notify: (text, action) =>
    set(s => ({
      // Keep the last few — a population crash can fire several at once.
      notices: [...s.notices, { id: ++noticeId, text, action }].slice(-3),
    })),
  dismissNotice: id => set(s => ({ notices: s.notices.filter(n => n.id !== id) })),
  addHistoryEntry: entry =>
    set(s => ({
      historyLog: [{ ...entry, id: ++historyEntryId }, ...s.historyLog].slice(0, 500),
    })),
  setHistoryOpen: historyOpen => set({ historyOpen }),
}))
