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
 * The world is wider than the screen, so there is a camera, and it only ever
 * sits on whole tiles: a camera at x = 12.4 would resample every tile in the
 * world onto a half-pixel and undo the one thing this renderer exists to
 * protect. Every per-frame pass below — tiles, light, shadow, sprites — is
 * clipped to the visible column range, which is what keeps a world three times
 * the size costing about what one screen used to.
 *
 * Zoom moves the size of a tile, never the size of the backbuffer: the world is
 * always composed at one pixel per tile and the zoom lives entirely in the final
 * blit, so pushing in costs nothing and pulling out to the whole world costs
 * only the wider column range. Pushed in far enough the world no longer fits
 * top to bottom, which is the only reason there is a vertical camera at all —
 * it is pinned to 0 and does nothing until the rows stop fitting.
 */
import { MATERIAL_BY_INDEX } from '@/app/micro-land/domain/config/materials'
import type { Theme } from '@/app/micro-land/domain/config/themes'
import { VIEW_W, WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { lifespanOf, sizeOf, tintKey } from '@/app/micro-land/domain/traits'
import { TUNING } from '@/app/micro-land/domain/tuning'
import type { WorldState } from '@/app/micro-land/domain/types'
import { useMicroLand } from '@/app/micro-land/store'

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

/**
 * How far in the camera can push, as a multiple of the default framing.
 *
 * 3× puts roughly 75 tiles across a phone, which is about a dozen body lengths
 * of a mid-sized creature — close enough to watch one eat without losing the
 * ground it is standing on. Past that the pixels are large enough that the art
 * stops reading as a creature and starts reading as squares.
 */
const ZOOM_MAX = 3

/** One press of + or −. Five or six presses cross the whole range. */
export const ZOOM_STEP = 1.5

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

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

interface TrailPoint { x: number; y: number; elapsed: number }
/** Creature id → recent positions. Updated and drawn by drawCreatures(). */
const trailMap = new Map<number, TrailPoint[]>()

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
   * Display pixels per tile at zoom 1 — the default framing, VIEW_W across.
   *
   * Zoom is expressed as a multiple of this rather than as an absolute tile size
   * so that 1× means the same thing on every display: exactly the framing the
   * game has always had, whatever the screen happens to be.
   */
  private baseScale = 1
  private zoom = 1
  /** Pulled back far enough to see the whole world. Depends on the display. */
  private minZoom = 1

  /**
   * Left edge of the view in world tiles. Kept fractional so a slow pan can
   * accumulate, but always floored before anything is drawn from it.
   */
  private camX = 0
  /** Top edge, same rules. Stays 0 unless zoom has made the world too tall. */
  private camY = 0
  /** How many world tiles the display is wide at the current scale. */
  private viewTiles = VIEW_W
  /** How many world rows the display is tall at the current scale. */
  private viewRows = WORLD_H

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

    this.materialRgb = MATERIAL_BY_INDEX.map(m => hexToRgb(m.color))
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

    // The resting zoom is fixed by VIEW_W, not by the whole world: a tile is
    // sized so that one screen's worth spans the canvas, exactly as it did when
    // the world was one screen wide. Whatever extra height allows, you simply
    // get to see.
    this.baseScale = Math.min(this.display.width / VIEW_W, this.display.height / WORLD_H)
    // Far enough out to hold all 672 columns, and never past 1× — on a display
    // wide enough to show the whole world already there is nothing to pull back
    // to, and a zoom-out button that magnified would be a lie.
    this.minZoom = Math.min(1, this.display.width / WORLD_W / this.baseScale)
    this.applyZoom()
  }

  /** Re-derive everything that depends on the zoom. Always ends clamped. */
  private applyZoom(): void {
    this.zoom = clamp(this.zoom, this.minZoom, ZOOM_MAX)
    const scale = this.baseScale * this.zoom
    this.scale = scale
    // Capped at the world: pulled all the way out there is letterboxing rather
    // than a view that claims to extend past the edge of everything there is.
    this.viewTiles = Math.min(WORLD_W, this.display.width / scale)
    this.viewRows = Math.min(WORLD_H, this.display.height / scale)
    this.offsetX = Math.floor((this.display.width - this.viewTiles * scale) / 2)
    this.offsetY = Math.floor((this.display.height - this.viewRows * scale) / 2)
    this.clampCam()
  }

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  /** Left edge of the view, in world tiles. */
  get cameraX(): number {
    return this.camX
  }

  /** Top edge of the view, in world rows. */
  get cameraY(): number {
    return this.camY
  }

  /** How much world is on screen right now, in tiles. */
  get viewWidth(): number {
    return this.viewTiles
  }

  /** How much world is on screen right now, in rows. */
  get viewHeight(): number {
    return this.viewRows
  }

  /** True when the whole world already fits — nothing to scroll to. */
  get fitsOnScreen(): boolean {
    return this.viewTiles >= WORLD_W && this.viewRows >= WORLD_H
  }

  /** Whether there is any world above or below to scroll to. */
  get canPanVertically(): boolean {
    return this.viewRows < WORLD_H
  }

  get zoomLevel(): number {
    return this.zoom
  }

  get canZoomIn(): boolean {
    return this.zoom < ZOOM_MAX - 1e-6
  }

  get canZoomOut(): boolean {
    return this.zoom > this.minZoom + 1e-6
  }

  panBy(tiles: number, rows = 0): void {
    this.camX += tiles
    this.camY += rows
    this.clampCam()
  }

  /** Put this world column at the left edge of the view. */
  panToLeft(tile: number): void {
    this.camX = tile
    this.clampCam()
  }

  /** Put this world point at the top-left corner. Absolute, for drag-panning. */
  panTo(tile: number, row: number): void {
    this.camX = tile
    this.camY = row
    this.clampCam()
  }

  /** Put this world column — and optionally this row — in the middle of the view. */
  centerOn(worldX: number, worldY?: number): void {
    this.camX = worldX - this.viewTiles / 2
    if (worldY !== undefined) this.camY = worldY - this.viewRows / 2
    this.clampCam()
  }

  // -------------------------------------------------------------------------
  // Zoom
  // -------------------------------------------------------------------------

  /**
   * Change the zoom, holding one point of the world still under the screen.
   *
   * Without an anchor the middle of the view is what stays put, which is what a
   * button press wants. With one — the pointer, or the midpoint between two
   * fingers — the tile you started the gesture on is the tile you end it on,
   * which is the whole difference between pinching a map and fighting one.
   *
   * Returns whether the zoom actually moved, so a caller can tell a press that
   * did something from one that hit the end of the range.
   */
  setZoom(next: number, anchor?: { clientX: number; clientY: number }): boolean {
    const target = clamp(next, this.minZoom, ZOOM_MAX)
    if (Math.abs(target - this.zoom) < 1e-6) return false

    if (!anchor) {
      const midX = this.camX + this.viewTiles / 2
      const midY = this.camY + this.viewRows / 2
      this.zoom = target
      this.applyZoom()
      this.centerOn(midX, midY)
      return true
    }

    // Measured off the fractional camera rather than `screenToWorld`, which
    // floors: a pinch is a stream of tiny changes, and quantising the anchor to
    // whole tiles at every step is what makes a zoom gesture crawl sideways.
    const rect = this.display.getBoundingClientRect()
    const dpr = rect.width === 0 ? 1 : this.display.width / rect.width
    const px = (anchor.clientX - rect.left) * dpr
    const py = (anchor.clientY - rect.top) * dpr
    const worldX = this.camX + (px - this.offsetX) / this.scale
    const worldY = this.camY + (py - this.offsetY) / this.scale

    this.zoom = target
    this.applyZoom()

    this.camX = worldX - (px - this.offsetX) / this.scale
    this.camY = worldY - (py - this.offsetY) / this.scale
    this.clampCam()
    return true
  }

  /** One notch of the +/− ladder. */
  zoomByStep(direction: 1 | -1, anchor?: { clientX: number; clientY: number }): boolean {
    const next = direction === 1 ? this.zoom * ZOOM_STEP : this.zoom / ZOOM_STEP
    // 1× is the framing the game was built around, so a ladder that steps over
    // it can never be landed on again without a lucky screen width. Anything
    // that crosses it stops there first.
    const snapped = (this.zoom - 1) * (next - 1) < 0 ? 1 : next
    return this.setZoom(snapped, anchor)
  }

  resetZoom(): boolean {
    return this.setZoom(1)
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

  /** The same, up and down. A no-op while the world still fits vertically. */
  keepInViewY(worldY: number, margin: number, maxRows: number): void {
    if (!this.canPanVertically) return
    const top = this.camY + margin
    const bottom = this.camY + this.viewRows - margin
    if (worldY < top) this.panBy(0, Math.max(-maxRows, worldY - top))
    else if (worldY > bottom) this.panBy(0, Math.min(maxRows, worldY - bottom))
  }

  private clampCam(): void {
    // `max(0, …)` on the limit as well as the value: pulled out far enough that
    // the world is letterboxed, `WORLD_W - viewTiles` is negative and the naive
    // clamp would pin the camera to a negative column.
    this.camX = clamp(this.camX, 0, Math.max(0, WORLD_W - this.viewTiles))
    this.camY = clamp(this.camY, 0, Math.max(0, WORLD_H - this.viewRows))
  }

  /**
   * How many world tiles one CSS pixel of drag is worth. Same either axis —
   * tiles are square and the scale is uniform.
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

  /** Whole-tile top edge. Same reason as `viewLeft`. */
  private viewTop(): number {
    return Math.floor(this.camY)
  }

  /** Display pixel → world tile. Used by every pointer interaction. */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.display.getBoundingClientRect()
    const dpr = this.display.width / rect.width
    const px = (clientX - rect.left) * dpr
    const py = (clientY - rect.top) * dpr
    return {
      x: this.viewLeft() + (px - this.offsetX) / this.scale,
      y: this.viewTop() + (py - this.offsetY) / this.scale,
    }
  }

  /**
   * Was this tap on the minimap, and if so where in the world does it point?
   *
   * Returns the world point to centre on, or null if the tap missed. The
   * minimap is the only part of the world canvas that isn't the world, so it
   * has to be asked about before a tap is allowed to paint anything.
   *
   * The row comes back as well as the column because zoomed in there is a
   * vertical camera to aim, and the thumbnail shows the whole height — tapping
   * a cave near the bottom of it and arriving at the surface would be a map
   * that answers a question you didn't ask.
   */
  minimapHit(clientX: number, clientY: number): { x: number; y: number } | null {
    const m = this.mapRect
    if (m.w <= 0) return null
    const rect = this.display.getBoundingClientRect()
    const dpr = this.display.width / rect.width
    const px = (clientX - rect.left) * dpr
    const py = (clientY - rect.top) * dpr
    if (px < m.x || px > m.x + m.w || py < m.y || py > m.y + m.h) return null
    return { x: ((px - m.x) / m.w) * WORLD_W, y: ((py - m.y) / m.h) * WORLD_H }
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

    this.drawCarcasses(w, vx, vw)
    this.drawTombstones(w, vx, vw)
    this.drawEggs(w, vx, vw)
    this.drawCreatures(w, vx, vw)
    this.drawPollinatorAuras(w, vx, vw)
    this.drawParticles(w, vx, vw)
    wctx.drawImage(this.shadowCanvas, vx, 0, vw, WORLD_H, vx, 0, vw, WORLD_H)
    // Both drawn after the shadow so they stay legible in a dark cave. The halo
    // goes first so the selection brackets sit on top when you inspect an elder.
    if (elderId !== null) this.drawElder(w, elderId)
    if (highlightId !== null) this.drawHighlight(w, highlightId)

    // Day/night cycle: gradually darkens during the night phase.
    if (TUNING.dayLengthSeconds > 0) {
      const nightFactor = (1 - Math.cos(2 * Math.PI * w.elapsed / TUNING.dayLengthSeconds)) / 2
      if (nightFactor > 0.05) {
        wctx.globalAlpha = Math.min(0.5, nightFactor * 0.55)
        wctx.fillStyle = '#000a1f'
        wctx.fillRect(vx, 0, vw, WORLD_H)
        wctx.globalAlpha = 1
      }
    }

    // One scaled blit. Nearest-neighbour keeps the pixels crisp.
    const ctx = this.ctx
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#05040c'
    ctx.fillRect(0, 0, this.display.width, this.display.height)
    ctx.drawImage(
      this.world,
      vx,
      this.viewTop(),
      this.viewTiles,
      this.viewRows,
      this.offsetX,
      this.offsetY,
      this.viewTiles * this.scale,
      this.viewRows * this.scale
    )

    this.drawMinimap(w, theme, vx)
    this.drawNameLabels(w, vx, vw, elderId)
    this.drawTombstoneLabels(w, vx, vw)
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

  private drawCarcasses(w: WorldState, vx: number, vw: number): void {
    if (w.carcasses.length === 0) return
    const ctx = this.wctx
    ctx.fillStyle = '#5a2e10'
    for (const car of w.carcasses) {
      if (car.x + 1 < vx || car.x > vx + vw) continue
      // Fade out during the last 3 seconds of decay.
      ctx.globalAlpha = Math.min(1, car.decaySeconds / 3) * 0.8
      ctx.fillRect(car.x - 0.75, car.y - 0.75, 1.5, 1.5)
    }
    ctx.globalAlpha = 1
  }

  /**
   * Orbiting pollen motes around creatures with a plant-helping aura.
   * Drawn on the world canvas so they scale with zoom like everything else.
   */
  private drawPollinatorAuras(w: WorldState, vx: number, vw: number): void {
    const ctx = this.wctx
    for (const c of w.creatures) {
      const bp = w.blueprints[c.blueprintId]
      if (!bp?.aura?.helps.includes('plant')) continue

      const rows = bp.art.frames[0]
      const bw = rows[0].length
      const bh = rows.length
      if (c.x + bw < vx || c.x > vx + vw) continue

      const cx = c.x + bw / 2
      const cy = c.y + bh / 2
      const orbitR = Math.max(4, bw)

      // 4 motes orbiting at different phase offsets
      ctx.fillStyle = '#fde68a'
      for (let i = 0; i < 4; i++) {
        const angle = w.elapsed * 1.8 + i * (Math.PI / 2)
        const mx = Math.round(cx + Math.cos(angle) * orbitR)
        const my = Math.round(cy + Math.sin(angle) * orbitR * 0.5)
        ctx.globalAlpha = 0.45 + 0.3 * Math.sin(w.elapsed * 3 + i)
        ctx.fillRect(mx, my, 1, 1)
      }
      ctx.globalAlpha = 1
    }
  }

  /**
   * Pixel-art headstones where named creatures died.
   *
   * Drawn on the world canvas so they sit in the world at tile scale and get
   * scaled up with everything else. Names are drawn separately on the display
   * canvas so they stay legible at any zoom.
   */
  private drawTombstones(w: WorldState, vx: number, vw: number): void {
    if (!w.tombstones || w.tombstones.length === 0) return
    const ctx = this.wctx
    ctx.fillStyle = '#9a8878'
    ctx.globalAlpha = 0.9

    for (const tomb of w.tombstones) {
      const cx = Math.round(tomb.x)
      const cy = Math.round(tomb.y)
      if (cx + 2 < vx || cx - 2 > vx + vw) continue

      // Headstone shape: 1-wide cap, then 3-wide body rising upward from centre.
      //  .█.   cy-4
      //  ███   cy-3
      //  ███   cy-2
      //  ███   cy-1
      ctx.fillRect(cx, cy - 4, 1, 1)
      ctx.fillRect(cx - 1, cy - 3, 3, 3)
    }

    ctx.globalAlpha = 1
  }

  /**
   * Name tags for tombstones, drawn on the display canvas so they stay
   * legible regardless of zoom — same approach as drawNameLabels.
   */
  private drawTombstoneLabels(w: WorldState, vx: number, vw: number): void {
    if (!w.tombstones || w.tombstones.length === 0) return

    const ctx = this.ctx
    const scale = this.scale
    const offsetX = this.offsetX
    const offsetY = this.offsetY
    const viewTop = this.viewTop()

    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    for (const tomb of w.tombstones) {
      if (tomb.x + 2 < vx || tomb.x - 2 > vx + vw) continue

      // Position: above the headstone top (cy-4 in world coords, then convert).
      const dx = (tomb.x - vx) * scale + offsetX
      const dy = (tomb.y - 5 - viewTop) * scale + offsetY

      // Dim shadow + muted warm-gray text (more memorial than the white creature labels).
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillText(tomb.name, dx + 1, dy + 1)
      ctx.fillStyle = 'rgba(200,185,165,0.85)'
      ctx.fillText(tomb.name, dx, dy)
    }

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  private drawEggs(w: WorldState, vx: number, vw: number): void {
    if (!w.eggs?.length) return
    const ctx = this.wctx
    ctx.strokeStyle = '#f5e642'
    ctx.lineWidth = 1
    for (const egg of w.eggs) {
      if (egg.hatchIn <= 0) continue
      if (egg.x + 2 < vx || egg.x - 2 > vx + vw) continue
      const rx = 1.5
      const ry = 2
      ctx.beginPath()
      ctx.ellipse(Math.round(egg.x), Math.round(egg.y), rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  private drawCreatures(w: WorldState, vx: number, vw: number): void {
    const ctx = this.wctx
    const traitKey = useMicroLand.getState().traitOverlay
    const trailsEnabled = useMicroLand.getState().trailsEnabled

    // --- trails: record positions, then draw before sprites ---
    if (trailsEnabled) {
      const now = w.elapsed
      // Build a fast id→creature lookup for pruning dead trails
      const alive = new Set(w.creatures.map(c => c.id))
      for (const id of trailMap.keys()) {
        if (!alive.has(id)) trailMap.delete(id)
      }
      // Sample & prune each creature
      for (const c of w.creatures) {
        let trail = trailMap.get(c.id)
        if (!trail) { trail = []; trailMap.set(c.id, trail) }
        // Sample at ~10 Hz (every 0.1 s of elapsed time)
        const last = trail[trail.length - 1]
        if (!last || now - last.elapsed > 0.1) {
          trail.push({ x: c.x, y: c.y, elapsed: now })
        }
        // Drop points older than 5 s
        while (trail.length > 0 && now - trail[0].elapsed > 5) trail.shift()
      }
      // Draw all trails (under sprites)
      for (const c of w.creatures) {
        const trail = trailMap.get(c.id)
        if (!trail || trail.length < 2) continue
        if (c.x + 4 < vx || c.x > vx + vw) continue  // rough cull
        const hue = c.traits.hue ?? 0
        ctx.fillStyle = `hsl(${hue}, 55%, 68%)`
        for (const pt of trail) {
          const age = w.elapsed - pt.elapsed
          if (age > 5) continue
          ctx.globalAlpha = (1 - age / 5) * 0.45
          ctx.fillRect(Math.round(pt.x), Math.round(pt.y), 1, 1)
        }
      }
      ctx.globalAlpha = 1
    } else {
      // Clear stale data when trails are off, so re-enabling starts fresh.
      if (trailMap.size > 0) trailMap.clear()
    }

    for (const c of w.creatures) {
      const bp = w.blueprints[c.blueprintId]
      if (!bp) continue
      // Its own colour, not its species'. `tintKey` quantizes, so a whole
      // population that has drifted together shares one cached set.
      const sprites = getSprites(bp, tintKey(c.traits))
      // Most of the population is off screen in a world this wide. Culling here
      // is what keeps the draw cost tied to what you can see rather than to how
      // many things happen to be alive.
      if (c.x + sprites.width < vx || c.x > vx + vw) continue
      const frameCount = sprites.frames.length
      const frame = frameCount === 1 ? 0 : Math.floor(c.animMs / sprites.frameMs) % frameCount
      const source =
        c.facing === -1 && bp.art.faceMotion ? sprites.flipped[frame] : sprites.frames[frame]

      const size = sizeOf(c)
      const sw = Math.round(sprites.width * size)
      const sh = Math.round(sprites.height * size)
      // Anchor at the bottom-centre so feet stay on the ground.
      const x = Math.round(c.x + (sprites.width - sw) / 2)
      const y = Math.round(c.y + sprites.height - sh)

      // A creature about to starve or drown flickers, so you can spot it.
      if (c.starving > 0 || c.distress > 2) {
        const pulse = Math.sin(w.elapsed * 12) * 0.5 + 0.5
        ctx.globalAlpha = 0.45 + pulse * 0.55
      }
      ctx.drawImage(source, x, y, sw, sh)
      ctx.globalAlpha = 1

      // Age desaturation: overlay a gray wash that grows as the creature ages.
      // Only applies to animals (plants age differently); kicks in after half
      // their lifespan has elapsed so young creatures look vivid.
      if (bp.move.kind !== 'root') {
        const ageFraction = Math.min(1, c.ageSeconds / lifespanOf(c, bp))
        if (ageFraction > 0.5) {
          const grayAlpha = ((ageFraction - 0.5) / 0.5) * 0.45
          ctx.globalAlpha = grayAlpha
          ctx.fillStyle = '#888888'
          ctx.fillRect(x, y, sprites.width, sprites.height)
          ctx.globalAlpha = 1
        }
      }

      // Disease indicator: semi-transparent green-yellow wash that pulses.
      if ((c as { sick?: number }).sick) {
        const sickPulse = Math.sin(w.elapsed * 6) * 0.25 + 0.55
        ctx.globalAlpha = sickPulse
        ctx.fillStyle = '#7fff00'
        ctx.fillRect(x, y, sw, sh)
        ctx.globalAlpha = 1
      }

      if (traitKey) {
        const delta = ((c.traits as Record<string, number>)[traitKey] ?? 1) - 1.0
        if (Math.abs(delta) >= 0.08) {
          const alpha = Math.min(0.6, Math.abs(delta) * 1.2).toFixed(2)
          ctx.globalAlpha = parseFloat(alpha)
          ctx.fillStyle = delta < 0 ? '#1e64ff' : '#ff3c00'
          ctx.fillRect(x, y, sw, sh)
          ctx.globalAlpha = 1
        }
      }
    }
  }

  /**
   * Glow around the oldest thing that has ever lived here.
   *
   * A ring of pixels wrapping the sprite rather than floating above it — a glow reads as vitality; a halo reads as dead.
   */
  private drawElder(w: WorldState, id: number): void {
    const c = w.creatures.find(x => x.id === id)
    if (!c) return
    const bp = w.blueprints[c.blueprintId]
    if (!bp) return
    const rows = bp.art.frames[0]
    const bw = rows[0].length
    const bh = rows.length

    const ctx = this.wctx
    // Centre of the sprite body — glow wraps around it, not above it.
    const cx = Math.round(c.x) + bw / 2
    const cy = Math.round(c.y) + bh / 2

    // 2px clearance outside the sprite bounds on each axis.
    const rx = bw / 2 + 2
    const ry = bh / 2 + 2

    ctx.fillStyle = '#fcd34d'
    ctx.globalAlpha = 0.5 + 0.25 * Math.sin(w.elapsed * 2.6)

    // Point-by-point so it stays sharp at pixel scale (no antialiasing).
    const steps = Math.max(16, Math.round((rx + ry) * 4))
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2
      ctx.fillRect(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry), 1, 1)
    }
    ctx.globalAlpha = 1
  }

  /** Ring around the creature the inspector is watching. */
  private drawHighlight(w: WorldState, id: number): void {
    const c = w.creatures.find(x => x.id === id)
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

    // The view, marked. Kept at least a couple of pixels each way so it can't
    // vanish on a narrow screen — or, zoomed right in, collapse to a line.
    const vxPx = x + Math.round((vx / WORLD_W) * width)
    const vwPx = Math.max(3, Math.round((this.viewTiles / WORLD_W) * width))
    const vyPx = y + Math.round((this.viewTop() / WORLD_H) * height)
    const vhPx = Math.max(3, Math.round((this.viewRows / WORLD_H) * height))
    ctx.strokeStyle = '#5eead4'
    ctx.lineWidth = Math.max(1, Math.round(width / 220))
    ctx.strokeRect(
      vxPx + ctx.lineWidth / 2,
      vyPx + ctx.lineWidth / 2,
      Math.min(vwPx, width - (vxPx - x)) - ctx.lineWidth,
      Math.min(vhPx, height - (vyPx - y)) - ctx.lineWidth
    )

    ctx.strokeStyle = 'rgba(94, 234, 212, 0.35)'
    ctx.lineWidth = border
    ctx.strokeRect(x - border / 2, y - border / 2, width + border, height + border)
    ctx.restore()
  }

  /**
   * Name tags for creatures the player has named.
   *
   * Drawn on the display canvas at display resolution so text stays legible
   * regardless of zoom. Only named creatures get a tag, which keeps the world
   * uncluttered — a name is notable, not a default label.
   */
  private drawNameLabels(w: WorldState, vx: number, vw: number, elderId: number | null): void {
    const elder = elderId !== null ? w.creatures.find(x => x.id === elderId) ?? null : null
    const namedCreatures = w.creatures.filter(c => c.name !== null)
    const showUnnamed = elder !== null && elder.name === null

    if (namedCreatures.length === 0 && !showUnnamed) return

    const ctx = this.ctx
    const scale = this.scale
    const offsetX = this.offsetX
    const offsetY = this.offsetY
    const viewTop = this.viewTop()

    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    for (const c of namedCreatures) {
      const bp = w.blueprints[c.blueprintId]
      if (!bp) continue
      if (c.x + bp.art.frames[0][0].length < vx || c.x > vx + vw) continue

      const rows = bp.art.frames[0]
      const bw = rows[0].length
      const dx = (c.x + bw / 2 - vx) * scale + offsetX
      const dy = (c.y - viewTop) * scale + offsetY - 3

      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillText(c.name!, dx + 1, dy + 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(c.name!, dx, dy)
    }

    // Unnamed elder: dim placeholder so the player knows it can be named.
    if (showUnnamed && elder) {
      const bp = w.blueprints[elder.blueprintId]
      if (bp && !(elder.x + bp.art.frames[0][0].length < vx || elder.x > vx + vw)) {
        const bw = bp.art.frames[0][0].length
        const dx = (elder.x + bw / 2 - vx) * scale + offsetX
        const dy = (elder.y - viewTop) * scale + offsetY - 3
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.fillText('unnamed', dx, dy)
      }
    }

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
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
