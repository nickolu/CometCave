import { Graphics, Container } from 'pixi.js'
import type { SimulationState } from '../../domain/types'
import { BUILDING_TYPES } from '../../domain/config/building-types'

export class BuildingLayer {
  readonly stage: Container
  private gfx: Graphics

  constructor() {
    this.stage = new Container()
    this.gfx = new Graphics()
    this.stage.addChild(this.gfx)
  }

  update(sim: SimulationState, playerColors: Record<string, number>) {
    this.gfx.clear()

    for (const building of Object.values(sim.buildings)) {
      const btype = BUILDING_TYPES[building.typeId]
      const color = playerColors[building.ownerId] ?? 0xffffff
      const r = btype?.size ?? 20

      // Base circle
      this.gfx.beginFill(color, 0.9)
      this.gfx.drawCircle(building.x, building.y, r)
      this.gfx.endFill()

      // Stroke
      this.gfx.lineStyle(2, 0xffffff, 0.4)
      this.gfx.drawCircle(building.x, building.y, r)
      this.gfx.lineStyle(0)

      // Pulse ring
      const pulse = Math.sin(Date.now() / 800) * 0.3 + 0.7
      this.gfx.lineStyle(2, color, pulse * 0.4)
      this.gfx.drawCircle(building.x, building.y, r + 8)
      this.gfx.lineStyle(0)

      // HP bar (above building)
      const barW = r * 2
      const barH = 4
      const barX = building.x - r
      const barY = building.y - r - 10
      const hpFrac = building.hp / building.maxHp

      this.gfx.beginFill(0x333333)
      this.gfx.drawRect(barX, barY, barW, barH)
      this.gfx.endFill()

      this.gfx.beginFill(hpFrac > 0.5 ? 0x44ff88 : 0xff4444)
      this.gfx.drawRect(barX, barY, barW * hpFrac, barH)
      this.gfx.endFill()
    }
  }

  destroy() {
    this.stage.destroy({ children: true })
  }
}
