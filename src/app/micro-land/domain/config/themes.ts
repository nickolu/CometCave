/**
 * Themes — the worlds you can switch between.
 *
 * A theme is a terrain generator plus a mood: what the void behind the world
 * looks like, how dark it is, how hard gravity pulls, and which creatures show
 * up already living there. Switching themes rebuilds the tile grid; summoned
 * creatures survive the change.
 */
import { WIDTH_SCALE, WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { type Rng, fbm3, makeNoise3D } from '@/app/micro-land/domain/sim/prng'
import type { MaterialId } from '@/app/micro-land/domain/types'
import { ringXY, wrapCol } from '@/app/micro-land/domain/wrap'

import { MATERIAL_INDEX } from './materials'

export interface Theme {
  id: string
  name: string
  blurb: string
  /** Two-stop gradient behind the world, top to bottom. */
  sky: [string, string]
  /** 0 = evenly lit, 1 = only glowing things are visible. */
  gloom: number
  /** Gravity multiplier. The station is 0.35; everywhere else is 1. */
  gravity: number
  /** Who already lives here. */
  starters: { id: string; count: number }[]
  build: (tiles: Uint8Array, rng: Rng) => void
}

const M = MATERIAL_INDEX

/**
 * "This many per screen" → "this many across the whole world".
 *
 * Every scattered feature below — ponds, geodes, lava falls — was a count
 * chosen by eye against one screen of land. Left alone in a world three screens
 * wide they don't spread out, they thin out: two ponds in a world this long
 * means most of it has no fresh water at all.
 */
function across(n: number): number {
  return Math.round(n * WIDTH_SCALE)
}

/**
 * A surface height that meets itself at the seam.
 *
 * Drop-in for `fbm(noise, x * freq, layer, octaves)`. `layer` keeps its old
 * meaning — a fixed offset picking out one slice of the field, which is how the
 * themes get several unrelated-looking curves out of a single noise object.
 */
function ring1(
  noise: (x: number, y: number, z: number) => number,
  x: number,
  freq: number,
  layer: number,
  octaves = 3
): number {
  const { u, v } = ringXY(x, freq)
  return fbm3(noise, u, v, layer, octaves)
}

/**
 * A 2-D field — caves, ore, cloud banks — periodic in x and free in y.
 *
 * The circle uses up two dimensions, so depth gets the third. That is the whole
 * reason `makeNoise3D` exists.
 */
function ring2(
  noise: (x: number, y: number, z: number) => number,
  x: number,
  freq: number,
  y: number,
  yFreq: number,
  octaves = 3
): number {
  const { u, v } = ringXY(x, freq)
  return fbm3(noise, u, v, y * yFreq, octaves)
}

/** `ring2` without the octave stack, for the single-sample call sites. */
function ring2Raw(
  noise: (x: number, y: number, z: number) => number,
  x: number,
  freq: number,
  y: number,
  yFreq: number
): number {
  const { u, v } = ringXY(x, freq)
  return noise(u, v, y * yFreq)
}

function fill(tiles: Uint8Array, id: MaterialId) {
  tiles.fill(M[id])
}

/**
 * Write one tile. Columns wrap; rows do not.
 *
 * Every scattered feature in every theme goes through here, so wrapping at this
 * one point is what lets a lava fall, a tree or a geode straddle column zero and
 * come out whole. Clipping them instead would leave a strip down the seam where
 * nothing generated — subtler than a cliff, and still a tell.
 */
function set(tiles: Uint8Array, x: number, y: number, id: MaterialId) {
  if (y < 0 || y >= WORLD_H) return
  tiles[y * WORLD_W + wrapCol(x)] = M[id]
}

/** Filled block. `x0 > x1` is not a thing; a rect that runs off the right edge
 *  simply carries on from the left. */
function rect(tiles: Uint8Array, x0: number, y0: number, x1: number, y1: number, id: MaterialId) {
  for (let y = Math.max(0, y0); y <= Math.min(WORLD_H - 1, y1); y++) {
    for (let x = x0; x <= x1; x++) {
      tiles[y * WORLD_W + wrapCol(x)] = M[id]
    }
  }
}

function tileAt(tiles: Uint8Array, x: number, y: number): number {
  if (y < 0 || y >= WORLD_H) return -1
  return tiles[y * WORLD_W + wrapCol(x)]
}

/**
 * The first row of anything at all in this column — `WORLD_H` for open sky.
 *
 * Every feature that sits *on the ground* rather than at a fixed height needs
 * this, and each generator that wanted one used to spell the same scan out by
 * hand. Read it before carving the column, not after: the scan stops at the
 * first solid thing, so a column you have already hollowed answers with the
 * floor of the hole.
 */
function surfaceY(tiles: Uint8Array, x: number): number {
  const col = wrapCol(x)
  let y = 0
  while (y < WORLD_H && tiles[y * WORLD_W + col] === M.air) y++
  return y
}

/** A wall of one material with the inside knocked out. Rooms, towers, houses. */
function hollow(
  tiles: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  wall: MaterialId,
  thickness = 1
) {
  rect(tiles, x0, y0, x1, y1, wall)
  rect(tiles, x0 + thickness, y0 + thickness, x1 - thickness, y1 - thickness, 'air')
}

/**
 * Creep moss over any bare rock with open space above it.
 *
 * Run as a pass over the finished grid rather than inside the generator loop,
 * because "is this tile exposed" is a question about neighbours that don't
 * exist yet while the column is still being written.
 */
function mossify(tiles: Uint8Array, rng: Rng, chance: number, on: MaterialId[]) {
  const allowed = new Set(on.map(id => M[id]))
  for (let y = 1; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const here = tileAt(tiles, x, y)
      if (!allowed.has(here)) continue
      if (tileAt(tiles, x, y - 1) !== M.air) continue
      if (rng() < chance) set(tiles, x, y, 'moss')
    }
  }
}

/** Drop a rough blob of material centred on a tile. Used for ore and pools. */
function blob(
  tiles: Uint8Array,
  cx: number,
  cy: number,
  radius: number,
  id: MaterialId,
  rng: Rng,
  into: MaterialId[]
) {
  const allowed = new Set(into.map(m => M[m]))
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d > radius * (0.6 + rng() * 0.5)) continue
      if (!allowed.has(tileAt(tiles, x, y))) continue
      set(tiles, x, y, id)
    }
  }
}

// ---------------------------------------------------------------------------

const EMPTY: Theme = {
  id: 'empty',
  name: 'Empty',
  blurb: 'Nothing at all. Build it yourself.',
  sky: ['#141026', '#090713'],
  gloom: 0.1,
  gravity: 1,
  starters: [],
  build: tiles => fill(tiles, 'air'),
}

