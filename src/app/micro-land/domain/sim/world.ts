/** World construction, tile access, and spawning. */
import { artSize, bodyBox } from '@/app/micro-land/domain/blueprint'
import { BUILTIN_CREATURES } from '@/app/micro-land/domain/config/creatures'
import {
  AIR,
  IS_DEADLY,
  IS_DROWNING,
  IS_FERTILE,
  IS_LIQUID,
  IS_SOLID,
  MATERIAL_BY_INDEX,
  MATERIAL_INDEX,
  VISCOSITY,
} from '@/app/micro-land/domain/config/materials'
import type { Biome } from '../config/biomes'
import { DEFAULT_THEME, THEME_BY_ID, type Theme } from '@/app/micro-land/domain/config/themes'
import {
  BIOME_REGION_H,
  NUM_BIOME_REGIONS,
  PLANT_SEED_INTERVAL,
  SURFACE_SEEDING_BIAS,
  WIDTH_SCALE,
  WORLD_H,
  WORLD_W,
} from '@/app/micro-land/domain/constants'
import { neutralTraits } from '@/app/micro-land/domain/traits'
import { TUNING } from '@/app/micro-land/domain/tuning'
import type {
  BiomeZone,
  BiomeZoneType,
  Creature,
  CreatureBlueprint,
  MaterialId,
  WorldGeneratorEntry,
  WorldState,
} from '@/app/micro-land/domain/types'
import { wrapCol, wrapX } from '@/app/micro-land/domain/wrap'

import { type Rng, makeRng } from './prng'

export function createWorld(seed = 1337): WorldState {
  const tiles = new Uint8Array(WORLD_W * WORLD_H)
  const grain = new Uint8Array(WORLD_W * WORLD_H)
  const rng = makeRng(seed)
  for (let i = 0; i < grain.length; i++) grain[i] = Math.floor(rng() * 256)

  const blueprints: Record<string, CreatureBlueprint> = {}
  for (const bp of BUILTIN_CREATURES) blueprints[bp.id] = bp

  const world: WorldState = {
    width: WORLD_W,
    height: WORLD_H,
    tiles,
    grain,
    creatures: [],
    particles: [],
    carcasses: [],
    tombstones: [],
    nextTombstoneId: 1,
    nextCarcassId: 1,
    scents: [],
    moisture: new Float32Array(WORLD_W * WORLD_H),
    eggs: [],
    nextEggId: 1,
    nests: [],
    nextNestId: 1,
    blueprints,
    nextCreatureId: 1,
    elapsed: 0,
    seed,
    flowPhase: 0,
    natives: [],
    nextPlantSeed: 0,
    dormant: false,
    spawners: [],
    nextSpawnerId: 1,
    generators: [],
  }
  if (TUNING.estuaryOceanFraction > 0) initSalinity(world)
  return world
}

// ---------------------------------------------------------------------------
// Tile access
// ---------------------------------------------------------------------------

export function idx(x: number, y: number): number {
  return y * WORLD_W + wrapCol(x)
}

/**
 * Is this a real tile?
 *
 * Only a question about `y` now. The world wraps horizontally, so there is no
 * such thing as an x that is out of bounds — every column resolves to a real one.
 * The argument is kept so the dozens of call sites still read as a bounds check
 * on a point rather than on a row, and so that any caller which one day cares
 * about x again has somewhere to put it.
 */
export function inBounds(_x: number, y: number): boolean {
  return y >= 0 && y < WORLD_H
}

/**
 * Material index at a tile. Above the sky and below the floor reads as stone —
 * the world is a cylinder, capped top and bottom.
 */
export function tileAt(w: WorldState, x: number, y: number): number {
  if (y < 0 || y >= WORLD_H) return MATERIAL_INDEX.stone
  return w.tiles[y * WORLD_W + wrapCol(x)]
}

/** The ceiling and the floor count as solid, so nothing falls out of the world. */
export function solidAt(w: WorldState, x: number, y: number): boolean {
  if (y < 0 || y >= WORLD_H) return true
  return IS_SOLID[w.tiles[y * WORLD_W + wrapCol(x)]] === 1
}

export function liquidAt(w: WorldState, x: number, y: number): boolean {
  if (y < 0 || y >= WORLD_H) return false
  return IS_LIQUID[w.tiles[y * WORLD_W + wrapCol(x)]] === 1
}

export function deadlyAt(w: WorldState, x: number, y: number): boolean {
  if (y < 0 || y >= WORLD_H) return false
  return IS_DEADLY[w.tiles[y * WORLD_W + wrapCol(x)]] === 1
}

export function fertileAt(w: WorldState, x: number, y: number): boolean {
  if (y < 0 || y >= WORLD_H) return false
  return IS_FERTILE[w.tiles[y * WORLD_W + wrapCol(x)]] === 1
}

export function setTile(w: WorldState, x: number, y: number, mat: number): void {
  if (y < 0 || y >= WORLD_H) return
  w.tiles[y * WORLD_W + wrapCol(x)] = mat
}

/**
 * Does a box of tiles overlap anything solid?
 * Used for both movement collision and finding somewhere to put a creature.
 */
export function boxHitsSolid(w: WorldState, x: number, y: number, bw: number, bh: number): boolean {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.floor(x + bw - 0.001)
  const y1 = Math.floor(y + bh - 0.001)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (solidAt(w, tx, ty)) return true
    }
  }
  return false
}

/**
 * Drop a box straight down from `y` until it rests on solid ground, and return
 * the resting top edge (or null if there's no floor within `maxDrop`, or the
 * box would be buried where it lands).
 *
 * This exists because "is there ground under me" is deceptively easy to get
 * wrong. A box at y with height bh occupies rows `floor(y)` through
 * `floor(y + bh - 0.001)` — so the tile *below* it is `floor(y + bh - 0.001) + 1`,
 * NOT `floor(y + bh)`. Those two differ for every non-integer y, and the naive
 * version asks about a row the box is already standing in — which collision has
 * necessarily just proven to be empty. The check silently never passes, and
 * nothing that walks or grows can ever be placed.
 */
export function settleOnGround(
  w: WorldState,
  x: number,
  y: number,
  bw: number,
  bh: number,
  opts: { maxDrop?: number; requireFertile?: boolean } = {}
): number | null {
  const maxDrop = opts.maxDrop ?? 64
  const x0 = Math.floor(x)
  const x1 = Math.floor(x + bw - 0.001)
  const startTop = Math.floor(y)
  const limit = Math.min(WORLD_H - 1, startTop + maxDrop + Math.ceil(bh))

  /**
   * The *highest* solid tile anywhere under the footprint.
   *
   * This used to take the first footing found in any column, walking the box
   * down until some column had ground beneath it. For a 4-wide bug that is the
   * same answer. For an 18-wide dinosaur on a hillside it lands the box at the
   * height of the lowest column, which buries its uphill half in the slope —
   * the fit check then fails and nothing that big could ever be placed at all.
   * Resting on the highest ground under the footprint is what "standing on a
   * hill" actually means.
   */
  let ground = Infinity
  let fertileGround = false
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = startTop; ty <= limit; ty++) {
      if (!solidAt(w, tx, ty)) continue
      if (ty < ground) {
        ground = ty
        fertileGround = fertileAt(w, tx, ty)
      } else if (ty === ground && fertileAt(w, tx, ty)) {
        fertileGround = true
      }
      break
    }
  }
  if (ground === Infinity) return null
  if (opts.requireFertile && !fertileGround) return null

  // The tile *below* a box at `top` is `floor(top + bh - 0.001) + 1`, not
  // `floor(top + bh)` — those differ for every non-integer top, and the naive
  // version asks about a row the box is already standing in. Sitting the box
  // exactly `bh` above the ground row is what makes that arithmetic come out.
  const top = ground - bh
  if (top < 0) return null
  if (boxHitsSolid(w, x, top, bw, bh)) return null
  return top
}

/** Fraction of a creature's box that's sitting in liquid, 0..1. */
export function boxLiquidFraction(
  w: WorldState,
  x: number,
  y: number,
  bw: number,
  bh: number
): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.floor(x + bw - 0.001)
  const y1 = Math.floor(y + bh - 0.001)
  let wet = 0
  let total = 0
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      total++
      if (liquidAt(w, tx, ty)) wet++
    }
  }
  return total === 0 ? 0 : wet / total
}

/**
 * Fraction of the box sitting in something it could drown in, 0..1.
 *
 * Deliberately not the same as `boxLiquidFraction`. Sap is a liquid for every
 * physical purpose — it's buoyant, it drags, things sink into it — but it isn't
 * water, and a creature stuck in tree sap is stuck, not drowning.
 */
export function boxDrownFraction(
  w: WorldState,
  x: number,
  y: number,
  bw: number,
  bh: number
): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.floor(x + bw - 0.001)
  const y1 = Math.floor(y + bh - 0.001)
  let submerged = 0
  let total = 0
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      total++
      if (!inBounds(tx, ty)) continue
      if (IS_DROWNING[w.tiles[ty * WORLD_W + wrapCol(tx)]] === 1) submerged++
    }
  }
  return total === 0 ? 0 : submerged / total
}

/**
 * How gummed-up the creature's box is, 0..1.
 *
 * The thickest tile wins rather than the average: one foot in the sap should
 * hold you, not be diluted by the nine tiles of clear air around it.
 */
export function boxViscosity(w: WorldState, x: number, y: number, bw: number, bh: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.floor(x + bw - 0.001)
  const y1 = Math.floor(y + bh - 0.001)
  let worst = 0
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!inBounds(tx, ty)) continue
      const v = VISCOSITY[w.tiles[ty * WORLD_W + wrapCol(tx)]]
      if (v > worst) worst = v
    }
  }
  return worst / 255
}

