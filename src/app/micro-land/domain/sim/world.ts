/** World construction, tile access, and spawning. */
import { artSize, canEat } from '@/app/micro-land/domain/blueprint'
import { BUILTIN_CREATURES } from '@/app/micro-land/domain/config/creatures'
import {
  AIR,
  IS_DEADLY,
  IS_FERTILE,
  IS_LIQUID,
  IS_SOLID,
  MATERIAL_INDEX,
} from '@/app/micro-land/domain/config/materials'
import { DEFAULT_THEME, THEME_BY_ID, type Theme } from '@/app/micro-land/domain/config/themes'
import {
  MAX_CREATURES,
  PLANT_FLOOR,
  SEED_RAIN_INTERVAL,
  WORLD_H,
  WORLD_W,
} from '@/app/micro-land/domain/constants'
import type { Creature, CreatureBlueprint, MaterialId, WorldState } from '@/app/micro-land/domain/types'

import { type Rng, makeRng } from './prng'

export function createWorld(seed = 1337): WorldState {
  const tiles = new Uint8Array(WORLD_W * WORLD_H)
  const grain = new Uint8Array(WORLD_W * WORLD_H)
  const rng = makeRng(seed)
  for (let i = 0; i < grain.length; i++) grain[i] = Math.floor(rng() * 256)

  const blueprints: Record<string, CreatureBlueprint> = {}
  for (const bp of BUILTIN_CREATURES) blueprints[bp.id] = bp

  return {
    width: WORLD_W,
    height: WORLD_H,
    tiles,
    grain,
    creatures: [],
    particles: [],
    blueprints,
    nextCreatureId: 1,
    elapsed: 0,
    seed,
    flowPhase: 0,
    natives: [],
    nextSeedRain: 0,
  }
}

// ---------------------------------------------------------------------------
// Tile access
// ---------------------------------------------------------------------------

export function idx(x: number, y: number): number {
  return y * WORLD_W + x
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H
}

/** Material index at a tile. Out of bounds reads as stone — the world is a box. */
export function tileAt(w: WorldState, x: number, y: number): number {
  if (!inBounds(x, y)) return MATERIAL_INDEX.stone
  return w.tiles[y * WORLD_W + x]
}

/** Out of bounds counts as solid, so nothing can wander out of the world. */
export function solidAt(w: WorldState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return true
  return IS_SOLID[w.tiles[y * WORLD_W + x]] === 1
}

export function liquidAt(w: WorldState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false
  return IS_LIQUID[w.tiles[y * WORLD_W + x]] === 1
}

export function deadlyAt(w: WorldState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false
  return IS_DEADLY[w.tiles[y * WORLD_W + x]] === 1
}

export function fertileAt(w: WorldState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false
  return IS_FERTILE[w.tiles[y * WORLD_W + x]] === 1
}

export function setTile(w: WorldState, x: number, y: number, mat: number): void {
  if (!inBounds(x, y)) return
  w.tiles[y * WORLD_W + x] = mat
}

/**
 * Does a box of tiles overlap anything solid?
 * Used for both movement collision and finding somewhere to put a creature.
 */
export function boxHitsSolid(
  w: WorldState,
  x: number,
  y: number,
  bw: number,
  bh: number
): boolean {
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

  for (let top = Math.floor(y); top <= Math.floor(y) + maxDrop; top++) {
    if (top + bh > WORLD_H) return null
    const groundRow = top + bh

    let footing = false
    for (let tx = x0; tx <= x1; tx++) {
      if (!solidAt(w, tx, groundRow)) continue
      footing = opts.requireFertile ? fertileAt(w, tx, groundRow) : true
      if (footing) break
    }
    if (!footing) continue

    // Found a floor. It only counts if the body itself fits above it.
    if (boxHitsSolid(w, x, top, bw, bh)) return null
    return top
  }
  return null
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

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

export function registerBlueprint(w: WorldState, bp: CreatureBlueprint): void {
  w.blueprints[bp.id] = bp
  // Summoned creatures become native too, so the world can bring them back.
  if (!w.natives.includes(bp.id)) w.natives.push(bp.id)
}

/** Make a creature at an exact spot, no questions asked. */
export function spawnCreature(
  w: WorldState,
  bp: CreatureBlueprint,
  x: number,
  y: number
): Creature | null {
  if (w.creatures.length >= MAX_CREATURES) return null
  if (!w.blueprints[bp.id]) w.blueprints[bp.id] = bp

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
    digProgress: 0,
    tilesDug: 0,
  }
  w.creatures.push(creature)
  return creature
}

/**
 * Find somewhere this creature could actually survive and put it there.
 *
 * Plants want fertile ground under them, fish want water, walkers want a floor.
 * Tries random spots and falls back to the requested position so a summon never
 * silently does nothing.
 */
