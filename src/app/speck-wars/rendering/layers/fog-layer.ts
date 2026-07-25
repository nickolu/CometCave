import { Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js'
import type { SimulationState } from '../../domain/types'
import {
  WORLD_WIDTH, WORLD_HEIGHT,
  FOG_ALPHA, FOG_CELL_SIZE,
  FOG_VISION_SPECK, FOG_VISION_BASE, FOG_VISION_BUILDING,
} from '../../domain/constants'

const FOG_COLS = Math.ceil(WORLD_WIDTH / FOG_CELL_SIZE)
const FOG_ROWS = Math.ceil(WORLD_HEIGHT / FOG_CELL_SIZE)
const FOG_CELLS = FOG_COLS * FOG_ROWS

// The vision mask lives in its own low-res texture: ~6 world px per texel. Upscaling it
// to world size is what gives the reveal its soft edge, and it keeps the per-frame draw
// into the mask tiny regardless of army size.
const MASK_WIDTH = 512
const MASK_HEIGHT = Math.round(MASK_WIDTH * (WORLD_HEIGHT / WORLD_WIDTH))
const MASK_SCALE = MASK_WIDTH / WORLD_WIDTH

// Radius revealed for one occupied speck cell — the vision radius plus half a cell, so
// specks anywhere in the cell still see at least FOG_VISION_SPECK around themselves.
const CELL_VISION_RADIUS = FOG_VISION_SPECK + FOG_CELL_SIZE * 0.5

// Pixi's TS defs mark setMask optional on the effects mixin; it exists at runtime.
type Maskable = { setMask(options: { mask: Container; inverse: boolean }): void }

// Minimal shape of the Pixi renderer we need — the full type is not reliably inferred
// in this Next.js project context (same reason textures.ts casts).
export interface MaskRenderer {
  render(options: { container: Container; target: RenderTexture; clear: boolean }): void
}

// White radial gradient: opaque core, soft falloff at the rim. The mask filter reads the
// red channel, so white-on-transparent is what punches a hole in the fog.
function createVisionTexture(): Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return Texture.WHITE   // degenerate fallback: square vision, still playable
  const r = size / 2
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.62, 'rgba(255,255,255,1)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return Texture.from(canvas)
}

/**
 * Fog of war.
 *
 * The fog is a single black rect, built once and never rebuilt. Vision is an inverse
 * alpha mask: each frame we draw one soft circle per vision source into a low-res render
 * texture, and the fog is hidden wherever that texture is bright.
 *
 * Per frame that costs one batched draw call plus a viewport-sized mask pass. The
 * previous implementation rebuilt the fog geometry every frame with Graphics.cut(),
 * which routes Pixi into an earcut triangulation of the rect plus every hole ring — and
 * since adjacent vision circles overlap, earcut fell into its self-intersection recovery
 * path: seconds per frame once a handful of cells were occupied.
 */
export class FogLayer {
  readonly stage: Container
  private renderer: MaskRenderer
  private fogGfx: Graphics
  private maskRT: RenderTexture
  private maskSprite: Sprite
  private visionTexture: Texture
  private visionScene: Container
  private pool: Sprite[] = []
  private activeCount = 0

  // Per-cell speck accumulators, reused across frames to avoid per-frame allocation
  private cellCount = new Int32Array(FOG_CELLS)
  private cellSumX = new Float32Array(FOG_CELLS)
  private cellSumY = new Float32Array(FOG_CELLS)
  private occupied: number[] = []

  constructor(renderer: MaskRenderer) {
    this.renderer = renderer
    this.stage = new Container()

    this.fogGfx = new Graphics()
    // Cast for Pixi v8 fluent API (rect/fill) not in TS defs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.fogGfx as any).rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill({ color: 0x000000, alpha: FOG_ALPHA })

    // Cast for the Pixi v8 options signature (the stale @types/pixi.js@4 in devDeps
    // shadows it with the v4 `create(width, height)` form)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.maskRT = (RenderTexture as any).create({ width: MASK_WIDTH, height: MASK_HEIGHT }) as RenderTexture
    this.maskSprite = new Sprite(this.maskRT)
    this.maskSprite.width = WORLD_WIDTH
    this.maskSprite.height = WORLD_HEIGHT

    this.stage.addChild(this.fogGfx)
    this.stage.addChild(this.maskSprite)   // in the tree so its transform stays current
    ;(this.fogGfx as unknown as Maskable).setMask({ mask: this.maskSprite, inverse: true })

    this.visionTexture = createVisionTexture()
    this.visionScene = new Container()     // drawn into maskRT, never added to the stage
  }

  update(sim: SimulationState, playerId: string): void {
    let n = 0

    // --- Vision from buildings ---
    for (const building of Object.values(sim.buildings)) {
      if (building.ownerId !== playerId) continue
      const r = building.typeId === 'base' ? FOG_VISION_BASE : FOG_VISION_BUILDING
      n = this.stamp(n, building.x, building.y, r)
    }

    // --- Vision from specks ---
    // Collapse specks onto a coarse grid so cost is O(cells), not O(specks). Each
    // occupied cell reveals around its specks' centroid rather than the cell centre, so
    // the reveal tracks the army instead of snapping from cell to cell.
    const { cellCount, cellSumX, cellSumY, occupied } = this
    occupied.length = 0
    for (let i = 0; i < sim.speckCount; i++) {
      if (!sim.speckIds[i]) continue
      const meta = sim.speckMeta[i]
      if (!meta || meta.ownerId !== playerId) continue
      const x = sim.speckX[i]
      const y = sim.speckY[i]
      const col = Math.min(FOG_COLS - 1, Math.max(0, Math.floor(x / FOG_CELL_SIZE)))
      const row = Math.min(FOG_ROWS - 1, Math.max(0, Math.floor(y / FOG_CELL_SIZE)))
      const idx = row * FOG_COLS + col
      if (cellCount[idx] === 0) occupied.push(idx)
      cellCount[idx]++
      cellSumX[idx] += x
      cellSumY[idx] += y
    }
    for (const idx of occupied) {
      const count = cellCount[idx]
      n = this.stamp(n, cellSumX[idx] / count, cellSumY[idx] / count, CELL_VISION_RADIUS)
      cellCount[idx] = 0
      cellSumX[idx] = 0
      cellSumY[idx] = 0
    }

    // Retire sprites left over from a frame that had more vision sources
    for (let i = n; i < this.activeCount; i++) this.pool[i].visible = false
    this.activeCount = n

    this.renderer.render({ container: this.visionScene, target: this.maskRT, clear: true })
  }

  /** Place pooled vision circle `n` at world (x, y) with radius r. Returns n + 1. */
  private stamp(n: number, x: number, y: number, r: number): number {
    let sprite = this.pool[n]
    if (!sprite) {
      sprite = new Sprite(this.visionTexture)
      sprite.anchor.set(0.5)
      this.pool[n] = sprite
      this.visionScene.addChild(sprite)
    }
    sprite.visible = true
    sprite.position.set(x * MASK_SCALE, y * MASK_SCALE)
    const size = r * 2 * MASK_SCALE
    sprite.width = size
    sprite.height = size
    return n + 1
  }

  destroy(): void {
    this.stage.destroy({ children: true })
    this.visionScene.destroy({ children: true })
    this.visionTexture.destroy(true)
    this.maskRT.destroy(true)
  }
}