/** The first deadly material the creature's box is touching, if any. */
export function boxDeadlyMaterial(
  w: WorldState,
  x: number,
  y: number,
  bw: number,
  bh: number
): number | null {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.floor(x + bw - 0.001)
  const y1 = Math.floor(y + bh - 0.001)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (deadlyAt(w, tx, ty)) return tileAt(w, tx, ty)
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

/** Rebuild the tile grid from a theme. Creatures are left alone. */
export function applyTheme(w: WorldState, themeId: string, seed?: number): void {
  applyThemeObject(w, THEME_BY_ID[themeId] ?? THEME_BY_ID[DEFAULT_THEME], seed)
}

/** Same, for a theme that isn't in the registry — i.e. summoned terrain. */
export function applyThemeObject(w: WorldState, theme: Theme, seed?: number): void {
  const s = seed ?? Math.floor(Math.random() * 1e9)
  w.seed = s
  const rng = makeRng(s)
  theme.build(w.tiles, rng)
  for (let i = 0; i < w.grain.length; i++) w.grain[i] = Math.floor(rng() * 256)
  w.particles.length = 0
  w.dormant = false
}

/** Paint a filled circle of material. This is the player's brush. */
export function paintCircle(
  w: WorldState,
  cx: number,
  cy: number,
  radius: number,
  mat: MaterialId
): void {
  const value = MATERIAL_INDEX[mat]
  // Painting is the player building something, which is the opposite of asking
  // for an empty world — so the ground is allowed to grow again.
  w.dormant = false
  const r2 = radius * radius
  const x0 = Math.floor(cx - radius)
  const x1 = Math.ceil(cx + radius)
  const y0 = Math.floor(cy - radius)
  const y1 = Math.ceil(cy + radius)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) setTile(w, x, y, value)
    }
  }
}

/** Paint a filled square (axis-aligned) of material. */
export function paintSquare(
  w: WorldState,
  cx: number,
  cy: number,
  half: number,
  mat: MaterialId
): void {
  const value = MATERIAL_INDEX[mat]
  w.dormant = false
  const x0 = Math.floor(cx - half)
  const x1 = Math.ceil(cx + half)
  const y0 = Math.floor(cy - half)
  const y1 = Math.ceil(cy + half)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setTile(w, x, y, value)
    }
  }
}

/** Pick one material from a biome palette by weighted random selection. */
function pickBiomeMat(rng: Rng, palette: Biome['palette']): number {
  let total = 0
  for (const e of palette) total += e.weight
  let roll = rng() * total
  for (const e of palette) {
    roll -= e.weight
    if (roll < 0) return MATERIAL_INDEX[e.material]
  }
  return MATERIAL_INDEX[palette[palette.length - 1].material]
}

/** Paint a filled circle where each tile is drawn from a biome's weighted material palette. */
export function paintBiomeCircle(
  w: WorldState,
  cx: number,
  cy: number,
  radius: number,
  biome: Biome,
  rng: Rng
): void {
  w.dormant = false
  const r2 = radius * radius
  const x0 = Math.floor(cx - radius)
  const x1 = Math.ceil(cx + radius)
  const y0 = Math.floor(cy - radius)
  const y1 = Math.ceil(cy + radius)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) setTile(w, x, y, pickBiomeMat(rng, biome.palette))
    }
  }
}

/** Paint a filled square where each tile is drawn from a biome's weighted material palette. */
export function paintBiomeSquare(
  w: WorldState,
  cx: number,
  cy: number,
  half: number,
  biome: Biome,
  rng: Rng
): void {
  w.dormant = false
  const x0 = Math.floor(cx - half)
  const x1 = Math.ceil(cx + half)
  const y0 = Math.floor(cy - half)
  const y1 = Math.ceil(cy + half)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setTile(w, x, y, pickBiomeMat(rng, biome.palette))
    }
  }
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

export function registerBlueprint(w: WorldState, bp: CreatureBlueprint): void {
  w.blueprints[bp.id] = bp
  // Summoned creatures become native too, so the world can bring them back.
  if (!w.natives.includes(bp.id)) w.natives.push(bp.id)
  // Each native species gets a generator entry — enabled for plants, off for
  // animals. Summoning a species twice leaves its config unchanged.
  if (!w.generators.some((g: WorldGeneratorEntry) => g.blueprintId === bp.id)) {
    const isPlant = bp.move.kind === 'root'
    w.generators.push({
      blueprintId: bp.id,
      enabled: isPlant,
      intervalSeconds: isPlant ? PLANT_SEED_INTERVAL : 30,
      nextSeed: 0,
    })
  }
}

/** Make a creature at an exact spot, no questions asked. */
export function spawnCreature(
  w: WorldState,
  bp: CreatureBlueprint,
  x: number,
  y: number
): Creature | null {
  if (w.creatures.length >= TUNING.maxCreatures) return null
  if (!w.blueprints[bp.id]) w.blueprints[bp.id] = bp

  // Every stored x is a wrapped x — see `domain/wrap.ts`. This is the one funnel
  // every creature in the game comes through (placed by hand, seeded by the
  // ground, born, dropped by a theme), so normalising here is what makes that
  // invariant true rather than merely intended.
  x = wrapX(x)

  // Species-specific trait baselines: fly/swim range naturally farther;
  // meat-eaters are naturally more territorial about their hunting grounds.
  const spawnBaseTraits = {
    ...neutralTraits(),
    ...(bp.move.kind === 'fly' || bp.move.kind === 'swim' ? { roam: 1.3 } : {}),
    ...(bp.diet.eats.includes('meat') ? { territorial: 0.7 } : {}),
  }

  const creature: Creature = {
    id: w.nextCreatureId++,
    blueprintId: bp.id,
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 1,
    hunger: 0.2,
    starving: 0,
    ageSeconds: 0,
    distress: 0,
    mood: 'wander',
    targetId: null,
    drift: 0,
    animMs: Math.random() * bp.art.frameMs * bp.art.frames.length,
    grounded: false,
    breedCooldown: 0,
    mealsEaten: 0,
    children: 0,
    // Founder of its line until `reproduce` says otherwise — and, being a
    // founder, exactly its species. Every creature this function makes is one
    // the world put there rather than one that was born: placed by hand, seeded
    // by the ground, dropped in by a theme. Inheritance is applied by the
    // breeding block afterwards, so this is also what makes a species that died
    // out and was placed again start over from the blueprint rather than from
    // wherever its last line had drifted to.
    generation: 1,
    traits: bp.traitDefaults ? { ...spawnBaseTraits, ...bp.traitDefaults } : spawnBaseTraits,
    name: null,
    huntPassCount: 0,
    huntBlockedId: null,
    poisoned: 0,
    // `wrapCol` and not a bare round: rounding a wrapped x can land exactly on
    // WORLD_W, which is one past the last column and would read as a home the
    // creature can never quite reach.
    homeX: wrapCol(Math.round(x)),
    homeY: Math.round(y),
    migrateTimer: 0,
    packTimer: 0,
    sinking: 0,
    stunTimer: 0,
    symbiosisTimer: 0,
    sick: 0,
    fatigue: 0,
    carryingSeed: null,
    seedTimer: 0,
  }
  w.creatures.push(creature)
  return creature
}

/**
 * Find somewhere this creature could actually survive.
 *
 * Plants want fertile ground under them, fish want water, walkers want a floor.
 * Returns the sprite's top-left corner, or null if nowhere in this world suits.
 *
 * Split out from `spawnSomewhereSensible` so the same search can answer "could
 * this species live here at all?" without actually creating anything — which is
 * how the ground decides which plants are native to it.
 */
export function findSpawnSpot(
  w: WorldState,
  bp: CreatureBlueprint,
  rng: Rng,
  near?: { x: number; y: number; radius: number }
): { x: number; y: number } | null {
  const { w: bw, h: bh } = artSize(bp)
  const body = bodyBox(bp)
  const wantsLiquid = bp.move.kind === 'swim' || bp.habitat.needs?.includes('water')
  const isPlant = bp.move.kind === 'root'

  // Somewhere to stand is judged on the solid core, not the drawing. A dragon
  // that needed a clear 28-tile box to exist would almost never find one, and
  // every summon would silently fall back to "drop it wherever".
  const fits = (x: number, y: number) => !boxHitsSolid(w, x + body.dx, y + body.dy, body.w, body.h)

  for (let attempt = 0; attempt < 120; attempt++) {
    let x: number
    let y: number
    /**
     * Dropped from the sky rather than from a random height, so the seed lands
     * on the *outdoor* surface of its column instead of the first cave floor it
     * happens to fall past.
     *
     * A random point in the world volume is overwhelmingly a point underground:
     * the sky is empty, the surface is one row, and everything below it is a
     * honeycomb of caves whose floors are all fertile. Sampling y uniformly and
     * settling from there put 554 of 585 plants in caves nobody can see, left
     * one sunleaf on the entire surface of the world, and starved every grazer
     * standing on it — while the headline plant count read as a world at its
     * ceiling. See SURFACE_SEEDING_BIAS for why some seeds still fall short.
     */
    let fromSky = false
    if (near) {
      const a = rng() * Math.PI * 2
      const r = rng() * near.radius
      x = near.x + Math.cos(a) * r
      y = near.y + Math.sin(a) * r
    } else if (isPlant && !wantsLiquid && rng() < SURFACE_SEEDING_BIAS) {
      // Water plants are excluded because the checks below judge the spot
      // *before* it settles: kelp asked about an empty sky reads as beached and
      // rejects all 120 attempts, which would quietly wipe kelp out of tidepool.
      x = rng() * WORLD_W
      y = 0
      fromSky = true
    } else {
      x = rng() * WORLD_W
      y = rng() * (WORLD_H - bh)
    }
    // The whole width is fair game now: a sprite hanging over the seam is drawn
    // and collided in two pieces rather than being pushed back inside, so the
    // old `WORLD_W - bw` limit would only have left a creature-shaped gap in the
    // spawn distribution either side of column zero.
    x = wrapX(x)
    y = Math.max(0, Math.min(WORLD_H - bh, y))

    if (!fits(x, y)) continue

    const wet = boxLiquidFraction(w, x + body.dx, y + body.dy, body.w, body.h)
    if (wantsLiquid && wet < 0.6) continue
    if (!wantsLiquid && bp.habitat.drowns && wet > 0.3) continue
    if (boxDeadlyMaterial(w, x + body.dx, y + body.dy, body.w, body.h) !== null) {
      const immune = bp.body.immuneTo.length > 0
      if (!immune) continue
    }

    if (isPlant || bp.move.kind === 'walk') {
      // Fall from wherever we landed onto the first floor beneath it. Scanning
      // down rather than demanding a floor at exactly this height is what makes
      // a random point in open sky a usable spawn instead of a wasted attempt.
      const settled = settleOnGround(w, x + body.dx, y + body.dy, body.w, body.h, {
        requireFertile: isPlant,
        // A seed let go at the top of the sky has the whole world to fall
        // through. The default 64 stops half way down and would leave every
        // deep valley barren for no reason the player could ever work out.
        maxDrop: fromSky ? WORLD_H : undefined,
      })
      if (settled === null) continue
      // `settled` is the core's resting top edge; the sprite hangs above it.
      y = settled - body.dy
      // Re-check the surroundings at the resting spot, not where we aimed.
      if (
        bp.habitat.drowns &&
        boxLiquidFraction(w, x + body.dx, y + body.dy, body.w, body.h) > 0.3
      ) {
        continue
      }
      if (
        boxDeadlyMaterial(w, x + body.dx, y + body.dy, body.w, body.h) !== null &&
        bp.body.immuneTo.length === 0
      ) {
        continue
      }
    }

    return { x, y }
  }

  // Nowhere ideal. Drop it wherever the player asked and let physics sort it out.
  // Resolved from a stash conflict: keep this function returning a spot (the
  // caller does the spawning now), but test the fit against the solid core
  // rather than the whole sprite — a dragon's wingtips overlapping a hill must
  // not be the reason a summon lands nowhere.
  if (near && fits(near.x - bw / 2, near.y - bh / 2)) {
    return { x: wrapX(near.x - bw / 2), y: near.y - bh / 2 }
  }
  return null
}

