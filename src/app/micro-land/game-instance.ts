/**
 * Owns the world, the loop, and the pointer.
 *
 * Deliberately outside React: the world mutates 60 times a second and React
 * only hears about it through a small summary pushed a few times a second.
 */
import { AIR, MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import {
  type SanitizedTerrain,
  sanitizeTerrain,
  terrainToTheme,
} from '@/app/micro-land/domain/terrain'
import { SUMMONED_THEME_ID } from '@/app/micro-land/store'
import { saveSpeedRunRecord } from '@/app/micro-land/domain/speed-run-records'

import {
  archivedSpecies,
  claimMilestone,
  flushChronicle,
  forgetSpecies,
  landId,
  landRecord,
  noteSpeciesLife,
  readChronicle,
  rememberSpecies,
  restoreSpeciesRecord,
  updateChronicle,
} from './chronicle/chronicle'
import {
  artSize,
  bodyBox,
  forgetBodyBox,
  lifeKind,
  reserveSummonIds,
  sanitizeBlueprint,
} from './domain/blueprint'
import { BIOME_BY_ID } from './domain/config/biomes'
import { MILESTONES, type MilestoneContext } from './domain/config/milestones'
import { DEFAULT_THEME, THEME_BY_ID, type Theme } from './domain/config/themes'
import { ELDER_MIN_SECONDS, TICK_S, TILE_TICK_EVERY, WORLD_H, WORLD_W } from './domain/constants'
import { type SimEvent, emitParticles, tickCreatures } from './domain/sim/creature-sim'
import { makeRng } from './domain/sim/prng'
import { tickTiles } from './domain/sim/tile-sim'
import {
  applyMassExtinction,
  applyStorm,
  applyTheme,
  applyThemeObject,
  applyTide,
  boxHitsSolid,
  boxLiquidFraction,
  clearCreatures,
  countByBlueprint,
  createWorld,
  erodeTile,
  paintBiomeCircle,
  paintBiomeSquare,
  paintCircle,
  paintSquare,
  registerBlueprint,
  seedStarters,
  spawnCreature,
  spawnSomewhereSensible,
} from './domain/sim/world'
import { lifespanOf } from './domain/traits'
import { TUNING } from './domain/tuning'
import {
  type Creature,
  type CreatureBlueprint,
  type CreatureThumb,
  type HistoryEntry,
  LIFE_KINDS,
  type LifeKind,
  type NamedCreatureEntry,
  type Traits,
  type WorldState,
} from './domain/types'
import { playBorn, playDeath, playEat, playExtinction, isSoundEnabled } from './audio/sound-engine'
import { formatDuration } from './format'
import { Renderer } from './rendering/renderer'
import { forgetSprites } from './rendering/sprite-cache'
import {
  type EarnedMilestone,
  type ExtinctionRecord,
  type FocusedSpeciesStats,
  type KindRecordsView,
  type PopulationEntry,
  type TraitHistoryEntry,
  useMicroLand,
} from './store'
import { releaseActiveWorld, touchActiveWorld } from './worlds/shelf'
import { restoreSnapshot, snapshotWorld } from './worlds/snapshot'
import { WORLD_SAVE_VERSION, type WorldSave } from './worlds/types'

import type { SpeciesRecord } from './chronicle/types'

/** How often the UI gets a fresh population summary. */
const STATS_EVERY_MS = 300

/** How many to put out when an edited species has nobody left alive to change. */
const REVISE_PLACE_COUNT = 4

/** Placing creatures by dragging shouldn't fire once per frame. */
const PLACE_THROTTLE_MS = 130

/** Minimum world-seconds between "X caught a Y" notices. */
const HUNT_NOTICE_GAP = 7

/** Simulation can't catch up on more than this much time at once. */
const MAX_CATCHUP_MS = 250

/**
 * Milestones already earned, in the order the config lists them.
 *
 * Ordered by the config rather than by when they were reached so the field
 * guide reads as a ladder — the ones still ahead of you sit in a stable place.
 */
function readMilestones(): EarnedMilestone[] {
  const earned = readChronicle().milestones
  return MILESTONES.filter(m => earned[m.id]).map(m => ({
    id: m.id,
    text: m.text,
    at: earned[m.id],
  }))
}

/** Held-key and held-button pan speed, world tiles per second. */
const PAN_SPEED = 115

/** One wheel notch or one arrow-button tap, in world tiles. */
const PAN_STEP = 34

/**
 * How close to the edge you can drag something before the world starts sliding.
 *
 * Expressed as a fraction of the view rather than a tile count so it behaves the
 * same on a phone showing 224 tiles and a monitor showing 400.
 */
const EDGE_BAND = 0.12
const EDGE_SPEED = 90

/** How hard the camera chases the creature the inspector is watching. */
const FOLLOW_SPEED = 90

/** Drag further than this and a tap was really a pan. CSS pixels. */
const TAP_SLOP = 6

/**
 * How much zoom one notch of a ctrl-wheel is worth.
 *
 * A trackpad pinch on macOS arrives as a wheel event with `ctrlKey` set and a
 * delta of a few pixels per frame, so this has to be gentle enough that a pinch
 * is smooth; a mouse wheel sends one large delta per notch and gets a whole step
 * out of the same number.
 */
const WHEEL_ZOOM_RATE = 0.0125

export class GameInstance {
  private canvas: HTMLCanvasElement
  private renderer: Renderer
  private world: WorldState
  private rng = makeRng(0xc0ffee)

  private rafId: number | null = null
  private destroyed = false
  private lastFrame = 0
  private accumulator = 0
  private tileCounter = 0
  private statsTimer = 0
  private pendingBirths: Record<string, number> = {}
  private pendingDeaths: Record<string, number> = {}

  /** Species that existed last time we checked, for extinction notices. */
  private knownSpecies = new Set<string>()
  /** World-clock time when each species was first observed alive in this world. */
  private speciesFirstSeen = new Map<string, number>()
  /** World-clock time of the last hunt notice, so kills don't spam the screen. */
  private lastHuntNotice = -HUNT_NOTICE_GAP

  // --- time-lapse ---
  private snapshotHistory: Array<{ elapsed: number; creatures: Creature[] }> = []
  private lastSnapshotElapsed = -30

  // --- trait evolution history ---
  private traitHistory = new Map<string, TraitHistoryEntry[]>()
  private lastTraitSample = -30

  // --- records ---
  /** Which land's records are being written to. See `landId()`. */
  private currentLand = DEFAULT_THEME
  /** The creature currently holding the longevity record, if one is alive. */
  private elderId: number | null = null
  /**
   * Enough of the elder to eulogize it.
   *
   * Kept alongside the id because the announcement happens *after* the creature
   * has already been filtered out of the world, so there is nothing left to read
   * its age or its name off by then.
   */
  private elderSnapshot: { name: string | null; species: string; seconds: number } | null = null
  /**
   * Who currently holds each column's longevity record.
   *
   * Only used to date the record: `at` marks when a record was *taken*, and the
   * column is rewritten on every stats tick while its holder keeps ageing, so
   * without knowing whether the holder changed the date would creep forward
   * forever and no record would ever look old. Not a second crown — the halo,
   * the eulogy and naming all still follow `elderId`, of which there is one.
   */
  private kindElderIds = new Map<LifeKind, number>()
  /** World-clock time the current no-extinction streak began. */
  private steadySince = 0
  /**
   * Prey species to watch for trophic-cascade blooms after their predator went
   * extinct. Maps blueprintId → creature count at the moment of extinction.
   */
  private trophicWatch = new Map<string, number>()
  /** Flips to true permanently once a cascade bloom has been confirmed. */
  private trophicCascadeDetected = false
  /** Archive size at the last push, so the guide is only re-sent when it grows. */
  private lastArchiveSize = -1
  /** World-time of the last mass extinction cataclysm. */
  private lastMassExtinction = -Infinity
  /** World-time of the last storm. */
  private lastStorm = -Infinity

  // --- terrain erosion ---
  /**
   * Per-tile creature visit counter. Incremented on each erosion update;
   * reset to 0 when the tile degrades. Uint16Array keeps it cheap.
   */
  private erosionTraffic: Uint16Array = new Uint16Array(WORLD_W * WORLD_H)
  private erosionTickCounter = 0

  // --- mood history for inspector sparkline ---
  private moodHistory: string[] = []
  private moodHistoryCreatureId: number | null = null
  /** Position samples for the memory trail; reset when inspectedId changes. */
  private inspectedTrail: { x: number; y: number }[] = []
  private trailLastSample = -999

  // --- heatmap ---
  private heatmap: Float32Array | null = null
  private heatmapCurrentBpId: string | null = null
  private heatmapTickCounter = 0

  // --- pointer state ---
  private pointerDown = false
  private grabbed: Creature | null = null
  /** Creature the inspector is watching, if any. */
  private inspectedId: number | null = null
  /** Terrain the player summoned, standing in for a built-in theme. */
  private summonedTheme: Theme | null = null
  /**
   * The terrain that theme was built from.
   *
   * Kept alongside it because a `Theme` carries a `build` function and functions
   * do not survive JSON — this is the half of a summoned land that can be
   * shelved, and `terrainToTheme` rebuilds the rest of it on the way back in.
   */
  private summonedTerrain: SanitizedTerrain | null = null
  private grabTrail: { x: number; y: number; t: number }[] = []
  private lastPlaceAt = 0
  private resizeObserver: ResizeObserver | null = null

  // --- camera state ---
  /**
   * Every pointer currently down, so a second finger can be noticed.
   *
   * Both coordinates, not just the column: a pinch needs the distance between
   * two fingers, and zoomed in there is somewhere to pan vertically to.
   */
  private pointers = new Map<number, { x: number; y: number }>()
  /** Where a drag-pan started, and the camera position it started at. */
  private panAnchorX = 0
  private panAnchorY = 0
  private panAnchorCam = 0
  private panAnchorCamY = 0
  private panning = false
  /**
   * The two-finger gesture in progress, if there is one.
   *
   * Pinching is tracked as a change since the *last* move rather than since the
   * gesture began, unlike the one-finger drag: a pinch is a zoom and a pan at
   * once, and an absolute anchor for each would have them fighting over the same
   * camera every frame. Incremental, they compose — zoom about the midpoint,
   * then slide by however far the midpoint itself travelled.
   */
  private pinch: { dist: number; x: number; y: number } | null = null
  /** -1, 0 or 1 — an arrow key or arrow button being held down. */
  private panHeld = 0
  /** The same, vertically. Only reachable by keyboard, and only when zoomed in. */
  private panHeldY = 0
  /** Direction keys currently held, so releasing one of two doesn't stop both. */
  private keysDown = new Set<string>()
  /** A look-mode tap waiting to see whether it turns into a pan. */
  private pendingInspect: { id: number | null } | null = null
  /** The pointer went down on the minimap, so it belongs to the minimap. */
  private scrubbingMap = false
  /**
   * Whether the camera is still chasing the inspected creature.
   *
   * Cleared the moment the player pans by hand: following is a convenience, and
   * a camera that drags itself back after you deliberately looked somewhere else
   * is not a convenience.
   */
  private following = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new Renderer(canvas)
    this.world = createWorld(Date.now() & 0xffff)

    this.restoreArchivedCreatures()
    this.syncBlueprintsToStore()
    this.setTheme(useMicroLand.getState().themeId || DEFAULT_THEME)
    this.attachInput()
    this.observeResize()
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  start(): void {
    if (this.rafId !== null) return
    this.lastFrame = performance.now()
    const loop = (now: number) => {
      if (this.destroyed) return
      this.frame(now)
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  destroy(): void {
    this.destroyed = true
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.detachInput()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
  }

  private observeResize(): void {
    const parent = this.canvas.parentElement
    if (!parent) return
    const apply = () => {
      const rect = parent.getBoundingClientRect()
      this.renderer.resize(rect.width, rect.height)
      this.pushCamera()
    }
    apply()
    this.resizeObserver = new ResizeObserver(apply)
    this.resizeObserver.observe(parent)
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  private frame(now: number): void {
    const state = useMicroLand.getState()
    const theme = this.resolveTheme(state.themeId)

    let delta = now - this.lastFrame
    this.lastFrame = now
    // A backgrounded tab hands back a huge delta; don't try to simulate it all.
    if (delta > MAX_CATCHUP_MS) delta = MAX_CATCHUP_MS

    if (!state.paused) {
      this.accumulator += delta * state.speed
      const step = TICK_S * 1000
      let steps = 0
      const events: SimEvent[] = []
      while (this.accumulator >= step && steps < 8) {
        this.accumulator -= step
        steps++
        this.step(theme.gravity, events)
      }
      if (steps > 0 && events.length > 0) this.digestEvents(events)
    } else {
      this.accumulator = 0
    }

    this.statsTimer += delta
    if (this.statsTimer >= STATS_EVERY_MS) {
      this.statsTimer = 0
      this.pushStats()
    }

    // Keep the grabbed creature glued to the finger even while paused.
    if (this.grabbed) this.grabbed.vx = this.grabbed.vy = 0

    // Panning runs off wall-clock rather than the sim clock, so the camera
    // answers at the same speed whether the world is paused or on fast-forward.
    this.updateCamera(delta / 1000)

    // In replay mode, render the historical snapshot instead of live creatures.
    const { replaySnapshots, replayIndex } = useMicroLand.getState()
    if (replaySnapshots && replaySnapshots.length > 0) {
      const snap = replaySnapshots[replayIndex] ?? replaySnapshots[replaySnapshots.length - 1]
      const replayWorld = { ...this.world, creatures: snap.creatures }
      this.renderer.render(replayWorld, theme, undefined, undefined, null)
    } else {
      this.renderer.render(this.world, theme, this.inspectedId, this.elderId, this.heatmap)
    }
  }

  /**
   * Move the camera for anything that isn't a direct drag.
   *
   * Held keys and held buttons, carrying a creature past the edge, and chasing
   * whatever the inspector is watching. Drag-panning is absolute and lives in
   * the pointer handler; everything here is per-second and belongs on a clock.
   */
  private updateCamera(dt: number): void {
    if (this.panHeld !== 0 || this.panHeldY !== 0) {
      this.following = false
      this.renderer.panBy(this.panHeld * PAN_SPEED * dt, this.panHeldY * PAN_SPEED * dt)
    }

    // Carry a creature to the edge and the world comes with it — otherwise
    // there is no way to move something from one end of the world to the other.
    if (this.grabbed && this.pointerDown && !this.panning) {
      const view = this.renderer.viewWidth
      const cam = this.renderer.cameraX
      const held = this.grabbed.x
      let dir = 0
      if (held < cam + view * EDGE_BAND) dir = -1
      else if (held > cam + view * (1 - EDGE_BAND)) dir = 1

      // The same band top and bottom, but only once zoom has put world off
      // screen that way — otherwise dragging something down to the floor, which
      // is a completely normal thing to do, would try to scroll after it.
      const rows = this.renderer.viewHeight
      const camY = this.renderer.cameraY
      const heldY = this.grabbed.y
      let dirY = 0
      if (this.renderer.canPanVertically) {
        if (heldY < camY + rows * EDGE_BAND) dirY = -1
        else if (heldY > camY + rows * (1 - EDGE_BAND)) dirY = 1
      }

      if (dir !== 0 || dirY !== 0) {
        this.renderer.panBy(dir * EDGE_SPEED * dt, dirY * EDGE_SPEED * dt)
        // The creature is positioned from the pointer, and the pointer isn't
        // moving — so without dragging it along by the same amount it would slip
        // out of the edge band on the first frame and the scroll would stop dead.
        const moved = this.renderer.cameraX - cam
        const movedY = this.renderer.cameraY - camY
        const bp = this.world.blueprints[this.grabbed.blueprintId]
        const art = bp ? artSize(bp) : { w: 0, h: 0 }
        this.grabbed.x = Math.max(0, Math.min(this.world.width - art.w, held + moved))
        this.grabbed.y = Math.max(0, Math.min(this.world.height - art.h, heldY + movedY))
      }
    }

    if (this.following && this.inspectedId !== null) {
      const c = this.world.creatures.find(x => x.id === this.inspectedId)
      if (c) {
        this.renderer.keepInView(c.x, this.renderer.viewWidth * 0.22, FOLLOW_SPEED * dt)
        this.renderer.keepInViewY(c.y, this.renderer.viewHeight * 0.22, FOLLOW_SPEED * dt)
      }
    }
  }

  private step(gravity: number, events: SimEvent[]): void {
    const w = this.world
    w.elapsed += TICK_S

    // Time-lapse: take a creature snapshot every 30 sim-seconds.
    if (w.elapsed - this.lastSnapshotElapsed >= 30) {
      this.lastSnapshotElapsed = w.elapsed
      this.snapshotHistory.push({
        elapsed: w.elapsed,
        creatures: w.creatures.map(c => ({ ...c, traits: { ...c.traits } })),
      })
      // Keep last 60 snapshots (30 min at 30s intervals)
      if (this.snapshotHistory.length > 60) this.snapshotHistory.shift()
    }

    this.tileCounter++
    if (this.tileCounter >= TILE_TICK_EVERY) {
      this.tileCounter = 0
      tickTiles(w)
      applyTide(w)
      // Tiles moved, so the cached tile image is stale.
      this.renderer.markTilesDirty()
    }

    // --- mass extinction cataclysm ---
    if (
      TUNING.massExtinctionInterval > 0 &&
      w.elapsed - this.lastMassExtinction >= TUNING.massExtinctionInterval
    ) {
      this.lastMassExtinction = w.elapsed
      const { cx, cy } = applyMassExtinction(w, this.rng)
      this.renderer.markTilesDirty()
      // Scatter a burst of dark particles at the blast centre.
      for (let i = 0; i < 20; i++) {
        const angle = this.rng() * Math.PI * 2
        const speed = 0.5 + this.rng() * 1.5
        w.particles.push({
          x: cx + (this.rng() - 0.5) * 6,
          y: cy + (this.rng() - 0.5) * 6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.5,
          life: 2 + this.rng() * 2,
          maxLife: 4,
          color: this.rng() < 0.5 ? '#6b7280' : '#374151',
        })
      }
      useMicroLand.getState().notify('A cataclysm strikes. The land remembers nothing.')
      this.breakSteadyStreak()
    }

    // --- storm event ---
    if (
      TUNING.stormInterval > 0 &&
      w.elapsed - this.lastStorm >= TUNING.stormInterval
    ) {
      this.lastStorm = w.elapsed
      const { x0, x1 } = applyStorm(w, this.rng)
      this.renderer.markTilesDirty()
      // Scatter blue-grey rain particles across the storm column.
      const stormW = x1 - x0
      for (let i = 0; i < Math.min(30, stormW); i++) {
        const rx = x0 + Math.floor(this.rng() * stormW)
        const ry = this.rng() * 8
        w.particles.push({
          x: rx,
          y: ry,
          vx: (this.rng() - 0.5) * 0.3,
          vy: 1.5 + this.rng() * 2,
          life: 1.5 + this.rng() * 1.5,
          maxLife: 3,
          color: this.rng() < 0.6 ? '#93c5fd' : '#60a5fa',
        })
      }
      useMicroLand.getState().notify('A storm sweeps through, stripping the land and flooding the banks.')
    }

    tickCreatures(w, TICK_S, this.rng, gravity, events)

    // --- terrain erosion (every 30 ticks ≈ every 0.5 s at 60 fps) ---
    this.erosionTickCounter++
    if (this.erosionTickCounter >= 30) {
      this.erosionTickCounter = 0
      const w = this.world
      // Stamp each creature's current tile.
      for (const c of w.creatures) {
        const tx = Math.max(0, Math.min(WORLD_W - 1, Math.round(c.x)))
        const ty = Math.max(0, Math.min(WORLD_H - 1, Math.round(c.y)))
        const i = ty * WORLD_W + tx
        if (this.erosionTraffic[i] < 65000) this.erosionTraffic[i]++
      }
      // Degrade any tile that has seen enough traffic.
      const THRESHOLD = 80
      for (let i = 0; i < this.erosionTraffic.length; i++) {
        if (this.erosionTraffic[i] >= THRESHOLD) {
          const x = i % WORLD_W
          const y = Math.floor(i / WORLD_W)
          erodeTile(w, x, y)
          this.erosionTraffic[i] = 0
        }
      }
    }

    // --- rain ---
    if (TUNING.rainRate > 0 && this.rng() < TUNING.rainRate) {
      const rx = Math.floor(this.rng() * WORLD_W)
      paintCircle(this.world, rx, 0, 1, 'water')
    }

    // --- heatmap update (every 5 ticks) ---
    this.heatmapTickCounter++
    if (this.heatmapTickCounter >= 5) {
      this.heatmapTickCounter = 0
      const bpId = useMicroLand.getState().heatmapBlueprintId
      if (bpId !== this.heatmapCurrentBpId) {
        this.heatmapCurrentBpId = bpId
        this.heatmap = bpId ? new Float32Array(WORLD_W * WORLD_H) : null
      }
      if (this.heatmap && bpId) {
        // Decay existing values.
        for (let i = 0; i < this.heatmap.length; i++) this.heatmap[i] *= 0.995
        // Stamp each creature of the tracked species.
        for (const c of w.creatures) {
          if (c.blueprintId !== bpId) continue
          const tx = Math.max(0, Math.min(WORLD_W - 1, Math.round(c.x)))
          const ty = Math.max(0, Math.min(WORLD_H - 1, Math.round(c.y)))
          this.heatmap[ty * WORLD_W + tx] += 1
        }
      }
    }
  }

  /** Turn raw sim events into the occasional human-readable notice. */
  private digestEvents(events: SimEvent[]): void {
    const { notify, logEat, updateWorldStats, worldStats } = useMicroLand.getState()

    for (const event of events) {
      if (event.kind !== 'ate' || !event.victimId) continue
      // Log to food web — every eat, including carcasses (victimId now set for both).
      logEat(event.blueprintId, event.victimId)
      if (isSoundEnabled()) {
        // Hash blueprint id to a hue-like number (0–360) for pitch variety
        let h = 0
        for (const ch of event.blueprintId) h = (h * 31 + ch.charCodeAt(0)) & 0xffff
        playEat((h % 360))
      }

      // Announce predation on animals — a kill is instant and the victim just
      // vanishes, so without this the food chain runs invisibly and looks like
      // it isn't happening at all. Plants are eaten constantly; saying so every
      // time would drown out everything else.
      const victim = this.world.blueprints[event.victimId]
      if (!victim || victim.move.kind === 'root') continue
      if (this.world.elapsed - this.lastHuntNotice < HUNT_NOTICE_GAP) continue
      const hunter = this.world.blueprints[event.blueprintId]
      if (!hunter) continue
      this.lastHuntNotice = this.world.elapsed
      notify(`A ${hunter.name} caught a ${victim.name}.`)
    }

    for (const event of events) {
      if (event.kind !== 'eaten' && event.kind !== 'starved' && event.kind !== 'drowned' && event.kind !== 'burned' && event.kind !== 'aged' && event.kind !== 'diseased' && event.kind !== 'frosted' && event.kind !== 'overheated') continue
      const bp = this.world.blueprints[event.blueprintId]
      if (!bp) continue
      // Was that the last one? Only interesting for species we'd seen alive.
      if (!this.knownSpecies.has(bp.id)) continue
      const stillAlive = this.world.creatures.some(c => c.blueprintId === bp.id)
      if (stillAlive) continue
      this.knownSpecies.delete(bp.id)
      // Record extinction in store for the field guide memorial.
      {
        const firstSeen = this.speciesFirstSeen.get(bp.id) ?? this.world.elapsed
        const livedFor = this.world.elapsed - firstSeen
        const maxGeneration = this.world.creatures.reduce(
          (max, c) => c.blueprintId === bp.id ? Math.max(max, c.generation) : max,
          1
        )
        useMicroLand.getState().addExtinction({
          blueprintId: bp.id,
          name: bp.name,
          elapsed: this.world.elapsed,
          livedFor,
          maxGeneration,
        })
        // Drop a fossil where the last creature of this species died.
        this.world.fossils.push({
          id: this.world.nextFossilId++,
          x: event.x,
          y: event.y,
          blueprintId: bp.id,
          name: bp.name,
          livedFor,
          maxGeneration,
          elapsed: this.world.elapsed,
        })
      }
      // An extinction is exactly what the steady streak measures the absence of
      // — it is the moment the world has to bail the player out via seed rain.
      this.breakSteadyStreak()
      notify(
        event.kind === 'starved' ? `The last ${bp.name} starved.`
        : event.kind === 'diseased' ? `The last ${bp.name} died of disease.`
        : event.kind === 'drowned' ? `The last ${bp.name} drowned.`
        : event.kind === 'burned' ? `The last ${bp.name} burned.`
        : event.kind === 'aged' ? `The last ${bp.name} lived to old age.`
        : event.kind === 'frosted' ? `The last ${bp.name} froze.`
        : event.kind === 'overheated' ? `The last ${bp.name} overheated.`
        : `The last ${bp.name} was eaten.`
      )
      // Trophic cascade: note the food web ripple from this extinction.
      {
        const foodWeb = useMicroLand.getState().foodWeb
        const eatsMeat = bp.diet.eats.includes('meat')
        const eatsPlants = bp.diet.eats.includes('plant')

        if (eatsMeat) {
          // A predator went extinct — surviving prey species may now multiply unchecked.
          const preyIds = foodWeb[bp.id] ?? []
          const alivePrey = preyIds
            .map(id => this.world.blueprints[id]?.name)
            .filter((name): name is string =>
              !!name && this.world.creatures.some(c => this.world.blueprints[c.blueprintId]?.name === name)
            )
          if (alivePrey.length === 1) {
            notify(`Without ${bp.name}, the ${alivePrey[0]} have nothing to fear.`)
          } else if (alivePrey.length >= 2) {
            notify(`Without ${bp.name}, the ${alivePrey[0]} and ${alivePrey[1]} have nothing to fear.`)
          }
          // Record prey counts now for trophic-cascade bloom detection.
          if (!this.trophicCascadeDetected) {
            const counts = countByBlueprint(this.world)
            for (const preyId of preyIds) {
              const c = counts[preyId] ?? 0
              if (c > 0 && !this.trophicWatch.has(preyId)) {
                this.trophicWatch.set(preyId, c)
              }
            }
          }
        } else if (eatsPlants) {
          // A herbivore went extinct — surviving predators that ate it lose a food source.
          const predatorIds = Object.keys(foodWeb).filter(predId =>
            foodWeb[predId].includes(bp.id)
          )
          const alivePredNames = predatorIds
            .filter(id => this.world.creatures.some(c => c.blueprintId === id))
            .map(id => this.world.blueprints[id]?.name)
            .filter((name): name is string => !!name)
          if (alivePredNames.length === 1) {
            notify(`The ${alivePredNames[0]} lost their prey.`)
          } else if (alivePredNames.length >= 2) {
            notify(`The ${alivePredNames[0]} and ${alivePredNames[1]} lost their prey.`)
          }
        }
      }
      if (isSoundEnabled()) playExtinction()
    }

    // Accumulate lifetime stats.
    let totalBorn = 0, totalDeaths = 0, totalEats = 0
    let longestLived = worldStats.longestLived
    let mostProlificName = worldStats.mostProlificName
    let mostProlificChildren = worldStats.mostProlificChildren
    for (const event of events) {
      if (event.kind === 'born') { totalBorn++ }
      else if (event.kind === 'eaten' || event.kind === 'starved' || event.kind === 'drowned' || event.kind === 'burned' || event.kind === 'aged' || event.kind === 'diseased') {
        totalDeaths++
        if ((event.ageSeconds ?? 0) > longestLived) longestLived = event.ageSeconds ?? 0
        if ((event.children ?? 0) > mostProlificChildren) {
          mostProlificChildren = event.children ?? 0
          mostProlificName = this.world.blueprints[event.blueprintId]?.name ?? null
        }
      } else if (event.kind === 'ate' && event.victimId) {
        totalEats++
      }
    }
    if (totalBorn > 0 || totalDeaths > 0 || totalEats > 0 || longestLived !== worldStats.longestLived) {
      updateWorldStats({
        totalBorn: worldStats.totalBorn + totalBorn,
        totalDeaths: worldStats.totalDeaths + totalDeaths,
        totalEats: worldStats.totalEats + totalEats,
        longestLived,
        mostProlificName,
        mostProlificChildren,
      })
    }

    // Track per-species births/deaths for the population graph.
    for (const event of events) {
      if (event.kind === 'born') {
        this.pendingBirths[event.blueprintId] = (this.pendingBirths[event.blueprintId] ?? 0) + 1
      } else if (
        event.kind === 'eaten' || event.kind === 'starved' || event.kind === 'drowned' ||
        event.kind === 'burned' || event.kind === 'aged' || event.kind === 'diseased'
      ) {
        this.pendingDeaths[event.blueprintId] = (this.pendingDeaths[event.blueprintId] ?? 0) + 1
      }
    }

    // Play sounds for aggregate events this tick
    if (isSoundEnabled()) {
      let hadBirth = false, hadDeath = false
      for (const ev of events) {
        if (ev.kind === 'born' && !hadBirth) { playBorn(); hadBirth = true }
        if ((ev.kind === 'aged' || ev.kind === 'starved' || ev.kind === 'drowned' || ev.kind === 'burned' || ev.kind === 'diseased') && !hadDeath) {
          playDeath(); hadDeath = true
        }
      }
    }

    // Push entries to the event history log.
    const { addHistoryEntry } = useMicroLand.getState()
    const simTime = this.world.elapsed
    const bps = this.world.blueprints

    for (const event of events) {
      const bp = bps[event.blueprintId]
      if (!bp) continue
      const speciesName = bp.name
      const isPlant = bp.move.kind === 'root'

      if (event.kind === 'born') {
        if (isPlant) {
          addHistoryEntry({
            simTime,
            kind: 'plant',
            blueprintId: event.blueprintId,
            speciesName,
            creatureName: null,
            detail: `A ${speciesName} spread`,
          })
        } else {
          addHistoryEntry({
            simTime,
            kind: 'born',
            blueprintId: event.blueprintId,
            speciesName,
            creatureName: null,
            detail: `A ${speciesName} was born`,
          })
        }
      } else if (event.kind === 'ate') {
        if (!event.victimId) continue
        const victimBp = bps[event.victimId]
        if (!victimBp || victimBp.move.kind === 'root') continue
        addHistoryEntry({
          simTime,
          kind: 'ate',
          blueprintId: event.blueprintId,
          speciesName,
          creatureName: null,
          detail: `A ${speciesName} ate a ${victimBp.name}`,
          killerBlueprintId: event.blueprintId,
          killerSpeciesName: speciesName,
        })
      } else if (
        event.kind === 'eaten' ||
        event.kind === 'starved' ||
        event.kind === 'drowned' ||
        event.kind === 'burned' ||
        event.kind === 'aged' ||
        event.kind === 'diseased'
      ) {
        const creatureName = event.creatureName ?? null
        const prefix = creatureName ? `${creatureName} the ${speciesName}` : `A ${speciesName}`
        let detail: string
        if (event.kind === 'aged') {
          const age = event.ageSeconds != null ? ` (${Math.round(event.ageSeconds)}s)` : ''
          detail = `${prefix} lived to old age${age}`
        } else if (event.kind === 'starved') {
          detail = `${prefix} starved`
        } else if (event.kind === 'eaten') {
          detail = `${prefix} was eaten`
        } else if (event.kind === 'drowned') {
          detail = `${prefix} drowned`
        } else if (event.kind === 'burned') {
          detail = `${prefix} burned`
        } else {
          detail = `${prefix} died of disease`
        }
        const entry: Omit<HistoryEntry, 'id'> = {
          simTime,
          kind: isPlant ? 'plant_died' : 'died',
          blueprintId: event.blueprintId,
          speciesName,
          creatureName,
          detail,
          cause: event.kind,
        }
        addHistoryEntry(entry)
      } else if (event.kind === 'sick') {
        addHistoryEntry({
          simTime,
          kind: 'sick',
          blueprintId: event.blueprintId,
          speciesName,
          creatureName: null,
          detail: `A ${speciesName} caught disease`,
        })
      }
    }
  }

  /**
   * End the current no-extinction streak, banking it if it was the best.
   *
   * Banked before the reset rather than only at the end of a session, because
   * most sessions end with the tab closing rather than with anything tidy.
   */
  private breakSteadyStreak(): void {
    const run = this.world.elapsed - this.steadySince
    this.steadySince = this.world.elapsed
    if (run <= 0) return
    updateChronicle(() => {
      const record = landRecord(this.currentLand)
      if (run > record.steadySeconds) record.steadySeconds = run
    })
  }

  private pushStats(): void {
    const counts = countByBlueprint(this.world)
    const population: PopulationEntry[] = Object.entries(counts)
      .map(([blueprintId, count]) => {
        const name = this.world.blueprints[blueprintId]?.name ?? blueprintId
        const maxGeneration = this.world.creatures.reduce(
          (max, c) => c.blueprintId === blueprintId ? Math.max(max, c.generation) : max,
          1
        )
        return { blueprintId, name, count, maxGeneration }
      })
      .sort((a, b) => b.count - a.count)

    for (const entry of population) {
      this.knownSpecies.add(entry.blueprintId)
      if (!this.speciesFirstSeen.has(entry.blueprintId)) {
        this.speciesFirstSeen.set(entry.blueprintId, this.world.elapsed)
      }
    }

    const births = { ...this.pendingBirths }
    const deaths = { ...this.pendingDeaths }
    this.pendingBirths = {}
    this.pendingDeaths = {}
    useMicroLand.getState().setStats(population, this.world.creatures.length, this.world.elapsed, births, deaths)

    // Count distinct non-air tile materials for biome diversity score.
    const seenMaterials = new Set<number>()
    for (let i = 0; i < this.world.tiles.length; i++) {
      const m = this.world.tiles[i]
      if (m !== AIR) seenMaterials.add(m)
    }
    useMicroLand.getState().setActiveMaterials(seenMaterials.size)

    // Per-creature thumbnails for the Field Guide population viewer.
    const thumbs: CreatureThumb[] = this.world.creatures
      .map(c => ({
        id: c.id,
        blueprintId: c.blueprintId,
        ageSeconds: c.ageSeconds,
        name: c.name,
      }))
      .sort((a, b) => b.ageSeconds - a.ageSeconds)
    useMicroLand.getState().setPopulationItems(thumbs)

    // Speed run win/loss detection
    const sr = useMicroLand.getState().speedRun
    if (sr.active && sr.result === 'none') {
      const deepestGen = population.reduce((max, p) => Math.max(max, p.maxGeneration), 0)
      const timeUsed = this.world.elapsed - sr.startElapsed
      if (deepestGen >= sr.targetGeneration) {
        useMicroLand.getState().endSpeedRun('won', Math.round(timeUsed))
        saveSpeedRunRecord({
          theme: useMicroLand.getState().themeId,
          targetGen: sr.targetGeneration,
          seconds: Math.round(timeUsed),
          date: new Date().toLocaleDateString(),
        })
      } else if (timeUsed >= sr.timeLimitSeconds || this.world.creatures.length === 0) {
        useMicroLand.getState().endSpeedRun('lost')
      }
    }

    const currentStats = useMicroLand.getState().worldStats
    if (this.world.creatures.length > currentStats.peakPopulation) {
      useMicroLand.getState().updateWorldStats({ peakPopulation: this.world.creatures.length })
    }

    this.updateRecords(population)
    this.pushInspected()

    // Average traits for the population-graph detail panel — only compute when a
    // species is focused so this doesn't run on every stats tick in normal play.
    const focusId = useMicroLand.getState().graphFocusId
    if (focusId) {
      const focused = this.world.creatures.filter(c => c.blueprintId === focusId)
      if (focused.length > 0) {
        const avg = (f: (c: Creature) => number) =>
          focused.reduce((s, c) => s + f(c), 0) / focused.length
        const stats: FocusedSpeciesStats = {
          blueprintId: focusId,
          avgSpeed: avg(c => (c.traits as Traits).speed ?? 1),
          avgSight: avg(c => (c.traits as Traits).sight ?? 1),
          avgSize: avg(c => (c.traits as Traits).size ?? 1),
          avgToxicity: avg(c => (c.traits as Traits).toxicity ?? 0),
          avgImmunity: avg(c => (c.traits as Traits).immunity ?? 0.2),
        }
        useMicroLand.getState().setFocusedSpeciesStats(stats)
      } else {
        useMicroLand.getState().setFocusedSpeciesStats(null)
      }
    }

    // Sync named creatures: living ones (current state) + dead ones (tombstones).
    const livingNamed: NamedCreatureEntry[] = this.world.creatures
      .filter(c => c.name !== null)
      .map(c => ({
        name: c.name!,
        blueprintId: c.blueprintId,
        ageSeconds: c.ageSeconds,
        generation: c.generation,
        mealsEaten: c.mealsEaten,
        children: c.children,
        alive: true,
      }))
    const deadNamed: NamedCreatureEntry[] = this.world.tombstones.map(t => ({
      name: t.name,
      blueprintId: t.blueprintId,
      ageSeconds: t.ageSeconds ?? 0,
      generation: t.generation ?? 1,
      mealsEaten: t.mealsEaten ?? 0,
      children: t.children ?? 0,
      alive: false,
    }))
    useMicroLand.getState().setNamedCreatures([...livingNamed, ...deadNamed])

    // Trait evolution history — sample mean traits for each living species every 30s.
    if (this.world.elapsed - this.lastTraitSample >= 30) {
      this.lastTraitSample = this.world.elapsed
      const liveIds = new Set(population.map(p => p.blueprintId))
      for (const bpId of liveIds) {
        const members = this.world.creatures.filter(c => c.blueprintId === bpId)
        if (members.length === 0) continue
        const avg = (f: (c: Creature) => number) =>
          members.reduce((s, c) => s + f(c), 0) / members.length
        const entry: TraitHistoryEntry = {
          elapsed: this.world.elapsed,
          speed: avg(c => (c.traits as Traits).speed ?? 1),
          sight: avg(c => (c.traits as Traits).sight ?? 1),
          size: avg(c => (c.traits as Traits).size ?? 1),
        }
        const prev = this.traitHistory.get(bpId) ?? []
        this.traitHistory.set(bpId, [...prev.slice(-59), entry])
      }
      const flat: Record<string, TraitHistoryEntry[]> = {}
      for (const [id, hist] of this.traitHistory) flat[id] = hist
      useMicroLand.getState().setTraitHistory(flat)
    }

    // Accumulate mutualism bond time for species pairs in active symbiosis.
    const STATS_DT = STATS_EVERY_MS / 1000
    for (const c of this.world.creatures) {
      if (c.symbiosisTimer <= 0) continue
      const bp = this.world.blueprints[c.blueprintId]
      if (!bp?.symbiosisPartnerId) continue
      const [a, b] = [c.blueprintId, bp.symbiosisPartnerId].sort()
      useMicroLand.getState().recordMutualismTime(`${a}:${b}`, STATS_DT)
    }

    // A running world is different every tick, so there is no cheaper signal
    // than "time passed" to hang the autosave on. The shelf debounces it hard
    // and does nothing at all when no shelved world is open.
    touchActiveWorld()
  }

  // -------------------------------------------------------------------------
  // Records
  // -------------------------------------------------------------------------

  /**
   * Keep the chronicle up to date and push a read-out to the UI.
   *
   * Runs on the stats tick — a few times a second, not per frame. Records are
   * high-water marks, so sampling is fine: a creature cannot get younger between
   * ticks, and the worst case is a record set a fraction of a second late.
   */
  private updateRecords(population: PopulationEntry[]): void {
    const w = this.world
    const now = Date.now()
    const store = useMicroLand.getState()

    // The elder is gone if it isn't in the world any more. Checked before the
    // new elder is chosen so the eulogy names the right creature.
    if (this.elderId !== null && !w.creatures.some(c => c.id === this.elderId)) {
      this.mourn()
    }

    let oldest: Creature | null = null
    let deepest = 0
    // Oldest *per species*, not just overall: the guide reports a longest life
    // for every kind, and only ever noting the single oldest creature would
    // leave every species but one permanently blank.
    const eldestOf = new Map<string, number>()
    // And the same two figures per *column*, which is what stops the record
    // book being a plant leaderboard — see `KindRecord`. Held as creatures
    // rather than numbers because the record wants the holder's name and
    // species too.
    const oldestOfKind = new Map<LifeKind, Creature>()
    const deepestOfKind = new Map<LifeKind, Creature>()
    for (const c of w.creatures) {
      if (!oldest || c.ageSeconds > oldest.ageSeconds) oldest = c
      if (c.generation > deepest) deepest = c.generation
      const best = eldestOf.get(c.blueprintId)
      if (best === undefined || c.ageSeconds > best) {
        eldestOf.set(c.blueprintId, c.ageSeconds)
      }

      const bp = w.blueprints[c.blueprintId]
      // A creature whose blueprint has gone is unclassifiable and unnameable, so
      // it cannot hold a record either. It still counts toward the land-wide
      // figures above, which need neither.
      if (!bp) continue
      const kind = lifeKind(bp)
      const kindOldest = oldestOfKind.get(kind)
      if (!kindOldest || c.ageSeconds > kindOldest.ageSeconds) oldestOfKind.set(kind, c)
      const kindDeepest = deepestOfKind.get(kind)
      if (!kindDeepest || c.generation > kindDeepest.generation) deepestOfKind.set(kind, c)
    }

    // Every species on screen goes into the guide, and takes its blueprint with
    // it — this is what stops a summoned creature dying with the tab.
    for (const entry of population) {
      const bp = w.blueprints[entry.blueprintId]
      if (bp) rememberSpecies(bp, now)
    }
    for (const [blueprintId, seconds] of eldestOf) {
      noteSpeciesLife(blueprintId, seconds)
    }

    const record = landRecord(this.currentLand)
    const steadySeconds = w.elapsed - this.steadySince

    updateChronicle(() => {
      // --- longevity ---------------------------------------------------
      const best = record.elder?.seconds ?? 0
      if (oldest && oldest.ageSeconds >= ELDER_MIN_SECONDS && oldest.ageSeconds > best) {
        const bp = w.blueprints[oldest.blueprintId]
        if (bp) {
          const crowning = this.elderId !== oldest.id
          this.elderId = oldest.id
          // Rewritten every tick while the elder lives, so the record tracks it
          // upward and freezes at whatever age it finally reached. `at` is the
          // exception — it marks when the record was *taken*, so it survives the
          // rewrites rather than creeping forward with them.
          record.elder = {
            seconds: oldest.ageSeconds,
            blueprintId: bp.id,
            speciesName: bp.name,
            name: oldest.name,
            at: crowning ? now : (record.elder?.at ?? now),
          }
          this.elderSnapshot = {
            name: oldest.name,
            species: bp.name,
            seconds: oldest.ageSeconds,
          }
          if (crowning) {
            store.notify(`A ${bp.name} has outlived everything this land remembers.`)
          }
        }
      }

      // --- bloodline ----------------------------------------------------
      if (deepest > record.generations) {
        record.generations = deepest
        const line = w.creatures.find(c => c.generation === deepest)
        const bp = line ? w.blueprints[line.blueprintId] : undefined
        record.generationsBlueprintId = bp?.id ?? null
        record.generationsSpeciesName = bp?.name ?? null
      }

      // --- the same two, per column -------------------------------------
      // No notice fires from in here. The land-wide record above already
      // announces itself, and a second line every time an animal beats a
      // record only animals are competing for would be constant early on,
      // when generation 2 beats generation 1 and so does 3.
      for (const kind of LIFE_KINDS) {
        const column = record.byKind[kind]

        const eldest = oldestOfKind.get(kind)
        const bestHere = column.elder?.seconds ?? 0
        if (eldest && eldest.ageSeconds >= ELDER_MIN_SECONDS && eldest.ageSeconds > bestHere) {
          const bp = w.blueprints[eldest.blueprintId]
          if (bp) {
            const taking = this.kindElderIds.get(kind) !== eldest.id
            this.kindElderIds.set(kind, eldest.id)
            column.elder = {
              seconds: eldest.ageSeconds,
              blueprintId: bp.id,
              speciesName: bp.name,
              name: eldest.name,
              at: taking ? now : (column.elder?.at ?? now),
            }
          }
        }

        const line = deepestOfKind.get(kind)
        if (line && line.generation > column.generations) {
          const bp = w.blueprints[line.blueprintId]
          column.generations = line.generation
          column.generationsBlueprintId = bp?.id ?? null
          column.generationsSpeciesName = bp?.name ?? null
        }
      }

      // --- stability ----------------------------------------------------
      // Banked live rather than only when the streak breaks, so a session that
      // ends by closing the tab still keeps the run it was in the middle of.
      if (steadySeconds > record.steadySeconds) record.steadySeconds = steadySeconds
    })

    // Copied out rather than handed over: `record` is the live chronicle object
    // and the next stats tick mutates it in place, so passing it into the store
    // would give React a value that changes without ever being re-set.
    const byKind = {} as Record<LifeKind, KindRecordsView>
    for (const kind of LIFE_KINDS) {
      const column = record.byKind[kind]
      byKind[kind] = {
        elder: column.elder,
        bestGenerations: column.generations,
        bestGenerationsSpeciesName: column.generationsSpeciesName,
      }
    }

    store.setRecords({
      elder: record.elder,
      bestSteadySeconds: record.steadySeconds,
      bestGenerations: record.generations,
      bestGenerationsSpeciesName: record.generationsSpeciesName,
      steadySeconds,
      deepestGeneration: deepest,
      byKind,
    })

    // Sorted once and shared: both of these want the same list, and it is
    // rebuilt on every stats tick.
    const archive = archivedSpecies()

    // Species population milestones — fire once ever per (species × threshold).
    //
    // Each threshold is checked in ascending order so the first unclaimed one
    // fires. Only one notification per species per stats push so three species
    // all crossing 10 at the same moment don't spam the screen.
    for (const entry of population) {
      const bp = w.blueprints[entry.blueprintId]
      if (!bp) continue
      for (const threshold of [5, 10, 25, 50]) {
        if (entry.count < threshold) break
        if (claimMilestone(`sp:${entry.blueprintId}:${threshold}`, now)) {
          store.notify(`${threshold} ${bp.name}s alive at once!`)
          break
        }
      }
    }

    const maxToxicity = w.creatures.reduce(
      (m, cr) => Math.max(m, (cr.traits as Traits).toxicity ?? 0),
      0
    )
    const maxPredatorImmunity = w.creatures
      .filter(cr => w.blueprints[cr.blueprintId]?.diet.eats.includes('meat'))
      .reduce((m, cr) => Math.max(m, (cr.traits as Traits).immunity ?? 0), 0)

    // Trophic cascade bloom check: has any watched prey species doubled?
    if (!this.trophicCascadeDetected && this.trophicWatch.size > 0) {
      const counts = countByBlueprint(this.world)
      for (const [preyId, countAtExtinction] of this.trophicWatch) {
        const current = counts[preyId] ?? 0
        if (current >= countAtExtinction * 2 && current >= 10) {
          this.trophicCascadeDetected = true
          break
        }
      }
    }

    this.checkMilestones(archive, {
      elapsed: w.elapsed,
      steadySeconds,
      oldestSeconds: oldest?.ageSeconds ?? 0,
      generations: deepest,
      speciesAlive: population.length,
      total: w.creatures.length,
      maxToxicity,
      maxPredatorImmunity,
      trophicCascadeDetected: this.trophicCascadeDetected,
    })

    this.syncArchive(archive)
  }

  /** Announce the elder's death, then stand down the halo. */
  private mourn(): void {
    const gone = this.elderSnapshot
    this.elderId = null
    this.elderSnapshot = null
    if (!gone) return
    const age = formatDuration(gone.seconds)
    useMicroLand
      .getState()
      .notify(
        gone.name
          ? `${gone.name} died at ${age}. Nothing here has lived longer.`
          : `The oldest ${gone.species} died at ${age}.`
      )
  }

  /**
   * Give the record-holder a name.
   *
   * Only the elder can be named, which is the point — a name is the reward for
   * the record, not a labelling tool. Returns false if the moment has passed.
   */
  nameElder(name: string): boolean {
    const trimmed = name.trim().slice(0, 24)
    if (!trimmed || this.elderId === null) return false
    const c = this.world.creatures.find(x => x.id === this.elderId)
    if (!c) return false
    c.name = trimmed
    if (this.elderSnapshot) this.elderSnapshot.name = trimmed
    updateChronicle(() => {
      const record = landRecord(this.currentLand)
      if (record.elder) record.elder.name = trimmed
      // The crowned creature is also holding its own column's record, near
      // enough always. Written across so the guide doesn't show the name beside
      // the land-wide line and the bare species name beside the split one.
      for (const kind of LIFE_KINDS) {
        if (this.kindElderIds.get(kind) !== c.id) continue
        const column = record.byKind[kind]
        if (column.elder) column.elder.name = trimmed
      }
    })
    this.pushStats()
    return true
  }

  /**
   * Give any inspected creature a name.
   *
   * Works for all creatures, not just the elder. If the creature being named
   * happens to be the elder, the chronicle is also updated so the record panel
   * stays consistent.
   */
  nameCreature(id: number, name: string): boolean {
    const trimmed = name.trim().slice(0, 24)
    if (!trimmed) return false
    const c = this.world.creatures.find(x => x.id === id)
    if (!c) return false
    c.name = trimmed
    // If this creature is also the elder, keep the chronicle in sync.
    if (id === this.elderId) {
      if (this.elderSnapshot) this.elderSnapshot.name = trimmed
      updateChronicle(() => {
        const record = landRecord(this.currentLand)
        if (record.elder) record.elder.name = trimmed
        for (const kind of LIFE_KINDS) {
          if (this.kindElderIds.get(kind) !== c.id) continue
          const column = record.byKind[kind]
          if (column.elder) column.elder.name = trimmed
        }
      })
    }
    // Record the naming in the history log.
    const bp = this.world.blueprints[c.blueprintId]
    if (bp) {
      useMicroLand.getState().addHistoryEntry({
        simTime: this.world.elapsed,
        kind: 'named',
        blueprintId: c.blueprintId,
        speciesName: bp.name,
        creatureName: trimmed,
        detail: `"${trimmed}" — a ${bp.name} is named`,
      })
    }
    this.pushStats()
    return true
  }

  /** Fire any milestone that just became true. Each one fires once, ever. */
  private checkMilestones(
    archive: SpeciesRecord[],
    context: Omit<MilestoneContext, 'archived' | 'summonedArchived'>
  ): void {
    const full = {
      ...context,
      archived: archive.length,
      summonedArchived: archive.filter(s => s.blueprint.summoned).length,
    }
    const now = Date.now()
    const store = useMicroLand.getState()
    let fired = false
    for (const milestone of MILESTONES) {
      if (!milestone.reached(full)) continue
      if (!claimMilestone(milestone.id, now)) continue
      store.notify(milestone.text)
      fired = true
    }
    if (fired) this.pushMilestones()
  }

  /**
   * Push everything the chronicle already knew into the UI.
   *
   * Called once after the chronicle loads, so a returning player's field guide
   * is populated before the first creature has drawn breath in this session.
   */
  publishRecords(): void {
    this.lastArchiveSize = -1
    this.syncArchive(archivedSpecies())
    this.pushMilestones()
  }

  /** Re-send the guide's archive, but only when it has actually changed. */
  private syncArchive(archive: SpeciesRecord[]): void {
    if (archive.length === this.lastArchiveSize) return
    this.lastArchiveSize = archive.length
    useMicroLand.getState().setArchive(archive)
  }

  private pushMilestones(): void {
    const earned = readMilestones()
    useMicroLand.getState().setMilestones(earned)
  }

  /**
   * Point the recorder at whichever land is now on screen, banking the run that
   * was in progress. Called whenever the world is replaced under the player.
   */
  private beginLand(): void {
    this.breakSteadyStreak()
    this.currentLand = landId(useMicroLand.getState().themeId, useMicroLand.getState().summonedLand)
    this.steadySince = this.world.elapsed
    // A cleared world has no elder; do this quietly rather than eulogizing a
    // creature the player deliberately removed.
    this.elderId = null
    this.elderSnapshot = null
    // Creature ids are per-world, so holders carried across a land change would
    // eventually collide with an unrelated creature and freeze a record's date.
    this.kindElderIds.clear()
    this.lastArchiveSize = -1
    this.traitHistory.clear()
    this.lastTraitSample = -30
    useMicroLand.getState().setTraitHistory({})
  }

  /** Copy the watched creature's live state out for the inspector panel. */
  private pushInspected(): void {
    const store = useMicroLand.getState()
    if (this.inspectedId === null) {
      if (store.inspected !== null) store.setInspected(null)
      this.inspectedTrail = []
      this.trailLastSample = -999
      return
    }

    const c = this.world.creatures.find(x => x.id === this.inspectedId)
    if (!c) {
      // It died while we were watching. Emit a life-story notice if it logged events.
      const was = store.inspected
      if (was && was.lifeLog.length > 0) {
        const label = was.name ?? (this.world.blueprints[was.blueprintId]?.name ?? 'creature')
        const events = was.lifeLog.map(e => e.text).join(' · ')
        store.notify(`${label}: ${events}`)
      }
      this.inspectedId = null
      this.following = false
      store.setInspected(null)
      return
    }

    const bp = this.world.blueprints[c.blueprintId]
    if (!bp) return
    // Accumulate mood history for the sparkline.
    if (c.id !== this.moodHistoryCreatureId) {
      this.moodHistory = [c.mood]
      this.moodHistoryCreatureId = c.id
      this.inspectedTrail = []
      this.trailLastSample = -999
    } else {
      this.moodHistory.push(c.mood)
      if (this.moodHistory.length > 40) this.moodHistory.shift()
    }
    // Sample position every sim-second for the memory trail.
    if (this.world.elapsed - this.trailLastSample >= 1) {
      this.trailLastSample = this.world.elapsed
      this.inspectedTrail.push({ x: c.x, y: c.y })
      if (this.inspectedTrail.length > 30) this.inspectedTrail.shift()
    }
    const { w: bw, h: bh } = artSize(bp)

    const target =
      c.targetId !== null ? this.world.creatures.find(x => x.id === c.targetId) : undefined
    const targetBp = target ? this.world.blueprints[target.blueprintId] : undefined

    store.setInspected({
      id: c.id,
      blueprintId: c.blueprintId,
      mood: c.mood,
      hunger: c.hunger,
      ageSeconds: c.ageSeconds,
      // This one's lifespan, not its species' — a long-lived creature showing a
      // "life left" meter drawn against the blueprint would sit at empty for the
      // whole of the extra life its line earned it.
      lifespanSeconds: lifespanOf(c, bp) * TUNING.lifespanScale,
      mealsEaten: c.mealsEaten,
      children: c.children,
      distress: c.distress,
      starving: c.starving,
      sick: (c as { sick?: number }).sick ?? 0,
      fatigue: (c as { fatigue?: number }).fatigue ?? 0,
      speed: Math.hypot(c.vx, c.vy),
      inWater: boxLiquidFraction(this.world, c.x, c.y, bw, bh) > 0.3,
      grounded: c.grounded,
      targetName: targetBp?.name ?? null,
      generation: c.generation,
      parentBlueprintIds: (c as { parentBlueprintIds?: readonly [string, string | null] }).parentBlueprintIds ?? null,
      // Copied, like everything else here. Traits are replaced wholesale rather
      // than mutated, so the reference would in fact be safe today — but that is
      // a fact about `inherit`, and this panel shouldn't depend on it.
      traits: { ...c.traits },
      name: c.name,
      isElder: c.id === this.elderId,
      followingScent: (c as { followingScent?: boolean }).followingScent ?? false,
      lifeLog: c.lifeLog ?? [],
      packSize: c.packSize ?? 0,
      hostName: (() => {
        const hid = c.hostId
        if (hid == null) return null
        const host = this.world.creatures.find(x => x.id === hid)
        return host ? (this.world.blueprints[host.blueprintId]?.name ?? null) : null
      })(),
      moodHistory: [...this.moodHistory],
      lastMealX: c.lastMealX,
      lastMealY: c.lastMealY,
      trail: [...this.inspectedTrail],
    })
  }

  private syncBlueprintsToStore(): void {
    useMicroLand.getState().setBlueprints(Object.values(this.world.blueprints))
  }

  /**
   * Put previously summoned creatures back on the shelf.
   *
   * The chronicle has archived their blueprints in full since it was written —
   * that is the stated point of `SpeciesRecord.blueprint` — but nothing ever
   * read them back into the roster, so `createWorld` seeded only the built-ins
   * and a creature invented yesterday was missing from the toolbar today. It
   * still appeared in the field guide, which made the loss look like a display
   * bug rather than a missing restore.
   *
   * Only the roster is restored, never the population. The land is deliberately
   * forgetful — "you are not keeping a save file, you are keeping a logbook" —
   * and spawning yesterday's creatures into today's world would break both that
   * and the empty-by-default start. What comes back is the *ability* to place
   * them.
   *
   * Safe to call before `initChronicle` resolves, in which case the archive is
   * simply empty; `MicroLandGame` already sequences the load first.
   */
  /**
   * Re-read the archive into the roster after it has changed underneath us.
   *
   * Signing in merges an account's chronicle into the live one *after* the world
   * was built, so a player opening Micro Land on a new device would see their
   * creatures land in the field guide but not in the toolbar until they
   * reloaded. Cheap enough to just re-run: `registerBlueprint` overwrites by id.
   */
  refreshRoster(): void {
    this.restoreArchivedCreatures()
    this.syncBlueprintsToStore()
  }

  /**
   * Remove a summoned species from the world and from the records.
   *
   * Everything alive bursts in its own death colour rather than blinking out —
   * the particle burst is the one already used when a creature dies, so "gone"
   * looks like something that happened rather than a rendering glitch.
   *
   * Returns the archived record, which is the entire undo. Null means there was
   * nothing to remove, or the caller aimed at a built-in: those are config, not
   * records, and would simply reappear on the next load.
   */
  removeSpecies(blueprintId: string): SpeciesRecord | null {
    const bp = this.world.blueprints[blueprintId]
    if (!bp?.summoned) return null

    const w = this.world
    for (const c of w.creatures) {
      if (c.blueprintId !== blueprintId) continue
      const { w: aw, h: ah } = artSize(bp)
      emitParticles(w, c.x + aw / 2, c.y + ah / 2, bp.death.particleColor, bp.death.particleCount)
    }
    w.creatures = w.creatures.filter(c => c.blueprintId !== blueprintId)

    delete w.blueprints[blueprintId]
    /**
     * `natives` must lose it too.
     *
     * `registerBlueprint` pushes every species onto that list, and the soil's
     * seed bank reads `w.blueprints[id]` straight off it to decide what it can
     * re-seed. Leaving a dangling id there hands `undefined` to `isPlant` and
     * breaks the one mechanism that stops the world flatlining, which would look
     * nothing like a deletion bug when it eventually surfaced.
     */
    w.natives = w.natives.filter(id => id !== blueprintId)

    // The player may have had it selected, or been watching one of them.
    const state = useMicroLand.getState()
    if (state.tool.kind === 'creature' && state.tool.blueprintId === blueprintId) {
      state.setTool({ kind: 'inspect' })
    }
    if (!w.creatures.some(c => c.id === this.inspectedId)) {
      this.inspectedId = null
      this.following = false
      state.setInspected(null)
    }

    const record = forgetSpecies(blueprintId)
    this.syncBlueprintsToStore()
    this.pushStats()
    // Straight to storage rather than on the debounce: a deletion the player
    // then closes the tab on must not come back.
    void flushChronicle()

    return record ?? { blueprint: bp, firstSeen: Date.now(), lastSeen: Date.now(), longestLife: 0 }
  }

  /**
   * Centre the camera on the first living creature of this species.
   *
   * Returns true when one was found; false when the species has no living
   * members (so the caller can tell the player rather than quietly doing
   * nothing).
   */
  locateSpecies(blueprintId: string): boolean {
    const creature = this.world.creatures.find(c => c.blueprintId === blueprintId)
    if (!creature) return false
    this.renderer.centerOn(creature.x, creature.y)
    return true
  }

  /**
   * Center the camera on a specific creature by id and open the Inspector for it.
   * Returns false if the creature is no longer alive.
   */
  inspectCreature(id: number): boolean {
    const creature = this.world.creatures.find(c => c.id === id)
    if (!creature) return false
    this.inspectedId = id
    this.following = true
    this.renderer.centerOn(creature.x, creature.y)
    this.pushInspected()
    return true
  }

  /** Put a removed species back on the shelf. Undo for `removeSpecies`. */
  restoreSpecies(record: SpeciesRecord): void {
    restoreSpeciesRecord(record)
    registerBlueprint(this.world, record.blueprint)
    this.syncBlueprintsToStore()
    void flushChronicle()
  }

  private restoreArchivedCreatures(): void {
    const restored = archivedSpecies()
      .filter(record => record.blueprint.summoned)
      .map(record => record.blueprint)

    for (const bp of restored) registerBlueprint(this.world, bp)

    // Ids carry a counter that resets with the page. Without this, the first
    // creature summoned after a reload would be handed an id a restored one is
    // already using, and would silently overwrite it in the roster.
    reserveSummonIds(restored.map(bp => bp.id))
  }

  // -------------------------------------------------------------------------
  // World commands (called from the UI)
  // -------------------------------------------------------------------------

  /** Summoned terrain wins over the registry when it's the selected world. */
  private resolveTheme(themeId: string): Theme {
    if (themeId === SUMMONED_THEME_ID && this.summonedTheme) return this.summonedTheme
    return THEME_BY_ID[themeId] ?? THEME_BY_ID[DEFAULT_THEME]
  }

  /**
   * Replace the land with terrain the player described.
   * Living creatures are kept — the ground changes underneath them.
   */
  applyTerrain(raw: unknown, opts: { keepCreatures?: boolean } = {}): SanitizedTerrain {
    // The land is about to be something else, so this is no longer the world the
    // player shelved. Let go of it rather than letting the next autosave
    // overwrite a saved world with the one that replaced it.
    releaseActiveWorld()
    const terrain = sanitizeTerrain(raw)
    this.summonedTerrain = terrain
    this.summonedTheme = terrainToTheme(terrain, MATERIAL_INDEX)
    applyThemeObject(this.world, this.summonedTheme)
    if (!opts.keepCreatures) {
      clearCreatures(this.world)
      this.knownSpecies.clear()
      this.speciesFirstSeen.clear()
      this.inspectedId = null
      this.following = false
    }
    this.renderer.markTilesDirty()
    useMicroLand.getState().setSummonedLand(terrain.name)
    useMicroLand.getState().setTheme(SUMMONED_THEME_ID)
    // After the store knows the land's name — `beginLand` derives the record key
    // from it, and a summoned land files its records under its own name.
    this.beginLand()
    this.pushStats()
    return terrain
  }

  setTheme(themeId: string): void {
    // Same reasoning as `applyTerrain`: a new theme is a new land, not a change
    // to the shelved one. `adoptSave` re-claims it immediately afterwards.
    releaseActiveWorld()
    if (themeId === SUMMONED_THEME_ID && this.summonedTheme) {
      applyThemeObject(this.world, this.summonedTheme)
      clearCreatures(this.world)
      this.knownSpecies.clear()
      this.speciesFirstSeen.clear()
      this.inspectedId = null
      this.following = false
      this.snapshotHistory = []
      this.lastSnapshotElapsed = -30
      this.renderer.markTilesDirty()
      this.beginLand()
      this.pushStats()
      return
    }
    const theme = THEME_BY_ID[themeId]
    if (!theme) return
    applyTheme(this.world, themeId)
    clearCreatures(this.world)
    this.knownSpecies.clear()
    this.speciesFirstSeen.clear()
    this.inspectedId = null
    this.following = false
    this.snapshotHistory = []
    this.lastSnapshotElapsed = -30
    seedStarters(this.world, themeId, this.rng)
    this.renderer.markTilesDirty()
    this.beginLand()
    this.pushStats()
  }

  /** Rebuild the terrain with a new seed, keeping the theme. */
  reshuffle(): void {
    // Reshape rebuilds the terrain from a new seed — the shelved world is gone
    // from the screen, and must not be gone from the shelf as well.
    releaseActiveWorld()
    const themeId = useMicroLand.getState().themeId
    if (themeId === SUMMONED_THEME_ID && this.summonedTheme) {
      applyThemeObject(this.world, this.summonedTheme)
      clearCreatures(this.world)
      this.knownSpecies.clear()
      this.speciesFirstSeen.clear()
      this.inspectedId = null
      this.following = false
      this.snapshotHistory = []
      this.lastSnapshotElapsed = -30
      this.renderer.markTilesDirty()
      this.beginLand()
      this.pushStats()
      return
    }
    applyTheme(this.world, themeId)
    clearCreatures(this.world)
    this.knownSpecies.clear()
    this.speciesFirstSeen.clear()
    this.inspectedId = null
    this.following = false
    this.snapshotHistory = []
    this.lastSnapshotElapsed = -30
    seedStarters(this.world, themeId, this.rng)
    this.renderer.markTilesDirty()
    this.beginLand()
    this.pushStats()
  }

  clearLife(): void {
    clearCreatures(this.world)
    // Native plants grow back out of the soil on their own, so on any world with
    // ground in it "empty" would last about three seconds without this. Anything
    // the player does next — painting, placing, summoning — wakes it back up.
    this.world.dormant = true
    this.knownSpecies.clear()
    this.speciesFirstSeen.clear()
    this.inspectedId = null
    this.following = false
    // Emptying the world is an extinction of everything, so the streak goes with
    // it — but silently, since the player did it on purpose.
    this.beginLand()
    this.pushStats()
  }

  /**
   * Register a summoned blueprint and drop some into the world.
   * Returns how many actually found somewhere to live.
   */
  introduce(raw: unknown, count: number): { blueprint: CreatureBlueprint; placed: number } {
    const bp = sanitizeBlueprint(raw, { summoned: true })
    this.world.dormant = false
    registerBlueprint(this.world, bp)
    this.syncBlueprintsToStore()

    let placed = 0
    for (let i = 0; i < count; i++) {
      if (this.world.creatures.length >= TUNING.maxCreatures) break
      if (spawnSomewhereSensible(this.world, bp, this.rng)) placed++
    }
    this.pushStats()
    return { blueprint: bp, placed }
  }

  /**
   * Create a new species from the workshop and spawn 5 of them.
   *
   * The blueprint is sanitized (so it gets a fresh id) and registered; then
   * 5 creatures are placed and their traits are overwritten with the player's
   * chosen values before the stats are pushed.
   */
  workshopIntroduce(blueprint: CreatureBlueprint, traits: Traits): void {
    const bp = sanitizeBlueprint(blueprint as unknown, { summoned: true, idPrefix: 'workshop' })
    this.world.dormant = false
    registerBlueprint(this.world, bp)
    this.syncBlueprintsToStore()

    let placed = 0
    for (let i = 0; i < 5; i++) {
      if (this.world.creatures.length >= TUNING.maxCreatures) break
      const creature = spawnSomewhereSensible(this.world, bp, this.rng)
      if (creature) {
        creature.traits = { ...traits }
        placed++
      }
    }
    this.pushStats()
    if (placed > 0) {
      useMicroLand.getState().notify(`${bp.name} × ${placed} placed in the world`)
    }
    useMicroLand.getState().clearWorkshopSpawnRequest()
  }

  /**
   * Change a species that already exists, rather than inventing another one.
   *
   * `introduce` was the only door into the roster, and it always mints a fresh
   * id — so opening a Hopper in the builder, moving four pixels and saving gave
   * you a *second* Hopper standing next to the first. That is right when the
   * player wants a variation and wrong when they meant to fix their own
   * creature, so the two are now separate verbs.
   *
   * Keeping the id is the whole point: every creature already alive belongs to
   * this species, the chronicle's records are filed under it, and the food
   * chain resolves through it. They all follow the edit for free, because
   * nothing in the simulation holds a blueprint — it holds an id and looks it
   * up. What is *not* free is the two caches that assumed art never changes
   * under an id; both are dropped here, and forgetting either one is invisible
   * until something is drawn at one size and collides at another.
   *
   * Anything alive whose body just grew may find itself overlapping rock. That
   * needs no repair: `integrate` snaps a downward-moving box out of the tile it
   * is inside, so gravity walks it back out over the next few ticks, which
   * reads as the creature shrugging itself loose.
   *
   * Returns null if the species is gone — the player can have deleted it from
   * the toolbar while the builder was open — and otherwise how many individuals
   * the edit caught, so the caller can tell "every Hopper just changed" from
   * "there were no Hoppers to change".
   */
  reviseSpecies(
    blueprintId: string,
    raw: unknown
  ): { blueprint: CreatureBlueprint; living: number } | null {
    const existing = this.world.blueprints[blueprintId]
    if (!existing) return null

    /**
     * The sanitizer mints an id and we throw it away, exactly as `builtin()`
     * does. Harmless — the summon counter only ever climbs, so no id it hands
     * out later can collide with one already in use.
     *
     * `summoned` is carried over rather than re-derived. It decides whether the
     * chronicle archives this creature at all, and a built-in that started
     * claiming to be summoned would get written into the player's records and
     * restored on top of the real roster entry on the next load.
     */
    const next: CreatureBlueprint = {
      ...sanitizeBlueprint(raw, { summoned: existing.summoned }),
      id: blueprintId,
      summoned: existing.summoned,
    }

    forgetBodyBox(blueprintId)
    forgetSprites(blueprintId)

    this.world.dormant = false
    registerBlueprint(this.world, next)

    // Built-ins are config and are rebuilt from source on every load; writing
    // one into the archive would shadow it forever with a stale copy.
    if (next.summoned) rememberSpecies(next, Date.now())

    /**
     * Put a few out if the edit had nothing to land on.
     *
     * Saving is meant to be the moment the change becomes real, and a species
     * with no individuals alive gives back an empty screen — which reads as the
     * save having failed rather than as there being nothing to update. The
     * player can already place them by hand; this only spares them having to
     * work out that they need to.
     */
    let living = this.world.creatures.reduce(
      (n, c) => (c.blueprintId === blueprintId ? n + 1 : n),
      0
    )
    if (living === 0) {
      for (let i = 0; i < REVISE_PLACE_COUNT; i++) {
        if (this.world.creatures.length >= TUNING.maxCreatures) break
        if (spawnSomewhereSensible(this.world, next, this.rng)) living++
      }
    }

    this.syncBlueprintsToStore()
    this.pushStats()
    // Straight to storage rather than on the debounce, for the same reason a
    // deletion is: an edit the player then closes the tab on must not come back
    // as the drawing they replaced.
    void flushChronicle()

    return { blueprint: next, living }
  }

  getWorld(): WorldState {
    return this.world
  }

  /** Returns a copy of the snapshot ring buffer for the replay UI. */
  getSnapshotHistory(): Array<{ elapsed: number; creatures: Creature[] }> {
    return [...this.snapshotHistory]
  }

  // -------------------------------------------------------------------------
  // The shelf
  // -------------------------------------------------------------------------

  /**
   * Freeze the world as it stands, under a given identity.
   *
   * The identity comes from the caller rather than from here because the game
   * instance has no opinion about which shelf slot it is: a first save mints an
   * id and takes the name the player typed, and every autosave afterwards passes
   * the same three back in. Everything else — the land, its inhabitants, where
   * the record-keeper was standing, where the camera was pointing — is read off
   * the running world.
   */
  toSave(identity: { id: string; name: string; createdAt: number }): WorldSave {
    return {
      version: WORLD_SAVE_VERSION,
      id: identity.id,
      name: identity.name,
      createdAt: identity.createdAt,
      updatedAt: Date.now(),
      themeId: useMicroLand.getState().themeId,
      terrain: this.summonedTerrain,
      camX: Math.round(this.renderer.cameraX),
      land: {
        landId: this.currentLand,
        steadySince: this.steadySince,
        elderId: this.elderId,
      },
      world: snapshotWorld(this.world),
    }
  }

  /**
   * Drop the player into a shelved world, mid-breath.
   *
   * The order here is load-bearing. The store's theme is set *first*, which the
   * subscription in `MicroLandGame` turns into a `setTheme` call and a freshly
   * generated land — wasted work that is nonetheless the simplest correct thing,
   * because it leaves every piece of theme state (sky, gloom, gravity, the world
   * picker) consistent before the saved tiles are written over the top of it.
   * The alternative was a re-entrancy flag threaded through the store, to save
   * about ten milliseconds once per world opened.
   *
   * Records survive the move intact: the outgoing world banks its streak on the
   * way out, and the saved one restores the streak it was in the middle of, so
   * neither is lost and neither is inflated. Nothing here can lower a
   * high-water mark (invariant 11) — `steadySince` is a live clock, not a record.
   *
   * Returns false if the save could not be decoded, having changed nothing the
   * player can see except the theme they asked for.
   */
  adoptSave(save: WorldSave): boolean {
    const store = useMicroLand.getState()

    if (save.terrain) {
      this.summonedTerrain = save.terrain
      this.summonedTheme = terrainToTheme(save.terrain, MATERIAL_INDEX)
      store.setSummonedLand(save.terrain.name)
      store.setTheme(SUMMONED_THEME_ID)
    } else {
      // The previous summoned land is deliberately left in place. It is still
      // an entry in the world picker, and `summonedTheme` and `summonedTerrain`
      // have to stay in step — clearing only one of them would leave a land the
      // player can still select but that can no longer be shelved.
      store.setTheme(save.themeId)
    }
    // `setTheme` above may not have fired the subscription — the theme can
    // already be the right one — so bank the outgoing streak here rather than
    // relying on the rebuild to have done it.
    this.breakSteadyStreak()

    if (!restoreSnapshot(this.world, save.world)) return false

    this.currentLand = save.land.landId
    // Clamped because `steadySince` is a point on the world clock and a save
    // claiming one in this world's future would report a negative streak.
    this.steadySince = Math.min(save.land.steadySince, this.world.elapsed)

    // The elder's halo comes back only if the creature wearing it did. The
    // eulogy needs its own copy of the details, because by the time it is spoken
    // the creature has already been filtered out of the world.
    const elder =
      save.land.elderId === null
        ? undefined
        : this.world.creatures.find(c => c.id === save.land.elderId)
    this.elderId = elder?.id ?? null
    this.elderSnapshot = elder
      ? {
          name: elder.name,
          species: this.world.blueprints[elder.blueprintId]?.name ?? 'creature',
          seconds: elder.ageSeconds,
        }
      : null
    // Not saved, and doesn't need to be: it only decides whether a column's `at`
    // date refreshes. Left empty, the first stats tick re-dates a record whose
    // holder survived the reload, which is off by however long the world sat
    // closed and self-corrects the moment anything beats it.
    this.kindElderIds.clear()

    // Seeded from what is actually alive, so opening a world does not announce
    // the extinction of everything that was in the land it replaced.
    this.knownSpecies = new Set(this.world.creatures.map(c => c.blueprintId))
    this.speciesFirstSeen.clear()
    this.inspectedId = null
    this.following = false
    store.setInspected(null)
    store.clearExtinctions()
    store.clearFoodWeb()

    this.renderer.panToLeft(save.camX)
    this.renderer.markTilesDirty()
    this.syncBlueprintsToStore()
    this.publishRecords()
    this.pushStats()
    return true
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  // --- camera, driven from the UI ------------------------------------------

  /** Start or stop a held pan. Used by the on-screen arrows. */
  holdPan(direction: -1 | 0 | 1): void {
    this.panHeld = direction
    if (direction !== 0) this.following = false
  }

  /** One tap's worth of pan, for a click that never becomes a hold. */
  nudgePan(direction: -1 | 1): void {
    this.following = false
    this.renderer.panBy(direction * PAN_STEP)
  }

  /** One press of the on-screen + or −, or of the + / − keys. */
  zoomByStep(direction: 1 | -1): void {
    if (this.renderer.zoomByStep(direction)) this.pushCamera()
  }

  /** Back to the framing the world opens at. */
  resetZoom(): void {
    if (this.renderer.resetZoom()) this.pushCamera()
  }

  setViewScale(preset: 'wide' | 'standard' | 'close'): void {
    const target =
      preset === 'wide' ? this.renderer.minZoomLevel :
      preset === 'close' ? 2 :
      1
    if (this.renderer.setZoom(target)) this.pushCamera()
  }

  /**
   * Tell the UI what the camera can currently do.
   *
   * Only on change rather than every frame: these drive whether buttons are on
   * screen and whether they look pressable, and none of them move on their own.
   */
  private pushCamera(): void {
    const store = useMicroLand.getState()
    const canPan = !this.renderer.fitsOnScreen
    const canZoomIn = this.renderer.canZoomIn
    const canZoomOut = this.renderer.canZoomOut
    // Guarded rather than set unconditionally: a pinch calls this on every
    // pointermove, and each `set` walks every subscriber in the tree to tell
    // them nothing changed.
    if (canPan !== store.canPan) store.setCanPan(canPan)
    if (canZoomIn !== store.canZoomIn || canZoomOut !== store.canZoomOut) {
      store.setZoomState(canZoomIn, canZoomOut)
    }
  }

  // --- pointer --------------------------------------------------------------

  private beginPan(clientX: number, clientY: number): void {
    this.panning = true
    this.following = false
    this.panAnchorX = clientX
    this.panAnchorY = clientY
    this.panAnchorCam = this.renderer.cameraX
    this.panAnchorCamY = this.renderer.cameraY
  }

  /** Midpoint of every finger down, so a two-finger pan doesn't pivot. */
  private pointerCenter(): { x: number; y: number } {
    let sumX = 0
    let sumY = 0
    for (const p of this.pointers.values()) {
      sumX += p.x
      sumY += p.y
    }
    const n = Math.max(1, this.pointers.size)
    return { x: sumX / n, y: sumY / n }
  }

  /** How far apart the two fingers of a pinch are. Zero if there aren't two. */
  private pinchDistance(): number {
    const points = [...this.pointers.values()]
    if (points.length < 2) return 0
    const dx = points[0].x - points[1].x
    const dy = points[0].y - points[1].y
    return Math.hypot(dx, dy)
  }

  /** Take a fresh reading of the pinch, so adding a finger doesn't jump. */
  private beginPinch(): void {
    this.panning = false
    this.following = false
    const center = this.pointerCenter()
    this.pinch = { dist: this.pinchDistance(), x: center.x, y: center.y }
  }

  /** Let go of whatever the first finger had started, without acting on it. */
  private cancelPointerAction(): void {
    if (this.grabbed) {
      this.grabbed.vx = 0
      this.grabbed.vy = 0
      this.grabbed = null
      this.grabTrail = []
    }
    this.pendingInspect = null
  }

  private onPointerLeave = () => {
    useMicroLand.getState().setHoveredCreature(null)
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // A second finger always means "move the world", whatever the first one had
    // started doing. Two fingers on a canvas is a pinch-and-pan everywhere else
    // on a phone, and the alternative — painting from both — is nobody's intent.
    if (this.pointers.size === 2) {
      this.cancelPointerAction()
      this.beginPinch()
      return
    }
    if (this.pointers.size > 2) {
      this.beginPinch()
      return
    }
    if (!e.isPrimary) return

    this.canvas.setPointerCapture(e.pointerId)
    this.canvas.focus({ preventScroll: true })
    this.pointerDown = true

    // The minimap is painted on the world canvas, so it has to be given the
    // chance to claim a tap before the tap is allowed to dig a hole. The flag
    // has to outlive the tap, too: without it the next pointermove would fall
    // straight through to the paint tool and carve a trench under the map.
    const jump = this.renderer.minimapHit(e.clientX, e.clientY)
    if (jump !== null) {
      this.scrubbingMap = true
      this.following = false
      this.renderer.centerOn(jump.x, jump.y)
      return
    }

    const p = this.renderer.screenToWorld(e.clientX, e.clientY)
    const hit = this.creatureAt(p.x, p.y)

    if (useMicroLand.getState().tool.kind === 'inspect') {
      // Look mode has nothing to paint, so a drag is free to mean "pan" — the
      // one place a single finger can move the world without ambiguity. The
      // selection is resolved on release, so a pan doesn't also deselect.
      this.pendingInspect = { id: hit ? hit.id : null }
      this.beginPan(e.clientX, e.clientY)
      return
    }

    if (hit) {
      // Pick it up. This wins over placing — grabbing is the more specific intent.
      this.grabbed = hit
      this.grabTrail = [{ x: p.x, y: p.y, t: performance.now() }]
      return
    }

    this.lastPlaceAt = 0
    this.applyTool(p.x, p.y, e.shiftKey)
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId))
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Two fingers: zoom about the point between them, then slide by however far
    // that point moved. Both are read against the previous move rather than the
    // start of the gesture — see `pinch`.
    if (this.pinch && this.pointers.size >= 2) {
      const dist = this.pinchDistance()
      const center = this.pointerCenter()
      if (dist > 0 && this.pinch.dist > 0) {
        const ratio = dist / this.pinch.dist
        // A fraction of a pixel of finger tremor is not a zoom, and feeding it
        // back into the camera every frame reads as the world breathing.
        if (Math.abs(ratio - 1) > 0.002) {
          this.renderer.setZoom(this.renderer.zoomLevel * ratio, {
            clientX: center.x,
            clientY: center.y,
          })
          this.pushCamera()
        }
      }
      const perPixel = this.renderer.tilesPerClientPixel()
      this.renderer.panBy(
        -(center.x - this.pinch.x) * perPixel,
        -(center.y - this.pinch.y) * perPixel
      )
      this.pinch = { dist, x: center.x, y: center.y }
      return
    }

    if (this.panning) {
      const dx = e.clientX - this.panAnchorX
      const dy = e.clientY - this.panAnchorY
      // A tap that has turned into a drag is no longer a tap.
      if (this.pendingInspect && Math.hypot(dx, dy) > TAP_SLOP) this.pendingInspect = null
      const perPixel = this.renderer.tilesPerClientPixel()
      this.renderer.panTo(this.panAnchorCam - dx * perPixel, this.panAnchorCamY - dy * perPixel)
      return
    }

    // Hover tooltip: track which creature is under the cursor when not painting or panning.
    if (e.isPrimary && !this.pointerDown && !this.panning && this.pointers.size <= 1) {
      const hp = this.renderer.screenToWorld(e.clientX, e.clientY)
      const hovered = this.creatureAt(hp.x, hp.y)
      const hState = useMicroLand.getState()
      const currentId = hState.hoveredCreature?.id ?? null
      const newId = hovered?.id ?? null
      if (newId !== currentId) {
        if (hovered) {
          const bp = this.world.blueprints[hovered.blueprintId]
          hState.setHoveredCreature({
            id: hovered.id,
            mood: hovered.mood,
            hunger: hovered.hunger,
            name: bp?.name ?? hovered.blueprintId,
            screenX: e.clientX,
            screenY: e.clientY,
          })
        } else {
          hState.setHoveredCreature(null)
        }
      } else if (hovered && hState.hoveredCreature) {
        // Keep position and stats fresh even without id change.
        const cur = hState.hoveredCreature
        if (Math.abs(e.clientX - cur.screenX) > 4 || Math.abs(e.clientY - cur.screenY) > 4 ||
            cur.mood !== hovered.mood || Math.abs(cur.hunger - hovered.hunger) > 0.05) {
          const bp = this.world.blueprints[hovered.blueprintId]
          hState.setHoveredCreature({
            id: hovered.id, mood: hovered.mood, hunger: hovered.hunger,
            name: bp?.name ?? hovered.blueprintId,
            screenX: e.clientX, screenY: e.clientY,
          })
        }
      }
    }

    if (!this.pointerDown || !e.isPrimary) return

    // Drag along the map and the world follows — the fastest way to cross it.
    if (this.scrubbingMap) {
      const jump = this.renderer.minimapHit(e.clientX, e.clientY)
      if (jump !== null) this.renderer.centerOn(jump.x, jump.y)
      return
    }

    const p = this.renderer.screenToWorld(e.clientX, e.clientY)

    if (this.grabbed) {
      const bp = this.world.blueprints[this.grabbed.blueprintId]
      if (bp) {
        const { w, h } = artSize(bp)
        this.grabbed.x = Math.max(0, Math.min(this.world.width - w, p.x - w / 2))
        this.grabbed.y = Math.max(0, Math.min(this.world.height - h, p.y - h / 2))
        this.grabbed.vx = 0
        this.grabbed.vy = 0
      }
      this.grabTrail.push({ x: p.x, y: p.y, t: performance.now() })
      if (this.grabTrail.length > 6) this.grabTrail.shift()
      return
    }

    this.applyTool(p.x, p.y)
  }

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)

    if (this.pinch) {
      if (this.pointers.size >= 2) {
        // Still a pinch, one finger lighter. Re-read it or the next move counts
        // the jump in the midpoint as a pan.
        this.beginPinch()
      } else {
        this.pinch = null
        // One finger left over from a two-finger gesture keeps moving the world
        // rather than suddenly starting to paint with it.
        const last = [...this.pointers.values()][0]
        if (last) this.beginPan(last.x, last.y)
      }
    } else if (this.panning && this.pointers.size === 0) {
      this.panning = false
    } else {
      this.reanchorPan()
    }

    if (!e.isPrimary) return
    this.pointerDown = false
    this.scrubbingMap = false

    // A look-mode tap that never travelled far enough to be a pan.
    if (this.pendingInspect) {
      this.inspectedId = this.pendingInspect.id
      // Following a creature you deliberately picked out is the point of
      // watching one; following "nothing" would just freeze the camera.
      this.following = this.pendingInspect.id !== null
      this.pendingInspect = null
      this.pushInspected()
    }

    if (this.grabbed) {
      // Throw: velocity from how fast the pointer was moving as it let go.
      const trail = this.grabTrail
      if (trail.length >= 2) {
        const first = trail[0]
        const last = trail[trail.length - 1]
        const dt = Math.max(0.016, (last.t - first.t) / 1000)
        this.grabbed.vx = Math.max(-40, Math.min(40, (last.x - first.x) / dt))
        this.grabbed.vy = Math.max(-40, Math.min(40, (last.y - first.y) / dt))
      }
      this.grabbed = null
      this.grabTrail = []
    }

    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId)
    }
  }

  private applyTool(x: number, y: number, shiftKey = false): void {
    const state = useMicroLand.getState()
    const tool = state.tool

    if (tool.kind === 'creature') {
      const now = performance.now()
      if (now - this.lastPlaceAt < PLACE_THROTTLE_MS) return
      this.lastPlaceAt = now
      const bp = this.world.blueprints[tool.blueprintId]
      if (!bp) return
      this.world.dormant = false

      // Shift+click: place a small flock/herd spread around the click point.
      if (shiftKey) {
        const GROUP_SIZE = 4
        for (let i = 0; i < GROUP_SIZE; i++) {
          if (this.world.creatures.length >= TUNING.maxCreatures) break
          spawnSomewhereSensible(this.world, bp, this.rng, { x, y, radius: 15 })
        }
        this.pushStats()
        return
      }

      if (this.world.creatures.length >= TUNING.maxCreatures) {
        state.notify('The world is full. Something has to go.')
        return
      }
      const { w, h } = artSize(bp)
      const body = bodyBox(bp)
      const px = Math.max(0, Math.min(this.world.width - w, x - w / 2))
      const py = Math.max(0, Math.min(this.world.height - h, y - h / 2))
      // Only the solid core has to be clear — tapping a spot where a dragon's
      // wingtip overlaps a hill should still place the dragon.
      if (boxHitsSolid(this.world, px + body.dx, py + body.dy, body.w, body.h)) {
        // Tapped inside rock — find the nearest breathing room instead.
        spawnSomewhereSensible(this.world, bp, this.rng, { x, y, radius: 10 })
      } else {
        spawnCreature(this.world, bp, px, py)
      }
      this.pushStats()
      return
    }

    // Inspecting is resolved on pointerdown; it never paints.
    if (tool.kind === 'inspect') return

    if (tool.kind === 'corridor') {
      if (!this.world.corridors) this.world.corridors = new Uint8Array(WORLD_W * WORLD_H)
      const r = state.brush
      const x0 = Math.max(0, Math.round(x) - r)
      const x1 = Math.min(WORLD_W - 1, Math.round(x) + r)
      const y0 = Math.max(0, Math.round(y) - r)
      const y1 = Math.min(WORLD_H - 1, Math.round(y) + r)
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const dx = cx - x, dy = cy - y
          if (state.brushShape !== 'square' && dx * dx + dy * dy > r * r) continue
          this.world.corridors[cy * WORLD_W + cx] = 1
        }
      }
      return
    }

    if (tool.kind === 'biome') {
      const biome = BIOME_BY_ID[tool.biomeId]
      if (biome) {
        if (state.brushShape === 'square') {
          paintBiomeSquare(this.world, x, y, state.brush, biome, this.rng)
        } else {
          paintBiomeCircle(this.world, x, y, state.brush, biome, this.rng)
        }
        this.renderer.markTilesDirty()
      }
      return
    }

    const material = tool.kind === 'erase' ? 'air' : tool.material
    if (state.brushShape === 'square') {
      paintSquare(this.world, x, y, state.brush, material)
    } else {
      paintCircle(this.world, x, y, state.brush, material)
    }
    this.renderer.markTilesDirty()
  }

  /** Topmost creature whose sprite box contains this point. */
  private creatureAt(x: number, y: number): Creature | null {
    const creatures = this.world.creatures
    for (let i = creatures.length - 1; i >= 0; i--) {
      const c = creatures[i]
      const bp = this.world.blueprints[c.blueprintId]
      if (!bp) continue
      const { w, h } = artSize(bp)
      // A little slack so small creatures are still grabbable on a phone.
      const pad = Math.max(0, 3 - Math.min(w, h) / 2)
      if (x >= c.x - pad && x <= c.x + w + pad && y >= c.y - pad && y <= c.y + h + pad) {
        return c
      }
    }
    return null
  }

  /** Fingers came or went mid-pan — take a fresh reading so it doesn't jump. */
  private reanchorPan(): void {
    if (!this.panning || this.pointers.size === 0) return
    const center = this.pointerCenter()
    this.panAnchorX = center.x
    this.panAnchorY = center.y
    this.panAnchorCam = this.renderer.cameraX
    this.panAnchorCamY = this.renderer.cameraY
  }

  /**
   * A wheel or trackpad moves the world; held with ctrl or ⌘, it zooms it.
   *
   * The ctrl half is not a keyboard shortcut anyone has to know — a trackpad
   * pinch on macOS *is* a ctrl-wheel, so this is how a laptop pinches. Plain
   * scrolling stays a pan, which is the thing you do far more often.
   *
   * Panning folds vertical scroll into horizontal while the world fits top to
   * bottom, because a mouse with one wheel is still the most common way anyone
   * will touch this and there would otherwise be nowhere for it to go. Zoomed in
   * far enough that there *is* somewhere, the two axes separate.
   */
  private onWheel = (e: WheelEvent) => {
    // deltaMode: 0 pixels, 1 lines, 2 pages.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1

    if (e.ctrlKey || e.metaKey) {
      if (e.deltaY === 0) return
      e.preventDefault()
      this.following = false
      // Exponential so a notch is worth the same proportion of the zoom at
      // either end of the range — linear steps crawl when close in and lurch
      // when far out.
      const factor = Math.exp(-e.deltaY * unit * WHEEL_ZOOM_RATE)
      this.renderer.setZoom(this.renderer.zoomLevel * factor, {
        clientX: e.clientX,
        clientY: e.clientY,
      })
      this.pushCamera()
      return
    }

    // Shift-wheel is the web's horizontal scroll. Most platforms hand it over
    // already turned into `deltaX`; the ones that don't are why this is here,
    // and it is the only way a mouse with a single wheel can cross a world nine
    // screens wide once zoom has claimed the vertical axis.
    const sideways = e.shiftKey && e.deltaX === 0
    const splitAxes = this.renderer.canPanVertically && !sideways
    const rawX = splitAxes
      ? e.deltaX
      : Math.abs(e.deltaX) > Math.abs(e.deltaY)
        ? e.deltaX
        : e.deltaY
    const rawY = splitAxes ? e.deltaY : 0
    if (rawX === 0 && rawY === 0) return
    e.preventDefault()
    this.following = false
    const step = (raw: number) => Math.max(-PAN_STEP, Math.min(PAN_STEP, raw * unit * 0.25))
    this.renderer.panBy(step(rawX), step(rawY))
  }

  /** Which way, if any, does this key point? */
  private static keyDirection(key: string): -1 | 0 | 1 {
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') return -1
    if (key === 'ArrowRight' || key === 'd' || key === 'D') return 1
    return 0
  }

  /** The same, up and down. Only reaches anything once zoom has made room. */
  private static keyDirectionY(key: string): -1 | 0 | 1 {
    if (key === 'ArrowUp' || key === 'w' || key === 'W') return -1
    if (key === 'ArrowDown' || key === 's' || key === 'S') return 1
    return 0
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return

    // `=` is the unshifted key `+` lives on, and nobody holds shift to zoom in.
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      this.zoomByStep(1)
      return
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      this.zoomByStep(-1)
      return
    }
    if (e.key === '0') {
      e.preventDefault()
      this.resetZoom()
      return
    }

    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      this.following = false
      this.renderer.panToLeft(e.key === 'Home' ? 0 : this.world.width)
      return
    }

    const dir = GameInstance.keyDirection(e.key)
    // Ignored outright rather than held at zero while the world fits top to
    // bottom: a key that silently stops the camera following something, and
    // then moves nothing, is worse than a key that does nothing at all.
    const dirY = this.renderer.canPanVertically ? GameInstance.keyDirectionY(e.key) : 0
    if (dir === 0 && dirY === 0) return
    e.preventDefault()
    this.keysDown.add(e.key)
    if (dir !== 0) this.panHeld = dir
    if (dirY !== 0) this.panHeldY = dirY
    this.following = false
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.key)
    // Holding both arrows and releasing one should leave you moving the other
    // way, not stop dead.
    let dir: -1 | 0 | 1 = 0
    let dirY: -1 | 0 | 1 = 0
    for (const key of this.keysDown) {
      const d = GameInstance.keyDirection(key)
      if (d !== 0) dir = d
      const dy = GameInstance.keyDirectionY(key)
      if (dy !== 0) dirY = dy
    }
    this.panHeld = dir
    this.panHeldY = dirY
  }

  /** A canvas that lost focus can't hear a keyup, so it must not stay stuck. */
  private onBlur = () => {
    this.keysDown.clear()
    this.panHeld = 0
    this.panHeldY = 0
  }

  private attachInput(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerUp)
    this.canvas.addEventListener('pointerleave', this.onPointerLeave)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.canvas.addEventListener('keydown', this.onKeyDown)
    this.canvas.addEventListener('keyup', this.onKeyUp)
    this.canvas.addEventListener('blur', this.onBlur)
  }

  private detachInput(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerUp)
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('keydown', this.onKeyDown)
    this.canvas.removeEventListener('keyup', this.onKeyUp)
    this.canvas.removeEventListener('blur', this.onBlur)
  }
}