export function spawnSomewhereSensible(
  w: WorldState,
  bp: CreatureBlueprint,
  rng: Rng,
  near?: { x: number; y: number; radius: number }
): Creature | null {
  const { w: bw, h: bh } = artSize(bp)
  const wantsLiquid = bp.move.kind === 'swim' || bp.habitat.needs?.includes('water')
  const isPlant = bp.move.kind === 'root'

  for (let attempt = 0; attempt < 120; attempt++) {
    let x: number
    let y: number
    if (near) {
      const a = rng() * Math.PI * 2
      const r = rng() * near.radius
      x = near.x + Math.cos(a) * r
      y = near.y + Math.sin(a) * r
    } else {
      x = rng() * (WORLD_W - bw)
      y = rng() * (WORLD_H - bh)
    }
    x = Math.max(0, Math.min(WORLD_W - bw, x))
    y = Math.max(0, Math.min(WORLD_H - bh, y))

    if (boxHitsSolid(w, x, y, bw, bh)) continue

    const wet = boxLiquidFraction(w, x, y, bw, bh)
    if (wantsLiquid && wet < 0.6) continue
    if (!wantsLiquid && bp.habitat.drowns && wet > 0.3) continue
    if (boxDeadlyMaterial(w, x, y, bw, bh) !== null) {
      const immune = bp.body.immuneTo.length > 0
      if (!immune) continue
    }

    if (isPlant || bp.move.kind === 'walk') {
      // Fall from wherever we landed onto the first floor beneath it. Scanning
      // down rather than demanding a floor at exactly this height is what makes
      // a random point in open sky a usable spawn instead of a wasted attempt.
      const settled = settleOnGround(w, x, y, bw, bh, { requireFertile: isPlant })
      if (settled === null) continue
      y = settled
      // Re-check the surroundings at the resting spot, not where we aimed.
      if (bp.habitat.drowns && boxLiquidFraction(w, x, y, bw, bh) > 0.3) continue
      if (
        boxDeadlyMaterial(w, x, y, bw, bh) !== null &&
        bp.body.immuneTo.length === 0
      ) {
        continue
      }
    }

    return spawnCreature(w, bp, x, y)
  }

  // Nowhere ideal. Drop it wherever the player asked and let physics sort it out.
  if (near && !boxHitsSolid(w, near.x, near.y, bw, bh)) {
    return spawnCreature(w, bp, near.x - bw / 2, near.y - bh / 2)
  }
  return null
}

/** Seed a theme's resident population. */
export function seedStarters(w: WorldState, themeId: string, rng: Rng): void {
  const theme = THEME_BY_ID[themeId]
  if (!theme) return
  for (const entry of theme.starters) {
    const bp = w.blueprints[entry.id]
    if (!bp) continue
    if (!w.natives.includes(bp.id)) w.natives.push(bp.id)
    for (let i = 0; i < entry.count; i++) spawnSomewhereSensible(w, bp, rng)
  }
}

export function clearCreatures(w: WorldState): void {
  w.creatures.length = 0
  w.particles.length = 0
}

/**
 * Let the world heal itself.
 *
 * Populations here are small enough that an oscillation eventually touches zero,
 * and zero is absorbing: plants only come from plants, hoppers only from
 * hoppers. Without this, every world converges on the same dead end — a field of
 * whatever happened to be last standing — and the only cure is a restart.
 *
 * Real habitats recover because the frame we're watching isn't the whole world:
 * seed blows in, animals wander over the hill. This is that edge, and it obeys
 * two rules that keep it honest:
 *   - Nothing returns to an empty world. Pressing Empty means empty.
 *   - A predator only returns when there is something alive for it to eat, so
 *     this can never conjure a species straight back into starving to death.
 */
export function repopulate(w: WorldState, rng: Rng): void {
  if (w.elapsed < w.nextSeedRain) return
  w.nextSeedRain = w.elapsed + SEED_RAIN_INTERVAL
  if (w.creatures.length === 0 || w.natives.length === 0) return

  const counts: Record<string, number> = {}
  let plants = 0
  for (const c of w.creatures) {
    counts[c.blueprintId] = (counts[c.blueprintId] ?? 0) + 1
    if (w.blueprints[c.blueprintId]?.move.kind === 'root') plants++
  }

  // Plants first — everything else is downstream of them.
  if (plants < PLANT_FLOOR) {
    const plantIds = w.natives.filter((id) => w.blueprints[id]?.move.kind === 'root')
    if (plantIds.length > 0) {
      const bp = w.blueprints[plantIds[Math.floor(rng() * plantIds.length)]]
      if (bp) spawnSomewhereSensible(w, bp, rng)
      return
    }
  }

  // Then any native that has died out and now has something to eat again.
  // Plants count here too: one plant species thriving is not a reason for the
  // others to stay extinct, and a grazer too small to eat the survivor depends
  // on the little ones coming back.
  const candidates = w.natives.filter((id) => {
    if (counts[id]) return false
    const bp = w.blueprints[id]
    if (!bp) return false
    if (bp.move.kind === 'root' || bp.diet.eats.length === 0) return true
    return w.creatures.some((c) => {
      const other = w.blueprints[c.blueprintId]
      return other ? canEat(bp, other) : false
    })
  })
  if (candidates.length === 0) return

  const bp = w.blueprints[candidates[Math.floor(rng() * candidates.length)]]
  if (bp) {
    spawnSomewhereSensible(w, bp, rng)
    spawnSomewhereSensible(w, bp, rng)
  }
}

export function countByBlueprint(w: WorldState): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of w.creatures) counts[c.blueprintId] = (counts[c.blueprintId] ?? 0) + 1
  return counts
}

export { AIR }
