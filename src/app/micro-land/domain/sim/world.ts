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
      if (IS_SOLID[tileIdx] === 1) light *= 0.25
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
    const temperature = Math.min(1, baseTemp * seasonFactor)

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

export { AIR }
