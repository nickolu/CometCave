/**
 * Promptable terrain.
 *
 * The model already draws creatures as a grid of characters plus a legend, and
 * it turns out that is also the right way to let it draw a *world*. A coarse map
 * — roughly 40x24 — is small enough to author reliably and, scaled up with a
 * noise-jittered sample, produces organic caves and shorelines rather than
 * visible rectangles.
 *
 * The alternative (a parameterised list of layers and features) would have been
 * more compact but far less expressive: you can't ask for "an island with a
 * flooded cave under it" in a band list, and you can draw it in about four
 * lines of text.
 */
import { z } from 'zod'

import { BASE_MATERIAL_IDS, MATERIALS, MATERIAL_IDS } from './config/materials'
import { WORLD_H, WORLD_W } from './constants'
import { type Rng, fbm, makeNoise2D } from './sim/prng'

import type { Theme } from './config/themes'
import type { MaterialId } from './types'

const MAP_MIN = 6
/**
 * Wide enough for a model to draw the whole world at once.
 *
 * A world 672 tiles across wants roughly 120 map columns to keep its cells
 * square. This sits well above that so a model that draws generously gets its
 * detail scaled down rather than chopped off at the right-hand edge.
 */
const MAP_MAX_COLS = 200
const MAP_MAX_ROWS = 48
const MAX_LEGEND = 14

/**
 * Where the ground should sit, as a share of the world's height.
 *
 * Models draw a horizon the way you would on paper — two thirds of the way up,
 * with a strip of sky above it — and the result is a world that is mostly dirt.
 * But almost everything a player comes to watch happens *above* the surface:
 * things walking, flying, hunting, falling. Earth below the surface is only
 * interesting where it's hollow. So the surface belongs low, and the air above
 * it is the part worth spending the world's height on.
 *
 * Around 0.4, spread so it usually lands between 0.3 and 0.5 and sometimes
 * doesn't — a world that always has its horizon in the same place stops reading
 * as a place and starts reading as a template.
 */
const GROUND_TARGET = 0.4
const GROUND_SPREAD = 0.52
const GROUND_MIN = 0.18
const GROUND_MAX = 0.62

/** A row counts as ground once this much of it is solid. */
const GROUND_ROW_FILL = 0.5

/** Ceiling on rows after padding, so an extreme roll can't squash the land flat. */
const MAX_PADDED_ROWS = 100

// Base materials only — tints are something the player paints, not vocabulary
// the model needs. See the same note in `blueprint.ts`.
const materialEnum = z.enum([...BASE_MATERIAL_IDS] as [MaterialId, ...MaterialId[]])

const hexColor = z.string().describe('A hex color like #7fc4e8.')

export const TerrainSchema = z.object({
  name: z.string().describe('Short name for this land, 1-3 words. Title Case.'),
  sky: z
    .object({
      top: hexColor.describe('Color at the very top of the background.'),
      bottom: hexColor.describe('Color at the very bottom of the background.'),
    })
    .describe(
      'The empty background behind the world, seen wherever there are no tiles.'
    ),
  gloom: z
    .number()
    .describe(
      'How dark the unlit parts are, 0 to 1. 0.2 for a bright outdoor place, 0.6 for a deep cave or deep space. Light comes from open sky above and from lava and glowing creatures.'
    ),
  gravity: z
    .number()
    .describe(
      'Gravity multiplier, 0.2 to 1.5. Use 1 for anywhere on the ground. Use about 0.35 for orbit or space, so things drift instead of dropping.'
    ),
  legend: z
    .array(
      z.object({
        key: z.string().describe('A SINGLE character used in the map rows.'),
        material: materialEnum.describe('Which material that character means.'),
      })
    )
    .describe(
      'What each character in the map means. Max 14 entries. Never define "." — it is always empty air.'
    ),
  map: z
    .array(z.string())
    .describe(
      'The world drawn as rows of characters, top row = sky, bottom row = the very bottom of the world. The world is WIDE — aim for about 120 characters across and 24 rows tall; every row must be the same length. Use "." for empty air. This gets scaled up and roughened, so draw the big shapes — hills, caves, a shoreline, a lava layer — and let the detail happen on its own. Vary it from one end to the other: it is a long stretch of land, not one scene repeated.'
    ),
})

export type RawTerrain = z.infer<typeof TerrainSchema>

