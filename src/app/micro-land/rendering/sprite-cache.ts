/**
 * Rasterizes a blueprint's `art` (palette + rows of characters) into tiny
 * canvases — one per frame, plus a mirrored copy for creatures that turn to
 * face where they're going.
 *
 * Sprites are one canvas pixel per world tile. All the scaling happens once, at
 * the very end of the render, so everything stays on the same pixel grid.
 */
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

export interface SpriteSet {
  width: number
  height: number
  frames: HTMLCanvasElement[]
  flipped: HTMLCanvasElement[]
  frameMs: number
}

const cache = new Map<string, SpriteSet>()

function rasterize(bp: CreatureBlueprint, rows: string[]): HTMLCanvasElement {
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
      const hex = bp.art.palette[ch]
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

export function getSprites(bp: CreatureBlueprint): SpriteSet {
  const existing = cache.get(bp.id)
  if (existing) return existing

  const frames = bp.art.frames.map(rows => rasterize(bp, rows))
  const set: SpriteSet = {
    width: frames[0].width,
    height: frames[0].height,
    frames,
    flipped: bp.art.faceMotion ? frames.map(mirror) : frames,
    frameMs: bp.art.frameMs,
  }
  cache.set(bp.id, set)
  return set
}

export function clearSpriteCache(): void {
  cache.clear()
}
