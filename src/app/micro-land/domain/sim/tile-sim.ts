/**
 * Falling-sand tile physics.
 *
 * One bottom-up pass per step: powders pile, liquids flow and level out, lava
 * quenches into obsidian where it meets water, ice melts near heat. A `moved`
 * bitmask stops a tile that just fell from being processed again in the same
 * pass (which would make everything drop at light speed).
 *
 * Scan direction alternates each pass — without that, liquids visibly drift
 * left forever.
 */
import { IS_LIQUID, IS_POWDER, MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import type { WorldState } from '@/app/micro-land/domain/types'

const AIR = MATERIAL_INDEX.air
const WATER = MATERIAL_INDEX.water
const LAVA = MATERIAL_INDEX.lava
const STONE = MATERIAL_INDEX.stone
const OBSIDIAN = MATERIAL_INDEX.obsidian
const ICE = MATERIAL_INDEX.ice

/** Reused across passes — the grid never changes size. */
const moved = new Uint8Array(WORLD_W * WORLD_H)

/** How far a liquid can slide sideways in one pass looking for a way down. */
const FLOW_REACH = 4

export function tickTiles(w: WorldState): void {
  moved.fill(0)
  const tiles = w.tiles
  w.flowPhase++
  const leftToRight = (w.flowPhase & 1) === 0
  // Lava is viscous: it only gets to move on every other pass.
  const lavaMoves = (w.flowPhase & 1) === 0

  for (let y = WORLD_H - 1; y >= 0; y--) {
    const rowStart = y * WORLD_W
    for (let i = 0; i < WORLD_W; i++) {
      const x = leftToRight ? i : WORLD_W - 1 - i
      const at = rowStart + x
      if (moved[at]) continue

      const mat = tiles[at]
      if (mat === AIR) continue

      if (mat === ICE) {
        if (touchesHeat(tiles, x, y)) tiles[at] = WATER
        continue
      }

      const isPowder = IS_POWDER[mat] === 1
      const isLiquid = IS_LIQUID[mat] === 1
      if (!isPowder && !isLiquid) continue

      if (mat === LAVA) {
        // Quenching wins over movement — a lava tile touching water sets solid.
        if (quench(tiles, x, y, at)) continue
        if (!lavaMoves) continue
      }

      if (isPowder) {
        stepPowder(tiles, x, y, at, leftToRight)
      } else {
        stepLiquid(tiles, x, y, at, mat, leftToRight)
      }
    }
  }
}

function cell(x: number, y: number): number {
  return y * WORLD_W + x
}

function passableForPowder(mat: number): boolean {
  // Powders sink through air and liquid alike.
  return mat === AIR || IS_LIQUID[mat] === 1
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
