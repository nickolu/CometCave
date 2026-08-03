/**
 * Rasterizes a blueprint's `art` (palette + rows of characters) into tiny
 * canvases — one per frame, plus a mirrored copy for creatures that turn to
 * face where they're going.
 *
 * Sprites are one canvas pixel per world tile. All the scaling happens once, at
 * the very end of the render, so everything stays on the same pixel grid.
 *
 * Since creatures inherit a colour of their own, a blueprint no longer names one
 * drawing but up to `HUE_BUCKETS * SHADE_BUCKETS` of them. Recolouring is done to
 * the *palette* — a dozen hex strings — before rasterizing, rather than to the
 * pixels afterwards: the art is a few hundred pixels and the palette is twelve
 * entries, so working on the palette is the cheaper end by an order of magnitude
 * and it keeps every pixel exactly on the grid.
 */
import { NEUTRAL_TINT, tintFromKey } from '@/app/micro-land/domain/traits'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

export interface SpriteSet {
  width: number
  height: number
  frames: HTMLCanvasElement[]
  flipped: HTMLCanvasElement[]
  frameMs: number
}

/**
 * Two caches, because the two have completely different lifetimes.
 *
 * Every creature that has never bred is neutral, so the neutral set is what the
 * overwhelming majority of draws ask for and it is never worth evicting. Tinted
 * variants are the long tail: a species can touch up to 36 of them over a long
 * session, most of them for a handful of creatures, and a world with thirty
 * summoned species could otherwise sit on a thousand canvases it will never draw
 * again.
 */
const neutral = new Map<string, SpriteSet>()
const tinted = new Map<string, SpriteSet>()

/**
 * How many tinted sets to keep before dropping the least recently drawn.
 *
 * Generous enough that everything visible at once stays cached — the cap is on
 * *variants*, and no single screen contains anywhere near this many distinct
 * species-and-colour pairs — and small enough to bound the memory at a few
 * megabytes of very small canvases. A miss only costs one rasterize of a sprite
 * no bigger than 28×24.
 */
const MAX_TINTED = 240

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Rotate a colour's hue and scale its lightness.
 *
 * Goes through HSL rather than doing anything clever to the channels directly,
 * because hue is an angle and the whole mechanic is a walk around that circle;
 * per-channel arithmetic can lighten and desaturate but it cannot *rotate*, so a
 * green creature could never become a blue one.
 */
function shiftColor(hex: string, hueShift: number, shade: number): string {
  const [r255, g255, b255] = hexToRgb(hex)
  const r = r255 / 255
  const g = g255 / 255
  const b = b255 / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min

  let h = 0
  let s = 0
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  h = (((h + hueShift / 360) % 1) + 1) % 1
  // Clamped rather than wrapped: a highlight pushed past white should stop at
  // white, not come back round as black.
  const l2 = Math.max(0, Math.min(1, l * shade))

  const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s
  const p = 2 * l2 - q
  const channel = (t: number) => {
    let v = t
    if (v < 0) v += 1
    if (v > 1) v -= 1
    if (v < 1 / 6) return p + (q - p) * 6 * v
    if (v < 1 / 2) return q
    if (v < 2 / 3) return p + (q - p) * (2 / 3 - v) * 6
    return p
  }

  const out = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${out(channel(h + 1 / 3))}${out(channel(h))}${out(channel(h - 1 / 3))}`
}

function rasterize(
  bp: CreatureBlueprint,
  rows: string[],
  palette: Record<string, string>
): HTMLCanvasElement {
  const height = rows.length
  const width = rows[0].length
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const image = ctx.createImageData(width, height)
  const data = image.data

  for (let y = 0; y < height; y++) {
    const row = rows[y]
    for (let x = 0; x < width; x++) {
      const ch = row[x]
      if (ch === '.' || ch === undefined) continue
      const hex = palette[ch]
      if (!hex) continue
      const n = parseInt(hex.slice(1), 16)
      const o = (y * width + x) * 4
      data[o] = (n >> 16) & 255
      data[o + 1] = (n >> 8) & 255
      data[o + 2] = n & 255
      data[o + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas
}

function mirror(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.imageSmoothingEnabled = false
  ctx.translate(source.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(source, 0, 0)
  return canvas
}

function build(bp: CreatureBlueprint, tint: number): SpriteSet {
  let palette = bp.art.palette
  if (tint !== NEUTRAL_TINT) {
    const { hue, shade } = tintFromKey(tint)
    palette = {}
    for (const [key, hex] of Object.entries(bp.art.palette)) {
      palette[key] = shiftColor(hex, hue, shade)
    }
  }

  const frames = bp.art.frames.map(rows => rasterize(bp, rows, palette))
  return {
    width: frames[0].width,
    height: frames[0].height,
    frames,
    flipped: bp.art.faceMotion ? frames.map(mirror) : frames,
    frameMs: bp.art.frameMs,
  }
}

/**
 * The sprites for one creature, in its own colour.
 *
 * `tint` comes from `tintKey(creature.traits)`; passing the neutral bucket gets
 * the blueprint exactly as it was drawn, which is both the common case and the
 * fast path.
 */
export function getSprites(bp: CreatureBlueprint, tint: number = NEUTRAL_TINT): SpriteSet {
  if (tint === NEUTRAL_TINT) {
    const existing = neutral.get(bp.id)
    if (existing) return existing
    const set = build(bp, tint)
    neutral.set(bp.id, set)
    return set
  }

  const key = `${bp.id}|${tint}`
  const existing = tinted.get(key)
  if (existing) {
    // Re-insert to move it to the back of the Map's insertion order, which is
    // the whole of the LRU: the eviction below always takes the front.
    tinted.delete(key)
    tinted.set(key, existing)
    return existing
  }

  const set = build(bp, tint)
  tinted.set(key, set)
  if (tinted.size > MAX_TINTED) {
    const oldest = tinted.keys().next()
    if (!oldest.done) tinted.delete(oldest.value)
  }
  return set
}

/**
 * Drop one blueprint's sprites, because its art changed underneath its id.
 *
 * The cache assumes an id names a fixed drawing, which held for as long as the
 * only way to change a creature was to invent a new one. Editing in place
 * breaks that: without this, a repainted Hopper keeps showing its old colours
 * for the rest of the session, and the edit looks like it never saved.
 *
 * Every tint has to go with it. An id no longer names one entry, and dropping
 * only the neutral one would leave a repainted creature showing its old drawing
 * for as long as its line stayed off-neutral — which is to say, for exactly the
 * creatures whose colour the player is most likely to be watching.
 */
export function forgetSprites(id: string): void {
  neutral.delete(id)
  const prefix = `${id}|`
  for (const key of tinted.keys()) {
    if (key.startsWith(prefix)) tinted.delete(key)
  }
}

export function clearSpriteCache(): void {
  neutral.clear()
  tinted.clear()
}
