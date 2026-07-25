import { Container, Graphics } from 'pixi.js'
import type { SimulationState } from '../../domain/types'
import {
  WORLD_WIDTH, WORLD_HEIGHT,
  FOG_ALPHA, FOG_CELL_SIZE,
  FOG_VISION_SPECK, FOG_VISION_BASE, FOG_VISION_BUILDING,
} from '../../domain/constants'

const FOG_COLS = Math.ceil(WORLD_WIDTH / FOG_CELL_SIZE)
const FOG_ROWS = Math.ceil(WORLD_HEIGHT / FOG_CELL_SIZE)

export class FogLayer {
  readonly stage: Container
  private gfx: Graphics

  constructor() {
    this.stage = new Container()
    ;(this.stage as any).enableRenderGroup()  // isolate for compositing (Pixi v8)
    this.gfx = new Graphics()
    this.stage.addChild(this.gfx)
  }

  update(sim: SimulationState, playerId: string): void {
    // Cast to any for Pixi v8 fluent API (rect/circle/cut/fill) not in TS defs
    const gfx = this.gfx as any
    gfx.clear()

    // Dark fog overlay covering the whole world
    gfx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill({ color: 0x000000, alpha: FOG_ALPHA })

    // --- Vision from buildings ---
    for (const building of Object.values(sim.buildings)) {
      if (building.ownerId !== playerId) continue
      const r = building.typeId === 'base' ? FOG_VISION_BASE : FOG_VISION_BUILDING
      gfx.circle(building.x, building.y, r).cut()
    }

    // --- Vision from specks (coarse grid) ---
    // Mark visible cells using a Set; draw one circle per unique cell center
    const visibleCells = new Set<number>()
    for (let i = 0; i < sim.speckCount; i++) {
      if (sim.speckMeta[i]?.ownerId !== playerId) continue
      const col = Math.min(FOG_COLS - 1, Math.max(0, Math.floor(sim.speckX[i] / FOG_CELL_SIZE)))
      const row = Math.min(FOG_ROWS - 1, Math.max(0, Math.floor(sim.speckY[i] / FOG_CELL_SIZE)))
      visibleCells.add(row * FOG_COLS + col)
    }
    for (const cellIdx of visibleCells) {
      const col = cellIdx % FOG_COLS
      const row = Math.floor(cellIdx / FOG_COLS)
      const cx = (col + 0.5) * FOG_CELL_SIZE
      const cy = (row + 0.5) * FOG_CELL_SIZE
      gfx.circle(cx, cy, FOG_VISION_SPECK + FOG_CELL_SIZE * 0.5).cut()
    }
  }

  destroy(): void {
    this.stage.destroy({ children: true })
  }
}
