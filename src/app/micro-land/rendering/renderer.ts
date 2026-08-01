/**
 * Renderer.
 *
 * Everything is drawn at exactly one canvas pixel per world tile into a small
 * backbuffer, then blown up to the display with smoothing off. That's what
 * keeps tiles, creatures and particles on a single shared pixel grid — nothing
 * lands on a half-pixel, so the whole thing reads as one piece of pixel art
 * rather than sprites floating over a background.
 *
 * Light is a quarter-resolution field (sky from above, plus glowing tiles and
 * creatures), blurred and composited as a darkness layer *after* sprites, so
 * creatures are dimmed by the same shadows as the terrain.
 */
import { MATERIAL_BY_INDEX } from '@/app/micro-land/domain/config/materials'
import type { Theme } from '@/app/micro-land/domain/config/themes'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import type { WorldState } from '@/app/micro-land/domain/types'

import { getSprites } from './sprite-cache'

/** Light is computed on a coarse grid and blurred — no need for per-pixel. */
const LIGHT_SCALE = 4
const LW = Math.ceil(WORLD_W / LIGHT_SCALE)
const LH = Math.ceil(WORLD_H / LIGHT_SCALE)

/** How far daylight reaches below the first solid tile in a column, in tiles. */
const SKY_FALLOFF = 16

