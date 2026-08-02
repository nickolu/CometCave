/**
 * Owns the world, the loop, and the pointer.
 *
 * Deliberately outside React: the world mutates 60 times a second and React
 * only hears about it through a small summary pushed a few times a second.
 */
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import {
  type SanitizedTerrain,
  sanitizeTerrain,
  terrainToTheme,
} from '@/app/micro-land/domain/terrain'
import { SUMMONED_THEME_ID } from '@/app/micro-land/store'

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
import { artSize, bodyBox, reserveSummonIds, sanitizeBlueprint } from './domain/blueprint'
import { MILESTONES, type MilestoneContext } from './domain/config/milestones'
import { DEFAULT_THEME, THEME_BY_ID, type Theme } from './domain/config/themes'
import { ELDER_MIN_SECONDS, TICK_S, TILE_TICK_EVERY } from './domain/constants'
import { type SimEvent, emitParticles, tickCreatures } from './domain/sim/creature-sim'
import { makeRng } from './domain/sim/prng'
import { tickTiles } from './domain/sim/tile-sim'
import {
  applyTheme,
  applyThemeObject,
  boxHitsSolid,
  boxLiquidFraction,
  clearCreatures,
  countByBlueprint,
  createWorld,
  paintCircle,
  registerBlueprint,
  seedStarters,
  spawnCreature,
  spawnSomewhereSensible,
} from './domain/sim/world'
import { TUNING } from './domain/tuning'
import { formatDuration } from './format'
import { Renderer } from './rendering/renderer'
import { type EarnedMilestone, type PopulationEntry, useMicroLand } from './store'
import { releaseActiveWorld, touchActiveWorld } from './worlds/shelf'
import { restoreSnapshot, snapshotWorld } from './worlds/snapshot'
import { WORLD_SAVE_VERSION, type WorldSave } from './worlds/types'

import type { SpeciesRecord } from './chronicle/types'
import type { Creature, CreatureBlueprint, WorldState } from './domain/types'

