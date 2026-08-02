/**
 * Themes — the worlds you can switch between.
 *
 * A theme is a terrain generator plus a mood: what the void behind the world
 * looks like, how dark it is, how hard gravity pulls, and which creatures show
 * up already living there. Switching themes rebuilds the tile grid; summoned
 * creatures survive the change.
 */
import { WIDTH_SCALE, WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { type Rng, fbm, makeNoise2D } from '@/app/micro-land/domain/sim/prng'
import type { MaterialId } from '@/app/micro-land/domain/types'

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

function fill(tiles: Uint8Array, id: MaterialId) {
  tiles.fill(M[id])
}

function set(tiles: Uint8Array, x: number, y: number, id: MaterialId) {
  if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return
  tiles[y * WORLD_W + x] = M[id]
}

function rect(tiles: Uint8Array, x0: number, y0: number, x1: number, y1: number, id: MaterialId) {
  for (let y = Math.max(0, y0); y <= Math.min(WORLD_H - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(WORLD_W - 1, x1); x++) {
      tiles[y * WORLD_W + x] = M[id]
    }
  }
}

function tileAt(tiles: Uint8Array, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return -1
  return tiles[y * WORLD_W + x]
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
    const surfaceNoise = makeNoise2D(Math.floor(rng() * 1e9))
    const caveNoise = makeNoise2D(Math.floor(rng() * 1e9))
    const oreNoise = makeNoise2D(Math.floor(rng() * 1e9))
    const treasureNoise = makeNoise2D(Math.floor(rng() * 1e9))

    const skyDepth = Math.floor(WORLD_H * 0.3)
    // Anything this far above the average hilltop keeps its snow.
    const snowLine = skyDepth - 4

    for (let x = 0; x < WORLD_W; x++) {
      // Rolling hills: a couple of octaves is enough at this width.
      const h = fbm(surfaceNoise, x * 0.035, 0.5, 3)
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
          const c = fbm(caveNoise, x * 0.06, y * 0.09, 3)
          if (c > 0.62) mat = 'air'
        }
        // Occasional water pockets and sand seams.
        if (mat === 'stone' && depth > 0.35 && depth < 0.7) {
          const o = oreNoise(x * 0.12, y * 0.12)
          if (o > 0.88) mat = 'water'
          else if (o < 0.08) mat = 'sand'
        }
        // Things worth digging for. Deeper is better, which is the point:
        // gold and crystal sit below the lava-adjacent rock, so getting there
        // costs something.
        if (mat === 'stone') {
          const t = treasureNoise(x * 0.19, y * 0.19)
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
        if (x < 0 || x >= WORLD_W) continue
        // Find the surface at this column, then scoop a bowl into it.
        let surface = 0
        while (surface < WORLD_H && tiles[surface * WORLD_W + x] === M.air) surface++
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
    { id: 'crystal-snail', count: 4 },
    { id: 'gulper', count: 2 },
    { id: 'drifter-jelly', count: 4 },
  ],
  build: (tiles, rng) => {
    fill(tiles, 'air')
    const floorNoise = makeNoise2D(Math.floor(rng() * 1e9))
    const shelfNoise = makeNoise2D(Math.floor(rng() * 1e9))

    const waterLine = Math.floor(WORLD_H * 0.34)

    for (let x = 0; x < WORLD_W; x++) {
      const f = fbm(floorNoise, x * 0.045, 2.5, 3)
      const floor = Math.floor(WORLD_H * 0.66 + (f - 0.5) * 26)

      for (let y = waterLine; y < floor; y++) set(tiles, x, y, 'water')
      for (let y = floor; y < WORLD_H; y++) {
        const depth = y - floor
        // Sand on top, then the silt that collects under it, then bedrock.
        set(tiles, x, y, depth < 3 ? 'sand' : depth < 6 ? 'mud' : 'stone')
      }

      // Rock shelves that break the surface — the tide leaves these dry.
      const s = fbm(shelfNoise, x * 0.03, 8.5, 2)
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
      let y = 0
      while (y < WORLD_H && tiles[y * WORLD_W + cx] === M.air) y++
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
    const surfaceNoise = makeNoise2D(Math.floor(rng() * 1e9))
    const caveNoise = makeNoise2D(Math.floor(rng() * 1e9))

    const skyDepth = Math.floor(WORLD_H * 0.28)

    for (let x = 0; x < WORLD_W; x++) {
      const h = fbm(surfaceNoise, x * 0.05, 1.5, 4)
      const surface = Math.floor(skyDepth + (h - 0.5) * 30)

      for (let y = surface; y < WORLD_H; y++) {
        const depth = (y - surface) / (WORLD_H - surface)
        let mat: MaterialId
        if (depth < 0.06) mat = 'ash'
        else if (depth > 0.86) mat = 'lava'
        else mat = depth > 0.55 ? 'obsidian' : 'stone'

        if ((mat === 'stone' || mat === 'obsidian') && depth < 0.82) {
          const c = fbm(caveNoise, x * 0.07, y * 0.1, 3)
          if (c > 0.6) mat = 'air'
          else if (c < 0.16 && depth > 0.4) mat = 'lava'
        }
        set(tiles, x, y, mat)
      }
    }

    // Lava falls spilling down from the surface.
    for (let i = 0; i < across(4); i++) {
      const cx = 12 + Math.floor(rng() * (WORLD_W - 24))
      let y = 0
      while (y < WORLD_H && tiles[y * WORLD_W + cx] === M.air) y++
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
      let y = 0
      while (y < WORLD_H && tiles[y * WORLD_W + cx] === M.air) y++
      const w = 2 + Math.floor(rng() * 3)
      for (let x = cx - w; x <= cx + w; x++) {
        const t = 1 - Math.abs(x - cx) / (w + 1)
        for (let d = 0; d < Math.floor(t * 3); d++) set(tiles, x, y + d, 'acid')
      }
    }
  },
}

export const THEMES: Theme[] = [EMPTY, EARTH, STATION, TIDEPOOL, VOLCANIC]

export const THEME_BY_ID: Record<string, Theme> = Object.fromEntries(THEMES.map(t => [t.id, t]))

export const DEFAULT_THEME = 'empty'