interface Rgb {
  r: number
  g: number
  b: number
}

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export class Renderer {
  private display: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  /** Backbuffer at world resolution. Everything is composed here first. */
  private world: HTMLCanvasElement
  private wctx: CanvasRenderingContext2D

  /** Tile colors. Rebuilt only when the grid actually changes. */
  private tileImage: ImageData
  private tileCanvas: HTMLCanvasElement
  private tileCtx: CanvasRenderingContext2D
  private tilesDirty = true

  /** Darkness overlay, world resolution. */
  private shadowImage: ImageData
  private shadowCanvas: HTMLCanvasElement
  private shadowCtx: CanvasRenderingContext2D

  private light = new Float32Array(LW * LH)
  private lightScratch = new Float32Array(LW * LH)
  private skyDepth = new Int16Array(WORLD_W)

  private materialRgb: Rgb[]

  /** Placement of the world inside the display canvas. */
  private scale = 1
  private offsetX = 0
  private offsetY = 0

  constructor(display: HTMLCanvasElement) {
    this.display = display
    const ctx = display.getContext('2d')
    if (!ctx) throw new Error('micro-land: 2d canvas context unavailable')
    this.ctx = ctx

    this.world = document.createElement('canvas')
    this.world.width = WORLD_W
    this.world.height = WORLD_H
    this.wctx = this.world.getContext('2d')!

    this.tileCanvas = document.createElement('canvas')
    this.tileCanvas.width = WORLD_W
    this.tileCanvas.height = WORLD_H
    this.tileCtx = this.tileCanvas.getContext('2d')!
    this.tileImage = this.tileCtx.createImageData(WORLD_W, WORLD_H)

    this.shadowCanvas = document.createElement('canvas')
    this.shadowCanvas.width = WORLD_W
    this.shadowCanvas.height = WORLD_H
    this.shadowCtx = this.shadowCanvas.getContext('2d')!
    this.shadowImage = this.shadowCtx.createImageData(WORLD_W, WORLD_H)

    this.materialRgb = MATERIAL_BY_INDEX.map((m) => hexToRgb(m.color))
  }

  /** Call whenever tiles change — painting, theme swap, lava setting solid. */
  markTilesDirty(): void {
    this.tilesDirty = true
  }

  resize(cssWidth: number, cssHeight: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.display.width = Math.max(1, Math.floor(cssWidth * dpr))
    this.display.height = Math.max(1, Math.floor(cssHeight * dpr))
    this.display.style.width = `${cssWidth}px`
    this.display.style.height = `${cssHeight}px`

    // Fit the whole world in view — it's a terrarium, you should see all of it.
    const fit = Math.min(this.display.width / WORLD_W, this.display.height / WORLD_H)
    this.scale = fit
    this.offsetX = Math.floor((this.display.width - WORLD_W * fit) / 2)
    this.offsetY = Math.floor((this.display.height - WORLD_H * fit) / 2)
  }

  /** Display pixel → world tile. Used by every pointer interaction. */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.display.getBoundingClientRect()
    const dpr = this.display.width / rect.width
    const px = (clientX - rect.left) * dpr
    const py = (clientY - rect.top) * dpr
    return {
      x: (px - this.offsetX) / this.scale,
      y: (py - this.offsetY) / this.scale,
    }
  }

  render(w: WorldState, theme: Theme, highlightId: number | null = null): void {
    if (this.tilesDirty) {
      this.buildTiles(w)
      this.tilesDirty = false
    }
    this.buildLight(w, theme)

    const wctx = this.wctx
    wctx.imageSmoothingEnabled = false

    // Sky behind everything (air tiles are transparent in the tile layer).
    const sky = wctx.createLinearGradient(0, 0, 0, WORLD_H)
    sky.addColorStop(0, theme.sky[0])
    sky.addColorStop(1, theme.sky[1])
    wctx.fillStyle = sky
    wctx.fillRect(0, 0, WORLD_W, WORLD_H)

    wctx.drawImage(this.tileCanvas, 0, 0)

    this.drawCreatures(w)
    this.drawParticles(w)
    wctx.drawImage(this.shadowCanvas, 0, 0)
    // Drawn after the shadow so the selection stays legible in a dark cave.
    if (highlightId !== null) this.drawHighlight(w, highlightId)

    // One scaled blit. Nearest-neighbour keeps the pixels crisp.
    const ctx = this.ctx
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#05040c'
    ctx.fillRect(0, 0, this.display.width, this.display.height)
    ctx.drawImage(
      this.world,
      0,
      0,
      WORLD_W,
      WORLD_H,
      this.offsetX,
      this.offsetY,
      WORLD_W * this.scale,
      WORLD_H * this.scale
    )
  }

  // -------------------------------------------------------------------------

  private buildTiles(w: WorldState): void {
    const data = this.tileImage.data
    const tiles = w.tiles
    const grain = w.grain
    const rgb = this.materialRgb
    const materials = MATERIAL_BY_INDEX

    for (let i = 0; i < tiles.length; i++) {
      const mat = tiles[i]
      const o = i * 4
      if (mat === 0) {
        // Air — leave it transparent so the sky gradient shows through.
        data[o + 3] = 0
        continue
      }
      const base = rgb[mat]
      // Per-tile jitter stops large fills from looking like flat blocks.
      const jitter = ((grain[i] / 255) * 2 - 1) * materials[mat].grain
      const k = 1 + jitter
      data[o] = Math.max(0, Math.min(255, base.r * k))
      data[o + 1] = Math.max(0, Math.min(255, base.g * k))
      data[o + 2] = Math.max(0, Math.min(255, base.b * k))
      data[o + 3] = 255
    }

    this.tileCtx.putImageData(this.tileImage, 0, 0)
  }

  private buildLight(w: WorldState, theme: Theme): void {
    const light = this.light
    light.fill(0)

    // --- daylight: how far below the first solid tile is each column? ---
    const tiles = w.tiles
    for (let x = 0; x < WORLD_W; x++) {
      let y = 0
      while (y < WORLD_H && MATERIAL_BY_INDEX[tiles[y * WORLD_W + x]].solid === false) {
        y++
      }
      this.skyDepth[x] = y
    }

    for (let ly = 0; ly < LH; ly++) {
      const wy = ly * LIGHT_SCALE + LIGHT_SCALE / 2
      for (let lx = 0; lx < LW; lx++) {
        const wx = Math.min(WORLD_W - 1, lx * LIGHT_SCALE + (LIGHT_SCALE >> 1))
        const surface = this.skyDepth[wx]
        const below = wy - surface
        let value: number
        if (below <= 0) value = 1
        else value = Math.max(0, 1 - below / SKY_FALLOFF)
        light[ly * LW + lx] = value
      }
    }

    // --- emitters: glowing tiles ---
    // Sampled every other tile; the blur smooths over the gaps.
    for (let y = 0; y < WORLD_H; y += 2) {
      for (let x = 0; x < WORLD_W; x += 2) {
        const mat = MATERIAL_BY_INDEX[tiles[y * WORLD_W + x]]
        if (mat.glow <= 0) continue
        const li = Math.floor(y / LIGHT_SCALE) * LW + Math.floor(x / LIGHT_SCALE)
        light[li] = Math.min(1.6, light[li] + mat.glow * 0.5)
      }
    }

    // --- emitters: glowing creatures ---
    for (const c of w.creatures) {
      const bp = w.blueprints[c.blueprintId]
      if (!bp || bp.glow <= 0) continue
      const lx = Math.floor(c.x / LIGHT_SCALE)
      const ly = Math.floor(c.y / LIGHT_SCALE)
      if (lx < 0 || ly < 0 || lx >= LW || ly >= LH) continue
      const li = ly * LW + lx
      light[li] = Math.min(1.8, light[li] + bp.glow * 1.4)
    }

    // --- blur, so light pools instead of forming squares ---
    for (let pass = 0; pass < 3; pass++) this.blurLight()

    // --- bake into the shadow overlay ---
    const gloom = theme.gloom
    const data = this.shadowImage.data
    for (let y = 0; y < WORLD_H; y++) {
      const ly = y / LIGHT_SCALE
      for (let x = 0; x < WORLD_W; x++) {
        const value = this.sampleLight(x / LIGHT_SCALE, ly)
        const alpha = Math.max(0, Math.min(1, 1 - value)) * gloom
        const o = (y * WORLD_W + x) * 4
        data[o] = 4
        data[o + 1] = 3
        data[o + 2] = 12
        data[o + 3] = Math.round(alpha * 255)
      }
    }
    this.shadowCtx.putImageData(this.shadowImage, 0, 0)
  }

  private blurLight(): void {
    const src = this.light
    const dst = this.lightScratch
    for (let y = 0; y < LH; y++) {
      for (let x = 0; x < LW; x++) {
        let sum = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= LH) continue
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            if (nx < 0 || nx >= LW) continue
            sum += src[ny * LW + nx]
            count++
          }
        }
        dst[y * LW + x] = sum / count
      }
    }
    this.light.set(dst)
  }

  /** Bilinear sample of the coarse light field. */
  private sampleLight(fx: number, fy: number): number {
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = fx - x0
    const ty = fy - y0
    const cx0 = Math.max(0, Math.min(LW - 1, x0))
    const cy0 = Math.max(0, Math.min(LH - 1, y0))
    const cx1 = Math.min(LW - 1, cx0 + 1)
    const cy1 = Math.min(LH - 1, cy0 + 1)
    const l = this.light
    const a = l[cy0 * LW + cx0]
    const b = l[cy0 * LW + cx1]
    const c = l[cy1 * LW + cx0]
    const d = l[cy1 * LW + cx1]
    const top = a + (b - a) * tx
    const bottom = c + (d - c) * tx
    return top + (bottom - top) * ty
  }

  private drawCreatures(w: WorldState): void {
    const ctx = this.wctx
    for (const c of w.creatures) {
      const bp = w.blueprints[c.blueprintId]
      if (!bp) continue
      const sprites = getSprites(bp)
      const frameCount = sprites.frames.length
      const frame =
        frameCount === 1
          ? 0
          : Math.floor(c.animMs / sprites.frameMs) % frameCount
      const source =
        c.facing === -1 && bp.art.faceMotion
          ? sprites.flipped[frame]
          : sprites.frames[frame]

      const x = Math.round(c.x)
      const y = Math.round(c.y)

      // A creature about to starve or drown flickers, so you can spot it.
      if (c.starving > 0 || c.distress > 2) {
        const pulse = Math.sin(w.elapsed * 12) * 0.5 + 0.5
        ctx.globalAlpha = 0.45 + pulse * 0.55
      }
      ctx.drawImage(source, x, y)
      ctx.globalAlpha = 1
    }
  }

  /** Ring around the creature the inspector is watching. */
  private drawHighlight(w: WorldState, id: number): void {
    const c = w.creatures.find((x) => x.id === id)
    if (!c) return
    const bp = w.blueprints[c.blueprintId]
    if (!bp) return
    const rows = bp.art.frames[0]
    const bw = rows[0].length
    const bh = rows.length

    const ctx = this.wctx
    const x = Math.round(c.x) - 2
    const y = Math.round(c.y) - 2
    const width = bw + 4
    const height = bh + 4

    // Corner brackets rather than a full box — a solid outline on a 6px sprite
    // hides more of the creature than it frames.
    const arm = Math.max(2, Math.floor(Math.min(width, height) / 3))
    ctx.fillStyle = '#5eead4'
    const pulse = 0.55 + 0.45 * Math.sin(w.elapsed * 6)
    ctx.globalAlpha = pulse
    for (const [cx, cy, sx, sy] of [
      [x, y, 1, 1],
      [x + width - 1, y, -1, 1],
      [x, y + height - 1, 1, -1],
      [x + width - 1, y + height - 1, -1, -1],
    ]) {
      for (let i = 0; i < arm; i++) {
        ctx.fillRect(cx + sx * i, cy, 1, 1)
        ctx.fillRect(cx, cy + sy * i, 1, 1)
      }
    }
    ctx.globalAlpha = 1
  }

  private drawParticles(w: WorldState): void {
    const ctx = this.wctx
    for (const p of w.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife))
      ctx.fillStyle = p.color
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1)
    }
    ctx.globalAlpha = 1
  }
}
