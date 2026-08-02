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
 *
 * The world is wider than the screen, so there is a camera. It only moves
 * horizontally and it only ever sits on whole tiles: a camera at x = 12.4 would
 * resample every tile in the world onto a half-pixel and undo the one thing this
 * renderer exists to protect. Every per-frame pass below — tiles, light, shadow,
 * sprites — is clipped to the visible column range, which is what keeps a world
 * three times the size costing about what one screen used to.
 */
import { MATERIAL_BY_INDEX } from '@/app/micro-land/domain/config/materials'
import type { Theme } from '@/app/micro-land/domain/config/themes'
import { VIEW_W, WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import type { WorldState } from '@/app/micro-land/domain/types'

import { getSprites } from './sprite-cache'

/** Light is computed on a coarse grid and blurred — no need for per-pixel. */
const LIGHT_SCALE = 4
const LW = Math.ceil(WORLD_W / LIGHT_SCALE)
const LH = Math.ceil(WORLD_H / LIGHT_SCALE)

/** How far daylight reaches below the first solid tile in a column, in tiles. */
const SKY_FALLOFF = 16

/**
 * Columns of slack baked either side of the view.
 *
 * Tiles are re-baked whenever the sand moves, which is 20 times a second, so
 * this margin mostly buys nothing while the world is running. It earns its keep
 * while paused, where panning would otherwise re-bake on every single frame.
 */
const TILE_MARGIN = 32

/**
 * Light bleeds sideways through the blur, so it's gathered a little wider.
 *
 * Has to cover more than the blur reaches. Each of the three passes pulls in one
 * coarse cell from outside the gathered range — which is stale, because nothing
 * out there was computed — so the outermost three cells of the margin are wrong
 * by the end. At 4 tiles per cell this leaves three clean cells of slack beyond
 * that before the visible edge starts.
 */
const LIGHT_MARGIN = 24

/** The minimap is a whole-world thumbnail at this many tiles per pixel. */
const MAP_SCALE = 4
const MW = Math.ceil(WORLD_W / MAP_SCALE)
const MH = Math.ceil(WORLD_H / MAP_SCALE)

/** Frames between minimap refreshes. It's a thumbnail; 5Hz is more than enough. */
const MAP_REFRESH_FRAMES = 12

interface Rgb {
  r: number
  g: number
  b: number
}

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Where the minimap ended up on the display, in device pixels. */
export interface MapRect {
  x: number
  y: number
  w: number
  h: number
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
  /** Column range currently baked into `tileCanvas`; outside it is stale. */
  private builtX0 = 0
  private builtX1 = 0

  /** Darkness overlay, world resolution. */
  private shadowImage: ImageData
  private shadowCanvas: HTMLCanvasElement
  private shadowCtx: CanvasRenderingContext2D

  private light = new Float32Array(LW * LH)
  private lightScratch = new Float32Array(LW * LH)
  private skyDepth = new Int16Array(WORLD_W)

  /** Whole-world thumbnail behind the minimap. */
  private mapImage: ImageData
  private mapCanvas: HTMLCanvasElement
  private mapCtx: CanvasRenderingContext2D
  private mapAge = MAP_REFRESH_FRAMES
  private mapRect: MapRect = { x: 0, y: 0, w: 0, h: 0 }

  private materialRgb: Rgb[]

  /** Placement of the world inside the display canvas. */
  private scale = 1
  private offsetX = 0
  private offsetY = 0

  /**
   * Left edge of the view in world tiles. Kept fractional so a slow pan can
   * accumulate, but always floored before anything is drawn from it.
   */
  private camX = 0
  /** How many world tiles the display is wide at the current scale. */
  private viewTiles = VIEW_W

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

    this.mapCanvas = document.createElement('canvas')
    this.mapCanvas.width = MW
    this.mapCanvas.height = MH
    this.mapCtx = this.mapCanvas.getContext('2d')!
    this.mapImage = this.mapCtx.createImageData(MW, MH)

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

    // Zoom is fixed by VIEW_W, not by the whole world: a tile is sized so that
    // one screen's worth spans the canvas, exactly as it did when the world was
    // one screen wide. Whatever extra height allows, you simply get to see.
    const fit = Math.min(this.display.width / VIEW_W, this.display.height / WORLD_H)
    this.scale = fit
    this.viewTiles = Math.min(WORLD_W, this.display.width / fit)
    this.offsetX = Math.floor((this.display.width - this.viewTiles * fit) / 2)
    this.offsetY = Math.floor((this.display.height - WORLD_H * fit) / 2)
    this.clampCam()
  }

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  /** Left edge of the view, in world tiles. */
  get cameraX(): number {
    return this.camX
  }

  /** How much world is on screen right now, in tiles. */
  get viewWidth(): number {
    return this.viewTiles
  }

  /** True when the whole world already fits — nothing to scroll to. */
  get fitsOnScreen(): boolean {
    return this.viewTiles >= WORLD_W
  }

  panBy(tiles: number): void {
    this.camX += tiles
    this.clampCam()
  }

  /** Put this world column at the left edge of the view. */
  panToLeft(tile: number): void {
    this.camX = tile
    this.clampCam()
  }

  /** Put this world column in the middle of the view. */
  centerOn(worldX: number): void {
    this.camX = worldX - this.viewTiles / 2
    this.clampCam()
  }

  /**
   * Slide just far enough to bring a point back on screen.
   *
   * Used to keep a creature you're carrying — or watching — from walking off
   * the edge of the view and leaving you looking at nothing.
   */
  keepInView(worldX: number, margin: number, maxTiles: number): void {
    const left = this.camX + margin
    const right = this.camX + this.viewTiles - margin
    if (worldX < left) this.panBy(Math.max(-maxTiles, worldX - left))
    else if (worldX > right) this.panBy(Math.min(maxTiles, worldX - right))
  }

  private clampCam(): void {
    this.camX = Math.max(0, Math.min(WORLD_W - this.viewTiles, this.camX))
  }

  /**
   * How many world tiles one CSS pixel of horizontal drag is worth.
   *
   * Drag-panning can't be built out of `screenToWorld` differences: that already
   * has the camera folded into it, so moving the camera moves the answer and the
   * two cancel out to a world that won't budge.
   */
  tilesPerClientPixel(): number {
    const rect = this.display.getBoundingClientRect()
    if (rect.width === 0) return 0
    return this.display.width / rect.width / this.scale
  }

  /** Whole-tile left edge. Everything drawn this frame is measured from here. */
  private viewLeft(): number {
    return Math.floor(this.camX)
  }

  /** Display pixel → world tile. Used by every pointer interaction. */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.display.getBoundingClientRect()
    const dpr = this.display.width / rect.width
    const px = (clientX - rect.left) * dpr
    const py = (clientY - rect.top) * dpr
    return {
      x: this.viewLeft() + (px - this.offsetX) / this.scale,
      y: (py - this.offsetY) / this.scale,
    }
  }

  /**
   * Was this tap on the minimap, and if so where in the world does it point?
   *
   * Returns the world column to centre on, or null if the tap missed. The
   * minimap is the only part of the world canvas that isn't the world, so it
   * has to be asked about before a tap is allowed to paint anything.
   */
  minimapHit(clientX: number, clientY: number): number | null {
    const m = this.mapRect
    if (m.w <= 0) return null
    const rect = this.display.getBoundingClientRect()
    const dpr = this.display.width / rect.width
    const px = (clientX - rect.left) * dpr
    const py = (clientY - rect.top) * dpr
    if (px < m.x || px > m.x + m.w || py < m.y || py > m.y + m.h) return null
    return ((px - m.x) / m.w) * WORLD_W
  }

  // -------------------------------------------------------------------------

  render(
    w: WorldState,
    theme: Theme,
    highlightId: number | null = null,
    elderId: number | null = null
  ): void {
    const vx = this.viewLeft()
    const vw = Math.min(WORLD_W - vx, Math.ceil(this.viewTiles))

    this.ensureTiles(w, vx, vw)
    this.buildLight(w, theme, vx, vw)

    const wctx = this.wctx
    wctx.imageSmoothingEnabled = false

    // Sky behind everything (air tiles are transparent in the tile layer).
    const sky = wctx.createLinearGradient(0, 0, 0, WORLD_H)
    sky.addColorStop(0, theme.sky[0])
    sky.addColorStop(1, theme.sky[1])
    wctx.fillStyle = sky
    wctx.fillRect(vx, 0, vw, WORLD_H)

    wctx.drawImage(this.tileCanvas, vx, 0, vw, WORLD_H, vx, 0, vw, WORLD_H)

    this.drawCreatures(w, vx, vw)
    this.drawParticles(w, vx, vw)
    wctx.drawImage(this.shadowCanvas, vx, 0, vw, WORLD_H, vx, 0, vw, WORLD_H)
    // Both drawn after the shadow so they stay legible in a dark cave. The halo
    // goes first so the selection brackets sit on top when you inspect an elder.
    if (elderId !== null) this.drawElder(w, elderId)
    if (highlightId !== null) this.drawHighlight(w, highlightId)

    // One scaled blit. Nearest-neighbour keeps the pixels crisp.
    const ctx = this.ctx
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#05040c'
    ctx.fillRect(0, 0, this.display.width, this.display.height)
    ctx.drawImage(
      this.world,
      vx,
      0,
      this.viewTiles,
      WORLD_H,
      this.offsetX,
      this.offsetY,
      this.viewTiles * this.scale,
      WORLD_H * this.scale
    )

    this.drawMinimap(w, theme, vx)
  }

  // -------------------------------------------------------------------------

  /** Re-bake the tile colours if the view has left the range we baked last. */
  private ensureTiles(w: WorldState, vx: number, vw: number): void {
    const covered = !this.tilesDirty && vx >= this.builtX0 && vx + vw <= this.builtX1
    if (covered) return

    const x0 = Math.max(0, vx - TILE_MARGIN)
    const x1 = Math.min(WORLD_W, vx + vw + TILE_MARGIN)
    this.buildTiles(w, x0, x1)
    this.builtX0 = x0
    this.builtX1 = x1
    this.tilesDirty = false
  }

  private buildTiles(w: WorldState, x0: number, x1: number): void {
    const data = this.tileImage.data
    const tiles = w.tiles
    const grain = w.grain
    const rgb = this.materialRgb
    const materials = MATERIAL_BY_INDEX

    for (let y = 0; y < WORLD_H; y++) {
      const row = y * WORLD_W
      for (let x = x0; x < x1; x++) {
        const i = row + x
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
    }

    this.tileCtx.putImageData(this.tileImage, 0, 0, x0, 0, x1 - x0, WORLD_H)
  }

  private buildLight(w: WorldState, theme: Theme, vx: number, vw: number): void {
    // Light spreads sideways as it blurs, so it is gathered a little beyond the
    // view — otherwise the lava just off screen stops lighting the cave mouth
    // you can see, and the edge of the screen visibly darkens as you pan.
    const gx0 = Math.max(0, vx - LIGHT_MARGIN)
    const gx1 = Math.min(WORLD_W, vx + vw + LIGHT_MARGIN)
    const lx0 = Math.floor(gx0 / LIGHT_SCALE)
    const lx1 = Math.min(LW, Math.ceil(gx1 / LIGHT_SCALE))

    const light = this.light
    for (let ly = 0; ly < LH; ly++) light.fill(0, ly * LW + lx0, ly * LW + lx1)

    // --- daylight: how far below the first solid tile is each column? ---
    const tiles = w.tiles
    for (let x = gx0; x < gx1; x++) {
      let y = 0
      while (y < WORLD_H && MATERIAL_BY_INDEX[tiles[y * WORLD_W + x]].solid === false) {
        y++
      }
      this.skyDepth[x] = y
    }

    for (let ly = 0; ly < LH; ly++) {
      const wy = ly * LIGHT_SCALE + LIGHT_SCALE / 2
      for (let lx = lx0; lx < lx1; lx++) {
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
      for (let x = gx0; x < gx1; x += 2) {
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
      if (lx < lx0 || ly < 0 || lx >= lx1 || ly >= LH) continue
      const li = ly * LW + lx
      light[li] = Math.min(1.8, light[li] + bp.glow * 1.4)
    }

    // --- blur, so light pools instead of forming squares ---
    for (let pass = 0; pass < 3; pass++) this.blurLight(lx0, lx1)

    // --- bake into the shadow overlay ---
    const gloom = theme.gloom
    const data = this.shadowImage.data
    for (let y = 0; y < WORLD_H; y++) {
      const ly = y / LIGHT_SCALE
      const row = y * WORLD_W
      for (let x = vx; x < vx + vw; x++) {
        const value = this.sampleLight(x / LIGHT_SCALE, ly)
        const alpha = Math.max(0, Math.min(1, 1 - value)) * gloom
        const o = (row + x) * 4
        data[o] = 4
        data[o + 1] = 3
        data[o + 2] = 12
        data[o + 3] = Math.round(alpha * 255)
      }
    }
    this.shadowCtx.putImageData(this.shadowImage, 0, 0, vx, 0, vw, WORLD_H)
  }

  private blurLight(lx0: number, lx1: number): void {
    const src = this.light
    const dst = this.lightScratch
    for (let y = 0; y < LH; y++) {
      for (let x = lx0; x < lx1; x++) {
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
    for (let y = 0; y < LH; y++) {
      const a = y * LW + lx0
      const b = y * LW + lx1
      src.set(dst.subarray(a, b), a)
    }
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

  private drawCreatures(w: WorldState, vx: number, vw: number): void {
    const ctx = this.wctx
    for (const c of w.creatures) {
      const bp = w.blueprints[c.blueprintId]
      if (!bp) continue
      const sprites = getSprites(bp)
      // Most of the population is off screen in a world this wide. Culling here
      // is what keeps the draw cost tied to what you can see rather than to how
      // many things happen to be alive.
      if (c.x + sprites.width < vx || c.x > vx + vw) continue
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

  /**
   * Halo over the oldest thing that has ever lived here.
   *
   * A ring rather than a crown: at six pixels wide a crown is three pixels of
   * mush sitting on the creature's head, while an ellipse floating clear of the
   * sprite reads as a halo at any size and never hides the animal wearing it.
   * This is the only mark the record system puts on the world — everything else
   * it knows lives behind a tap.
   */
  private drawElder(w: WorldState, id: number): void {
    const c = w.creatures.find((x) => x.id === id)
    if (!c) return
    const bp = w.blueprints[c.blueprintId]
    if (!bp) return
    const rows = bp.art.frames[0]
    const bw = rows[0].length

    const ctx = this.wctx
    const cx = Math.round(c.x) + bw / 2
    // Two pixels of clear air above the sprite, so it reads as floating rather
    // than as part of the creature.
    const cy = Math.round(c.y) - 3
    const rx = Math.max(2, Math.min(6, bw / 2))
    const ry = Math.max(1, rx * 0.42)

    // Slower than the selection pulse — this is meant to be noticed, not to
    // demand attention while you're doing something else.
    ctx.fillStyle = '#fcd34d'
    ctx.globalAlpha = 0.62 + 0.28 * Math.sin(w.elapsed * 2.6)

    // Plotted point by point instead of ctx.ellipse: a stroked path at this
    // scale antialiases into a grey smudge, and the whole world is nearest
    // neighbour. Step is tied to the radius so small halos don't come out dotted.
    const steps = Math.max(12, Math.round(rx * 6))
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2
      ctx.fillRect(
        Math.round(cx + Math.cos(t) * rx),
        Math.round(cy + Math.sin(t) * ry),
        1,
        1
      )
    }
    ctx.globalAlpha = 1
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

  private drawParticles(w: WorldState, vx: number, vw: number): void {
    const ctx = this.wctx
    for (const p of w.particles) {
      if (p.x < vx || p.x > vx + vw) continue
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife))
      ctx.fillStyle = p.color
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1)
    }
    ctx.globalAlpha = 1
  }

  // -------------------------------------------------------------------------
  // Minimap
  // -------------------------------------------------------------------------

  /**
   * A thumbnail of the whole world with the view marked on it.
   *
   * Drawn on the canvas rather than in React because it has to stay on the same
   * pixel grid as the world and it changes every frame — a DOM element updated
   * at 60Hz would be the most expensive thing on the page. The buttons beside it
   * are the real controls; this is the map that tells you where you are.
   */
  private drawMinimap(w: WorldState, theme: Theme, vx: number): void {
    if (this.fitsOnScreen) {
      this.mapRect.w = 0
      return
    }

    this.mapAge++
    if (this.mapAge >= MAP_REFRESH_FRAMES) {
      this.mapAge = 0
      this.buildMapImage(w, theme)
    }

    const dw = this.display.width
    const dh = this.display.height
    const width = Math.round(Math.max(140, Math.min(dw * 0.32, 520)))
    const height = Math.round((width * MH) / MW)
    const pad = Math.max(6, Math.round(dh * 0.025))
    const x = Math.round((dw - width) / 2)
    const y = dh - height - pad

    this.mapRect = { x, y, w: width, h: height }

    const ctx = this.ctx
    ctx.save()
    ctx.imageSmoothingEnabled = false

    const border = Math.max(1, Math.round(width / 200))
    ctx.fillStyle = 'rgba(5, 4, 12, 0.72)'
    ctx.fillRect(x - border, y - border, width + border * 2, height + border * 2)

    ctx.globalAlpha = 0.9
    ctx.drawImage(this.mapCanvas, 0, 0, MW, MH, x, y, width, height)
    ctx.globalAlpha = 1

    // The view, marked. Kept at least a couple of pixels wide so it can't
    // vanish on a narrow screen.
    const vxPx = x + Math.round((vx / WORLD_W) * width)
    const vwPx = Math.max(3, Math.round((this.viewTiles / WORLD_W) * width))
    ctx.strokeStyle = '#5eead4'
    ctx.lineWidth = Math.max(1, Math.round(width / 220))
    ctx.strokeRect(
      vxPx + ctx.lineWidth / 2,
      y + ctx.lineWidth / 2,
      Math.min(vwPx, width - (vxPx - x)) - ctx.lineWidth,
      height - ctx.lineWidth
    )

    ctx.strokeStyle = 'rgba(94, 234, 212, 0.35)'
    ctx.lineWidth = border
    ctx.strokeRect(x - border / 2, y - border / 2, width + border, height + border)
    ctx.restore()
  }

  private buildMapImage(w: WorldState, theme: Theme): void {
    const data = this.mapImage.data
    const tiles = w.tiles
    const rgb = this.materialRgb
    const sky = hexToRgb(theme.sky[1])

    for (let my = 0; my < MH; my++) {
      const wy = Math.min(WORLD_H - 1, my * MAP_SCALE)
      for (let mx = 0; mx < MW; mx++) {
        const wx = Math.min(WORLD_W - 1, mx * MAP_SCALE)
        const mat = tiles[wy * WORLD_W + wx]
        const o = (my * MW + mx) * 4
        const c = mat === 0 ? sky : rgb[mat]
        data[o] = c.r
        data[o + 1] = c.g
        data[o + 2] = c.b
        data[o + 3] = 255
      }
    }
    this.mapCtx.putImageData(this.mapImage, 0, 0)
  }
}
