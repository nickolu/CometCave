import { Application, Container, Graphics } from 'pixi.js'
import { SpeckLayer } from './layers/speck-layer'
import { BuildingLayer } from './layers/building-layer'
import { GridLayer } from './layers/grid-layer'
import { EffectsLayer } from './layers/effects-layer'
import { StarfieldLayer } from './layers/starfield-layer'
import { FogLayer } from './layers/fog-layer'
import { createSpeckTexture } from './textures'
import type { SimulationState } from '../domain/types'
import { PLAYER_COLOR, AI_COLOR } from '../domain/constants'

export const PLAYER_COLORS: Record<string, number> = {
  player: PLAYER_COLOR,
  ai: AI_COLOR,
}

// Application.init exists at runtime in Pixi 8 but the TypeScript plugin
// in this Next.js project incorrectly omits it from the inferred type.
interface PixiApplication extends Application {
  init(options?: {
    canvas?: HTMLCanvasElement
    resizeTo?: HTMLElement
    backgroundAlpha?: number
    antialias?: boolean
    preference?: string
    [key: string]: unknown
  }): Promise<void>
}

export class Renderer {
  app!: Application
  private world!: Container  // camera container
  private speckLayer!: SpeckLayer
  private buildingLayer!: BuildingLayer
  private gridLayer!: GridLayer
  private effectsLayer!: EffectsLayer
  private starfieldLayer!: StarfieldLayer
  private fogLayer!: FogLayer
  private rallyGfx!: Graphics
  private selectionGfx!: Graphics
  private vignetteGfx!: Graphics

  async init(canvas: HTMLCanvasElement) {
    const app = new Application() as PixiApplication
    await app.init({
      canvas,
      resizeTo: canvas,
      backgroundAlpha: 0,
      antialias: false,
      preference: 'webgl',
    })
    this.app = app

    this.world = new Container()
    this.app.stage.addChild(this.world)

    const texture = createSpeckTexture(this.app, 4)
    this.starfieldLayer = new StarfieldLayer()
    this.gridLayer = new GridLayer()
    this.effectsLayer = new EffectsLayer()
    this.buildingLayer = new BuildingLayer()
    this.speckLayer = new SpeckLayer(texture, PLAYER_COLORS)
    this.fogLayer = new FogLayer()

    this.world.addChild(this.starfieldLayer.stage)
    this.world.addChild(this.gridLayer.stage)
    this.world.addChild(this.buildingLayer.stage)
    this.world.addChild(this.effectsLayer.stage)
    this.world.addChild(this.speckLayer.stage)
    this.world.addChild(this.fogLayer.stage)

    this.rallyGfx = new Graphics()
    this.world.addChild(this.rallyGfx)

    this.selectionGfx = new Graphics()
    this.app.stage.addChild(this.selectionGfx)

    this.vignetteGfx = new Graphics()
    this.app.stage.addChild(this.vignetteGfx)
  }

  render(sim: SimulationState, camera: { x: number; y: number; zoom: number }, dt: number, shakeX = 0, shakeY = 0, dragRect?: { x1: number; y1: number; x2: number; y2: number } | null, ghostBuild?: { typeId: string; wx: number; wy: number } | null): void {
    this.world.position.set(camera.x + shakeX, camera.y + shakeY)
    this.world.scale.set(camera.zoom)

    this.buildingLayer.update(sim, PLAYER_COLORS, sim.selectedBuildingId, ghostBuild)
    this.speckLayer.update(sim, sim.selectedSpeckIds)
    this.fogLayer.update(sim, 'player')

    // Process events from this tick
    for (const event of sim.events) {
      if (event.type === 'SPECK_DIED') {
        const flashColor = PLAYER_COLORS[event.killedOwnerId] ?? 0xffffff
        this.effectsLayer.addDeathFlash(event.x, event.y, flashColor)
        this.effectsLayer.addDeathParticles(event.x, event.y, flashColor)
        this.effectsLayer.markCombatAt(event.x, event.y)
      }
      if (event.type === 'BUILDING_DAMAGED') {
        this.buildingLayer.flashBuilding(event.buildingId)
      }
      if (event.type === 'SPECK_SPAWNED' && event.buildingId.startsWith('building-player')) {
        this.buildingLayer.flashSpawn(event.buildingId)
      }
      if (event.type === 'BUILDING_DESTROYED') {
        const color = PLAYER_COLORS[event.ownerId] ?? 0xffffff
        this.effectsLayer.addDestructionBurst(event.x, event.y, color)
      }
      if (event.type === 'CONSTRUCTION_COMPLETE') {
        this.showRallyPing(event.x, event.y)
      }
      if (event.type === 'OUTPOST_CAPTURED') {
        const building = sim.buildings[event.outpostId]
        const color = PLAYER_COLORS[event.newOwner] ?? 0xffffff
        const x = building?.x ?? 0
        const y = building?.y ?? 0
        this.effectsLayer.addCaptureRipple(x, y, color)
      }
    }
    this.effectsLayer.update(dt)

    // Rally point marker + dashed line from base to rally
    this.rallyGfx.clear()
    const rp = sim.rallyPoints['player']
    if (rp) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400)
      const alpha = 0.5 + 0.5 * pulse
      this.rallyGfx.lineStyle(2, PLAYER_COLOR, alpha)
      const s = 10
      this.rallyGfx.moveTo(rp.x - s, rp.y)
      this.rallyGfx.lineTo(rp.x + s, rp.y)
      this.rallyGfx.moveTo(rp.x, rp.y - s)
      this.rallyGfx.lineTo(rp.x, rp.y + s)
      this.rallyGfx.lineStyle(1.5, PLAYER_COLOR, alpha * 0.5)
      this.rallyGfx.drawCircle(rp.x, rp.y, 14)
      this.rallyGfx.lineStyle(0)

