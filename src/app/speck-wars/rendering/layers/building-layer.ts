import { Graphics, Container } from 'pixi.js'
import type { SimulationState } from '../../domain/types'
import { BUILDING_TYPES } from '../../domain/config/building-types'
import { NEUTRAL_COLOR, OUTPOST_AURA_RADIUS } from '../../domain/constants'

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
      const color = building.ownerId === 'neutral' ? NEUTRAL_COLOR : (playerColors[building.ownerId] ?? 0xffffff)
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

      // Spawn timer progress arc (clockwise fill inside building, shows time to next spawn)
      if (building.ownerId !== 'neutral' && btype?.spawnInterval) {
        const totalInterval = building.spawnIntervalOverride ?? btype.spawnInterval
        const effectiveInterval = building.tripleOutpostBonus ? totalInterval / 2 : totalInterval
        const progress = Math.max(0, Math.min(1, 1 - building.spawnTimer / effectiveInterval))
        if (progress > 0) {
          const startAngle = -Math.PI / 2
          const endAngle = startAngle + Math.PI * 2 * progress
          this.gfx.lineStyle(2, 0xffffff, 0.5)
          this.gfx.moveTo(building.x + (r - 5) * Math.cos(startAngle), building.y + (r - 5) * Math.sin(startAngle))
          this.gfx.arc(building.x, building.y, r - 5, startAngle, endAngle)
          this.gfx.lineStyle(0)
        }
      }

      // Outpost speed aura ring (faint pulsing circle showing boost radius)
      if (building.typeId === 'outpost' && building.ownerId !== 'neutral') {
        const auraPulse = Math.sin(Date.now() / 1200) * 0.5 + 0.5
        this.gfx.lineStyle(1, color, auraPulse * 0.18 + 0.04)
        this.gfx.drawCircle(building.x, building.y, OUTPOST_AURA_RADIUS)
        this.gfx.lineStyle(0)
      }

      // Capture progress ring
      if (building.captureProgress && building.captureProgress > 0 && building.captureSide) {
        const capColor = playerColors[building.captureSide] ?? 0xffffff
        this.gfx.lineStyle(3, capColor, 0.9)
        const startAngle = -Math.PI / 2
        const endAngle = startAngle + Math.PI * 2 * building.captureProgress
        this.gfx.moveTo(building.x + (r + 12) * Math.cos(startAngle), building.y + (r + 12) * Math.sin(startAngle))
        this.gfx.arc(building.x, building.y, r + 12, startAngle, endAngle)
        this.gfx.lineStyle(0)
      }
    }
  }

  destroy() {
    this.stage.destroy({ children: true })
  }
}