/** Find somewhere this creature could survive and put it there. */
export function spawnSomewhereSensible(
  w: WorldState,
  bp: CreatureBlueprint,
  rng: Rng,
  near?: { x: number; y: number; radius: number }
): Creature | null {
  const spot = findSpawnSpot(w, bp, rng, near)
  if (!spot) return null
  return spawnCreature(w, bp, spot.x, spot.y)
}

/**
 * Seed a theme's resident population.
 *
 * Starter counts are written per screen of land, and scaled up here rather than
 * in each theme so the numbers stay readable as what they are: 34 sunleaf is a
 * meadow, and it should still be a meadow in a world three times the size
 * instead of a thin scattering the player has to go looking for.
 */
export function seedStarters(w: WorldState, themeId: string, rng: Rng): void {
  const theme = THEME_BY_ID[themeId]
  if (!theme) return
  w.dormant = false
  for (const entry of theme.starters) {
    const bp = w.blueprints[entry.id]
    if (!bp) continue
    if (!w.natives.includes(bp.id)) w.natives.push(bp.id)
    const count = Math.round(entry.count * WIDTH_SCALE)
    for (let i = 0; i < count; i++) spawnSomewhereSensible(w, bp, rng)
  }
}

export function clearCreatures(w: WorldState): void {
  w.creatures.length = 0
  w.particles.length = 0
  w.spawners.length = 0
}

// ---------------------------------------------------------------------------
// Native plants — the ground's seed bank
// ---------------------------------------------------------------------------

function isPlant(bp: CreatureBlueprint | undefined): boolean {
  return bp?.move.kind === 'root'
}

/** Native species that are plants. Empty until the ground has decided. */
function nativePlantIds(w: WorldState): string[] {
  return w.natives.filter(id => isPlant(w.blueprints[id]))
}

/** Is there anywhere in this world a plant could put roots down? */
function hasFertileGround(w: WorldState): boolean {
  for (let i = 0; i < w.tiles.length; i++) {
    if (IS_FERTILE[w.tiles[i]] === 1) return true
  }
  return false
}

/**
 * Decide which plants belong to this world, once, the first time it has soil.
 *
 * A theme hands its flora over through `starters`, so this is really for the
 * worlds nobody wrote: an Empty canvas the player paints grass onto, terrain
 * that came back from a summon, stone a Loamworm has been patiently turning
 * into dirt. Those worlds have ground and no reason for anything to grow on it.
 *
 * Which species is settled by asking the world rather than by a lookup table —
 * a candidate is native if `findSpawnSpot` can actually place it. Kelp rules
 * itself out of a world with no water without anyone having to say so, and a
 * summoned material nobody has thought about yet still gets an honest answer.
 *
 * Picks a few of the viable species rather than all of them, so a pond and a
 * meadow don't grow the same flora.
 */
export function establishNativePlants(w: WorldState, rng: Rng): boolean {
  if (nativePlantIds(w).length > 0) return true
  if (!hasFertileGround(w)) return false

  const viable: string[] = []
  for (const bp of Object.values(w.blueprints)) {
    if (!isPlant(bp)) continue
    if (findSpawnSpot(w, bp, rng)) viable.push(bp.id)
  }
  if (viable.length === 0) return false

  // Fisher–Yates over a copy, so the pick is drawn from the world's own RNG and
  // stays reproducible for the headless harness.
  for (let i = viable.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[viable[i], viable[j]] = [viable[j], viable[i]]
  }
  for (const id of viable.slice(0, TUNING.nativePlantSpecies)) w.natives.push(id)
  return true
}

/**
 * The ground pushing its plant population back toward a living level.
 *
 * This is the *only* thing in the game that brings a species back. Animals used
 * to wander back in too, on a four-second clock, and it made the world feel like
 * it was being restocked rather than lived in: a kind you had watched go extinct
 * was back before you had finished reading the notice. Nothing does that now.
 * Lose a creature and it is gone until you place another one.
 *
 * Plants keep their seed bank because they are the one thing with no upstream —
 * plants only come from plants, so a grazer boom that strips the last one is
 * terminal for everything above it. The soil holding the seed is what makes a
 * meadow renewable instead of merely long-lived.
 *
 * Deliberately blind to whether anything is alive, and deliberately slow. The
 * rate is a trickle rather than a refill (see PLANT_SEED_INTERVAL): green
 * creeping back over minutes reads as the land recovering, where a fast one read
 * as the game undoing what just happened.
 */
export function seedNativePlants(w: WorldState, rng: Rng, seasonFactor = 1): void {
  if (w.elapsed < w.nextPlantSeed) return
  w.nextPlantSeed = w.elapsed + TUNING.plantSeedInterval
  if (w.dormant) return
  if (!establishNativePlants(w, rng)) return

  const counts: Record<string, number> = {}
  let plants = 0
  for (const c of w.creatures) {
    if (!isPlant(w.blueprints[c.blueprintId])) continue
    counts[c.blueprintId] = (counts[c.blueprintId] ?? 0) + 1
    plants++
  }

  // In winter (seasonFactor < 1), the ground targets fewer plants — the seed
  // bank is depleted. In summer (> 1) it aims higher and seeds more aggressively.
  const scaledTarget = Math.max(0, Math.round(TUNING.nativePlantTarget * seasonFactor))
  const deficit = scaledTarget - plants
  if (deficit <= 0) return
  if (plants >= TUNING.maxPlants || w.creatures.length >= TUNING.maxCreatures) return

  // Scale the seeding to how bare the world is: a nearly-full meadow gets one
  // sprout, a stripped one gets the full batch. Recovery from a crash is fast
  // without the ground quietly out-growing the grazers the rest of the time.
  const batch = Math.min(
    TUNING.plantSeedBatch,
    Math.max(1, Math.ceil((deficit / TUNING.nativePlantTarget) * TUNING.plantSeedBatch))
  )

  // Rarest first, so the ground refills the species the grazers actually
  // emptied instead of piling more onto whichever one is already winning.
  const pool = nativePlantIds(w)
    .filter(id => (counts[id] ?? 0) < TUNING.plantSpeciesCap)
    .sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0))
  if (pool.length === 0) return

  for (let i = 0; i < batch; i++) {
    const bp = w.blueprints[pool[i % pool.length]]
    if (!bp) continue
    // Try a couple of spots and prefer the more moist one — moisture fertilises.
    const spot1 = findSpawnSpot(w, bp, rng)
    const spot2 = findSpawnSpot(w, bp, rng)
    let bestSpot = spot1
    if (spot1 && spot2 && w.moisture) {
      const m1 = w.moisture[Math.floor(spot1.y) * WORLD_W + Math.floor(spot1.x)] ?? 0
      const m2 = w.moisture[Math.floor(spot2.y) * WORLD_W + Math.floor(spot2.x)] ?? 0
      bestSpot = m2 > m1 ? spot2 : spot1
    } else {
      bestSpot = spot1 ?? spot2
    }
    if (bestSpot) {
      spawnCreature(w, bp, bestSpot.x, bestSpot.y)
    }
  }
}

/**
 * Data-driven replacement for seedNativePlants.
 *
 * Fires each enabled generator when its timer expires, seeding one creature per
 * species per tick. Plants use the same moist-spot preference as the old batch
 * seeder; animals use findSpawnSpot without preference.
 *
 * Lazy-initialises generator entries for any native that slipped in through
 * establishNativePlants rather than registerBlueprint (e.g. empty-canvas worlds
 * where the ground picks its own species).
 */
export function runWorldGenerators(w: WorldState, dt: number, rng: Rng): void {
  if (w.dormant) return
  // Same precondition as seedNativePlants — no point seeding until soil exists.
  if (!establishNativePlants(w, rng)) return

  // Lazy-init generator entries for natives added by establishNativePlants.
  for (const id of w.natives) {
    if (!w.generators.some(g => g.blueprintId === id)) {
      const bp = w.blueprints[id]
      if (!bp) continue
      const plantBp = isPlant(bp)
      w.generators.push({
        blueprintId: id,
        enabled: plantBp,
        intervalSeconds: plantBp ? PLANT_SEED_INTERVAL : 30,
        nextSeed: 0,
      })
    }
  }

  const rateScale = Math.max(0.01, TUNING.generatorRateMultiplier)

  for (const entry of w.generators) {
    if (!entry.enabled) continue
    if (w.elapsed < entry.nextSeed) continue
    entry.nextSeed = w.elapsed + entry.intervalSeconds * rateScale

    const bp = w.blueprints[entry.blueprintId]
    if (!bp) continue

    if (isPlant(bp)) {
      // Respect global plant and creature caps.
      if (w.creatures.length >= TUNING.maxCreatures) continue
      let plants = 0
      for (const c of w.creatures) {
        if (isPlant(w.blueprints[c.blueprintId])) plants++
      }
      if (plants >= TUNING.maxPlants) continue
      const speciesCount = w.creatures.filter(c => c.blueprintId === bp.id).length
      if (speciesCount >= TUNING.plantSpeciesCap) continue

      // Prefer the moistier of two candidate spots — same heuristic as before.
      const spot1 = findSpawnSpot(w, bp, rng)
      const spot2 = findSpawnSpot(w, bp, rng)
      let bestSpot = spot1
      if (spot1 && spot2 && w.moisture) {
        const m1 = w.moisture[Math.floor(spot1.y) * WORLD_W + Math.floor(spot1.x)] ?? 0
        const m2 = w.moisture[Math.floor(spot2.y) * WORLD_W + Math.floor(spot2.x)] ?? 0
        bestSpot = m2 > m1 ? spot2 : spot1
      } else {
        bestSpot = spot1 ?? spot2
      }
      if (bestSpot) spawnCreature(w, bp, bestSpot.x, bestSpot.y)
    } else {
      // Animal generator — respects the per-species soft cap.
      if (w.creatures.length >= TUNING.maxCreatures) continue
      const speciesCount = w.creatures.filter(c => c.blueprintId === bp.id).length
      if (speciesCount >= TUNING.speciesSoftCap) continue
      const spot = findSpawnSpot(w, bp, rng)
      if (spot) spawnCreature(w, bp, spot.x, spot.y)
    }
  }
}