      // Dashed line from player base to rally point (only if far enough apart)
      const playerBase = Object.values(sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
      if (playerBase) {
        const dx = rp.x - playerBase.x
        const dy = rp.y - playerBase.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len > 80) {
          const nx = dx / len, ny = dy / len
          const dashLen = 8, gapLen = 6
          this.rallyGfx.lineStyle(1, PLAYER_COLOR, 0.22)
          const dashCycle = dashLen + gapLen
          const marchOffset = (Date.now() / 80) % dashCycle  // ~1.75 cycles/sec
          let d = (playerBase === null ? 0 : 46) - marchOffset  // animated march toward rally
          while (d < len - 24) {
            const x1 = playerBase.x + nx * d
            const y1 = playerBase.y + ny * d
            const x2 = playerBase.x + nx * Math.min(d + dashLen, len - 24)
            const y2 = playerBase.y + ny * Math.min(d + dashLen, len - 24)
            this.rallyGfx.moveTo(x1, y1)
            this.rallyGfx.lineTo(x2, y2)
            d += dashLen + gapLen
          }
          this.rallyGfx.lineStyle(0)
        }
      }
    }

    // Draw drag-selection box (screen space)
    this.selectionGfx.clear()
    if (dragRect) {
      const { x1, y1, x2, y2 } = dragRect
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
      const w = maxX - minX, h = maxY - minY
      // Semi-transparent cyan fill
      this.selectionGfx.beginFill(0x4af7c4, 0.08)
      this.selectionGfx.lineStyle(1.5, 0x4af7c4, 0.9)
      this.selectionGfx.drawRect(minX, minY, w, h)
      this.selectionGfx.endFill()
      // Corner brackets for RTS feel
      const cs = Math.min(12, w / 3, h / 3)  // corner size
      this.selectionGfx.lineStyle(2, 0x4af7c4, 1.0)
      // Top-left
      this.selectionGfx.moveTo(minX, minY + cs); this.selectionGfx.lineTo(minX, minY); this.selectionGfx.lineTo(minX + cs, minY)
      // Top-right
      this.selectionGfx.moveTo(maxX - cs, minY); this.selectionGfx.lineTo(maxX, minY); this.selectionGfx.lineTo(maxX, minY + cs)
      // Bottom-left
      this.selectionGfx.moveTo(minX, maxY - cs); this.selectionGfx.lineTo(minX, maxY); this.selectionGfx.lineTo(minX + cs, maxY)
      // Bottom-right
      this.selectionGfx.moveTo(maxX - cs, maxY); this.selectionGfx.lineTo(maxX, maxY); this.selectionGfx.lineTo(maxX, maxY - cs)
    }
    // Winning vignette — pulsing green border glow when enemy base is critical
    this.vignetteGfx.clear()
    const aiBase = sim.buildings['building-ai-base']
    if (aiBase && aiBase.maxHp > 0) {
      const hpFrac = aiBase.hp / aiBase.maxHp
      if (hpFrac < 0.20) {
        const w = this.app.screen.width
        const h = this.app.screen.height
        const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 400)
        const intensity = ((0.20 - hpFrac) / 0.20) * pulse
        const color = 0x00ff88
        this.vignetteGfx.lineStyle(32, color, 0.12 * intensity)
        this.vignetteGfx.drawRect(0, 0, w, h)
        this.vignetteGfx.lineStyle(12, color, 0.35 * intensity)
        this.vignetteGfx.drawRect(0, 0, w, h)
        this.vignetteGfx.lineStyle(2, color, 0.9 * intensity)
        this.vignetteGfx.drawRect(1, 1, w - 2, h - 2)
      }
    }
  }

  showRallyPing(x: number, y: number) {
    this.effectsLayer.showRallyPing(x, y)
  }

  destroy() {
    this.starfieldLayer.destroy()
    this.gridLayer.destroy()
    this.effectsLayer.destroy()
    this.speckLayer.destroy()
    this.buildingLayer.destroy()
    this.fogLayer.destroy()
    this.rallyGfx.destroy()
    this.selectionGfx.destroy()
    this.vignetteGfx.destroy()
    this.app.destroy()
  }
}