export interface SanitizedTerrain {
  name: string
  sky: [string, string]
  gloom: number
  gravity: number
  legend: Record<string, MaterialId>
  map: string[]
}

function clamp(n: unknown, lo: number, hi: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(hi, Math.max(lo, v))
}

function cleanColor(c: unknown, fallback: string): string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : fallback
}

/** Never throws — a half-drawn map still becomes a playable world. */
export function sanitizeTerrain(raw: unknown): SanitizedTerrain {
  const t = (raw ?? {}) as Record<string, unknown>
  const sky = (t.sky ?? {}) as Record<string, unknown>

  const valid = new Set<string>(MATERIAL_IDS)
  const legend: Record<string, MaterialId> = {}
  if (Array.isArray(t.legend)) {
    for (const entry of t.legend) {
      const e = (entry ?? {}) as Record<string, unknown>
      const key = typeof e.key === 'string' ? e.key.slice(0, 1) : ''
      const material = typeof e.material === 'string' ? e.material : ''
      if (!key || key === '.' || !valid.has(material)) continue
      legend[key] = material as MaterialId
      if (Object.keys(legend).length >= MAX_LEGEND) break
    }
  }

  const rawMap = Array.isArray(t.map)
    ? t.map.filter((r): r is string => typeof r === 'string').slice(0, MAP_MAX_ROWS)
    : []

  let map: string[]
  if (rawMap.length < MAP_MIN || Object.keys(legend).length === 0) {
    // Nothing usable. A flat island beats an empty void the player can't stand on.
    legend.g = 'grass'
    legend.d = 'dirt'
    legend.s = 'stone'
    map = [
      ...Array(10).fill('.'.repeat(40)),
      'gggggggggggggggggggggggggggggggggggggggg',
      'dddddddddddddddddddddddddddddddddddddddd',
      'dddddddddddddddddddddddddddddddddddddddd',
      ...Array(11).fill('ssssssssssssssssssssssssssssssssssssssss'),
    ]
  } else {
    const width = Math.min(
      MAP_MAX_COLS,
      Math.max(MAP_MIN, Math.max(...rawMap.map((r) => r.length)))
    )
    const known = new Set(Object.keys(legend))
    map = rawMap.map((row) => {
      let line = ''
      for (let x = 0; x < width; x++) {
        const ch = row[x] ?? '.'
        line += known.has(ch) ? ch : '.'
      }
      return line
    })
  }

  return {
    name:
      typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 32) : 'Summoned Land',
    sky: [cleanColor(sky.top, '#243b55'), cleanColor(sky.bottom, '#0b1020')],
    gloom: clamp(t.gloom, 0, 0.85, 0.3),
    gravity: clamp(t.gravity, 0.15, 2, 1),
    legend,
    map,
  }
}

/**
 * The first row that is mostly solid — the top of the land.
 *
 * Deliberately not "the highest non-air tile in each column": that finds the tip
 * of a lone mountain, a cloud, or a floating island and calls it the ground,
 * which would shove a perfectly good world into the basement. A row only counts
 * once it is half earth, which is the row a creature would actually walk on.
 *
 * Returns -1 when nothing qualifies — a world of floating islands has no ground
 * level to speak of, and the honest answer there is to leave it alone.
 */
function groundRow(map: string[]): number {
  const cols = map[0].length
  const needed = cols * GROUND_ROW_FILL
  for (let y = 0; y < map.length; y++) {
    let solid = 0
    for (let x = 0; x < cols; x++) if (map[y][x] !== '.') solid++
    if (solid >= needed) return y
  }
  return -1
}

/**
 * Slide the ground down (or up) until the surface sits at a sensible height.
 *
 * The map is stretched to the world's height whatever its row count, so adding
 * empty rows on top is all it takes: the land keeps every cave, seam and pool
 * the model drew and simply occupies less of the world. Trimming works the same
 * way in reverse, and only ever removes rows that are entirely air, so nothing
 * drawn is ever cut off.
 */
