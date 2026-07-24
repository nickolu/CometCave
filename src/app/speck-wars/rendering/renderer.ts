import { Application, Container } from 'pixi.js'
import { SpeckLayer } from './layers/speck-layer'
import { BuildingLayer } from './layers/building-layer'
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
    this.buildingLayer = new BuildingLayer()
    this.speckLayer = new SpeckLayer(texture, PLAYER_COLORS)

    this.world.addChild(this.buildingLayer.stage)
    this.world.addChild(this.speckLayer.stage)
  }

  render(sim: SimulationState, camera: { x: number; y: number; zoom: number }) {
    this.world.position.set(camera.x, camera.y)
    this.world.scale.set(camera.zoom)

    this.buildingLayer.update(sim, PLAYER_COLORS)
    this.speckLayer.update(sim)
  }

  destroy() {
    this.speckLayer.destroy()
    this.buildingLayer.destroy()
    this.app.destroy()
  }
}
