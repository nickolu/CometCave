import { Graphics, Container } from 'pixi.js'
import type { SimulationState } from '../../domain/types'
import { BUILDING_TYPES } from '../../domain/config/building-types'
import { NEUTRAL_COLOR, OUTPOST_AURA_RADIUS, FORTIFY_TIME } from '../../domain/constants'

function hexPoints(x: number, y: number, r: number): number[] {
  const pts: number[] = []
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    pts.push(x + r * Math.cos(a), y + r * Math.sin(a))
  }
  return pts
}

const FLASH_DURATION = 200   // ms — how long a damage flash lasts
const SPAWN_FLASH_DURATION = 250  // ms — brief golden ring when a speck spawns

export class BuildingLayer {
  readonly stage: Container
  private gfx: Graphics
  private flashMap: Map<string, number> = new Map()       // buildingId → timestamp of last hit
  private spawnFlashMap: Map<string, number> = new Map()  // buildingId → timestamp of last spawn

  constructor() {
    this.stage = new Container()
    this.gfx = new Graphics()
    this.stage.addChild(this.gfx)
  }

  flashBuilding(buildingId: string) {
    this.flashMap.set(buildingId, Date.now())
  }

  flashSpawn(buildingId: string) {
    this.spawnFlashMap.set(buildingId, Date.now())
  }

  update(sim: SimulationState, playerColors: Record<string, number>) {
    const now = Date.now()
    this.gfx.clear()

    for (const building of Object.values(sim.buildings)) {
      const btype = BUILDING_TYPES[building.typeId]
      const color = building.ownerId === 'neutral' ? NEUTRAL_COLOR : (playerColors[building.ownerId] ?? 0xffffff)
      const r = btype?.size ?? 20

      const isOutpost = building.typeId === 'outpost'

      // Base shape: hexagon for outposts, circle for bases
      this.gfx.beginFill(color, 0.9)
      if (isOutpost) {
        this.gfx.drawPolygon(hexPoints(building.x, building.y, r))
      } else {
        this.gfx.drawCircle(building.x, building.y, r)
      }
      this.gfx.endFill()

      // Damage flash overlay
      const flashTs = this.flashMap.get(building.id)
      if (flashTs !== undefined) {
        const elapsed = now - flashTs
        if (elapsed < FLASH_DURATION) {
          const alpha = (1 - elapsed / FLASH_DURATION) * 0.7
          this.gfx.beginFill(0xff2222, alpha)
          if (isOutpost) {
            this.gfx.drawPolygon(hexPoints(building.x, building.y, r))
          } else {
            this.gfx.drawCircle(building.x, building.y, r)
          }
          this.gfx.endFill()
        } else {
          this.flashMap.delete(building.id)
        }
      }

      // Spawn flash: brief gold expanding ring when a speck is produced
      const spawnTs = this.spawnFlashMap.get(building.id)
      if (spawnTs !== undefined) {
        const elapsed = now - spawnTs
        if (elapsed < SPAWN_FLASH_DURATION) {
          const t = elapsed / SPAWN_FLASH_DURATION
          const alpha = (1 - t) * 0.6
          const spawnR = r + 4 + t * 14  // expands from r+4 to r+18
          this.gfx.lineStyle(1.5, 0xffd700, alpha)
          this.gfx.drawCircle(building.x, building.y, spawnR)
          this.gfx.lineStyle(0)
        } else {
          this.spawnFlashMap.delete(building.id)
        }
      }

      // Stroke
      this.gfx.lineStyle(2, 0xffffff, 0.4)
      if (isOutpost) {
        this.gfx.drawPolygon(hexPoints(building.x, building.y, r))
      } else {
        this.gfx.drawCircle(building.x, building.y, r)
      }
      this.gfx.lineStyle(0)

      // Pulse ring
      const pulse = Math.sin(Date.now() / 800) * 0.3 + 0.7
      this.gfx.lineStyle(2, color, pulse * 0.4)
      this.gfx.drawCircle(building.x, building.y, r + 8)
      this.gfx.lineStyle(0)

      // Critical HP warning ring — pulsing red when building HP is low
      const hpFracEarly = building.hp / building.maxHp
      if (hpFracEarly < 0.3) {
        const isCrit = hpFracEarly < 0.15
        const speed = isCrit ? 180 : 350
        const critPulse = 0.5 + 0.5 * Math.sin(now / speed)
        const baseAlpha = isCrit ? 0.75 : 0.45
        const width = isCrit ? 2.5 : 1.8
        this.gfx.lineStyle(width, 0xff2222, critPulse * baseAlpha)
        this.gfx.drawCircle(building.x, building.y, r + 12)
        this.gfx.lineStyle(0)
      }

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
          const arcColor = building.spawnTypeOverride === 'heavy' ? 0xffa032
            : building.spawnTypeOverride === 'scout' ? 0x50c8ff
            : 0xffffff
          this.gfx.lineStyle(2, arcColor, 0.5)
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

      // Fortification ring: gold glow when outpost has been held and is fortifying
      if (building.typeId === 'outpost' && building.ownerId !== 'neutral') {
        const fortLevel = Math.min(1, (building.fortifyDuration ?? 0) / FORTIFY_TIME)
        if (fortLevel > 0.05) {  // only show when at least 5% fortified
          const fortPulse = Math.sin(now / 1500) * 0.2 + 0.8
          this.gfx.lineStyle(1.5, 0xffd700, fortLevel * fortPulse * 0.55)
          this.gfx.drawCircle(building.x, building.y, r + 16)
          this.gfx.lineStyle(0)
        }
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