/** How often the UI gets a fresh population summary. */
const STATS_EVERY_MS = 300

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

  /** Species that existed last time we checked, for extinction notices. */
  private knownSpecies = new Set<string>()
  /** World-clock time of the last hunt notice, so kills don't spam the screen. */
  private lastHuntNotice = -HUNT_NOTICE_GAP

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
  /** World-clock time the current no-extinction streak began. */
  private steadySince = 0
  /** Archive size at the last push, so the guide is only re-sent when it grows. */
  private lastArchiveSize = -1

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
  /** Every pointer currently down, so a second finger can be noticed. */
  private pointers = new Map<number, number>()
  /** Client X where a drag-pan started, and the camera position it started at. */
  private panAnchorX = 0
  private panAnchorCam = 0
  private panning = false
  /** -1, 0 or 1 — an arrow key or arrow button being held down. */
  private panHeld = 0
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
      useMicroLand.getState().setCanPan(!this.renderer.fitsOnScreen)
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

    this.renderer.render(this.world, theme, this.inspectedId, this.elderId)
  }

  /**
   * Move the camera for anything that isn't a direct drag.
   *
   * Held keys and held buttons, carrying a creature past the edge, and chasing
   * whatever the inspector is watching. Drag-panning is absolute and lives in
   * the pointer handler; everything here is per-second and belongs on a clock.
   */
  private updateCamera(dt: number): void {
    if (this.panHeld !== 0) {
      this.following = false
      this.renderer.panBy(this.panHeld * PAN_SPEED * dt)
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

      if (dir !== 0) {
        this.renderer.panBy(dir * EDGE_SPEED * dt)
        // The creature is positioned from the pointer, and the pointer isn't
        // moving — so without dragging it along by the same amount it would slip
        // out of the edge band on the first frame and the scroll would stop dead.
        const moved = this.renderer.cameraX - cam
        const bp = this.world.blueprints[this.grabbed.blueprintId]
        const bw = bp ? artSize(bp).w : 0
        this.grabbed.x = Math.max(0, Math.min(this.world.width - bw, held + moved))
      }
    }

    if (this.following && this.inspectedId !== null) {
      const c = this.world.creatures.find(x => x.id === this.inspectedId)
      if (c) {
        this.renderer.keepInView(c.x, this.renderer.viewWidth * 0.22, FOLLOW_SPEED * dt)
      }
    }
  }

  private step(gravity: number, events: SimEvent[]): void {
    const w = this.world
    w.elapsed += TICK_S

    this.tileCounter++
    if (this.tileCounter >= TILE_TICK_EVERY) {
      this.tileCounter = 0
      tickTiles(w)
      // Tiles moved, so the cached tile image is stale.
      this.renderer.markTilesDirty()
    }

    tickCreatures(w, TICK_S, this.rng, gravity, events)
  }

  /** Turn raw sim events into the occasional human-readable notice. */
  private digestEvents(events: SimEvent[]): void {
    const notify = useMicroLand.getState().notify

    for (const event of events) {
      // Announce predation on animals — a kill is instant and the victim just
      // vanishes, so without this the food chain runs invisibly and looks like
      // it isn't happening at all. Plants are eaten constantly; saying so every
      // time would drown out everything else.
      if (event.kind !== 'ate' || !event.victimId) continue
      const victim = this.world.blueprints[event.victimId]
      if (!victim || victim.move.kind === 'root') continue
      if (this.world.elapsed - this.lastHuntNotice < HUNT_NOTICE_GAP) continue
      const hunter = this.world.blueprints[event.blueprintId]
      if (!hunter) continue
      this.lastHuntNotice = this.world.elapsed
      notify(`A ${hunter.name} caught a ${victim.name}.`)
    }

    for (const event of events) {
      if (event.kind !== 'eaten' && event.kind !== 'starved') continue
      const bp = this.world.blueprints[event.blueprintId]
      if (!bp) continue
      // Was that the last one? Only interesting for species we'd seen alive.
      if (!this.knownSpecies.has(bp.id)) continue
      const stillAlive = this.world.creatures.some(c => c.blueprintId === bp.id)
      if (stillAlive) continue
      this.knownSpecies.delete(bp.id)
      // An extinction is exactly what the steady streak measures the absence of
      // — it is the moment the world has to bail the player out via seed rain.
      this.breakSteadyStreak()
      notify(
        event.kind === 'starved' ? `The last ${bp.name} starved.` : `The last ${bp.name} was eaten.`
      )
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
      .map(([blueprintId, count]) => ({
        blueprintId,
        name: this.world.blueprints[blueprintId]?.name ?? blueprintId,
        count,
      }))
      .sort((a, b) => b.count - a.count)

    for (const entry of population) this.knownSpecies.add(entry.blueprintId)

    useMicroLand.getState().setStats(population, this.world.creatures.length, this.world.elapsed)

    this.updateRecords(population)
    this.pushInspected()

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
    for (const c of w.creatures) {
      if (!oldest || c.ageSeconds > oldest.ageSeconds) oldest = c
      if (c.generation > deepest) deepest = c.generation
      const best = eldestOf.get(c.blueprintId)
      if (best === undefined || c.ageSeconds > best) {
        eldestOf.set(c.blueprintId, c.ageSeconds)
      }
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

      // --- stability ----------------------------------------------------
      // Banked live rather than only when the streak breaks, so a session that
      // ends by closing the tab still keeps the run it was in the middle of.
      if (steadySeconds > record.steadySeconds) record.steadySeconds = steadySeconds
    })

    store.setRecords({
      elder: record.elder,
      bestSteadySeconds: record.steadySeconds,
      bestGenerations: record.generations,
      bestGenerationsSpeciesName: record.generationsSpeciesName,
      steadySeconds,
      deepestGeneration: deepest,
    })

    // Sorted once and shared: both of these want the same list, and it is
    // rebuilt on every stats tick.
    const archive = archivedSpecies()

    this.checkMilestones(archive, {
      elapsed: w.elapsed,
      steadySeconds,
      oldestSeconds: oldest?.ageSeconds ?? 0,
      generations: deepest,
      speciesAlive: population.length,
      total: w.creatures.length,
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
    })
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
    this.lastArchiveSize = -1
  }

  /** Copy the watched creature's live state out for the inspector panel. */
  private pushInspected(): void {
    const store = useMicroLand.getState()
    if (this.inspectedId === null) {
      if (store.inspected !== null) store.setInspected(null)
      return
    }

    const c = this.world.creatures.find(x => x.id === this.inspectedId)
    if (!c) {
      // It died while we were watching. Let go rather than freezing a corpse.
      this.inspectedId = null
      this.following = false
      store.setInspected(null)
      return
    }

    const bp = this.world.blueprints[c.blueprintId]
    if (!bp) return
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
      lifespanSeconds: bp.diet.lifespanSeconds,
      mealsEaten: c.mealsEaten,
      children: c.children,
      tilesDug: c.tilesDug,
      distress: c.distress,
      starving: c.starving,
      speed: Math.hypot(c.vx, c.vy),
      inWater: boxLiquidFraction(this.world, c.x, c.y, bw, bh) > 0.3,
      grounded: c.grounded,
      targetName: targetBp?.name ?? null,
      generation: c.generation,
      name: c.name,
      isElder: c.id === this.elderId,
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
     * `registerBlueprint` pushes every species onto that list, and both safety
     * nets read `w.blueprints[id]` straight off it — `nativePlants` to decide
     * what the soil can re-seed, `repopulate` to pick who comes back. Leaving a
     * dangling id there hands `undefined` to `isPlant` and breaks the two
     * mechanisms that stop the world flatlining, which would look nothing like
     * a deletion bug when it eventually surfaced.
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
      this.inspectedId = null
      this.following = false
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
    this.inspectedId = null
    this.following = false
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
      this.inspectedId = null
      this.following = false
      this.renderer.markTilesDirty()
      this.beginLand()
      this.pushStats()
      return
    }
    applyTheme(this.world, themeId)
    clearCreatures(this.world)
    this.knownSpecies.clear()
    this.inspectedId = null
    this.following = false
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

  getWorld(): WorldState {
    return this.world
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

    // Seeded from what is actually alive, so opening a world does not announce
    // the extinction of everything that was in the land it replaced.
    this.knownSpecies = new Set(this.world.creatures.map(c => c.blueprintId))
    this.inspectedId = null
    this.following = false
    store.setInspected(null)

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

  // --- pointer --------------------------------------------------------------

  private beginPan(clientX: number): void {
    this.panning = true
    this.following = false
    this.panAnchorX = clientX
    this.panAnchorCam = this.renderer.cameraX
  }

  /** Midpoint of every finger down, so a two-finger pan doesn't pivot. */
  private pointerCenterX(): number {
    let sum = 0
    for (const x of this.pointers.values()) sum += x
    return this.pointers.size > 0 ? sum / this.pointers.size : 0
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

  private onPointerDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, e.clientX)

    // A second finger always means "move the world", whatever the first one had
    // started doing. Two fingers on a canvas is a pan everywhere else on a
    // phone, and the alternative — painting from both — is nobody's intent.
    if (this.pointers.size === 2) {
      this.cancelPointerAction()
      this.beginPan(this.pointerCenterX())
      return
    }
    if (this.pointers.size > 2) {
      this.reanchorPan()
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
      this.renderer.centerOn(jump)
      return
    }

    const p = this.renderer.screenToWorld(e.clientX, e.clientY)
    const hit = this.creatureAt(p.x, p.y)

    if (useMicroLand.getState().tool.kind === 'inspect') {
      // Look mode has nothing to paint, so a drag is free to mean "pan" — the
      // one place a single finger can move the world without ambiguity. The
      // selection is resolved on release, so a pan doesn't also deselect.
      this.pendingInspect = { id: hit ? hit.id : null }
      this.beginPan(e.clientX)
      return
    }

    if (hit) {
      // Pick it up. This wins over placing — grabbing is the more specific intent.
      this.grabbed = hit
      this.grabTrail = [{ x: p.x, y: p.y, t: performance.now() }]
      return
    }

    this.lastPlaceAt = 0
    this.applyTool(p.x, p.y)
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, e.clientX)

    if (this.panning) {
      const from = this.pointers.size >= 2 ? this.pointerCenterX() : e.clientX
      const dx = from - this.panAnchorX
      // A tap that has turned into a drag is no longer a tap.
      if (this.pendingInspect && Math.abs(dx) > TAP_SLOP) this.pendingInspect = null
      this.renderer.panToLeft(this.panAnchorCam - dx * this.renderer.tilesPerClientPixel())
      return
    }

    if (!this.pointerDown || !e.isPrimary) return

    // Drag along the map and the world follows — the fastest way to cross it.
    if (this.scrubbingMap) {
      const jump = this.renderer.minimapHit(e.clientX, e.clientY)
      if (jump !== null) this.renderer.centerOn(jump)
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
    if (this.panning && this.pointers.size === 0) this.panning = false
    else this.reanchorPan()

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

  private applyTool(x: number, y: number): void {
    const state = useMicroLand.getState()
    const tool = state.tool

    if (tool.kind === 'creature') {
      const now = performance.now()
      if (now - this.lastPlaceAt < PLACE_THROTTLE_MS) return
      this.lastPlaceAt = now
      const bp = this.world.blueprints[tool.blueprintId]
      if (!bp) return
      this.world.dormant = false
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

    const material = tool.kind === 'erase' ? 'air' : tool.material
    paintCircle(this.world, x, y, state.brush, material)
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
    this.panAnchorX = this.pointerCenterX()
    this.panAnchorCam = this.renderer.cameraX
  }

  /**
   * A wheel or trackpad scrolls the world sideways.
   *
   * Vertical scroll is folded in as well as horizontal: there is nothing above
   * or below to scroll to, and a mouse with one wheel is still the most common
   * way anyone will touch this.
   */
  private onWheel = (e: WheelEvent) => {
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (raw === 0) return
    e.preventDefault()
    this.following = false
    // deltaMode: 0 pixels, 1 lines, 2 pages.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    const tiles = raw * unit * 0.25
    this.renderer.panBy(Math.max(-PAN_STEP, Math.min(PAN_STEP, tiles)))
  }

  /** Which way, if any, does this key point? */
  private static keyDirection(key: string): -1 | 0 | 1 {
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') return -1
    if (key === 'ArrowRight' || key === 'd' || key === 'D') return 1
    return 0
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return

    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      this.following = false
      this.renderer.panToLeft(e.key === 'Home' ? 0 : this.world.width)
      return
    }

    const dir = GameInstance.keyDirection(e.key)
    if (dir === 0) return
    e.preventDefault()
    this.keysDown.add(e.key)
    this.panHeld = dir
    this.following = false
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.key)
    // Holding both arrows and releasing one should leave you moving the other
    // way, not stop dead.
    let dir: -1 | 0 | 1 = 0
    for (const key of this.keysDown) {
      const d = GameInstance.keyDirection(key)
      if (d !== 0) dir = d
    }
    this.panHeld = dir
  }

  /** A canvas that lost focus can't hear a keyup, so it must not stay stuck. */
  private onBlur = () => {
    this.keysDown.clear()
    this.panHeld = 0
  }

  private attachInput(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerUp)
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
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('keydown', this.onKeyDown)
    this.canvas.removeEventListener('keyup', this.onKeyUp)
    this.canvas.removeEventListener('blur', this.onBlur)
  }
}