/**
 * Update the moisture field — called once per sim step.
 *
 * Runs at a reduced cadence (every 30 ticks ≈ twice a second) to keep the
 * O(width×height) scan from dominating the frame budget. Water-adjacent tiles
 * gain moisture; everything dries at a baseline rate; a periodic rainfall zone
 * adds a burst of moisture somewhere in the world.
 */
export function tickMoisture(w: WorldState, tickCount: number, dt: number, rng: Rng): void {
  if (tickCount % 30 !== 0) return
  w.moisture ??= new Float32Array(WORLD_W * WORLD_H)
  const timePassed = 30 / 60 // seconds per update window
  const waterIdx = MATERIAL_INDEX.water

  // Spring flood pulse: rising-phase sine (spring) amplifies moisture near water
  // and deposits floodwater nutrients in floodplain tiles. Issue #3372.
  let springFloodMult = 1
  let nutrientDeposit = 0
  if (TUNING.seasonAmplitude > 0) {
    const sPhase = (2 * Math.PI * w.elapsed) / TUNING.seasonPeriod
    const sinP = Math.sin(sPhase)
    const cosP = Math.cos(sPhase)
    // Spring = sin > 0 && cos > 0: the rising quarter heading toward summer peak.
    if (sinP > 0 && cosP > 0) {
      springFloodMult = 1 + TUNING.seasonAmplitude * sinP * 4
      nutrientDeposit = TUNING.seasonAmplitude * sinP * 0.0001 * timePassed
    }
  }

  if (nutrientDeposit > 0) {
    w.caveNutrient ??= new Float32Array(WORLD_W * WORLD_H)
  }

  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const i = y * WORLD_W + x
      w.moisture[i] = Math.max(0, w.moisture[i] - 0.005 * timePassed)
      // Sideways neighbours wrap, so a shoreline at column zero is as damp as
      // one in the middle of the map. Up and down still stop at the walls.
      const rowStart = y * WORLD_W
      const hasWater =
        w.tiles[i] === waterIdx ||
        w.tiles[rowStart + (x === 0 ? WORLD_W - 1 : x - 1)] === waterIdx ||
        w.tiles[rowStart + (x === WORLD_W - 1 ? 0 : x + 1)] === waterIdx ||
        (y > 0 && w.tiles[i - WORLD_W] === waterIdx) ||
        (y < WORLD_H - 1 && w.tiles[i + WORLD_W] === waterIdx)
      if (hasWater) {
        w.moisture[i] = Math.min(1, w.moisture[i] + 0.01 * timePassed * springFloodMult)
        // Spring floodwater deposits nutrients in floodplain tiles
        if (nutrientDeposit > 0 && w.caveNutrient) {
          w.caveNutrient[i] = Math.min(1, (w.caveNutrient[i] ?? 0) + nutrientDeposit)
        }
      }
    }
  }
  // Rainfall: once per sim-minute, soak a random zone.
  if (Math.floor(w.elapsed / 60) > Math.floor((w.elapsed - timePassed) / 60)) {
    const rx = Math.floor(rng() * WORLD_W)
    const ry = Math.floor(rng() * WORLD_H)
    const radius = 15 + Math.floor(rng() * 25)
    for (let dy2 = -radius; dy2 <= radius; dy2++) {
      for (let dx2 = -radius; dx2 <= radius; dx2++) {
        const tx = wrapCol(rx + dx2)
        const ty = ry + dy2
        if (ty < 0 || ty >= WORLD_H) continue
        if (dx2 * dx2 + dy2 * dy2 > radius * radius) continue
        const mi = ty * WORLD_W + tx
        w.moisture[mi] = Math.min(1, (w.moisture[mi] || 0) + 0.25)
      }
    }
  }
  updateFlowZones(w, tickCount)
  tickLight(w, tickCount)
}

/**
 * Classify each water tile as pool (1), run (2), or riffle (3) based on the
 * local height gradient of the solid-floor beneath neighbour columns.
 *
 * For a water tile at (x, y), scan down in columns x-1 and x+1 to find the
 * first solid-tile Y in each. The absolute difference gives the gradient:
 * >= 3 tiles = riffle (steep), >= 1 = run, 0 = pool (flat). Runs every 60
 * ticks (~1 Hz). The overlay stays undefined in worlds with no water.
 * Issue #3370.
 */
export function updateFlowZones(w: WorldState, tickCount: number): void {
  if (tickCount % 60 !== 0) return

  // Early exit if no water tiles exist.
  let hasWater = false
  for (let i = 0; i < WORLD_W * WORLD_H; i++) {
    if (IS_LIQUID[w.tiles[i]] === 1) { hasWater = true; break }
  }
  if (!hasWater) return

  w.flowZone ??= new Uint8Array(WORLD_W * WORLD_H)
  w.flowZone.fill(0)

  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      if (IS_LIQUID[w.tiles[y * WORLD_W + wrapCol(x)]] !== 1) continue

      // Find Y of first solid tile at or below y in a given column.
      let fL = WORLD_H
      const xL = wrapCol(x - 1)
      for (let fy = y; fy < WORLD_H; fy++) {
        if (IS_SOLID[w.tiles[fy * WORLD_W + xL]] === 1) { fL = fy; break }
      }

      let fR = WORLD_H
      const xR = wrapCol(x + 1)
      for (let fy = y; fy < WORLD_H; fy++) {
        if (IS_SOLID[w.tiles[fy * WORLD_W + xR]] === 1) { fR = fy; break }
      }

      const gradient = Math.abs(fL - fR)
      const zone = gradient >= 3 ? 3 : gradient >= 1 ? 2 : 1
      w.flowZone[y * WORLD_W + wrapCol(x)] = zone
    }
  }
}

/**
 * Compute the per-tile light level by column-sweep from the top of the world.
 *
 * Starts at full sunlight (1.0) at row 0 and attenuates by 0.25 for each solid
 * tile encountered, reaching near-zero under thick overhangs or cave ceilings.
 * Air and liquid tiles are transparent. Runs every 30 ticks (same cadence as
 * tickMoisture). Used by the light-gap germination trigger. Issue #3351.
 */
export function tickLight(w: WorldState, tickCount: number): void {
  if (tickCount % 30 !== 0) return
  w.lightGrid ??= new Float32Array(WORLD_W * WORLD_H)
  for (let x = 0; x < WORLD_W; x++) {
    let light = 1.0
    for (let y = 0; y < WORLD_H; y++) {
      const tileIdx = w.tiles[y * WORLD_W + wrapCol(x)]
      if (IS_SOLID[tileIdx] === 1) {
        light *= 0.25
      } else {
        // Semi-solid tiles attenuate light partially. Issue #3170.
        //
        // Only `moss` and `grass` are checked because they are the only growth
        // materials in the table. This originally also tested 'plant',
        // 'leaves', 'fern' and 'flower', none of which are materials — plants
        // are *creatures* here, not tiles, so a plant can never appear in the
        // grid. Those branches were unreachable and are gone; shading from
        // standing vegetation would have to read `w.creatures` instead.
        const matId = MATERIAL_BY_INDEX[tileIdx]?.id
        if (matId === 'moss' || matId === 'grass') {
          light *= 0.6  // canopy plants reduce light by 40%
        } else if (matId === 'water') {
          light *= 0.85  // water reduces light by 15%
        }
      }
      w.lightGrid[y * WORLD_W + x] = light
    }
  }
}

/**
 * Update the cave-nutrient field — drip water from surface pools carries
 * dissolved organic matter down through stone, nourishing cave bacteria.
 * Runs at the same cadence as tickMoisture (every 30 ticks).
 */
export function tickCaveNutrient(w: WorldState, tickCount: number, dt: number): void {
  if (tickCount % 30 !== 0) return
  w.caveNutrient ??= new Float32Array(WORLD_W * WORLD_H)
  const timePassed = 30 / 60
  const stoneIdx = MATERIAL_INDEX.stone
  const waterIdx = MATERIAL_INDEX.water

  // Decay all cave nutrient slowly.
  for (let i = 0; i < WORLD_W * WORLD_H; i++) {
    if (w.caveNutrient[i] > 0) {
      w.caveNutrient[i] = Math.max(0, w.caveNutrient[i] - 0.003 * timePassed)
    }
  }

  // Drip: for each water tile in the upper half of the world, look downward
  // for the first stone tile within 40 rows. Check every 4th column to stay cheap.
  for (let x = 0; x < WORLD_W; x += 4) {
    for (let y = 0; y < Math.floor(WORLD_H / 2); y++) {
      if (w.tiles[y * WORLD_W + x] !== waterIdx) continue
      for (let dy = 1; dy <= 40; dy++) {
        const ty = y + dy
        if (ty >= WORLD_H) break
        const ti = ty * WORLD_W + x
        if (w.tiles[ti] === stoneIdx) {
          w.caveNutrient[ti] = Math.min(1, w.caveNutrient[ti] + 0.015 * timePassed)
          break
        }
        // Stop looking if we hit another liquid (no further drip through pooled water)
        if (IS_LIQUID[w.tiles[ti]] === 1) break
      }
    }
  }
}

