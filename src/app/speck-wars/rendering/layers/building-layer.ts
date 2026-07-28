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

  update(sim: SimulationState, playerColors: Record<string, number>, selectedBuildingId: string | null = null, ghostBuild?: { typeId: string; wx: number; wy: number } | null) {
    const now = Date.now()
    this.gfx.clear()

    for (const building of Object.values(sim.buildings)) {
      const btype = BUILDING_TYPES[building.typeId]
      const color = building.ownerId === 'neutral' ? NEUTRAL_COLOR : (playerColors[building.ownerId] ?? 0xffffff)
      const r = btype?.size ?? 20

      const isOutpost = building.typeId === 'outpost'
      const isTurret = building.typeId === 'turret'

      // Turret: special rendering path
      if (isTurret) {
        if (building.underConstruction) {
          // Ghost: faint pulsing circle + sacrifice progress ring + countdown arc
          const ghostPulse = 0.3 + 0.2 * Math.sin(now / 600)
          this.gfx.beginFill(color, ghostPulse * 0.4)
          this.gfx.drawCircle(building.x, building.y, r)
          this.gfx.endFill()
          this.gfx.lineStyle(1.5, color, ghostPulse)
          this.gfx.drawCircle(building.x, building.y, r)
          this.gfx.lineStyle(0)

          // Sacrifice progress: how many specks have arrived / required
          const required = building.sacrificeRequired ?? 1
          const arrived = building.sacrificeArrived ?? 0
          const sacrificeFrac = Math.min(1, arrived / required)
          if (sacrificeFrac > 0) {
            const startAngle = -Math.PI / 2
            const endAngle = startAngle + Math.PI * 2 * sacrificeFrac
            this.gfx.lineStyle(2.5, 0xffd700, 0.8)
            this.gfx.moveTo(building.x + (r + 6) * Math.cos(startAngle), building.y + (r + 6) * Math.sin(startAngle))
            this.gfx.arc(building.x, building.y, r + 6, startAngle, endAngle)
            this.gfx.lineStyle(0)
          }

          // Construction timer arc (after all specks arrived, 2s countdown)
          if (building.constructionTimer !== undefined && building.constructionTimer > 0) {
            const timerFrac = 1 - building.constructionTimer / 2000
            const startAngle = -Math.PI / 2
            const endAngle = startAngle + Math.PI * 2 * timerFrac
            this.gfx.lineStyle(2, 0xffffff, 0.6)
            this.gfx.moveTo(building.x + (r - 4) * Math.cos(startAngle), building.y + (r - 4) * Math.sin(startAngle))
            this.gfx.arc(building.x, building.y, r - 4, startAngle, endAngle)
            this.gfx.lineStyle(0)
          }
        } else {
          // Live turret: diamond shape
          const s = r
          this.gfx.beginFill(color, 0.9)
          this.gfx.drawPolygon([
            building.x, building.y - s,
            building.x + s, building.y,
            building.x, building.y + s,
            building.x - s, building.y,
          ])
          this.gfx.endFill()
          // Damage flash
          const flashTs = this.flashMap.get(building.id)
          if (flashTs !== undefined) {
            const elapsed = now - flashTs
            if (elapsed < FLASH_DURATION) {
              const alpha = (1 - elapsed / FLASH_DURATION) * 0.7
              this.gfx.beginFill(0xff2222, alpha)
              this.gfx.drawPolygon([
                building.x, building.y - s,
                building.x + s, building.y,
                building.x, building.y + s,
                building.x - s, building.y,
              ])
              this.gfx.endFill()
            } else {
              this.flashMap.delete(building.id)
            }
          }
          // Stroke
          this.gfx.lineStyle(2, 0xffffff, 0.4)
          this.gfx.drawPolygon([
            building.x, building.y - s,
            building.x + s, building.y,
            building.x, building.y + s,
            building.x - s, building.y,
          ])
          this.gfx.lineStyle(0)
          // Pulse ring
          const pulse = Math.sin(now / 800) * 0.3 + 0.7
          this.gfx.lineStyle(2, color, pulse * 0.4)
          this.gfx.drawCircle(building.x, building.y, r + 8)
          this.gfx.lineStyle(0)
          // HP bar
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
          // Attack range ring suppressed — shown only during ghost placement preview
        }
        continue
      }

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

      // Surge active: fast-pulsing gold outer ring on player base
      if (!isOutpost && building.ownerId === 'player' && sim.surgeDuration > 0) {
        const surgePulse = 0.5 + 0.5 * Math.sin(now / 120)
        this.gfx.lineStyle(2.5, 0xffd700, surgePulse * 0.85)
        this.gfx.drawCircle(building.x, building.y, r + 22)
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

      // Selection ring: pulsing teal ring around selected building
      if (building.id === selectedBuildingId && building.ownerId === 'player') {
        const selPulse = 0.7 + 0.3 * Math.sin(now / 250)
        this.gfx.lineStyle(2, color, selPulse)
        this.gfx.drawCircle(building.x, building.y, r + 18)
        this.gfx.lineStyle(0)
      }

      // Rally point indicator: thin dashed-style line from building to rally marker
      if (building.ownerId === 'player' && building.rallyPoint) {
        const rp = building.rallyPoint
        const showLine = building.id === selectedBuildingId
        if (showLine) {
          // Draw segmented "dashed" line
          const dx = rp.x - building.x
          const dy = rp.y - building.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > 5) {
            const nx = dx / dist, ny = dy / dist
            const dashLen = 8, gapLen = 6, total = dashLen + gapLen
            const startDist = r + 5
            let d = startDist
            while (d < dist - 5) {
              const segEnd = Math.min(d + dashLen, dist - 5)
              this.gfx.lineStyle(1, color, 0.5)
              this.gfx.moveTo(building.x + nx * d, building.y + ny * d)
              this.gfx.lineTo(building.x + nx * segEnd, building.y + ny * segEnd)
              this.gfx.lineStyle(0)
              d += total
            }
          }
        }

        // Rally marker: small diamond at rally point (only show when line visible)
        if (showLine) {
          const markerSize = 5
          this.gfx.beginFill(color, 0.7)
          this.gfx.drawPolygon([
            rp.x, rp.y - markerSize,
            rp.x + markerSize, rp.y,
            rp.x, rp.y + markerSize,
            rp.x - markerSize, rp.y,
          ])
          this.gfx.endFill()
          this.gfx.lineStyle(1, 0xffffff, 0.4)
          this.gfx.drawPolygon([
            rp.x, rp.y - markerSize,
            rp.x + markerSize, rp.y,
            rp.x, rp.y + markerSize,
            rp.x - markerSize, rp.y,
          ])
          this.gfx.lineStyle(0)
        }
      }
    }

    // Draw terrain wall obstacles
    for (const obs of sim.obstacles) {
      this.gfx.beginFill(0x3d3550, 0.9)
      this.gfx.drawRect(obs.x, obs.y, obs.w, obs.h)
      this.gfx.endFill()
      this.gfx.lineStyle(2, 0x7766aa, 0.7)
      this.gfx.drawRect(obs.x, obs.y, obs.w, obs.h)
      this.gfx.lineStyle(0)
      // Highlight ledge on top edge
      this.gfx.lineStyle(1, 0xffffff, 0.15)
      this.gfx.moveTo(obs.x + 3, obs.y + 3)
      this.gfx.lineTo(obs.x + obs.w - 3, obs.y + 3)
      this.gfx.lineStyle(0)
    }

    // Draw placement ghost for pending build
    if (ghostBuild) {
      const btype = BUILDING_TYPES[ghostBuild.typeId]
      const r = btype?.size ?? 18
      const pulse = 0.5 + 0.3 * Math.sin(now / 400)
      const ghostColor = 0x4af7c4  // player color
      this.gfx.beginFill(ghostColor, pulse * 0.2)
      this.gfx.drawCircle(ghostBuild.wx, ghostBuild.wy, r)
      this.gfx.endFill()
      this.gfx.lineStyle(2, ghostColor, pulse)
      this.gfx.drawCircle(ghostBuild.wx, ghostBuild.wy, r)
      this.gfx.lineStyle(0)
      const attackRange = (btype as { attackRange?: number })?.attackRange
      if (attackRange) {
        this.gfx.lineStyle(0.5, ghostColor, 0.15)
        this.gfx.drawCircle(ghostBuild.wx, ghostBuild.wy, attackRange)
        this.gfx.lineStyle(0)
      }
    }
  }

  destroy() {
    this.stage.destroy({ children: true })
  }
}
