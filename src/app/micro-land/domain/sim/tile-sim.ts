/**
 * Falling-sand tile physics.
 *
 * One bottom-up pass per step: powders pile, liquids flow and level out, lava
 * quenches into obsidian where it meets water, ice and snow melt near heat,
 * acid eats through whatever it is sitting on. A `moved` bitmask stops a tile
 * that just fell from being processed again in the same pass (which would make
 * everything drop at light speed).
 *
 * Scan direction alternates each pass — without that, liquids visibly drift
 * left forever.
 */
import {
  IS_ACID_PROOF,
  IS_LIQUID,
  IS_POWDER,
  IS_SOLID,
  MATERIAL_BY_INDEX,
  MATERIAL_INDEX,
} from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import type { WorldState } from '@/app/micro-land/domain/types'

const AIR = MATERIAL_INDEX.air
const WATER = MATERIAL_INDEX.water
const LAVA = MATERIAL_INDEX.lava
const STONE = MATERIAL_INDEX.stone
const OBSIDIAN = MATERIAL_INDEX.obsidian
const ACID = MATERIAL_INDEX.acid
const SAP = MATERIAL_INDEX.sap

/** Anything that turns to water next to lava — ice, snow. */
const MELTS: Uint8Array = new Uint8Array(MATERIAL_BY_INDEX.map(m => (m.melts ? 1 : 0)))

/**
 * Chance an acid tile eats its neighbour on a pass it is allowed to act, 0..1.
 *
 * Low on purpose. Acid that dissolves instantly just deletes terrain; acid that
 * takes a few seconds to chew through a wall is something you watch.
 */
const ACID_BITE = 0.22

/** Reused across passes — the grid never changes size. */
const moved = new Uint8Array(WORLD_W * WORLD_H)

/** How far a liquid can slide sideways in one pass looking for a way down. */
const FLOW_REACH = 4

export function tickTiles(w: WorldState): void {
  moved.fill(0)
  const tiles = w.tiles
  w.flowPhase++
  const phase = w.flowPhase
  const leftToRight = (phase & 1) === 0
  // Lava is viscous: it only gets to move on every other pass.
  const lavaMoves = (phase & 1) === 0
  // Sap is far thicker than lava — it creeps.
  const sapMoves = (phase & 7) === 0

  for (let y = WORLD_H - 1; y >= 0; y--) {
    const rowStart = y * WORLD_W
    for (let i = 0; i < WORLD_W; i++) {
      const x = leftToRight ? i : WORLD_W - 1 - i
      const at = rowStart + x
      if (moved[at]) continue

      const mat = tiles[at]
      if (mat === AIR) continue

      if (MELTS[mat] === 1) {
        if (touchesHeat(tiles, x, y)) {
          tiles[at] = WATER
          continue
        }
        // Ice is a wall and has nothing else to do this pass. Snow is a powder,
        // so it still has to fall — this used to `continue` for both, and snow
        // hung in mid-air wherever it was painted.
        if (IS_POWDER[mat] !== 1) continue
      }

      const isPowder = IS_POWDER[mat] === 1
      const isLiquid = IS_LIQUID[mat] === 1
      if (!isPowder && !isLiquid) continue

      if (mat === LAVA) {
        // Quenching wins over movement — a lava tile touching water sets solid.
        if (quench(tiles, x, y, at)) continue
        if (!lavaMoves) continue
      }

      if (mat === ACID) {
        // Eating a wall uses the acid up, so there's nothing left to move.
        if (corrode(tiles, x, y, at, phase)) continue
      }

      if (mat === SAP && !sapMoves) continue

      if (isPowder) {
        stepPowder(tiles, x, y, at, leftToRight)
      } else {
        stepLiquid(tiles, x, y, at, mat, leftToRight)
      }
    }
  }
}

/**
 * Cheap deterministic noise from a tile and the pass number.
 *
 * The tile sim has no RNG of its own and shouldn't gain one — it has to give
 * the same result for the same world on every machine, including the headless
 * harness. Hashing the coordinates gets randomness without any state.
 */