/**
 * Initialise the salinity overlay based on TUNING.estuaryOceanFraction.
 * Ocean tiles (right edge) start at 1.0; fresh tiles (left edge) start at 0.0.
 * Called once on world creation when estuaryOceanFraction > 0.
 */
export function initSalinity(w: WorldState): void {
  if (TUNING.estuaryOceanFraction <= 0) return
  w.salinity ??= new Float32Array(WORLD_W * WORLD_H)
  const oceanStart = Math.floor(WORLD_W * (1 - TUNING.estuaryOceanFraction))
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const i = y * WORLD_W + x
      if (x >= oceanStart) {
        w.salinity[i] = 1.0
      } else {
        w.salinity[i] = 0.0
      }
    }
  }
}

/**
 * Diffuse the salinity gradient — runs every 60 ticks to let the gradient
 * stabilise without dominating the frame budget.
 * Ocean edge is held at 1.0; fresh (left 20%) at 0.0. Interior diffuses.
 */
export function tickSalinity(w: WorldState, tickCount: number): void {
  if (!w.salinity || TUNING.estuaryOceanFraction <= 0 || tickCount % 60 !== 0) return
  const oceanStart = Math.floor(WORLD_W * (1 - TUNING.estuaryOceanFraction))
  const freshEnd = Math.floor(WORLD_W * 0.1)  // leftmost 10% stays fresh
  const alpha = 0.05  // diffusion rate
  // Simple averaging diffusion — one pass per update
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = freshEnd; x < oceanStart; x++) {
      const i = y * WORLD_W + x
      const left = w.salinity[y * WORLD_W + (x - 1)] ?? 0
      const right = w.salinity[y * WORLD_W + (x + 1)] ?? 0
      w.salinity[i] += alpha * (left + right - 2 * w.salinity[i])
      w.salinity[i] = Math.max(0, Math.min(1, w.salinity[i]))
    }
  }
  // Reinforce boundary conditions.
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < freshEnd; x++) w.salinity[y * WORLD_W + x] = 0
    for (let x = oceanStart; x < WORLD_W; x++) w.salinity[y * WORLD_W + x] = 1
  }
}

/**
 * Decay and diffuse marsh detritus — dissolved organic carbon exported from
 * decomposing salt marsh plants. Acts as a slow-release fertility subsidy for
 * the coastal food web. Runs every 30 ticks.
 */
export function tickMarshDetritus(w: WorldState, tickCount: number, dt: number): void {
  if (!w.marshDetritus || tickCount % 30 !== 0) return
  const decay = 0.001 * dt
  for (let i = 0; i < WORLD_W * WORLD_H; i++) {
    w.marshDetritus[i] = Math.max(0, w.marshDetritus[i] - decay)
  }
  // Gentle lateral diffusion between horizontally adjacent tiles
  const alpha = 0.02
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const i = y * WORLD_W + x
      const left = w.marshDetritus[y * WORLD_W + ((x - 1 + WORLD_W) % WORLD_W)]
      const right = w.marshDetritus[y * WORLD_W + ((x + 1) % WORLD_W)]
      w.marshDetritus[i] = Math.max(0, Math.min(1, w.marshDetritus[i] + alpha * (left + right - 2 * w.marshDetritus[i])))
    }
  }
}

/**
 * Soil nutrient cycle: fallow recovery, runoff loss near water tiles.
 * Runs every 60 ticks. Plant uptake and nitrogen fixation are handled
 * per-creature in tickCreatures(). Issues #3144, #3149, #3151.
 */
export function tickSoilNutrient(w: WorldState, tickCount: number): void {
  if (tickCount % 60 !== 0) return
  if (!w.soilNutrient) {
    w.soilNutrient = new Float32Array(WORLD_W * WORLD_H)
    w.soilNutrient.fill(1.0)
  }

  const dirtIdx = MATERIAL_INDEX.dirt
  const mudIdx = MATERIAL_INDEX.mud
  const waterIdx = MATERIAL_INDEX.water
  const grassIdx = MATERIAL_INDEX.grass

  // Fallow recovery: bare soil slowly regains fertility. Issue #3151.
  // Check every 4th column to stay cheap.
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x += 4) {
      const i = y * WORLD_W + x
      const tile = w.tiles[i]
      if (tile === dirtIdx || tile === mudIdx || tile === grassIdx) {
        if (w.soilNutrient[i] < 1.0) {
          w.soilNutrient[i] = Math.min(1.0, w.soilNutrient[i] + 0.00003)
        }
      }
    }
  }

  // Nutrient runoff: soil adjacent to water loses a small amount. Issue #3149.
  // Only runs every 5 minutes (300 ticks).
  if (tickCount % 300 !== 0) return
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      if (w.tiles[y * WORLD_W + x] !== waterIdx) continue
      // Adjacent soil tiles lose a small fraction to runoff
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = (x + dx + WORLD_W) % WORLD_W
          const ny = y + dy
          if (ny < 0 || ny >= WORLD_H) continue
          const ni = ny * WORLD_W + nx
          const ntile = w.tiles[ni]
          if (ntile === dirtIdx || ntile === mudIdx) {
            w.soilNutrient[ni] = Math.max(0, w.soilNutrient[ni] - 0.004)
          }
        }
      }
    }
  }
}

export function countByBlueprint(w: WorldState): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of w.creatures) counts[c.blueprintId] = (counts[c.blueprintId] ?? 0) + 1
  return counts
}

/**
 * Compute Whittaker biome classification for each of the 8 horizontal region
 * bands. Temperature is derived from the band's Y midpoint and seasonFactor;
 * precipitation is the mean moisture across the band. Runs every 300 ticks.
 * Issue #3377.
 */
export function updateBiomeZones(w: WorldState, tickCount: number, seasonFactor: number): void {
  if (tickCount % 300 !== 0) return
  w.biomeZones ??= []
  for (let r = 0; r < NUM_BIOME_REGIONS; r++) {
    const midY = r * BIOME_REGION_H + Math.floor(BIOME_REGION_H / 2)
    const baseTemp = Math.max(0, 1 - midY / WORLD_H)
    const co2Warming = (w.atmosphericCO2 ?? 0) * 0.3  // up to +0.3 temperature units at max CO2
    const temperature = Math.min(1, baseTemp * seasonFactor + co2Warming)

    // Sample moisture across every 4th column of every row in the band
    const rowStart = r * BIOME_REGION_H
    const rowEnd = Math.min(rowStart + BIOME_REGION_H, WORLD_H)
    let sum = 0, count = 0
    for (let y = rowStart; y < rowEnd; y++) {
      for (let x = 0; x < WORLD_W; x += 4) {
        sum += w.moisture[y * WORLD_W + x] ?? 0
        count++
      }
    }
    const precipitation = count > 0 ? sum / count : 0

    w.biomeZones[r] = { regionIndex: r, type: classifyBiome(temperature, precipitation), temperature, precipitation }
  }
}

const LAVA_CO2_EMIT = 0.000002    // per lava tile per tick
const PLANT_CO2_ABSORB = 0.00001  // per living plant creature per tick
const O2_PLANT_EMIT = 0.000008    // per living plant per tick-call
const O2_ANIMAL_CONSUME = 0.000003 // per living animal per tick-call
const O2_LAVA_CONSUME = 0.000001   // per sampled lava tile

/**
 * Accumulate atmospheric CO2 from lava tiles and deplete it via plant
 * photosynthesis. Also tracks O2: plants produce it, animals and lava consume
 * it. CO2 remains in [0, 1]; O2 in [0, 2] (1.0 = baseline).
 * Called every tick. Issues #3381, #3275, #3276.
 */
export function tickAtmosphericCO2(
  w: WorldState,
  tickCount: number,
  livingPlantCount: number
): void {
  if (tickCount % 60 !== 0) return  // update once per second
  w.atmosphericCO2 ??= 0
  // Count lava tiles (lazy: sample every 8th tile for performance)
  const lavaIdx = MATERIAL_INDEX.lava
  let lavaTiles = 0
  for (let i = 0; i < w.tiles.length; i += 8) {
    if (w.tiles[i] === lavaIdx) lavaTiles++
  }
  // Emit from lava, absorb by plants
  const emission = lavaTiles * LAVA_CO2_EMIT
  const absorption = livingPlantCount * PLANT_CO2_ABSORB
  w.atmosphericCO2 = Math.max(0, Math.min(1, w.atmosphericCO2 + emission - absorption))

  // O2 tracking: plants produce O2, animals and lava consume it. Issues #3275, #3276.
  const livingAnimalCount = w.creatures.length  // rough approximation (includes plants/animals)
  const o2Change = livingPlantCount * O2_PLANT_EMIT
               - livingAnimalCount * O2_ANIMAL_CONSUME
               - lavaTiles * O2_LAVA_CONSUME
  w.atmosphericO2 = Math.max(0, Math.min(2, (w.atmosphericO2 ?? 1.0) + o2Change))
}

const HYPHAE_RANGE = 20  // tiles — max fungal link distance
const COLONIZATION_CHANCE = 0.05  // probability per tick-60 cycle of forming a new link

/**
 * Spread mycorrhizal fungal hyphae between nearby compatible plants, building
 * the network graph in `w.mycorrhizalLinks`. Prunes dead links each cycle.
 * Runs every 60 ticks. Issue #3329.
 */