const EARTH: Theme = {
  id: 'earth',
  name: 'Cross-Section',
  blurb: 'Snowy tops, grass, dirt, caves, and molten rock at the bottom.',
  sky: ['#7fc4e8', '#2a3a5c'],
  gloom: 0.34,
  gravity: 1,
  starters: [
    { id: 'sunleaf', count: 34 },
    { id: 'bramble', count: 12 },
    { id: 'glowvine', count: 8 },
    { id: 'frostcap', count: 8 },
    { id: 'sporecap', count: 4 },
    { id: 'skybloom', count: 6 },
    { id: 'mite', count: 8 },
    { id: 'mote', count: 8 },
    { id: 'hopper', count: 6 },
    { id: 'glimmer-moth', count: 5 },
    { id: 'dustbee', count: 5 },
    { id: 'fluttermoth', count: 3 },
    { id: 'seedmite', count: 4 },
    { id: 'loamworm', count: 4 },
    { id: 'delver', count: 3 },
    { id: 'woolly', count: 4 },
    { id: 'driftmole', count: 3 },
    { id: 'stalker', count: 2 },
    { id: 'sunhawk', count: 1 },
    { id: 'rimeclaw', count: 1 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const surfaceNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const caveNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const oreNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const treasureNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const skyDepth = Math.floor(WORLD_H * 0.3)
    // Anything this far above the average hilltop keeps its snow.
    const snowLine = skyDepth - 4

    for (let x = 0; x < WORLD_W; x++) {
      // Rolling hills: a couple of octaves is enough at this width.
      const h = ring1(surfaceNoise, x, 0.035, 0.5, 3)
      const surface = Math.floor(skyDepth + (h - 0.5) * 18)
      const snowy = surface < snowLine
      const snowDepth = snowy ? 3 + Math.floor((snowLine - surface) / 3) : 0

      for (let y = surface; y < WORLD_H; y++) {
        const depth = (y - surface) / (WORLD_H - surface)
        let mat: MaterialId
        // Loose snow on top of packed ice. Snow is a powder, so the top layer
        // slides off the steep faces and drifts into the valleys the moment the
        // world starts — the ice underneath is what keeps the peak white.
        if (snowy && y - surface < snowDepth) mat = y - surface < 2 ? 'snow' : 'ice'
        else if (y === surface) mat = 'grass'
        else if (depth < 0.22) mat = 'dirt'
        else if (depth > 0.9) mat = 'lava'
        else mat = 'stone'

        // Carve caves out of the rock, but never out of the top crust.
        if (mat === 'stone' && depth < 0.88) {
          const c = ring2(caveNoise, x, 0.06, y, 0.09, 3)
          if (c > 0.62) mat = 'air'
        }
        // Occasional water pockets and sand seams.
        if (mat === 'stone' && depth > 0.35 && depth < 0.7) {
          const o = ring2Raw(oreNoise, x, 0.12, y, 0.12)
          if (o > 0.88) mat = 'water'
          else if (o < 0.08) mat = 'sand'
        }
        // Things worth digging for. Deeper is better, which is the point:
        // gold and crystal sit below the lava-adjacent rock, so getting there
        // costs something.
        if (mat === 'stone') {
          const t = ring2Raw(treasureNoise, x, 0.19, y, 0.19)
          if (depth > 0.6 && t > 0.93) mat = 'gold'
          else if (depth > 0.7 && t < 0.05) mat = 'crystal'
          else if (depth > 0.45 && t > 0.895 && t <= 0.93) mat = 'gem'
          else if (depth > 0.2 && depth < 0.45 && t < 0.06) mat = 'bone'
        }
        set(tiles, x, y, mat)
      }
    }

    // A shallow pond or two on the surface, with mud round the rim — the one
    // place on the map where the ground is both wet and fertile.
    const ponds = across(2) + Math.floor(rng() * across(2))
    for (let p = 0; p < ponds; p++) {
      const cx = Math.floor(rng() * WORLD_W)
      const w = 8 + Math.floor(rng() * 14)
      for (let x = cx - w; x <= cx + w; x++) {
        // Find the surface at this column, then scoop a bowl into it.
        const surface = surfaceY(tiles, x)
        const t = 1 - Math.abs(x - cx) / (w + 1)
        const depth = Math.floor(t * 5)
        for (let d = 0; d < depth; d++) set(tiles, x, surface + d, 'water')
        for (let d = depth; d < depth + 2; d++) {
          if (tileAt(tiles, x, surface + d) === M.dirt) set(tiles, x, surface + d, 'mud')
        }
      }
    }

    mossify(tiles, rng, 0.4, ['stone', 'dirt'])
  },
}

const STATION: Theme = {
  id: 'station',
  name: 'Broken Station',
  blurb: 'Metal rooms adrift in orbit. Everything falls slowly here.',
  sky: ['#060812', '#01030a'],
  gloom: 0.62,
  gravity: 0.35,
  starters: [
    { id: 'rustbot', count: 5 },
    { id: 'sporecap', count: 16 },
    { id: 'skybloom', count: 5 },
    { id: 'drifter-jelly', count: 5 },
    { id: 'glimmer-moth', count: 7 },
    { id: 'mite', count: 8 },
    { id: 'mote', count: 6 },
    { id: 'dustbee', count: 3 },
    { id: 'fluttermoth', count: 2 },
    { id: 'seedmite', count: 3 },
    { id: 'palecrawler', count: 4 },
    { id: 'wisp', count: 4 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')

    // Chop the interior into rooms by recursively splitting a box, then hollow
    // each one out and knock a doorway through — cheap, and it always connects.
    interface Box {
      x0: number
      y0: number
      x1: number
      y1: number
    }
    const rooms: Box[] = []

    // Each level of recursion doubles the room count, so widening the station
    // needs *more depth*, not a bigger number — at the old limit of 4 the same
    // sixteen rooms would simply have been stretched to three times the size,
    // and a station made of enormous empty halls stops reading as a station.
    const maxDepth = 4 + Math.round(Math.log2(WIDTH_SCALE))

    function split(box: Box, depth: number) {
      const w = box.x1 - box.x0
      const h = box.y1 - box.y0
      if (depth > maxDepth || (w < 26 && h < 20) || rooms.length > across(24)) {
        rooms.push(box)
        return
      }
      const horizontal = w > h * 1.4 ? true : h > w * 1.4 ? false : rng() > 0.5
      if (horizontal) {
        const cut = box.x0 + Math.floor(w * (0.35 + rng() * 0.3))
        split({ ...box, x1: cut }, depth + 1)
        split({ ...box, x0: cut }, depth + 1)
      } else {
        const cut = box.y0 + Math.floor(h * (0.35 + rng() * 0.3))
        split({ ...box, y1: cut }, depth + 1)
        split({ ...box, y0: cut }, depth + 1)
      }
    }

    const margin = 12
    split({ x0: margin, y0: 10, x1: WORLD_W - margin, y1: WORLD_H - 10 }, 0)

    for (const room of rooms) {
      // Skip a few rooms entirely — a station with holes in it reads as broken.
      if (rng() < 0.18) continue
      // Different decks were built by different people. Rusted iron reads as
      // the old part of the station, marble as the part somebody cared about.
      const shellRoll = rng()
      const shell: MaterialId = shellRoll < 0.18 ? 'iron' : shellRoll < 0.26 ? 'marble' : 'metal'
      rect(tiles, room.x0, room.y0, room.x1, room.y1, shell)
      rect(tiles, room.x0 + 2, room.y0 + 2, room.x1 - 2, room.y1 - 2, 'air')

      // Viewports.
      if (rng() < 0.5) {
        const gy = room.y0 + 2 + Math.floor(rng() * Math.max(1, room.y1 - room.y0 - 4))
        rect(tiles, room.x0, gy, room.x0 + 1, gy + 1, 'glass')
      }
      // Doorway to the room on the right.
      const dy = room.y1 - 3
      rect(tiles, room.x1 - 2, dy - 2, room.x1 + 2, dy, 'air')

      // Leftover cargo: water tanks, scrap piles, and — critically — soil.
      //
      // Metal and glass are not fertile, so a station built only from those has
      // nowhere for a plant to root. Nothing grows, nothing eats, and the whole
      // station starves within a couple of minutes. These are the overgrown
      // hydroponics beds, and they are what make the place survivable.
      const roll = rng()
      if (roll < 0.2) {
        rect(tiles, room.x0 + 3, room.y1 - 6, room.x0 + 10, room.y1 - 3, 'water')
      } else if (roll < 0.32) {
        rect(tiles, room.x0 + 4, room.y1 - 4, room.x0 + 9, room.y1 - 3, 'iron')
      } else if (roll < 0.44) {
        // Stacked supply crates.
        rect(tiles, room.x0 + 4, room.y1 - 5, room.x0 + 7, room.y1 - 3, 'plastic')
      }
      if (rng() < 0.65) {
        const bedX = room.x0 + 3
        const bedW = Math.max(4, Math.floor((room.x1 - room.x0) * 0.5))
        rect(tiles, bedX, room.y1 - 3, bedX + bedW, room.y1 - 3, 'dirt')
        // Long-abandoned beds have gone over to mud and moss.
        if (rng() < 0.5) {
          rect(tiles, bedX, room.y1 - 3, bedX + Math.floor(bedW / 2), room.y1 - 3, 'mud')
        }
      }
    }

    mossify(tiles, rng, 0.12, ['dirt', 'mud'])
  },
}

const TIDEPOOL: Theme = {
  id: 'tidepool',
  name: 'Tidepool',
  blurb: 'Shallow water over rock shelves and sand.',
  sky: ['#bfe6f5', '#4a89a8'],
  gloom: 0.22,
  gravity: 1,
  starters: [
    { id: 'kelp', count: 30 },
    { id: 'sunleaf', count: 8 },
    { id: 'skybloom', count: 4 },
    { id: 'finling', count: 10 },
    { id: 'mite', count: 6 },
    { id: 'mote', count: 6 },
    { id: 'dustbee', count: 4 },
    { id: 'fluttermoth', count: 3 },
    { id: 'seedmite', count: 4 },
    { id: 'crystal-snail', count: 4 },
    { id: 'gulper', count: 2 },
    { id: 'drifter-jelly', count: 4 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const floorNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const shelfNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const waterLine = Math.floor(WORLD_H * 0.34)

    for (let x = 0; x < WORLD_W; x++) {
      const f = ring1(floorNoise, x, 0.045, 2.5, 3)
      const floor = Math.floor(WORLD_H * 0.66 + (f - 0.5) * 26)

      for (let y = waterLine; y < floor; y++) set(tiles, x, y, 'water')
      for (let y = floor; y < WORLD_H; y++) {
        const depth = y - floor
        // Sand on top, then the silt that collects under it, then bedrock.
        set(tiles, x, y, depth < 3 ? 'sand' : depth < 6 ? 'mud' : 'stone')
      }

      // Rock shelves that break the surface — the tide leaves these dry.
      const s = ring1(shelfNoise, x, 0.03, 8.5, 2)
      if (s > 0.66) {
        const top = waterLine - Math.floor((s - 0.66) * 34)
        for (let y = top; y < floor; y++) {
          set(tiles, x, y, y < waterLine + 1 ? 'stone' : 'stone')
        }
        set(tiles, x, top, 'stone')
      }
    }

    // Scattered tidepools sitting on top of the shelves.
    for (let i = 0; i < across(14); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const y = surfaceY(tiles, cx)
      if (y >= waterLine || y >= WORLD_H - 2) continue
      const w = 2 + Math.floor(rng() * 5)
      for (let x = cx - w; x <= cx + w; x++) {
        const t = 1 - Math.abs(x - cx) / (w + 1)
        for (let d = 0; d < Math.floor(t * 4); d++) set(tiles, x, y + d, 'water')
      }
    }

    // Shells and old bones worked into the sand, and a few gems in the bedrock.
    for (let i = 0; i < across(10); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const cy = Math.floor(WORLD_H * (0.7 + rng() * 0.28))
      blob(tiles, cx, cy, 2 + Math.floor(rng() * 3), rng() < 0.6 ? 'bone' : 'gem', rng, [
        'stone',
        'sand',
        'mud',
      ])
    }

    // The wet rock above the tideline is where everything green gets a hold.
    mossify(tiles, rng, 0.5, ['stone'])
  },
}

const VOLCANIC: Theme = {
  id: 'volcanic',
  name: 'Volcanic',
  blurb: 'Ash, black rock and rivers of lava. Only tough things last.',
  sky: ['#3a1512', '#120608'],
  gloom: 0.5,
  gravity: 1,
  starters: [
    { id: 'sporecap', count: 20 },
    { id: 'glowvine', count: 8 },
    { id: 'ember-grub', count: 7 },
    { id: 'cinder-wyrm', count: 3 },
    { id: 'mite', count: 6 },
    { id: 'delver', count: 3 },
    { id: 'loamworm', count: 3 },
    { id: 'crystal-snail', count: 4 },
    { id: 'rustbot', count: 2 },
    { id: 'wisp', count: 4 },
    { id: 'grumblestone', count: 2 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const surfaceNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const caveNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const skyDepth = Math.floor(WORLD_H * 0.28)

    for (let x = 0; x < WORLD_W; x++) {
      const h = ring1(surfaceNoise, x, 0.05, 1.5, 4)
      const surface = Math.floor(skyDepth + (h - 0.5) * 30)

      for (let y = surface; y < WORLD_H; y++) {
        const depth = (y - surface) / (WORLD_H - surface)
        let mat: MaterialId
        if (depth < 0.06) mat = 'ash'
        else if (depth > 0.86) mat = 'lava'
        else mat = depth > 0.55 ? 'obsidian' : 'stone'

        if ((mat === 'stone' || mat === 'obsidian') && depth < 0.82) {
          const c = ring2(caveNoise, x, 0.07, y, 0.1, 3)
          if (c > 0.6) mat = 'air'
          else if (c < 0.16 && depth > 0.4) mat = 'lava'
        }
        set(tiles, x, y, mat)
      }
    }

    // Lava falls spilling down from the surface.
    for (let i = 0; i < across(4); i++) {
      const cx = 12 + Math.floor(rng() * (WORLD_W - 24))
      const y = surfaceY(tiles, cx)
      const w = 1 + Math.floor(rng() * 2)
      for (let d = 0; d < 18; d++) {
        for (let x = cx - w; x <= cx + w; x++) set(tiles, x, y + d, 'lava')
      }
    }

    // Crystal geodes and gem seams growing in the cooled rock, plus the bones
    // of whatever didn't get out in time.
    for (let i = 0; i < across(16); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const cy = Math.floor(WORLD_H * (0.4 + rng() * 0.45))
      const roll = rng()
      const id: MaterialId = roll < 0.45 ? 'crystal' : roll < 0.75 ? 'gem' : 'bone'
      blob(tiles, cx, cy, 2 + Math.floor(rng() * 3), id, rng, ['stone', 'obsidian', 'ash'])
    }

    // A couple of acid pools sitting in the ash. They eat their way down and
    // then they're gone, which is exactly what makes them safe to leave here.
    for (let i = 0; i < across(2); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const y = surfaceY(tiles, cx)
      const w = 2 + Math.floor(rng() * 3)
      for (let x = cx - w; x <= cx + w; x++) {
        const t = 1 - Math.abs(x - cx) / (w + 1)
        for (let d = 0; d < Math.floor(t * 3); d++) set(tiles, x, y + d, 'acid')
      }
    }
  },
}

const SKYLANDS: Theme = {
  id: 'skylands',
  name: 'Sky Islands',
  blurb: 'Meadows floating in open air, a sea of cloud, and the old ground below.',
  sky: ['#a9dcff', '#4f7bc4'],
  gloom: 0.16,
  // Thin air. Slower falling is what turns walking off an island into a journey
  // instead of a full stop — the cloud sea does the rest of the catching.
  gravity: 0.8,
  starters: [
    { id: 'sunleaf', count: 24 },
    { id: 'bramble', count: 8 },
    { id: 'glowvine', count: 6 },
    { id: 'frostcap', count: 4 },
    { id: 'skybloom', count: 9 },
    { id: 'mite', count: 8 },
    { id: 'mote', count: 8 },
    { id: 'dustbee', count: 7 },
    { id: 'fluttermoth', count: 4 },
    { id: 'seedmite', count: 5 },
    { id: 'glimmer-moth', count: 6 },
    { id: 'hopper', count: 6 },
    { id: 'drifter-jelly', count: 4 },
    { id: 'woolly', count: 3 },
    { id: 'delver', count: 3 },
    { id: 'stalker', count: 2 },
    { id: 'sunhawk', count: 2 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const groundNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const cloudNoise = makeNoise3D(Math.floor(rng() * 1e9))

    /**
     * The floor of the world, and it has to be a living one.
     *
     * Nothing dies of a fall here — creatures are clamped to the bottom row
     * rather than leaving the world — so an empty sky underneath would slowly
     * fill up with everything that ever slipped off an edge, standing in a bare
     * gutter with nothing to eat. Real soil down there turns the drop into
     * somewhere you arrive instead of somewhere you are stored.
     */
    const underTop = Math.floor(WORLD_H * 0.84)
    for (let x = 0; x < WORLD_W; x++) {
      const h = ring1(groundNoise, x, 0.03, 4.5, 3)
      const surface = underTop + Math.floor((h - 0.5) * 10)
      for (let y = surface; y < WORLD_H; y++) {
        const depth = y - surface
        set(tiles, x, y, depth === 0 ? 'grass' : depth < 5 ? 'dirt' : 'stone')
      }
    }

    // Flat-topped, deep-keeled — the shape a floating island has to have to read
    // as floating rather than as a lump someone forgot to attach to anything.
    const island = (cx: number, halfW: number, cy: number, keel: number) => {
      let top = cy
      for (let dx = -halfW; dx <= halfW; dx++) {
        // A gentle wander rather than a ruler-straight lawn, clamped so the
        // wander can never turn the meadow into a staircase.
        if (rng() < 0.16) top += rng() < 0.5 ? -1 : 1
        top = Math.max(cy - 2, Math.min(cy + 2, top))

        const t = 1 - Math.abs(dx) / (halfW + 1)
        const deep = Math.round(keel * Math.pow(t, 0.75) * (0.7 + rng() * 0.6))
        if (deep < 1) continue
        set(tiles, cx + dx, top, 'grass')
        for (let d = 1; d <= deep; d++) set(tiles, cx + dx, top + d, d < 4 ? 'dirt' : 'stone')
      }
    }

    const count = across(9)
    for (let i = 0; i < count; i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const cy = Math.floor(WORLD_H * (0.1 + rng() * 0.4))
      const halfW = 8 + Math.floor(rng() * 14)
      island(cx, halfW, cy, 6 + Math.floor(rng() * 10))

      // A pool on the bigger islands. Without one there is no water anywhere
      // above the cloud line, and half the roster is shut out of the sky.
      if (halfW > 13 && rng() < 0.6) {
        const pw = 3 + Math.floor(rng() * 4)
        const px = cx + Math.floor((rng() - 0.5) * (halfW - pw) * 1.4)
        for (let x = px - pw; x <= px + pw; x++) {
          const top = surfaceY(tiles, x)
          if (top >= WORLD_H) continue
          const t = 1 - Math.abs(x - px) / (pw + 1)
          for (let d = 0; d < Math.floor(t * 5); d++) set(tiles, x, top + d, 'water')
        }
      }
      // What the island grew around.
      if (rng() < 0.5) {
        blob(tiles, cx, cy + 4 + Math.floor(rng() * 4), 2 + Math.floor(rng() * 2), 'crystal', rng, [
          'stone',
          'dirt',
        ])
      }
    }

    /**
     * The cloud sea, thickest through its middle so it reads as a layer with a
     * top and a bottom rather than as fog filling the lower half of the screen.
     *
     * Only ever written into air, so it drapes around the islands instead of
     * eating their keels.
     */
    const cloudTop = Math.floor(WORLD_H * 0.58)
    const cloudBottom = underTop - 9
    for (let y = cloudTop; y < cloudBottom; y++) {
      const t = (y - cloudTop) / Math.max(1, cloudBottom - cloudTop)
      const density = 0.4 + Math.sin(t * Math.PI) * 0.32
      for (let x = 0; x < WORLD_W; x++) {
        if (tileAt(tiles, x, y) !== M.air) continue
        if (ring2(cloudNoise, x, 0.05, y, 0.11, 2) < density) set(tiles, x, y, 'cloud')
      }
    }

    mossify(tiles, rng, 0.3, ['stone', 'dirt'])
  },
}

const DUNES: Theme = {
  id: 'dunes',
  name: 'Dune Sea',
  blurb: 'Sand as far as you can see, ruins underneath, and water only where you dig.',
  sky: ['#f7d79a', '#c0603a'],
  gloom: 0.12,
  gravity: 1,
  starters: [
    { id: 'sunleaf', count: 16 },
    { id: 'bramble', count: 10 },
    { id: 'sporecap', count: 6 },
    { id: 'glowvine', count: 4 },
    { id: 'kelp', count: 8 },
    { id: 'skybloom', count: 4 },
    { id: 'mite', count: 8 },
    { id: 'mote', count: 7 },
    { id: 'dustbee', count: 6 },
    { id: 'fluttermoth', count: 3 },
    { id: 'seedmite', count: 4 },
    { id: 'hopper', count: 6 },
    { id: 'loamworm', count: 5 },
    { id: 'delver', count: 4 },
    { id: 'ember-grub', count: 4 },
    { id: 'finling', count: 6 },
    { id: 'crystal-snail', count: 3 },
    { id: 'stalker', count: 2 },
    { id: 'sunhawk', count: 2 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const surfaceNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const seamNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const tableNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const skyDepth = Math.floor(WORLD_H * 0.36)
    // Where the rock stops being dry. Everything interesting in this world is
    // the question of how far down that is.
    const waterTable = Math.floor(WORLD_H * 0.82)

    for (let x = 0; x < WORLD_W; x++) {
      /**
       * A long, low swell rather than dunes with sharp crests.
       *
       * Sand is a powder and slides down any slope with air at the bottom of
       * it, so a field of steep dunes flattens itself within a minute of the
       * world starting and takes its silhouette with it. Keeping the surface
       * gentle is what makes the settling look like weather instead of like
       * the world falling over.
       */
      const h = ring1(surfaceNoise, x, 0.018, 7.5, 3)
      const surface = Math.floor(skyDepth + (h - 0.5) * 16)

      for (let y = surface; y < WORLD_H; y++) {
        const d = y - surface
        const depth = d / (WORLD_H - surface)
        /**
         * Sand nearly all the way down, and it stays put.
         *
         * Buried powder never moves — a sand tile only falls when what is
         * under or diagonally under it isn't solid — so a deep body of sand is
         * as stable as rock and only the exposed skin drifts. A thin blanket
         * over bedrock was the first attempt and it reads, from any distance,
         * as a grey world with a tan crust: this has to be a *sea* of sand for
         * the name on the picker to be telling the truth.
         */
        let mat: MaterialId = depth < 0.62 ? 'sand' : 'stone'
        // Rock shelves the sand has drifted up against, so the sea has
        // something in it besides sand.
        if (mat === 'sand' && d > 6 && ring2Raw(seamNoise, x, 0.05, y, 0.085) > 0.8) mat = 'stone'
        // The water table: porous rock down here, and the pockets join up into
        // something a well can reach.
        if (y > waterTable && ring2Raw(tableNoise, x, 0.06, y, 0.14) > 0.42) mat = 'water'
        set(tiles, x, y, mat)
      }
    }

    // Ruins, buried to whatever depth the sand has had time to bury them to.
    // Few and large: a dozen small ones scattered evenly read as picture frames
    // hung on the rock rather than as something that was here first.
    for (let i = 0; i < across(1.5); i++) {
      const cx = 24 + Math.floor(rng() * (WORLD_W - 60))
      const cy = Math.floor(WORLD_H * (0.42 + rng() * 0.16))
      const w = 14 + Math.floor(rng() * 16)
      const h = 8 + Math.floor(rng() * 7)
      // Bone rather than marble: white marble against this much tan reads as a
      // picture frame, and bone is fertile, so the hall gets to grow something.
      hollow(tiles, cx, cy, cx + w, cy + h, 'bone', 2)
      if (rng() < 0.5) rect(tiles, cx + 4, cy + h - 3, cx + 7, cy + h - 3, 'gold')
      // Pillars, so the inside is a hall and not a crate.
      for (let px = cx + 5; px < cx + w - 4; px += 7) {
        rect(tiles, px, cy + 2, px + 1, cy + h - 3, 'bone')
      }
    }

    /**
     * Sinkholes — a shaft from the open desert down to the water.
     *
     * This is the whole reason the water table is drawn as a band instead of a
     * few scattered pockets: a shaft that opens onto it drains into a standing
     * pool at the bottom, so the cross-section shows why anything survives out
     * here rather than just asserting that it does.
     *
     * Rocked before it is hollowed, and that is not decoration. A shaft cut
     * straight through sand has powder on both walls with open air beside it,
     * which is the one arrangement powder does not tolerate — the hole pours
     * itself shut in seconds and seals the water away again. The lining follows
     * the shaft rather than boxing it in: a full-width slab of rock around each
     * hole reads as a wall someone built in the middle of a desert.
     */
    for (let i = 0; i < across(1); i++) {
      const cx = 24 + Math.floor(rng() * (WORLD_W - 48))
      const half = 4 + Math.floor(rng() * 4)
      // Wide at the top, narrow at the bottom — a collapse cone. A shaft of
      // constant width is a pipe, and a pipe is the one thing in a desert that
      // announces somebody drew it.
      const mouth = surfaceY(tiles, cx)
      for (let y = mouth; y < waterTable + 6; y++) {
        const t = Math.min(1, (y - mouth) / (waterTable - mouth))
        const hw = Math.max(1, Math.round(half * (1.7 - t)))
        for (let d = 1; d <= 3; d++) {
          set(tiles, cx - hw - d, y, 'stone')
          set(tiles, cx + hw + d, y, 'stone')
        }
        // Damp walls near the bottom. The one green thing for a long way in
        // either direction, and the only fertile ground down the hole.
        if (y > waterTable - 16 && y < waterTable) {
          if (rng() < 0.7) set(tiles, cx - hw - 1, y, 'moss')
          if (rng() < 0.7) set(tiles, cx + hw + 1, y, 'moss')
        }
        for (let x = cx - hw; x <= cx + hw; x++) set(tiles, x, y, 'air')
      }
    }

    /**
     * Oases: a rock basin with water in it and a green rim.
     *
     * The basin is the whole trick. A bowl scooped straight out of the dunes
     * fills itself back in within a minute — powder sinks through liquid, so
     * every grain on the rim slides into the pool until there is no pool. Rock
     * first, water second, and the oasis is still there ten minutes later.
     */
    for (let i = 0; i < across(2); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const w = 10 + Math.floor(rng() * 12)
      // Bone rather than stone for the basin: a grey bowl this size is the
      // loudest thing on the screen, and bone is fertile, so the shore it makes
      // is somewhere a root can take hold.
      for (let x = cx - w - 4; x <= cx + w + 4; x++) {
        const t = 1 - Math.abs(x - cx) / (w + 5)
        const top = surfaceY(tiles, x)
        for (let d = 0; d < Math.floor(t * 14); d++) set(tiles, x, top + d, 'bone')
      }
      for (let x = cx - w; x <= cx + w; x++) {
        const t = 1 - Math.abs(x - cx) / (w + 1)
        const depth = Math.floor(t * 9)
        const top = surfaceY(tiles, x)
        for (let d = 0; d < depth; d++) set(tiles, x, top + d, 'water')
        if (depth > 0) set(tiles, x, top + depth, 'mud')
      }
      // A green shore, and something with roots standing on it — an oasis is a
      // canopy as much as it is a shoreline.
      for (const side of [-1, 1]) {
        const px = cx + side * (w + 2)
        const top = surfaceY(tiles, px)
        if (top >= WORLD_H - 4) continue
        rect(tiles, px - 2, top, px + 2, top, 'grass')
        const trunk = 7 + Math.floor(rng() * 6)
        rect(tiles, px, top - trunk, px + 1, top - 1, 'wood')
        rect(tiles, px - 3, top - trunk - 2, px + 4, top - trunk - 1, 'moss')
      }
    }

    // Glass where lightning found the sand, and gems where the rock kept some.
    for (let i = 0; i < across(3); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const cy = Math.floor(WORLD_H * (0.55 + rng() * 0.28))
      const roll = rng()
      const id: MaterialId = roll < 0.4 ? 'glass' : roll < 0.75 ? 'gem' : 'bone'
      blob(tiles, cx, cy, 2 + Math.floor(rng() * 3), id, rng, ['stone', 'sand'])
    }
  },
}

const WINTER: Theme = {
  id: 'winter',
  name: 'Winter Wonderland',
  blurb: 'Deep snow over blue ice, frozen ponds, and caves that never thaw.',
  sky: ['#e3f1ff', '#8ba7cd'],
  gloom: 0.18,
  gravity: 1,
  starters: [
    { id: 'frostcap', count: 22 },
    { id: 'sunleaf', count: 12 },
    { id: 'glowvine', count: 6 },
    { id: 'bramble', count: 6 },
    { id: 'sporecap', count: 5 },
    { id: 'skybloom', count: 4 },
    { id: 'mite', count: 8 },
    { id: 'mote', count: 7 },
    { id: 'dustbee', count: 5 },
    { id: 'fluttermoth', count: 3 },
    { id: 'seedmite', count: 4 },
    { id: 'glimmer-moth', count: 5 },
    { id: 'hopper', count: 5 },
    { id: 'woolly', count: 6 },
    { id: 'driftmole', count: 5 },
    { id: 'delver', count: 3 },
    { id: 'crystal-snail', count: 3 },
    { id: 'wisp', count: 3 },
    { id: 'stalker', count: 2 },
    { id: 'rimeclaw', count: 2 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const surfaceNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const caveNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const veinNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const skyDepth = Math.floor(WORLD_H * 0.34)

    for (let x = 0; x < WORLD_W; x++) {
      // `fbm` only spans about 0.2–0.72, so the multiplier buys roughly half
      // its face value in tiles: this is an eighteen-tile range, not thirty.
      const h = ring1(surfaceNoise, x, 0.03, 2.5, 3)
      const surface = Math.floor(skyDepth + (h - 0.5) * 34)
      // Where the glacier gives out and rock begins. A constant would draw a
      // ruler-straight seam from one end of the world to the other.
      const iceFloor = 0.42 + ring1(surfaceNoise, x, 0.012, 30.5, 2) * 0.2

      for (let y = surface; y < WORLD_H; y++) {
        const d = y - surface
        const depth = d / (WORLD_H - surface)
        /**
         * Snow on ice on rock, and the ice goes down half the world.
         *
         * Snow is a powder and drifts off the steep faces into the hollows the
         * moment the world starts, so the ice beneath is what actually keeps
         * the hills white instead of grey by the second minute. A dozen rows of
         * it was not enough — from any distance that reads as a frosted lid on
         * an ordinary stone world. This is a glacier with rock under it.
         */
        let mat: MaterialId = d < 5 ? 'snow' : depth < iceFloor ? 'ice' : 'stone'

        // Caves, cut through the ice as much as the rock — glacier caves, so
        // they show blue rather than black.
        if (depth < 0.86 && d > 6) {
          const c = ring2(caveNoise, x, 0.065, y, 0.095, 3)
          if (c > 0.63) mat = 'air'
        }
        // Sparingly. At the thresholds this started on, the rock came out
        // flecked pink and cyan from end to end and read as static.
        if (mat === 'stone') {
          const v = ring2Raw(veinNoise, x, 0.17, y, 0.17)
          if (depth > 0.6 && v > 0.95) mat = 'crystal'
          else if (depth > 0.5 && v < 0.035) mat = 'bone'
          else if (depth > 0.55 && v > 0.93 && v <= 0.95) mat = 'gem'
        }
        set(tiles, x, y, mat)
      }
    }

    /**
     * Frozen ponds: water with a lid of ice over it.
     *
     * The lid is the point. Open water in a snowfield freezes over in a child's
     * mental model of winter, and mechanically it means the fish have somewhere
     * that isn't also somewhere a walker can fall into.
     */
    for (let i = 0; i < across(3); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const w = 7 + Math.floor(rng() * 12)
      for (let x = cx - w; x <= cx + w; x++) {
        const surface = surfaceY(tiles, x)
        const t = 1 - Math.abs(x - cx) / (w + 1)
        const depth = Math.floor(t * 8)
        if (depth < 3) continue
        for (let d = 0; d < depth; d++) set(tiles, x, surface + d, 'water')
        set(tiles, x, surface, 'ice')
        set(tiles, x, surface + 1, 'ice')
      }
    }

    // Bare winter trees. Wood is fertile, so these are also the only thing
    // holding green above the snowline once the drifts have moved.
    for (let i = 0; i < across(7); i++) {
      const cx = 4 + Math.floor(rng() * (WORLD_W - 8))
      const top = surfaceY(tiles, cx)
      if (top >= WORLD_H - 4) continue
      const trunk = 6 + Math.floor(rng() * 9)
      rect(tiles, cx, top - trunk, cx + 1, top, 'wood')
      for (let b = 0; b < 3; b++) {
        const by = top - trunk + 2 + b * 3
        const side = rng() < 0.5 ? -1 : 1
        const reach = 2 + Math.floor(rng() * 3)
        rect(
          tiles,
          Math.min(cx, cx + side * reach),
          by,
          Math.max(cx, cx + side * reach),
          by,
          'wood'
        )
      }
      rect(tiles, cx - 2, top - trunk - 2, cx + 3, top - trunk - 1, 'snow')
    }

    mossify(tiles, rng, 0.16, ['stone', 'wood'])
  },
}

const PEAKS: Theme = {
  id: 'peaks',
  name: 'Tall Peaks',
  blurb: 'Stone spires above the clouds, green ledges, and a valley a long way down.',
  sky: ['#67a6e6', '#122448'],
  gloom: 0.26,
  gravity: 1,
  starters: [
    { id: 'sunleaf', count: 22 },
    { id: 'frostcap', count: 10 },
    { id: 'bramble', count: 8 },
    { id: 'glowvine', count: 6 },
    { id: 'skybloom', count: 6 },
    { id: 'mite', count: 8 },
    { id: 'mote', count: 8 },
    { id: 'dustbee', count: 6 },
    { id: 'fluttermoth', count: 4 },
    { id: 'seedmite', count: 5 },
    { id: 'glimmer-moth', count: 5 },
    { id: 'hopper', count: 6 },
    { id: 'woolly', count: 5 },
    { id: 'delver', count: 4 },
    { id: 'driftmole', count: 3 },
    { id: 'wisp', count: 3 },
    { id: 'stalker', count: 2 },
    { id: 'sunhawk', count: 3 },
    { id: 'rimeclaw', count: 1 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const floorNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const cloudNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const valley = Math.floor(WORLD_H * 0.84)
    // Above this, rock goes white. It sits above both cloud bands, so the snow
    // line is a thing you look *up* at from inside the weather.
    const snowLine = Math.floor(WORLD_H * 0.28)

    for (let x = 0; x < WORLD_W; x++) {
      const h = ring1(floorNoise, x, 0.04, 1.5, 3)
      const surface = valley + Math.floor((h - 0.5) * 8)
      for (let y = surface; y < WORLD_H; y++) {
        const d = y - surface
        set(tiles, x, y, d === 0 ? 'grass' : d < 4 ? 'dirt' : 'stone')
      }
    }

    for (let i = 0; i < across(5); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const top = Math.floor(WORLD_H * (0.06 + rng() * 0.36))
      const baseHalf = 9 + Math.floor(rng() * 12)
      const base = surfaceY(tiles, cx)
      if (base >= WORLD_H) continue

      for (let y = top; y < base; y++) {
        const t = (y - top) / Math.max(1, base - top)
        // The exponent is what stops these reading as chimneys: a spire has to
        // flare out near the bottom and taper on the way up.
        const half = Math.round(baseHalf * Math.pow(t, 1.25))
        // Stop before it narrows to a single column. A one-tile needle a third
        // of the world tall is an aerial, not a mountain — the first pass had a
        // skyline of them.
        if (half < 2) continue
        for (let x = cx - half; x <= cx + half; x++) {
          // Snow on the flanks, and right through the cross-section wherever
          // the peak is too narrow to have flanks. Outer-edge-only at every
          // width leaves a white outline drawn around grey rock instead of a
          // cap sitting on it.
          const outer = half <= 4 || Math.abs(x - cx) >= half - 2
          set(tiles, x, y, y < snowLine && outer ? 'snow' : 'stone')
        }
      }

      /**
       * Ledges.
       *
       * Without these a spire is scenery: plants need fertile ground and the
       * only fertile ground would be the valley floor, so every living thing
       * would end up at the bottom and the height would be decoration. A shelf
       * of grass halfway up is what puts a food chain in the air.
       */
      const ledges = 2 + Math.floor(rng() * 3)
      for (let l = 0; l < ledges; l++) {
        const span = Math.max(1, base - top - 8)
        const ly = top + 5 + Math.floor(rng() * span)
        // A short spire has no room between its tip and the valley, and the
        // clamped span above will happily put the shelf below the mountain —
        // a strip of grass buried in the valley floor.
        if (ly >= base - 3) continue
        const t = (ly - top) / Math.max(1, base - top)
        const half = Math.max(2, Math.round(baseHalf * Math.pow(t, 1.25)))
        const side = rng() < 0.5 ? -1 : 1
        const reach = 4 + Math.floor(rng() * 6)
        const edge = cx + side * half
        const x0 = Math.min(edge, edge + side * reach)
        const x1 = Math.max(edge, edge + side * reach)
        rect(tiles, x0, ly, x1, ly, 'grass')
        rect(tiles, x0, ly + 1, x1, ly + 2, 'dirt')
      }
    }

    /**
     * Two bands of cloud between the peaks.
     *
     * Cloud isn't solid, so these are not platforms — you sink through them
     * slowly. That is exactly what they are for: in a world this vertical they
     * are the difference between a mis-step off a ledge and a lost creature.
     */
    for (const band of [0.34, 0.56]) {
      const cy = Math.floor(WORLD_H * band)
      for (let y = cy - 5; y <= cy + 5; y++) {
        const t = 1 - Math.abs(y - cy) / 6
        for (let x = 0; x < WORLD_W; x++) {
          if (tileAt(tiles, x, y) !== M.air) continue
          // Not `ring2`: the depth coordinate carries a per-band offset as well,
          // which is what stops the two cloud decks coming out as copies of each
          // other. Built by hand rather than widening `ring2` for one caller.
          const { u, v } = ringXY(x, 0.04)
          if (fbm3(cloudNoise, u, v, y * 0.13 + band * 10, 2) < 0.32 + t * 0.3) {
            set(tiles, x, y, 'cloud')
          }
        }
      }
    }

    for (let i = 0; i < across(8); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const cy = Math.floor(WORLD_H * (0.55 + rng() * 0.4))
      const roll = rng()
      const id: MaterialId = roll < 0.4 ? 'crystal' : roll < 0.7 ? 'gem' : 'gold'
      blob(tiles, cx, cy, 2 + Math.floor(rng() * 3), id, rng, ['stone', 'dirt'])
    }

    mossify(tiles, rng, 0.32, ['stone', 'dirt'])
  },
}

const CASTLE: Theme = {
  id: 'castle',
  name: 'Castle Town',
  blurb: 'A keep, a moat, houses with gardens — and something with wings above it.',
  sky: ['#93bce0', '#363d68'],
  gloom: 0.3,
  gravity: 1,
  starters: [
    { id: 'sunleaf', count: 24 },
    { id: 'bramble', count: 10 },
    { id: 'glowvine', count: 6 },
    { id: 'sporecap', count: 5 },
    { id: 'kelp', count: 6 },
    { id: 'skybloom', count: 4 },
    { id: 'mite', count: 8 },
    { id: 'mote', count: 6 },
    { id: 'dustbee', count: 6 },
    { id: 'fluttermoth', count: 3 },
    { id: 'seedmite', count: 5 },
    { id: 'glimmer-moth', count: 4 },
    { id: 'hopper', count: 8 },
    { id: 'finling', count: 6 },
    { id: 'woolly', count: 4 },
    { id: 'delver', count: 3 },
    { id: 'loamworm', count: 3 },
    { id: 'stalker', count: 2 },
    { id: 'tower-folk', count: 4 },
    { id: 'sunhawk', count: 1 },
    { id: 'dragon', count: 1 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const groundNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const oreNoise = makeNoise3D(Math.floor(rng() * 1e9))

    // Flatter than any other land here, on purpose: people build on the level,
    // and rolling hills would leave every house half-buried on one side.
    const groundLine = Math.floor(WORLD_H * 0.52)
    for (let x = 0; x < WORLD_W; x++) {
      const h = ring1(groundNoise, x, 0.02, 3.5, 2)
      const surface = groundLine + Math.floor((h - 0.5) * 6)
      for (let y = surface; y < WORLD_H; y++) {
        const d = y - surface
        const depth = d / (WORLD_H - surface)
        let mat: MaterialId = d === 0 ? 'grass' : d < 6 ? 'dirt' : 'stone'
        // Rare. At the thresholds this started on, the bedrock came out
        // confettied from end to end and the treasure stopped reading as
        // treasure.
        if (mat === 'stone') {
          const o = ring2Raw(oreNoise, x, 0.15, y, 0.15)
          if (depth > 0.6 && o > 0.965) mat = 'gold'
          else if (depth > 0.45 && o < 0.03) mat = 'bone'
          else if (depth > 0.5 && o > 0.945 && o <= 0.965) mat = 'gem'
        }
        set(tiles, x, y, mat)
      }
    }

    const mid = Math.floor(WORLD_W / 2)
    const keepHalf = 24
    const keepX0 = mid - keepHalf
    const keepX1 = mid + keepHalf
    const gy = surfaceY(tiles, mid)
    const keepTop = gy - 34

    hollow(tiles, keepX0, keepTop, keepX1, gy + 2, 'marble', 2)
    // Floors every eight rows, each with a gap in it. A sealed tower is a solid
    // block with a shell drawn on it as far as anything living is concerned —
    // the gaps are what make the inside somewhere you can actually get to.
    for (let fy = keepTop + 8; fy < gy - 2; fy += 8) {
      rect(tiles, keepX0 + 2, fy, keepX1 - 2, fy, 'wood')
      const gap = keepX0 + 4 + Math.floor(rng() * (keepHalf * 2 - 12))
      rect(tiles, gap, fy, gap + 3, fy, 'air')
    }
    // A spine wall down the middle, so each floor is two rooms. Without it the
    // cutaway is one enormous hall with shelves in it, which reads as scaffold
    // rather than as somewhere anybody lives.
    rect(tiles, mid - 1, keepTop + 2, mid, gy, 'marble')
    for (let fy = keepTop + 10; fy < gy; fy += 8) {
      rect(tiles, mid - 1, fy - 4, mid, fy - 1, 'air')
    }
    // Towers at both corners, and battlements: blocks with gaps between them,
    // because a flat parapet reads as an unfinished wall.
    for (const tx of [keepX0, keepX1 - 9]) {
      hollow(tiles, tx, keepTop - 12, tx + 9, keepTop + 4, 'marble', 2)
      for (let x = tx; x <= tx + 9; x += 3) {
        rect(tiles, x, keepTop - 15, x + 1, keepTop - 13, 'marble')
      }
    }
    for (let wy = keepTop + 6; wy < gy - 8; wy += 8) {
      rect(tiles, keepX0, wy, keepX0 + 1, wy + 2, 'glass')
      rect(tiles, keepX1 - 1, wy, keepX1, wy + 2, 'glass')
    }
    /**
     * A gate in each side wall, at ground level.
     *
     * Seen edge-on, a keep's door has to go through the *wall* — carving the
     * middle of the floor only moves air around inside a box that is still
     * sealed. Sealed is the failure here: plants would seed inside, grazers
     * would breed inside, and the whole thing would run as a separate little
     * world in a jar while the town outside never met any of it.
     */
    for (const gx of [keepX0, keepX1 - 1]) {
      rect(tiles, gx, gy - 8, gx + 1, gy, 'air')
      rect(tiles, gx, gy - 9, gx + 1, gy - 9, 'wood')
    }
    // Banners, painted onto the wall face rather than hung off it — a strip of
    // plastic floating beside a tower is a bug, not a flag. Colour is doing
    // real work here: a town of grey stone and white marble reads as a ruin.
    rect(tiles, keepX0, gy - 24, keepX0 + 1, gy - 14, 'plastic-red')
    rect(tiles, keepX1 - 1, gy - 24, keepX1, gy - 14, 'plastic-blue')
    // The vault, and the reason anything ever digs under a castle.
    hollow(tiles, mid - 10, gy + 14, mid + 10, gy + 26, 'iron')
    rect(tiles, mid - 7, gy + 22, mid + 7, gy + 24, 'gold')

    // The moat, one trench on each side. Carve first, then fill — and read each
    // column's surface before carving it, or the second pass finds the floor of
    // the hole the first one made.
    for (const side of [-1, 1]) {
      const mx = mid + side * (keepHalf + 24)
      const half = 14
      for (let x = mx - half; x <= mx + half; x++) {
        const top = surfaceY(tiles, x)
        if (top >= WORLD_H - 4) continue
        const t = 1 - Math.abs(x - mx) / (half + 1)
        const depth = 4 + Math.floor(t * 14)
        for (let d = 0; d <= depth; d++) set(tiles, x, top + d, 'air')
        for (let d = 2; d < depth; d++) set(tiles, x, top + d, 'water')
        set(tiles, x, top + depth, 'mud')
      }
    }

    /**
     * Cellars, and a tunnel joining them.
     *
     * Half this world is the ground under the town, and without these it is a
     * single grey slab with ore freckles in it. It is also the only thing down
     * there for a Delver or a Loamworm to find, which is the difference between
     * digging being a mechanic and digging being a way to pass the time.
     */
    const cellarY = groundLine + 20
    rect(tiles, 24, cellarY + 2, WORLD_W - 24, cellarY + 4, 'air')
    for (let i = 0; i < across(3); i++) {
      const cx = 40 + Math.floor(rng() * (WORLD_W - 90))
      const w = 16 + Math.floor(rng() * 20)
      const h = 10 + Math.floor(rng() * 6)
      hollow(tiles, cx, cellarY - h + 4, cx + w, cellarY + 5, rng() < 0.5 ? 'wood' : 'stone', 2)
      rect(tiles, cx, cellarY + 2, cx + w, cellarY + 4, 'air')
      if (rng() < 0.5) rect(tiles, cx + 3, cellarY + 1, cx + 7, cellarY + 1, 'gold')
      // A damp floor, so something can actually grow down here.
      rect(tiles, cx + 2, cellarY + 5, cx + w - 2, cellarY + 5, 'mud')
    }

    const house = (hx: number) => {
      const w = 10 + Math.floor(rng() * 10)
      const h = 9 + Math.floor(rng() * 7)
      const top = surfaceY(tiles, hx)
      // Anything this far below the town's ground line is the moat, or a hollow
      // something else already made. Houses do not get built in holes.
      if (top >= WORLD_H - 6 || top > groundLine + 8) return

      hollow(tiles, hx, top - h, hx + w, top - 1, rng() < 0.35 ? 'marble' : 'stone')
      rect(
        tiles,
        hx + 1,
        top - Math.floor(h * 0.45),
        hx + w - 1,
        top - Math.floor(h * 0.45),
        'wood'
      )
      rect(tiles, hx - 1, top - h - 2, hx + w + 1, top - h - 1, 'wood')
      rect(tiles, hx + 2, top - 5, hx + 3, top - 1, 'air')
      rect(tiles, hx + w - 4, top - h + 2, hx + w - 3, top - h + 3, 'glass')
      if (rng() < 0.6) {
        const flag: MaterialId = rng() < 0.5 ? 'plastic-red' : 'plastic-yellow'
        const fx = hx + Math.floor(w / 2)
        rect(tiles, fx, top - h - 1, fx, top - h + 4, flag)
      }
      // A garden beside it. The town has to feed itself, and moss and dirt are
      // the difference between a set and a place with a food chain in it.
      rect(tiles, hx + w + 2, top, hx + w + 8, top, 'moss')
      rect(tiles, hx + w + 2, top + 1, hx + w + 8, top + 3, 'dirt')
    }

    /**
     * One lot at a time, evenly spaced with a jitter inside each.
     *
     * Scattering houses at random across the width gives you three in a heap
     * and then a hundred empty tiles, which reads as ruins rather than as a
     * street. The jitter is what keeps it from reading as a spreadsheet.
     */
    const lots = across(6)
    const stride = WORLD_W / lots
    for (let i = 0; i < lots; i++) {
      const hx = Math.floor(i * stride + 4 + rng() * stride * 0.3)
      if (Math.abs(hx - mid) < keepHalf + 42) continue
      house(hx)
    }

    mossify(tiles, rng, 0.2, ['stone', 'dirt'])
  },
}

const CANDY: Theme = {
  id: 'candy',
  name: 'Candy Parade',
  blurb: 'Layer-cake hills, caramel rivers, rock candy, and clouds you could eat.',
  sky: ['#ffdcee', '#ff9dc4'],
  gloom: 0.1,
  // A shade less pull than everywhere else, so a parade bounces. Small enough
  // that nothing about the food chain changes; large enough to feel.
  gravity: 0.85,
  starters: [
    { id: 'sunleaf', count: 22 },
    { id: 'bramble', count: 8 },
    { id: 'sporecap', count: 8 },
    { id: 'glowvine', count: 6 },
    { id: 'skybloom', count: 6 },
    { id: 'frostcap', count: 4 },
    { id: 'mite', count: 8 },
    { id: 'mote', count: 8 },
    { id: 'dustbee', count: 7 },
    { id: 'fluttermoth', count: 4 },
    { id: 'seedmite', count: 5 },
    { id: 'glimmer-moth', count: 6 },
    { id: 'hopper', count: 7 },
    { id: 'palecrawler', count: 4 },
    { id: 'drifter-jelly', count: 5 },
    { id: 'wisp', count: 4 },
    { id: 'woolly', count: 3 },
    { id: 'unicycle-clown', count: 3 },
    { id: 'stalker', count: 2 },
    { id: 'sunhawk', count: 1 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const surfaceNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const seamNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const flossNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const skyDepth = Math.floor(WORLD_H * 0.36)
    const STRIPES: MaterialId[] = [
      'plastic-pink',
      'plastic-white',
      'plastic-yellow',
      'plastic-purple',
    ]

    for (let x = 0; x < WORLD_W; x++) {
      const h = ring1(surfaceNoise, x, 0.028, 6.5, 3)
      const surface = Math.floor(skyDepth + (h - 0.5) * 20)

      for (let y = surface; y < WORLD_H; y++) {
        const d = y - surface
        /**
         * Icing, then biscuit, then cake in bands.
         *
         * The first two are not decoration. Nothing in the sweet-shop half of
         * the material table is fertile — not plastic, not crystal, not gem,
         * not cloud, not sap — so a world built only out of those is a
         * beautiful one where no plant can root, nothing eats, and every
         * creature is dead inside two minutes. Icing is snow and biscuit is
         * wood; together with the sugar seams below they are the only reason
         * this land has a food chain at all.
         */
        let mat: MaterialId
        if (d < 2) mat = 'snow'
        else if (d < 6) mat = 'wood'
        else mat = STRIPES[Math.floor((d - 6) / 5) % STRIPES.length]

        if (d >= 6 && ring2Raw(seamNoise, x, 0.1, y, 0.1) > 0.85) mat = 'sand'
        if (d >= 12 && ring2Raw(seamNoise, x, 0.24, y, 0.24) < 0.055) {
          mat = rng() < 0.5 ? 'gem-green' : 'gem-purple'
        }
        set(tiles, x, y, mat)
      }
    }

    // Caramel. Sap is a liquid you can breathe in and it barely flows, so these
    // stay put and stay survivable — a river of anything else this thick would
    // be a drowning hazard dressed as a treat.
    for (let i = 0; i < across(3); i++) {
      const cx = 14 + Math.floor(rng() * (WORLD_W - 28))
      const w = 4 + Math.floor(rng() * 5)
      for (let x = cx - w; x <= cx + w; x++) {
        const top = surfaceY(tiles, x)
        const t = 1 - Math.abs(x - cx) / (w + 1)
        const depth = Math.floor(t * 8)
        for (let d = 0; d < depth; d++) set(tiles, x, top + d, 'sap')
      }
    }

    // Rock candy, growing up out of the cake.
    const ROCK_CANDY: MaterialId[] = [
      'crystal-pink',
      'crystal-blue',
      'crystal-purple',
      'crystal-green',
    ]
    for (let i = 0; i < across(6); i++) {
      const cx = 4 + Math.floor(rng() * (WORLD_W - 8))
      const base = surfaceY(tiles, cx)
      if (base >= WORLD_H) continue
      const h = 6 + Math.floor(rng() * 13)
      const id = ROCK_CANDY[Math.floor(rng() * ROCK_CANDY.length)]
      for (let d = 0; d < h; d++) {
        const half = Math.max(0, Math.round((1 - d / h) * 2.5))
        rect(tiles, cx - half, base - d - 1, cx + half, base - d - 1, id)
      }
    }

    /**
     * Candyfloss, kept well above the hilltops so it stays weather rather than
     * a lid over the whole world.
     *
     * Broad and low-frequency on purpose. Finer noise here produced a haze of
     * single pink tiles across the sky — at one tile per world tile that isn't
     * cloud, it's static. Each puff also commits to one colour, because
     * choosing per tile speckles the two together into one mauve smear.
     */
    for (let y = 3; y < skyDepth - 8; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (tileAt(tiles, x, y) !== M.air) continue
        if (ring2(flossNoise, x, 0.022, y, 0.07, 2) > 0.6) {
          set(tiles, x, y, ring1(flossNoise, x, 0.008, 40.5, 1) > 0.5 ? 'cloud-pink' : 'cloud-white')
        }
      }
    }
  },
}

const BIOME_WORLD: Theme = {
  id: 'biome-world',
  name: 'Three Lands',
  blurb: 'Forest, open plains, and desert — three biomes side by side.',
  sky: ['#8ecf9a', '#2a5c3a'],
  gloom: 0.18,
  gravity: 1,
  starters: [
    { id: 'sunleaf', count: 20 },
    { id: 'glowvine', count: 8 },
    { id: 'bramble', count: 10 },
    { id: 'skybloom', count: 8 },
    { id: 'sporecap', count: 6 },
    { id: 'mite', count: 10 },
    { id: 'mote', count: 8 },
    { id: 'hopper', count: 6 },
    { id: 'dustbee', count: 6 },
    { id: 'fluttermoth', count: 4 },
    { id: 'seedmite', count: 5 },
    { id: 'loamworm', count: 4 },
    { id: 'glimmer-moth', count: 4 },
    { id: 'woolly', count: 4 },
    { id: 'delver', count: 3 },
    { id: 'ember-grub', count: 4 },
    { id: 'stalker', count: 2 },
    { id: 'sunhawk', count: 2 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const surfaceNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const featureNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const THIRD = Math.floor(WORLD_W / 3)
    const skyDepth = Math.floor(WORLD_H * 0.30)
    const BLEND = 18  // border blend width in tiles

    for (let x = 0; x < WORLD_W; x++) {
      // Smooth biome blend factor at borders: 0 = first biome, 1 = second biome
      const leftBorder = THIRD
      const rightBorder = THIRD * 2

      // blendFP: 0 = pure forest, 1 = pure plains (active in transition zone)
      const blendFP = x < leftBorder - BLEND ? 0
        : x > leftBorder ? 1
        : (x - (leftBorder - BLEND)) / BLEND

      // blendPD: 0 = pure plains, 1 = pure desert
      const blendPD = x < rightBorder - BLEND ? 0
        : x > rightBorder ? 1
        : (x - (rightBorder - BLEND)) / BLEND

      // Terrain height per biome
      const forestH = ring1(surfaceNoise, x, 0.030, 0.5, 3)
      const forestSurf = skyDepth + (forestH - 0.5) * 22

      const plainsH = ring1(surfaceNoise, x, 0.014, 100.5, 2)
      const plainsSurf = skyDepth + (plainsH - 0.5) * 8 + 4

      const desertH = ring1(surfaceNoise, x, 0.020, 300.5, 2)
      const desertSurf = skyDepth + (desertH - 0.5) * 16 + 6

      // Blend surface heights at borders
      let rawSurf: number
      if (x < leftBorder) {
        rawSurf = forestSurf * (1 - blendFP) + plainsSurf * blendFP
      } else if (x < rightBorder) {
        rawSurf = plainsSurf * (1 - blendPD) + desertSurf * blendPD
      } else {
        rawSurf = desertSurf
      }
      const surface = Math.floor(rawSurf)

      for (let y = surface; y < WORLD_H; y++) {
        const depth = (y - surface) / (WORLD_H - surface)
        let mat: MaterialId

        if (x < leftBorder) {
          // Forest: grass crust, dirt, stone, deep lava
          if (depth < 0.02) mat = 'grass'
          else if (depth < 0.16) mat = 'dirt'
          else if (depth < 0.85) mat = 'stone'
          else mat = 'lava'
        } else if (x < rightBorder) {
          // Plains: thicker grass layer, dirt, stone
          if (depth < 0.04) mat = 'grass'
          else if (depth < 0.20) mat = 'dirt'
          else if (depth < 0.85) mat = 'stone'
          else mat = 'lava'
        } else {
          // Desert: deep sand over stone
          if (depth < 0.28) mat = 'sand'
          else if (depth < 0.85) mat = 'stone'
          else mat = 'lava'
        }

        set(tiles, x, y, mat)
      }
    }

    // Forest trees: wood columns above ground with moss canopy
    for (let x = 4; x < THIRD - 4; x++) {
      if (ring1(featureNoise, x, 0.18, 0.2, 1) > 0.52) {
        const sy = surfaceY(tiles, x)
        const height = 4 + Math.floor(rng() * 5)
        for (let dy = 1; dy <= height; dy++) {
          set(tiles, x, sy - dy, 'wood')
        }
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = height - 1; dy <= height + 2; dy++) {
            if (rng() > 0.35) set(tiles, x + dx, sy - dy, 'moss')
          }
        }
      }
    }

    // Forest: water springs (3–4 pools)
    const springCount = 3 + Math.floor(rng() * 2)
    for (let i = 0; i < springCount; i++) {
      const sx = 20 + Math.floor(rng() * (THIRD - 40))
      const sy = surfaceY(tiles, sx)
      blob(tiles, sx, sy + 3 + Math.floor(rng() * 4), 3, 'water', rng, ['dirt', 'stone'])
    }

    // Plains: scattered water pools
    for (let i = 0; i < 3; i++) {
      const px = THIRD + 20 + Math.floor(rng() * (THIRD - 40))
      const sy = surfaceY(tiles, px)
      blob(tiles, px, sy + 2, 4, 'water', rng, ['dirt', 'stone', 'grass'])
    }

    // Desert: stone rock formations
    for (let rx = THIRD * 2 + 25; rx < WORLD_W - 20; rx += 30 + Math.floor(rng() * 25)) {
      const sy = surfaceY(tiles, rx)
      const height = 3 + Math.floor(rng() * 6)
      for (let dy = 0; dy < height; dy++) {
        set(tiles, rx, sy - dy, 'stone')
        if (rng() > 0.4) set(tiles, rx + 1, sy - dy, 'stone')
      }
    }

    // Desert: buried aquifer (water at depth ~78%)
    const waterTable = Math.floor(WORLD_H * 0.78)
    for (let x = THIRD * 2; x < WORLD_W; x++) {
      for (let dy = 0; dy < 3; dy++) {
        const y = waterTable + dy
        if (y < WORLD_H && tileAt(tiles, x, y) !== M.air) {
          set(tiles, x, y, 'water')
        }
      }
    }
  },
}

const MUSHROOM_FOREST: Theme = {
  id: 'mushroom-forest',
  name: 'The Spore Wood',
  blurb: 'Rot and bloom together. Something has been growing here for a long time.',
  sky: ['#1a0d2e', '#0a0618'],
  gloom: 0.5,
  gravity: 1,
  starters: [
    { id: 'glowvine', count: 25 },
    { id: 'sporecap', count: 20 },
    { id: 'loamworm', count: 10 },
    { id: 'mite', count: 10 },
    { id: 'delver', count: 5 },
    { id: 'stalker', count: 2 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const groundNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const treeNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const skyDepth = Math.floor(WORLD_H * 0.44)

    // Muddy ground: shallow surface layer is mud, then dirt, then stone.
    for (let x = 0; x < WORLD_W; x++) {
      const h = ring1(groundNoise, x, 0.022, 4.5, 2)
      const surface = Math.floor(skyDepth + (h - 0.5) * 12)
      for (let y = surface; y < WORLD_H; y++) {
        const d = y - surface
        const depth = d / (WORLD_H - surface)
        set(tiles, x, y, d < 3 ? 'mud' : depth < 0.3 ? 'dirt' : 'stone')
      }
    }

    // Dense wood columns — mushroom stems and ancient fungi, packed tightly.
    // Two passes: tall thick ones, then shorter ones to fill gaps.
    for (let pass = 0; pass < 2; pass++) {
      for (let x = 2; x < WORLD_W - 2; x++) {
        const thresh = pass === 0 ? 0.52 : 0.40
        if (ring1(treeNoise, x, 0.13, 0.7 + pass * 50, 1) < thresh) continue
        const sy = surfaceY(tiles, x)
        if (sy >= WORLD_H - 4) continue
        const height = pass === 0
          ? 10 + Math.floor(rng() * 14)
          : 4 + Math.floor(rng() * 6)
        const capW = pass === 0 ? 2 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2)
        // Stem
        for (let dy = 1; dy <= height; dy++) set(tiles, x, sy - dy, 'wood')
        // Moss cap
        for (let dx = -capW; dx <= capW; dx++) {
          set(tiles, x + dx, sy - height - 1, 'moss')
          if (Math.abs(dx) < capW) set(tiles, x + dx, sy - height - 2, 'moss')
        }
      }
    }

    // Fallen logs: horizontal wood rects resting on the forest floor.
    for (let i = 0; i < across(6); i++) {
      const cx = 8 + Math.floor(rng() * (WORLD_W - 16))
      const sy = surfaceY(tiles, cx)
      if (sy >= WORLD_H - 2) continue
      const logW = 9 + Math.floor(rng() * 14)
      rect(tiles, cx, sy, cx + logW, sy, 'wood')
      rect(tiles, cx, sy + 1, cx + logW, sy + 1, 'wood')
    }

    // Sap pools on the forest floor — spore goo where sporecap plants will root.
    for (let i = 0; i < across(9); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const sy = surfaceY(tiles, cx)
      if (sy >= WORLD_H) continue
      const w = 3 + Math.floor(rng() * 7)
      for (let x = cx - w; x <= cx + w; x++) {
        const t = 1 - Math.abs(x - cx) / (w + 1)
        const poolY = surfaceY(tiles, x)
        for (let d = 0; d < Math.floor(t * 3); d++) {
          set(tiles, x, poolY + d, 'sap')
        }
      }
    }

    // Scattered mud pockets underground.
    for (let i = 0; i < across(7); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const sy = surfaceY(tiles, cx)
      if (sy >= WORLD_H) continue
      blob(tiles, cx, sy + 2 + Math.floor(rng() * 4), 2 + Math.floor(rng() * 4), 'mud', rng, [
        'dirt',
        'stone',
      ])
    }

    // Bone in the soil — what the forest has claimed over the years.
    for (let i = 0; i < across(6); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const cy = Math.floor(WORLD_H * (0.5 + rng() * 0.4))
      blob(tiles, cx, cy, 1 + Math.floor(rng() * 2), 'bone', rng, ['dirt', 'stone', 'mud'])
    }

    // Sparse gem seams deep in the rock — the forest hides old wealth.
    for (let i = 0; i < across(4); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const cy = Math.floor(WORLD_H * (0.7 + rng() * 0.25))
      blob(tiles, cx, cy, 1 + Math.floor(rng() * 2), rng() < 0.6 ? 'gem' : 'crystal', rng, ['stone'])
    }

    // Moss covers everything exposed: mud, dirt, wood.
    mossify(tiles, rng, 0.48, ['mud', 'dirt', 'wood'])
  },
}

const CAVE: Theme = {
  id: 'cave',
  name: 'The Deep',
  blurb: 'Stone in every direction. Crystals older than the surface. Things that never needed eyes.',
  sky: ['#0c051e', '#04020d'],
  gloom: 0.65,
  gravity: 1,
  starters: [
    { id: 'glowvine', count: 20 },
    { id: 'sporecap', count: 12 },
    { id: 'loamworm', count: 8 },
    { id: 'delver', count: 6 },
    { id: 'finling', count: 8 },
  ],
  build: (tiles, rng) => {
    // The whole world is stone to start; everything is carved out of it.
    fill(tiles, 'stone')

    const edgeNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const oreNoise = makeNoise3D(Math.floor(rng() * 1e9))

    // BSP carves connected cave chambers — same trick as STATION but organic.
    interface CaveBox { x0: number; y0: number; x1: number; y1: number }
    const chambers: Array<{ cx: number; cy: number; rx: number; ry: number }> = []

    const margin = 12
    const maxDepth = 4 + Math.round(Math.log2(WIDTH_SCALE))

    function split(box: CaveBox, depth: number) {
      const w = box.x1 - box.x0
      const h = box.y1 - box.y0
      // Stop when the box is cave-sized or we have enough chambers.
      if (depth > maxDepth || (w < 38 && h < 30) || chambers.length >= across(5)) {
        const cx = box.x0 + Math.floor(w * (0.3 + rng() * 0.4))
        const cy = box.y0 + Math.floor(h * (0.3 + rng() * 0.4))
        chambers.push({
          cx,
          cy,
          rx: Math.max(7, Math.floor(w * 0.27)),
          ry: Math.max(5, Math.floor(h * 0.27)),
        })
        return
      }
      const horizontal = w > h * 1.3 ? true : h > w * 1.3 ? false : rng() > 0.5
      if (horizontal) {
        const cut = box.x0 + Math.floor(w * (0.35 + rng() * 0.3))
        split({ ...box, x1: cut }, depth + 1)
        split({ ...box, x0: cut }, depth + 1)
      } else {
        const cut = box.y0 + Math.floor(h * (0.35 + rng() * 0.3))
        split({ ...box, y1: cut }, depth + 1)
        split({ ...box, y0: cut }, depth + 1)
      }
    }

    split({ x0: margin, y0: margin, x1: WORLD_W - margin, y1: WORLD_H - margin }, 0)

    // Carve each chamber as a noise-deformed ellipse.
    for (const { cx, cy, rx, ry } of chambers) {
      for (let y = cy - ry; y <= cy + ry; y++) {
        for (let x = cx - rx; x <= cx + rx; x++) {
          const nx = (x - cx) / (rx + 1)
          const ny = (y - cy) / (ry + 1)
          const dist = Math.sqrt(nx * nx + ny * ny)
          // Edge noise makes the boundary rough rather than a perfect ellipse.
          const noise = ring2Raw(edgeNoise, x, 0.07, y, 0.07) * 0.38
          if (dist < 0.64 + noise) set(tiles, x, y, 'air')
        }
      }
    }

    // Connect chambers with Z-shaped tunnels (horizontal → vertical → horizontal).
    // Sort by centre X so each chamber connects to its horizontal neighbour.
    const sorted = [...chambers].sort((a, b) => a.cx - b.cx)
    for (let i = 0; i + 1 < sorted.length; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      const midX = Math.floor((a.cx + b.cx) / 2)
      // Leg 1: horizontal from a to midX at a's depth.
      for (let x = Math.min(a.cx, midX); x <= Math.max(a.cx, midX); x++) {
        for (let dy = -2; dy <= 2; dy++) set(tiles, x, a.cy + dy, 'air')
      }
      // Leg 2: vertical between the two depths.
      for (let y = Math.min(a.cy, b.cy) - 2; y <= Math.max(a.cy, b.cy) + 2; y++) {
        for (let dx = -2; dx <= 2; dx++) set(tiles, midX + dx, y, 'air')
      }
      // Leg 3: horizontal from midX to b.
      for (let x = Math.min(midX, b.cx); x <= Math.max(midX, b.cx); x++) {
        for (let dy = -2; dy <= 2; dy++) set(tiles, x, b.cy + dy, 'air')
      }
    }

    // Stalactites: stone columns hanging down from cave ceilings into open air.
    // A ceiling tile is stone (y) with air below it (y+1); the stalactite extends
    // further downward into that air.
    for (let x = 0; x < WORLD_W; x++) {
      for (let y = 0; y < WORLD_H - 1; y++) {
        if (tileAt(tiles, x, y) !== M.stone) continue
        if (tileAt(tiles, x, y + 1) !== M.air) continue
        if (rng() > 0.18) continue
        const length = 2 + Math.floor(rng() * 7)
        for (let d = 1; d <= length; d++) {
          if (tileAt(tiles, x, y + d) !== M.air) break
          set(tiles, x, y + d, 'stone')
        }
      }
    }

    // Underground lakes: water in the air space just above cave floors,
    // only in chambers sitting below the mid-point of the world.
    for (const { cx, cy } of chambers) {
      if (cy < WORLD_H * 0.44 || rng() > 0.55) continue
      const lakeW = 5 + Math.floor(rng() * 14)
      for (let x = cx - lakeW; x <= cx + lakeW; x++) {
        // Scan downward from cy to find the floor of the chamber at this column.
        let floorY = -1
        for (let y = cy; y < Math.min(WORLD_H, cy + 24); y++) {
          if (tileAt(tiles, x, y) === M.stone) { floorY = y; break }
        }
        if (floorY < 0) continue
        const t = 1 - Math.abs(x - cx) / (lakeW + 1)
        const depth = Math.floor(t * 5)
        for (let d = 1; d <= depth; d++) {
          if (tileAt(tiles, x, floorY - d) === M.air) set(tiles, x, floorY - d, 'water')
        }
      }
    }

    // Lava pockets in the lower quarter — the deep rock is still hot.
    for (let i = 0; i < across(3); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const cy = Math.floor(WORLD_H * (0.70 + rng() * 0.22))
      blob(tiles, cx, cy, 3 + Math.floor(rng() * 5), 'lava', rng, ['stone'])
    }

    // Crystal and gem veins grow in the stone walls.
    for (let i = 0; i < across(14); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const cy = Math.floor(WORLD_H * (0.08 + rng() * 0.84))
      const t = ring2Raw(oreNoise, cx, 0.05, cy, 0.05)
      const id: MaterialId = t < 0.4 ? 'crystal' : t < 0.75 ? 'gem' : 'gold'
      blob(tiles, cx, cy, 2 + Math.floor(rng() * 3), id, rng, ['stone'])
    }

    // Ancient bone deposits — whatever once lived down here.
    for (let i = 0; i < across(5); i++) {
      const cx = Math.floor(rng() * WORLD_W)
      const cy = Math.floor(WORLD_H * (0.25 + rng() * 0.65))
      blob(tiles, cx, cy, 2 + Math.floor(rng() * 2), 'bone', rng, ['stone'])
    }

    // Moss on the exposed stone floors and walls where moisture collects.
    mossify(tiles, rng, 0.28, ['stone'])
  },
}

const GRASSLAND: Theme = {
  id: 'grassland',
  name: 'Grassland Meadow',
  blurb: 'Rolling hills, shallow ponds, and a simple food chain finding its balance.',
  sky: ['#a8d8f0', '#e8f4d4'],
  gloom: 0.08,
  gravity: 1,
  starters: [
    // Plants
    { id: 'sunleaf', count: 18 },
    { id: 'bramble', count: 12 },
    { id: 'skybloom', count: 8 },
    // Plant eaters (× 3 species, ~16 total)
    { id: 'mite', count: 7 },
    { id: 'hopper', count: 6 },
    { id: 'woolly', count: 5 },
    // Pollinator
    { id: 'dustbee', count: 4 },
    // Predators
    { id: 'stalker', count: 2 },
    { id: 'sunhawk', count: 1 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const surfaceNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const skyDepth = Math.floor(WORLD_H * 0.35)

    for (let x = 0; x < WORLD_W; x++) {
      const h = ring1(surfaceNoise, x, 0.03, 0.5, 2)
      const surface = Math.floor(skyDepth + (h - 0.5) * 14)
      for (let y = surface; y < WORLD_H; y++) {
        const depth = (y - surface) / (WORLD_H - surface)
        const mat: MaterialId =
          y === surface ? 'grass' :
          depth < 0.28  ? 'dirt'  :
          'stone'
        set(tiles, x, y, mat)
      }
    }

    // Shallow ponds
    const ponds = across(2) + Math.floor(rng() * across(1))
    for (let p = 0; p < ponds; p++) {
      const cx = Math.floor(rng() * WORLD_W)
      const w = 7 + Math.floor(rng() * 10)
      for (let x = cx - w; x <= cx + w; x++) {
        const sy = surfaceY(tiles, x)
        const t = 1 - Math.abs(x - cx) / (w + 1)
        const d = Math.floor(t * 4)
        for (let i = 0; i < d; i++) set(tiles, x, sy + i, 'water')
        if (tileAt(tiles, x, sy + d) === M.dirt) set(tiles, x, sy + d, 'mud')
      }
    }

    mossify(tiles, rng, 0.3, ['dirt'])
  },
}

const TROPICAL_ISLAND: Theme = {
  id: 'tropical-island',
  name: 'Tropical Island',
  blurb: 'Sandy shores, warm shallows, and creatures that thrive where land meets sea.',
  sky: ['#5bc8f5', '#1a6fa8'],
  gloom: 0.06,
  gravity: 1,
  starters: [
    // Plants
    { id: 'sunleaf', count: 14 },
    { id: 'kelp', count: 16 },
    { id: 'skybloom', count: 6 },
    // Plant eaters (× 3 species, ~17 total)
    { id: 'mite', count: 7 },
    { id: 'finling', count: 6 },
    { id: 'crystal-snail', count: 4 },
    // Pollinator
    { id: 'fluttermoth', count: 3 },
    // Predators
    { id: 'gulper', count: 3 },
    { id: 'sunhawk', count: 2 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const surfaceNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const skyDepth = Math.floor(WORLD_H * 0.38)
    const waterLine = skyDepth + 5

    // Terrain pass
    for (let x = 0; x < WORLD_W; x++) {
      const h = ring1(surfaceNoise, x, 0.022, 5.0, 3)
      const landY = Math.floor(skyDepth + (h - 0.5) * 22)
      const surface = Math.min(landY, waterLine)

      for (let y = surface; y < WORLD_H; y++) {
        const depth = (y - surface) / (WORLD_H - surface)
        const aboveWater = landY <= waterLine
        const mat: MaterialId =
          y < landY                   ? 'sand'  :
          y === landY && aboveWater   ? (landY <= waterLine - 3 ? 'grass' : 'sand') :
          y === landY                 ? 'sand'  :
          depth < 0.22                ? (aboveWater ? 'dirt' : 'sand') :
          'stone'
        set(tiles, x, y, mat)
      }
    }

    // Fill water in low valleys up to the waterLine
    for (let x = 0; x < WORLD_W; x++) {
      const sy = surfaceY(tiles, x)
      if (sy >= waterLine) {
        for (let y = waterLine; y < sy; y++) set(tiles, x, y, 'water')
      }
    }
  },
}

const VERDANT_FOREST: Theme = {
  id: 'verdant-forest',
  name: 'Verdant Forest',
  blurb: 'Ancient trees, soft earth, and a canopy thick enough to make its own weather.',
  sky: ['#2d5a27', '#0e1f0c'],
  gloom: 0.35,
  gravity: 1,
  starters: [
    // Plants
    { id: 'sunleaf', count: 16 },
    { id: 'glowvine', count: 10 },
    { id: 'bramble', count: 8 },
    // Plant eaters (× 3 species, ~18 total)
    { id: 'mote', count: 7 },
    { id: 'loamworm', count: 6 },
    { id: 'woolly', count: 5 },
    // Pollinator
    { id: 'seedmite', count: 2 },
    // Predators
    { id: 'stalker', count: 3 },
    { id: 'grumblestone', count: 2 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const groundNoise = makeNoise3D(Math.floor(rng() * 1e9))
    const treeNoise = makeNoise3D(Math.floor(rng() * 1e9))

    const skyDepth = Math.floor(WORLD_H * 0.33)

    for (let x = 0; x < WORLD_W; x++) {
      const h = ring1(groundNoise, x, 0.028, 2.0, 2)
      const surface = Math.floor(skyDepth + (h - 0.5) * 12)
      for (let y = surface; y < WORLD_H; y++) {
        const depth = (y - surface) / (WORLD_H - surface)
        const mat: MaterialId =
          y === surface ? 'mud'  :
          depth < 0.2   ? 'dirt' :
          'stone'
        set(tiles, x, y, mat)
      }
    }

    // Tree trunks — scattered wood columns rising from the surface
    const treeCount = across(10) + Math.floor(rng() * across(4))
    for (let t = 0; t < treeCount; t++) {
      const tx = Math.floor(rng() * WORLD_W)
      const sy = surfaceY(tiles, tx)
      const height = 5 + Math.floor(rng() * 8)
      for (let i = 0; i < height; i++) set(tiles, tx, sy - 1 - i, 'wood')
    }

    // A couple of ponds
    const ponds = across(2) + Math.floor(rng() * across(1))
    for (let p = 0; p < ponds; p++) {
      const cx = Math.floor(rng() * WORLD_W)
      const w = 6 + Math.floor(rng() * 8)
      for (let x = cx - w; x <= cx + w; x++) {
        const sy = surfaceY(tiles, x)
        const t = 1 - Math.abs(x - cx) / (w + 1)
        const d = Math.floor(t * 4)
        for (let i = 0; i < d; i++) set(tiles, x, sy + i, 'water')
        if (tileAt(tiles, x, sy + d) === M.mud || tileAt(tiles, x, sy + d) === M.dirt) {
          set(tiles, x, sy + d, 'mud')
        }
      }
    }

    mossify(tiles, rng, 0.45, ['dirt', 'mud'])
  },
}

/**
 * Order is the order of the picker, and it is a reading order: nothing, then
 * the world most like ours, then the ones that bend it further and further.
 */
export const THEMES: Theme[] = [
  EMPTY,
  GRASSLAND,
  TROPICAL_ISLAND,
  VERDANT_FOREST,
  TIDEPOOL,
]

export const THEME_BY_ID: Record<string, Theme> = Object.fromEntries(THEMES.map(t => [t.id, t]))

/**
 * The land with nothing in it.
 *
 * Named separately from `DEFAULT_THEME` even though they are the same string
 * today: one is "where a new player starts", the other is "what clearing the
 * world means", and a decision to open somewhere less bare should not silently
 * redefine empty.
 */
export const EMPTY_THEME_ID = 'empty'

export const DEFAULT_THEME = EMPTY_THEME_ID