function hash3(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function cell(x: number, y: number): number {
  return y * WORLD_W + x
}

function passableForPowder(mat: number): boolean {
  // Powders sink through anything that isn't a wall — air, liquid, cloud alike.
  return IS_SOLID[mat] !== 1
}

function swap(tiles: Uint8Array, a: number, b: number): void {
  const tmp = tiles[a]
  tiles[a] = tiles[b]
  tiles[b] = tmp
  moved[a] = 1
  moved[b] = 1
}

function stepPowder(
  tiles: Uint8Array,
  x: number,
  y: number,
  at: number,
  leftToRight: boolean
): void {
  if (y + 1 >= WORLD_H) return

  const below = cell(x, y + 1)
  if (passableForPowder(tiles[below])) {
    swap(tiles, at, below)
    return
  }

  // Blocked straight down — try the diagonals so it forms a slope.
  const first = leftToRight ? -1 : 1
  for (const dir of [first, -first]) {
    const nx = x + dir
    if (nx < 0 || nx >= WORLD_W) continue
    const diag = cell(nx, y + 1)
    if (passableForPowder(tiles[diag])) {
      swap(tiles, at, diag)
      return
    }
  }
}

function stepLiquid(
  tiles: Uint8Array,
  x: number,
  y: number,
  at: number,
  mat: number,
  leftToRight: boolean
): void {
  if (y + 1 < WORLD_H) {
    const below = cell(x, y + 1)
    if (tiles[below] === AIR) {
      swap(tiles, at, below)
      return
    }
    // Lava is denser than water: it sinks through it.
    if (mat === LAVA && tiles[below] === WATER) {
      swap(tiles, at, below)
      return
    }
  }

  const first = leftToRight ? -1 : 1
  for (const dir of [first, -first]) {
    const nx = x + dir
    if (nx < 0 || nx >= WORLD_W || y + 1 >= WORLD_H) continue
    const diag = cell(nx, y + 1)
    if (tiles[diag] === AIR) {
      swap(tiles, at, diag)
      return
    }
  }

  // Can't go down anywhere — spread sideways so the surface levels out. Reach
  // further than one tile per pass or puddles take forever to settle.
  for (const dir of [first, -first]) {
    for (let step = 1; step <= FLOW_REACH; step++) {
      const nx = x + dir * step
      if (nx < 0 || nx >= WORLD_W) break
      const side = cell(nx, y)
      if (tiles[side] !== AIR) break
      // Prefer a spot that has somewhere to fall from.
      const under = y + 1 < WORLD_H ? tiles[cell(nx, y + 1)] : STONE
      if (under === AIR || step === FLOW_REACH) {
        swap(tiles, at, side)
        return
      }
    }
  }
}

/** Lava touching water: lava sets to obsidian, the water boils away. */
function quench(tiles: Uint8Array, x: number, y: number, at: number): boolean {
  let found = false
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H) continue
      const n = cell(nx, ny)
      if (tiles[n] === WATER) {
        tiles[n] = AIR
        found = true
      }
    }
  }
  if (found) {
    tiles[at] = OBSIDIAN
    moved[at] = 1
  }
  return found
}

/**
 * Acid eating whatever it's resting against.
 *
 * The acid tile is spent by the bite, which is the whole reason this is safe to
 * ship: a puddle can only dissolve as many tiles as it has drops, so acid digs a
 * hole and then it's gone. Without that it would quietly erase the world while
 * nobody was looking. Glass, obsidian, marble, plastic, gold, crystal, gem and
 * lava shrug it off, so there is always something to build a container out of.
 *
 * Returns true if the tile was used up.
 */
function corrode(tiles: Uint8Array, x: number, y: number, at: number, phase: number): boolean {
  if (hash3(x, y, phase) > ACID_BITE) return false

  // Below first, then the sides, then up — acid works downward like it should.
  for (const [dx, dy] of [
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
  ]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H) continue
    const n = cell(nx, ny)
    const target = tiles[n]
    if (IS_SOLID[target] !== 1 || IS_ACID_PROOF[target] === 1) continue
    tiles[n] = AIR
    tiles[at] = AIR
    moved[n] = 1
    moved[at] = 1
    return true
  }
  return false
}

function touchesHeat(tiles: Uint8Array, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H) continue
      if (tiles[cell(nx, ny)] === LAVA) return true
    }
  }
  return false
}