export function tickMycorrhizalNetwork(w: WorldState, tickCount: number, rng: Rng): void {
  if (tickCount % 60 !== 0) return

  // Collect all living mycorrhizal-partner plants
  const mycoPlants = w.creatures.filter(c => w.blueprints[c.blueprintId]?.mycorrhizalPartner)
  if (mycoPlants.length === 0) return

  w.mycorrhizalLinks ??= {}

  // Prune links where one end is dead
  const livingIds = new Set(w.creatures.map(c => c.id))
  for (const [idStr, neighbors] of Object.entries(w.mycorrhizalLinks)) {
    if (!livingIds.has(Number(idStr))) {
      delete w.mycorrhizalLinks[idStr]
      continue
    }
    w.mycorrhizalLinks[idStr] = neighbors.filter(n => livingIds.has(n))
    if (w.mycorrhizalLinks[idStr].length === 0) delete w.mycorrhizalLinks[idStr]
  }

  // Attempt new connections between nearby plants
  for (let i = 0; i < mycoPlants.length; i++) {
    const a = mycoPlants[i]
    for (let j = i + 1; j < mycoPlants.length; j++) {
      const b = mycoPlants[j]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (dist > HYPHAE_RANGE) continue
      // Check if already connected
      const aLinks = w.mycorrhizalLinks[String(a.id)]
      if (aLinks?.includes(b.id)) continue
      // Probabilistic colonization
      if (rng() > COLONIZATION_CHANCE) continue
      // Add bidirectional link
      w.mycorrhizalLinks[String(a.id)] ??= []
      w.mycorrhizalLinks[String(b.id)] ??= []
      w.mycorrhizalLinks[String(a.id)].push(b.id)
      w.mycorrhizalLinks[String(b.id)].push(a.id)
    }
  }

  // Nutrient sharing: well-fed plants export to hungry neighbors (20% fungal toll)
  const EXPORT_THRESHOLD = 0.3   // hunger below this → surplus to share
  const IMPORT_THRESHOLD = 0.6   // hunger above this → needs help
  const TRANSFER_RATE = 0.02     // hunger units transferred per link per tick-60 cycle
  const FUNGAL_TOLL = 0.20       // fraction lost to fungal intermediary

  const creatureById = new Map(w.creatures.map(c => [c.id, c]))
  for (const [idStr, neighbors] of Object.entries(w.mycorrhizalLinks)) {
    const donor = creatureById.get(Number(idStr))
    if (!donor || donor.hunger > EXPORT_THRESHOLD) continue  // not well-fed enough to share
    for (const neighborId of neighbors) {
      const recipient = creatureById.get(neighborId)
      if (!recipient || recipient.hunger < IMPORT_THRESHOLD) continue  // doesn't need help
      // Transfer nutrients: donor gets slightly hungrier, recipient gets less hungry
      const transferred = Math.min(TRANSFER_RATE, recipient.hunger - IMPORT_THRESHOLD)
      const donorCost = transferred / (1 - FUNGAL_TOLL)  // fungus takes 20% cut
      donor.hunger = Math.min(1, donor.hunger + donorCost)
      recipient.hunger = Math.max(0, recipient.hunger - transferred)
    }
  }
}

/**
 * True if there is at least one mycorrhizal-partner plant within HYPHAE_RANGE
 * tiles of the given position. Used to gate obligate species. Issue #3333.
 */
export function hasMycorrhizalPartnerNearby(w: WorldState, x: number, y: number): boolean {
  if (!w.mycorrhizalLinks) return false
  const linkedIds = new Set(Object.keys(w.mycorrhizalLinks).map(Number))
  for (const c of w.creatures) {
    if (!linkedIds.has(c.id)) continue
    if (Math.hypot(c.x - x, c.y - y) <= HYPHAE_RANGE) return true
  }
  return false
}

function classifyBiome(temp: number, precip: number): BiomeZoneType {
  if (temp < 0.1) return 'ice-cap'
  if (temp < 0.2) return 'tundra'
  if (temp < 0.35) return precip >= 0.2 ? 'boreal' : 'desert'
  if (temp < 0.75) return precip >= 0.3 ? 'temperate-forest' : 'temperate-grassland'
  // temp >= 0.75 (tropical)
  if (precip >= 0.5) return 'tropical-rainforest'
  if (precip >= 0.2) return 'tropical-savanna'
  return 'desert'
}

/**
 * Return the biome type at a given Y tile coordinate, or null if biome zones
 * have not been computed yet. O(1) lookup. Issue #3377.
 */
export function biomeZoneAt(w: WorldState, y: number): BiomeZoneType | null {
  if (!w.biomeZones) return null
  const r = Math.min(NUM_BIOME_REGIONS - 1, Math.floor(y / BIOME_REGION_H))
  return w.biomeZones[r]?.type ?? null
}

const ECOTONE_WIDTH = 8  // rows on each side of a band boundary that count as ecotone

/**
 * Returns all biome zones accessible at a given Y row, considering ecotone
 * blending. Within ECOTONE_WIDTH rows of a band boundary, both the primary
 * and adjacent zone are returned so that species from either side may establish.
 *
 * The zone list always begins with the primary zone for the row's band; adjacent
 * zones are appended only when the row is close to a boundary. This means the
 * result is a singleton in the interior of any band and a pair (or triple, if
 * exactly on a corner) near boundaries.
 *
 * Issue #3379.
 */
export function biomeZonesAtWithEcotone(w: WorldState, y: number): BiomeZoneType[] {
  if (!w.biomeZones || w.biomeZones.length === 0) return []
  const r = Math.min(NUM_BIOME_REGIONS - 1, Math.floor(y / BIOME_REGION_H))
  const primary = w.biomeZones[r]?.type
  if (!primary) return []
  const result: BiomeZoneType[] = [primary]
  const bandStart = r * BIOME_REGION_H
  const bandEnd = bandStart + BIOME_REGION_H
  // Near the top boundary of this band — blend with the band above (lower index = warmer).
  if (y - bandStart < ECOTONE_WIDTH && r > 0) {
    const adj = w.biomeZones[r - 1]?.type
    if (adj) result.push(adj)
  }
  // Near the bottom boundary of this band — blend with the band below (higher index = colder).
  if (bandEnd - y <= ECOTONE_WIDTH && r < NUM_BIOME_REGIONS - 1) {
    const adj = w.biomeZones[r + 1]?.type
    if (adj) result.push(adj)
  }
  return result
}

/**
 * True if the given Y row is in an ecotone — within ECOTONE_WIDTH rows of a
 * biome band boundary. Ecotone creatures from adjacent zones experience a mild
 * fitness reduction to model the cost of operating outside their primary niche.
 * Issue #3379.
 */
export function isInEcotone(w: WorldState, y: number): boolean {
  if (!w.biomeZones) return false
  const r = Math.min(NUM_BIOME_REGIONS - 1, Math.floor(y / BIOME_REGION_H))
  const bandStart = r * BIOME_REGION_H
  const bandEnd = bandStart + BIOME_REGION_H
  return (y - bandStart < ECOTONE_WIDTH) || (bandEnd - y <= ECOTONE_WIDTH)
}

/**
 * Decay web tiles over time and destroy them when adjacent to water (rain damage).
 * Each call (every 60 ticks) gives each web tile a 0.2% chance to become air.
 * Issue #3420.
 */
const WEB_DECAY_CHANCE = 0.002
export function tickWebDecay(w: WorldState, tickCount: number, rng: () => number): void {
  if (tickCount % 60 !== 0) return
  const webIdx = MATERIAL_INDEX.web
  const waterIdx = MATERIAL_INDEX.water
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] !== webIdx) continue
    const x = i % w.width
    const y = Math.floor(i / w.width)
    // Check for adjacent water (rain damage)
    let adjacentWater = false
    const offsets: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    for (const [dx, dy] of offsets) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= w.width || ny < 0 || ny >= w.height) continue
      if (w.tiles[ny * w.width + nx] === waterIdx) { adjacentWater = true; break }
    }
    if (adjacentWater || rng() < WEB_DECAY_CHANCE) {
      w.tiles[i] = AIR
    }
  }
}

/**
 * Simulate fire spreading and decay.
 *
 * Each call (every 30 ticks) processes all fire tiles: each has a 6% chance to
 * decay to ash, and a 15% chance per adjacent flammable non-liquid tile to
 * spread. This gives fire an expected lifetime of ~8 s at 60 fps and a
 * neighbourhood radius that grows over time before guttering out. Issue #3115.
 */
export function tickFire(
  w: WorldState,
  tickCount: number,
  rng: () => number,
  IS_FLAMMABLE: Uint8Array,
  IS_LIQUID: Uint8Array,
  fireMatIdx: number,
  ashMatIdx: number,
): void {
  if (tickCount % 30 !== 0) return
  if (fireMatIdx < 0 || ashMatIdx < 0) return

  const { width, height, tiles } = w

  // Collect fire tile indices to avoid modifying the array while iterating.
  const fireTiles: number[] = []
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === fireMatIdx) fireTiles.push(i)
  }

  for (const tileIdx of fireTiles) {
    const x = tileIdx % width
    const y = Math.floor(tileIdx / width)

    // 6% chance per 30-tick check to decay to ash (~8 s expected lifetime).
    if (rng() < 0.06) {
      setTile(w, x, y, ashMatIdx)
      continue
    }

    // Spread to adjacent flammable, non-liquid, non-fire tiles.
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    for (const [dx, dy] of dirs) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const nIdx = ny * width + nx
      const nMat = tiles[nIdx]
      if (IS_FLAMMABLE[nMat] && !IS_LIQUID[nMat] && nMat !== fireMatIdx && rng() < 0.15) {
        setTile(w, nx, ny, fireMatIdx)
      }
    }
  }
}

// Edge effect mask: marks tiles at habitat boundaries. Issue #3282.
export function tickEdgeMask(w: WorldState, tickCount: number): void {
  if (tickCount % 300 !== 0) return
  if (!w.edgeMask) w.edgeMask = new Uint8Array(w.tiles.length)
  for (let i = 0; i < w.tiles.length; i++) {
    const t = w.tiles[i]
    // check 4-connected neighbors
    const x = i % w.width, y = Math.floor(i / w.width)
    let isEdge = 0
    if (x > 0 && w.tiles[i - 1] !== t) isEdge = 1
    else if (x < w.width - 1 && w.tiles[i + 1] !== t) isEdge = 1
    else if (y > 0 && w.tiles[i - w.width] !== t) isEdge = 1
    else if (y < w.height - 1 && w.tiles[i + w.width] !== t) isEdge = 1
    w.edgeMask[i] = isEdge
  }
}