export function fitGroundLevel(map: string[], rng: Rng): string[] {
  const top = groundRow(map)
  if (top < 0) return map

  const rows = map.length
  // Three rolls averaged: a hump around GROUND_TARGET rather than a flat band,
  // so the usual world is ordinary and the occasional one is a canyon or a plain.
  const roll = (rng() + rng() + rng()) / 3
  const target = Math.min(
    GROUND_MAX,
    Math.max(GROUND_MIN, GROUND_TARGET + (roll - 0.5) * GROUND_SPREAD)
  )

  const depth = rows - top
  const wanted = Math.min(MAX_PADDED_ROWS, Math.round(depth / target))
  const sky = '.'.repeat(map[0].length)

  if (wanted > rows) return [...Array<string>(wanted - rows).fill(sky), ...map]

  // Raising the ground means eating into the sky, and only into empty sky —
  // a mountain peak or a floating island sits above `top` and must survive.
  let empty = 0
  while (empty < top && /^\.*$/.test(map[empty])) empty++
  const trim = Math.min(rows - wanted, empty)
  return trim > 0 ? map.slice(trim) : map
}

/**
 * Paint the coarse map into the tile grid.
 *
 * The sample point is nudged by a little fbm noise before it's floored, which
 * is what turns the map's straight cell edges into ragged, natural-looking
 * boundaries. Without it a 40x24 map upscaled 5x reads as obvious blocks.
 *
 * Horizontal scale is *not* simply "stretch the map to fit". The world is five
 * times wider than it is tall, so stretching a 40-column map across it makes
 * every cell three times wider than it is deep — hills become plateaus, caves
 * become tunnels, and the whole thing reads as a smear. Instead a cell is kept
 * square, and a map too narrow to reach the far edge is repeated, mirrored, so
 * the seams line up and the land simply carries on. A model that draws the full
 * ~120 columns never repeats at all.
 */
export function paintTerrain(
  tiles: Uint8Array,
  terrain: SanitizedTerrain,
  rng: Rng,
  materialIndex: Record<MaterialId, number>
): void {
  const map = fitGroundLevel(terrain.map, rng)
  const rows = map.length
  const cols = map[0].length
  const noise = makeNoise2D(Math.floor(rng() * 1e9))

  const scaleY = rows / WORLD_H
  // How many columns a map would need to cross the world with square cells.
  const squareCols = WORLD_W * scaleY
  const repeats = cols < squareCols - 0.5
  // A map drawn *wider* than that is squeezed to fit instead of repeated. There
  // is no third option — the rows have to span the world's full height, which
  // fixes the vertical scale — and squeezing is much the gentler failure: it
  // makes hills steeper, where the old stretch made them into plateaus.
  const scaleX = repeats ? scaleY : cols / WORLD_W
  // Out and back again, so the joins are reflections rather than hard cuts.
  const period = cols * 2

  // Roughen by about half a map cell, in world tiles.
  const wobble = Math.max(1, Math.min(1 / scaleX, 1 / scaleY) * 0.65)

  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const nx = (fbm(noise, x * 0.09, y * 0.09, 2) - 0.5) * 2 * wobble
      const ny = (fbm(noise, x * 0.09 + 31.7, y * 0.09 - 12.3, 2) - 0.5) * 2 * wobble

      let cx = Math.floor((x + nx) * scaleX)
      if (repeats) {
        const p = ((cx % period) + period) % period
        cx = p < cols ? p : period - 1 - p
      }
      const cy = Math.floor((y + ny) * scaleY)
      const row = map[Math.max(0, Math.min(rows - 1, cy))]
      const ch = row[Math.max(0, Math.min(cols - 1, cx))] ?? '.'
      const material = terrain.legend[ch]
      tiles[y * WORLD_W + x] = material ? materialIndex[material] : 0
    }
  }
}

/** Wrap summoned terrain so it behaves exactly like a built-in theme. */
export function terrainToTheme(
  terrain: SanitizedTerrain,
  materialIndex: Record<MaterialId, number>
): Theme {
  return {
    id: 'summoned',
    name: terrain.name,
    blurb: 'A land you asked for.',
    sky: terrain.sky,
    gloom: terrain.gloom,
    gravity: terrain.gravity,
    // Creatures arrive from the scene that summoned it, not from a starter list.
    starters: [],
    build: (tiles, rng) => paintTerrain(tiles, terrain, rng, materialIndex),
  }
}

/** True if anything can take root here — no fertile tile means no food chain. */
export function hasFertileGround(terrain: SanitizedTerrain): boolean {
  // Read off the materials themselves rather than a copy of the list, so a new
  // fertile material is never fertile for plants but invisible to this check.
  return Object.values(terrain.legend).some((m) => MATERIALS[m]?.fertile)
}
