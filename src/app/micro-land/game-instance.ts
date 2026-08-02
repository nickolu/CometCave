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
  landId,
  landRecord,
  noteSpeciesLife,
  readChronicle,
  rememberSpecies,
  updateChronicle,
} from './chronicle/chronicle'
import { artSize, sanitizeBlueprint } from './domain/blueprint'
import { MILESTONES, type MilestoneContext } from './domain/config/milestones'
import { DEFAULT_THEME, THEME_BY_ID, type Theme } from './domain/config/themes'
import {
  ELDER_MIN_SECONDS,
  MAX_CREATURES,
  TICK_S,
  TILE_TICK_EVERY,
} from './domain/constants'
import { type SimEvent, tickCreatures } from './domain/sim/creature-sim'
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
import { formatDuration } from './format'
import { Renderer } from './rendering/renderer'
import {
  type EarnedMilestone,
  type PopulationEntry,
  useMicroLand,
} from './store'

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
  return MILESTONES.filter((m) => earned[m.id]).map((m) => ({
    id: m.id,
    text: m.text,
    at: earned[m.id],
  }))
}

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
  private elderSnapshot: { name: string | null; species: string; seconds: number } | null =
    null
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
  private grabTrail: { x: number; y: number; t: number }[] = []
  private lastPlaceAt = 0
  private resizeObserver: ResizeObserver | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new Renderer(canvas)
    this.world = createWorld(Date.now() & 0xffff)

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

    this.renderer.render(this.world, theme, this.inspectedId, this.elderId)
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
      const stillAlive = this.world.creatures.some((c) => c.blueprintId === bp.id)
      if (stillAlive) continue
      this.knownSpecies.delete(bp.id)
      // An extinction is exactly what the steady streak measures the absence of
      // — it is the moment the world has to bail the player out via seed rain.
      this.breakSteadyStreak()
      notify(
        event.kind === 'starved'
          ? `The last ${bp.name} starved.`
          : `The last ${bp.name} was eaten.`
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

    useMicroLand
      .getState()
      .setStats(population, this.world.creatures.length, this.world.elapsed)

    this.updateRecords(population)
    this.pushInspected()
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
    if (this.elderId !== null && !w.creatures.some((c) => c.id === this.elderId)) {
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
      if (
        oldest &&
        oldest.ageSeconds >= ELDER_MIN_SECONDS &&
        oldest.ageSeconds > best
      ) {
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
        const line = w.creatures.find((c) => c.generation === deepest)
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
    const c = this.world.creatures.find((x) => x.id === this.elderId)
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
      summonedArchived: archive.filter((s) => s.blueprint.summoned).length,
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
    this.currentLand = landId(
      useMicroLand.getState().themeId,
      useMicroLand.getState().summonedLand
    )
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

    const c = this.world.creatures.find((x) => x.id === this.inspectedId)
    if (!c) {
      // It died while we were watching. Let go rather than freezing a corpse.
      this.inspectedId = null
      store.setInspected(null)
      return
    }

    const bp = this.world.blueprints[c.blueprintId]
    if (!bp) return
    const { w: bw, h: bh } = artSize(bp)

    const target = c.targetId !== null
      ? this.world.creatures.find((x) => x.id === c.targetId)
      : undefined
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
    const terrain = sanitizeTerrain(raw)
    this.summonedTheme = terrainToTheme(terrain, MATERIAL_INDEX)
    applyThemeObject(this.world, this.summonedTheme)
    if (!opts.keepCreatures) {
      clearCreatures(this.world)
      this.knownSpecies.clear()
      this.inspectedId = null
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
    if (themeId === SUMMONED_THEME_ID && this.summonedTheme) {
      applyThemeObject(this.world, this.summonedTheme)
      clearCreatures(this.world)
      this.knownSpecies.clear()
      this.inspectedId = null
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
    seedStarters(this.world, themeId, this.rng)
    this.renderer.markTilesDirty()
    this.beginLand()
    this.pushStats()
  }

  /** Rebuild the terrain with a new seed, keeping the theme. */
  reshuffle(): void {
    const themeId = useMicroLand.getState().themeId
    if (themeId === SUMMONED_THEME_ID && this.summonedTheme) {
      applyThemeObject(this.world, this.summonedTheme)
      clearCreatures(this.world)
      this.knownSpecies.clear()
      this.inspectedId = null
      this.renderer.markTilesDirty()
      this.beginLand()
      this.pushStats()
      return
    }
    applyTheme(this.world, themeId)
    clearCreatures(this.world)
    this.knownSpecies.clear()
    this.inspectedId = null
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
      if (this.world.creatures.length >= MAX_CREATURES) break
      if (spawnSomewhereSensible(this.world, bp, this.rng)) placed++
    }
    this.pushStats()
    return { blueprint: bp, placed }
  }

  getWorld(): WorldState {
    return this.world
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private onPointerDown = (e: PointerEvent) => {
    if (!e.isPrimary) return
    this.canvas.setPointerCapture(e.pointerId)
    this.pointerDown = true

    const p = this.renderer.screenToWorld(e.clientX, e.clientY)
    const hit = this.creatureAt(p.x, p.y)

    if (useMicroLand.getState().tool.kind === 'inspect') {
      // Tapping nothing clears the selection, which is how you close the panel.
      this.inspectedId = hit ? hit.id : null
      this.pushInspected()
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
    if (!this.pointerDown || !e.isPrimary) return
    const p = this.renderer.screenToWorld(e.clientX, e.clientY)

    if (this.grabbed) {
      const bp = this.world.blueprints[this.grabbed.blueprintId]
      if (bp) {
        const { w, h } = artSize(bp)
        this.grabbed.x = Math.max(
          0,
          Math.min(this.world.width - w, p.x - w / 2)
        )
        this.grabbed.y = Math.max(
          0,
          Math.min(this.world.height - h, p.y - h / 2)
        )
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
    if (!e.isPrimary) return
    this.pointerDown = false

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
      if (this.world.creatures.length >= MAX_CREATURES) {
        state.notify('The world is full. Something has to go.')
        return
      }
      const { w, h } = artSize(bp)
      const px = Math.max(0, Math.min(this.world.width - w, x - w / 2))
      const py = Math.max(0, Math.min(this.world.height - h, y - h / 2))
      if (boxHitsSolid(this.world, px, py, w, h)) {
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
      if (
        x >= c.x - pad &&
        x <= c.x + w + pad &&
        y >= c.y - pad &&
        y <= c.y + h + pad
      ) {
        return c
      }
    }
    return null
  }

  private attachInput(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerUp)
  }

  private detachInput(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerUp)
  }
}