// Corridor mask: thin habitat strips connecting patches. Issue #3283.
export function tickCorridorMask(w: WorldState, tickCount: number): void {
  if (tickCount % 600 !== 0) return
  if (!w.corridorMask) w.corridorMask = new Uint8Array(w.tiles.length)
  for (let i = 0; i < w.tiles.length; i++) {
    const t = w.tiles[i]
    if (t === AIR) { w.corridorMask[i] = 0; continue }  // air
    const x = i % w.width, y = Math.floor(i / w.width)
    // Count horizontal and vertical same-type neighbors (range 1)
    let hCount = 0, vCount = 0
    for (let d = 1; d <= 3; d++) {
      if (x - d >= 0 && w.tiles[i - d] === t) hCount++
      if (x + d < w.width && w.tiles[i + d] === t) hCount++
      if (y - d >= 0 && w.tiles[i - d * w.width] === t) vCount++
      if (y + d < w.height && w.tiles[i + d * w.width] === t) vCount++
    }
    // A corridor tile has more neighbors in one direction than the other (narrow strip)
    const isCorridor = (hCount <= 2 && vCount >= 4) || (vCount <= 2 && hCount >= 4)
    w.corridorMask[i] = isCorridor ? 1 : 0
  }
}

export { AIR }

// ---------------------------------------------------------------------------
// Soil age — ecological succession substrate (Issues #3124, #3125)
// ---------------------------------------------------------------------------

/**
 * Increment soil age on stable solid surface tiles and reset it on deadly tiles.
 *
 * Runs every 60 ticks (~once per second). Processes every 6th column per call
 * (staggered by tickCount) for performance, completing a full world sweep in
 * approximately 6 seconds. Deadly tiles (lava/fire) reset soil age to 0,
 * modelling disturbance-driven succession re-set.
 *
 * Issues #3124 (soil age field) and #3125 (disturbance reset).
 */
export function tickSoilAge(w: WorldState, tickCount: number): void {
  if (tickCount % 60 !== 0) return
  w.soilAge ??= new Float32Array(w.width * w.height)
  const { width, height, tiles, soilAge } = w
  const colOffset = Math.floor(tickCount / 60) % 6
  for (let x = colOffset; x < width; x += 6) {
    for (let y = 0; y < height; y++) {
      const idx = y * width + x
      const mat = tiles[idx]
      if (IS_DEADLY[mat]) {
        soilAge[idx] = 0  // lava/fire resets succession
      } else if (IS_SOLID[mat] && !IS_LIQUID[mat]) {
        // Only age surface tiles — solid tile with non-solid above it
        const aboveIdx = y > 0 ? (y - 1) * width + x : -1
        if (aboveIdx >= 0 && !IS_SOLID[tiles[aboveIdx]]) {
          soilAge[idx] = Math.min(10000, soilAge[idx] + 1)
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Keystone species detection (Issue #3122)
// ---------------------------------------------------------------------------

/**
 * Identify keystone species: blueprints that 2+ other species in the ecosystem
 * depend on (via diet.eats tags or diet.fears tags). A species is "depended on"
 * when another species' eats or fears list matches one of its tags.
 *
 * Runs every 3000 ticks (~50 seconds). Results stored in
 * WorldState.keystoneSpeciesIds. Issue #3122.
 */
export function updateKeystoneSpecies(w: WorldState, tickCount: number): void {
  if (tickCount % 3000 !== 0) return
  const dependencyCount = new Map<string, number>()
  const bpList = Object.values(w.blueprints)
  for (const bp of bpList) {
    const checkedIds = new Set<string>()
    const allDeps = [...bp.diet.eats, ...bp.diet.fears]
    for (const tag of allDeps) {
      for (const other of bpList) {
        if (other.id === bp.id) continue
        if (checkedIds.has(other.id)) continue
        if (other.tags.includes(tag)) {
          checkedIds.add(other.id)
          dependencyCount.set(other.id, (dependencyCount.get(other.id) ?? 0) + 1)
        }
      }
    }
  }
  const keystones = new Set<string>()
  for (const [id, count] of dependencyCount) {
    if (count >= 2) keystones.add(id)
  }
  w.keystoneSpeciesIds = keystones
}

// ---------------------------------------------------------------------------
// Acid rain from sulfur pollution (Issue #3279)
// ---------------------------------------------------------------------------

/**
 * Simulates atmospheric sulfur accumulation from lava tiles and the resulting
 * acid-rain effect on water and moist-soil pH. Marble/limestone tiles buffer.
 */
export function tickAcidRain(w: WorldState, tickCount: number, _rng: () => number): void {
  if (tickCount % 60 !== 0) return

  // Initialise pH grid to neutral if not yet created
  if (!w.tilePH) {
    w.tilePH = new Float32Array(w.tiles.length).fill(7.0)
  }

  // --- Step 1: Lava tiles emit sulfur ---
  let sulfurEmitted = 0
  let limestoneCount = 0
  for (let i = 0; i < w.tiles.length; i++) {
    const matId = MATERIAL_BY_INDEX[w.tiles[i]]?.id
    if (matId === 'lava') sulfurEmitted += 0.0004
    // `marble` is the only carbonate in the material table — the 'limestone'
    // this used to also test is not a material and never matched.
    if (matId === 'marble') limestoneCount++
  }

  // --- Step 2: Update atmospheric sulfur (decays naturally, buffered by limestone) ---
  const bufferFactor = Math.max(0, 1 - limestoneCount * 0.00005)
  w.atmosphericSulfurPpm = Math.max(
    0,
    Math.min(2.0, (w.atmosphericSulfurPpm ?? 0) * 0.98 * bufferFactor + sulfurEmitted)
  )

  // --- Step 3: Acid rain — lower pH of water and moist tiles proportional to sulfur ---
  const sulfur = w.atmosphericSulfurPpm ?? 0
  if (sulfur < 0.1) return  // not enough sulfur for significant acid rain

  for (let i = 0; i < w.tiles.length; i++) {
    const matId = MATERIAL_BY_INDEX[w.tiles[i]]?.id
    // 'salt-water' is not a material; `water` is the only liquid water here.
    const isWater = matId === 'water'
    const isMoist = (w.moisture?.[i] ?? 0) > 0.5

    if (!isWater && !isMoist) continue

    // Acid deposition proportional to sulfur level
    const acidDeposit = sulfur * 0.15
    w.tilePH[i] = Math.max(3.0, w.tilePH[i] - acidDeposit)

    // Limestone/marble adjacency buffers pH recovery
    const x = i % w.width, y = Math.floor(i / w.width)
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
      const ni = (y + dy) * w.width + (x + dx)
      if (ni >= 0 && ni < w.tiles.length) {
        const nMat = MATERIAL_BY_INDEX[w.tiles[ni]]?.id
        if (nMat === 'marble') {
          w.tilePH[i] = Math.min(7.0, w.tilePH[i] + 0.3)
          break
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Water cycle — evaporation, cloud drift, precipitation, groundwater (#3110–#3114)
// ---------------------------------------------------------------------------

/**
 * Evaporation: water tiles adjacent to air/cloud above slowly emit cloud vapor.
 *
 * Runs every 90 ticks. Samples a random row and checks every 4th column so the
 * scan stays cheap (~width/4 tiles per pass). Each eligible water tile has a 3%
 * chance of converting the tile above it to cloud. Issue #3110.
 */
export function tickEvaporation(w: WorldState, tickCount: number, rng: () => number): void {
  if (tickCount % 90 !== 0) return
  const { width, height, tiles } = w
  const waterIdx = MATERIAL_INDEX['water'] ?? -1
  const cloudIdx = MATERIAL_INDEX['cloud'] ?? -1
  const airIdx = MATERIAL_INDEX['air'] ?? -1
  if (waterIdx < 0 || cloudIdx < 0) return

  const row = Math.floor(rng() * height)
  if (row === 0) return
  for (let x = 0; x < width; x += 4) {
    const tileI = row * width + x
    if (tiles[tileI] !== waterIdx) continue
    const aboveI = (row - 1) * width + x
    const above = tiles[aboveI]
    if ((above === airIdx || above === cloudIdx) && rng() < 0.03) {
      w.tiles[aboveI] = cloudIdx
    }
  }
}

/**
 * Cloud drift: cloud tiles move laterally with a wind bias and precipitate when
 * they form dense clusters.
 *
 * Runs every 120 ticks. Uses w.windX if present, else a slight rightward bias.
 * When a cloud tile has 3+ cloud neighbors it has an 8% chance to precipitate —
 * dropping rain or snow (based on altitude) on the first air tile below the
 * cloud column. Issues #3111, #3112.
 */
export function tickCloudDrift(
  w: WorldState,
  tickCount: number,
  rng: () => number,
  setTileFn: (w: WorldState, x: number, y: number, matIdx: number) => void,
  airMatIdx: number,
  cloudMatIdx: number,
  waterMatIdx: number,
  snowMatIdx: number,
): void {
  if (tickCount % 120 !== 0) return
  const { width, height, tiles } = w
  if (cloudMatIdx < 0) return

  // Wind bias: use w.windX if available, else slight rightward drift
  const windBias = (w as unknown as { windX?: number }).windX ?? 0.1

  // Collect cloud tile indices before mutation
  const cloudTiles: number[] = []
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === cloudMatIdx) cloudTiles.push(i)
  }

  for (const tileIdx of cloudTiles) {
    const x = tileIdx % width
    const y = Math.floor(tileIdx / width)

    // Lateral drift based on wind direction
    const drift = windBias > 0 ? 1 : windBias < 0 ? -1 : (rng() < 0.5 ? 1 : -1)
    const nx = x + drift
    if (nx >= 0 && nx < width) {
      const nIdx = y * width + nx
      if (tiles[nIdx] === airMatIdx) {
        setTileFn(w, x, y, airMatIdx)
        setTileFn(w, nx, y, cloudMatIdx)
      }
    }

    // Precipitation: count cloud neighbors; dense clusters rain
    let cloudNeighbors = 0
    for (let cy = -1; cy <= 1; cy++) {
      for (let cx = -1; cx <= 1; cx++) {
        if (cx === 0 && cy === 0) continue
        const cnx = x + cx
        const cny = y + cy
        if (cnx >= 0 && cnx < width && cny >= 0 && cny < height) {
          if (tiles[cny * width + cnx] === cloudMatIdx) cloudNeighbors++
        }
      }
    }

    if (cloudNeighbors >= 3 && rng() < 0.08) {
      // Find first non-cloud tile below
      let rainY = y + 1
      while (rainY < height && tiles[rainY * width + x] === cloudMatIdx) rainY++
      if (rainY < height && tiles[rainY * width + x] === airMatIdx) {
        // Top 20% of world counts as cold → snow; otherwise rain
        const cold = y < height * 0.2
        const precipMat = cold && snowMatIdx >= 0 ? snowMatIdx : waterMatIdx
        if (precipMat >= 0) {
          setTileFn(w, x, y, airMatIdx)       // cloud dissipates
          setTileFn(w, x, rainY, precipMat)   // precipitation falls below
          // Boost moisture at landing tile
          if (w.moisture) {
            const mIdx = rainY * width + x
            w.moisture[mIdx] = Math.min(1, w.moisture[mIdx] + 0.1)
          }
        }
      }
    }
  }
}

/**
 * Groundwater table: subsurface moisture seeps upward through soil from water
 * tiles below, keeping lowlands moist even without surface water.
 *
 * Runs every 150 ticks. Samples every 4th column for performance. Initializes
 * w.groundwater lazily. Issue #3114.
 */
export function tickGroundwater(w: WorldState, tickCount: number, isLiquid: Uint8Array): void {
  if (tickCount % 150 !== 0) return
  const { width, height, tiles, moisture } = w
  if (!moisture) return

  // Lazy-initialize groundwater array
  if (!w.groundwater) {
    w.groundwater = new Float32Array(width * height)
  }
  const gw = w.groundwater

  for (let y = 1; y < height; y++) {
    for (let x = 0; x < width; x += 4) {
      const tileI = y * width + x
      const belowI = y + 1 < height ? (y + 1) * width + x : -1

      if (belowI < 0) continue

      // Seep moisture upward from liquid tiles below into non-liquid tiles
      if (isLiquid[tiles[belowI]] === 1 && isLiquid[tiles[tileI]] !== 1) {
        moisture[tileI] = Math.min(1, moisture[tileI] + 0.003)
        gw[tileI] = Math.min(1, gw[tileI] + 0.003)
      }

      // Groundwater level decays slowly
      if (gw[tileI] > 0) {
        gw[tileI] = Math.max(0, gw[tileI] - 0.001)
      }
    }
  }
}

/**
 * Bone slow decomposition (#3103): bone tiles near moisture slowly convert to soil
 * and deposit nutrients, modelling the long-term breakdown of skeletal material.
 *
 * Runs every 300 ticks. Samples 20 random tiles looking for bone. Each bone tile
 * in moist conditions has a 3% chance to convert to soil with a +0.2 nutrient boost.
 */
export function tickBoneDecomposition(w: WorldState, tickCount: number, rng: () => number): void {
  if (tickCount % 300 !== 0) return
  if (!w.soilNutrient) w.soilNutrient = new Float32Array(w.width * w.height)

  const { width, height, tiles, moisture } = w
  const boneIdx = MATERIAL_INDEX['bone'] ?? -1
  const dirtIdx = MATERIAL_INDEX['dirt'] ?? -1
  if (boneIdx < 0) return

  for (let i = 0; i < 20; i++) {
    const x = Math.floor(rng() * width)
    const y = Math.floor(rng() * height)
    const tileI = y * width + x

    if (tiles[tileI] !== boneIdx) continue

    const moistureHere = moisture?.[tileI] ?? 0
    if (moistureHere < 0.2) continue // bone needs moisture to decompose

    if (rng() < 0.03) {
      // Convert bone tile to dirt (if dirt exists) and add nutrients.
      if (dirtIdx >= 0) {
        w.tiles[tileI] = dirtIdx
      }
      w.soilNutrient[tileI] = Math.min(1, w.soilNutrient[tileI] + 0.2)
    }
  }
}


/**
 * Stochastic weather state machine: transitions between clear, rain, drought,
 * and storm states, biased by season. Applies moisture and tile effects each
 * 60-tick window. Issues #3094, #3095, #3096, #3097.
 */
export function tickWeather(w: WorldState, tickCount: number, rng: () => number): void {
  // Initialize
  if (w.weatherState === undefined) w.weatherState = 'clear'
  if (w.weatherTimer === undefined) w.weatherTimer = 0

  w.weatherTimer -= 1

  const seasonFactor =
    TUNING.seasonAmplitude > 0
      ? 1 + TUNING.seasonAmplitude * Math.sin((2 * Math.PI * w.elapsed) / (TUNING.seasonPeriod * 60))
      : 1
  const isSummer = seasonFactor > 1.1
  const isWinter = seasonFactor < 0.9

  // Apply ongoing weather effects every 60 ticks
  if (tickCount % 60 === 0) {
    if (w.weatherState === 'rain') {
      // Boost moisture on 30 random tiles per check
      for (let i = 0; i < 30; i++) {
        const rx = Math.floor(rng() * w.width)
        const ry = Math.floor(rng() * w.height)
        const idx = ry * w.width + rx
        if (w.moisture[idx] < 1) w.moisture[idx] = Math.min(1, w.moisture[idx] + 0.05)
      }
    } else if (w.weatherState === 'drought') {
      // Drain moisture from 15 random non-water tiles
      for (let i = 0; i < 15; i++) {
        const rx = Math.floor(rng() * w.width)
        const ry = Math.floor(rng() * w.height)
        const idx = ry * w.width + rx
        if (!IS_LIQUID[w.tiles[idx]] && w.moisture[idx] > 0) {
          w.moisture[idx] = Math.max(0, w.moisture[idx] - 0.02)
        }
      }
    } else if (w.weatherState === 'storm') {
      // Lightning: 5% chance per check to convert a random exposed surface tile to ash
      if (rng() < 0.05) {
        const lx = Math.floor(rng() * w.width)
        const ly = Math.floor(rng() * w.height)
        const lIdx = ly * w.width + lx
        if (!IS_SOLID[w.tiles[lIdx]] && !IS_LIQUID[w.tiles[lIdx]]) {
          setTile(w, lx, ly, MATERIAL_INDEX.ash)
        }
      }
      // Storms also bring rain — boost moisture on 10 random tiles
      for (let i = 0; i < 10; i++) {
        const rx = Math.floor(rng() * w.width)
        const ry = Math.floor(rng() * w.height)
        const idx = ry * w.width + rx
        if (w.moisture[idx] < 1) w.moisture[idx] = Math.min(1, w.moisture[idx] + 0.03)
      }
    }
  }

  // Weather transition (only when timer expires)
  if (w.weatherTimer > 0) return

  const prev = w.weatherState
  const r = rng()

  if (prev === 'clear') {
    if (isSummer && r < 0.08) w.weatherState = 'drought'
    else if (r < 0.12) w.weatherState = 'rain'
    else if (r < 0.04) w.weatherState = 'storm'
    // else stay clear
  } else if (prev === 'rain') {
    if (r < 0.45) w.weatherState = 'clear'
    else if (r < 0.55) w.weatherState = 'storm'
    // else continue rain
  } else if (prev === 'drought') {
    if (isWinter || r < 0.35) w.weatherState = 'clear'
    else if (r < 0.40) w.weatherState = 'rain'
    // else continue drought
  } else if (prev === 'storm') {
    if (r < 0.55) w.weatherState = 'rain'
    else if (r < 0.80) w.weatherState = 'clear'
    // else continue storm
  }

  // Set next transition timer: 600–2400 ticks (10–40 seconds at 60fps)
  w.weatherTimer = 600 + Math.floor(rng() * 1800)
}

/**
 * Mineral vein exposure: periodically converts exposed stone tiles to ore deposits
 * and applies local effects (water chemistry, plant nutrition). Issue #3179.
 *
 * Runs every 1200 ticks (every ~20 seconds of sim time at 60 ticks/s).
 * Uses a fixed random probe rather than a full scan.
 */
export function tickMineralVeins(w: WorldState, tickCount: number, rng: () => number): void {
  if (tickCount % 1200 !== 0) return
  const stoneIdx = MATERIAL_INDEX.stone
  const waterIdx = MATERIAL_INDEX.water

  // Ore materials and their local nutrient effects
  const ores: Array<{ id: string; nutrientBoost: number; pHShift: number }> = [
    { id: 'iron', nutrientBoost: -0.02, pHShift: -0.3 },   // iron → acidifies water, reduces fertility
    { id: 'gold', nutrientBoost: 0.05, pHShift: 0 },       // gold → inert, mild fertility boost
    { id: 'gem', nutrientBoost: 0.03, pHShift: 0.1 },      // gem crystal → slightly alkaline
    { id: 'crystal', nutrientBoost: 0.04, pHShift: 0 },    // crystal → enhances plant growth
  ]

  // Probe a random column, look for exposed stone in the upper-middle depth
  // (not at the very surface, which is already well-modelled)
  const tx = Math.floor(rng() * WORLD_W)
  const startY = Math.floor(WORLD_H * 0.25)
  const endY = Math.floor(WORLD_H * 0.75)

  for (let ty = startY; ty < endY; ty++) {
    const ti = ty * WORLD_W + tx
    if (w.tiles[ti] !== stoneIdx) continue

    // Only expose ore if adjacent to air or liquid (crack in the rock)
    const above = ty > 0 ? w.tiles[(ty - 1) * WORLD_W + tx] : 0
    const hasGap = !IS_SOLID[above] || (ty < WORLD_H - 1 && !IS_SOLID[w.tiles[(ty + 1) * WORLD_W + tx]])
    if (!hasGap) continue

    // Small chance to convert stone to ore (1 in 8 when conditions met)
    if (rng() > 0.125) break

    const ore = ores[Math.floor(rng() * ores.length)]
    setTile(w, tx, ty, MATERIAL_INDEX[ore.id as keyof typeof MATERIAL_INDEX])

    // Apply effects to adjacent water tiles (chemistry) and caveNutrient (plant growth)
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = (tx + dx + WORLD_W) % WORLD_W
        const ny = ty + dy
        if (ny < 0 || ny >= WORLD_H) continue
        const ni = ny * WORLD_W + nx

        if (w.tiles[ni] === waterIdx) {
          // pH effect on water chemistry (uses existing tilePH system if present)
          if (w.tilePH && ore.pHShift !== 0) {
            w.tilePH[ni] = Math.max(0, Math.min(14, (w.tilePH[ni] ?? 7) + ore.pHShift * 0.1))
          }
        }

        // Plant nutrition effect via caveNutrient (affects soil fertility)
        if (ore.nutrientBoost !== 0 && w.caveNutrient) {
          w.caveNutrient[ni] = Math.max(0, Math.min(1, (w.caveNutrient[ni] ?? 0) + ore.nutrientBoost * 0.05))
        }
      }
    }
    break
  }
}
