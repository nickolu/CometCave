import { createSim } from './domain/simulation/create-sim'
import { tick } from './domain/simulation/tick'
import type { SimulationState } from './domain/types'
import { useSpeckWarsStore } from './store'
import { Renderer } from './rendering/renderer'
import { WORLD_WIDTH, WORLD_HEIGHT } from './domain/constants'

export class GameInstance {
  private canvas: HTMLCanvasElement
  private sim: SimulationState
  private renderer: Renderer
  private rafId: number | null = null
  private lastTime: number = 0
  private camera: { x: number; y: number; zoom: number }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.sim = createSim()
    this.renderer = new Renderer()
    this.camera = {
      x: canvas.width / 2 - WORLD_WIDTH / 2,
      y: canvas.height / 2 - WORLD_HEIGHT / 2,
      zoom: 1,
    }
  }

  async start() {
    console.log('GameInstance started')
    await this.renderer.init(this.canvas)
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  private loop = (now: number) => {
    const dt = Math.min(now - this.lastTime, 50)
    this.lastTime = now

    this.sim = tick(this.sim, dt)

    // Forward sim events to Zustand store
    for (const event of this.sim.events) {
      if (event.type === 'GAME_OVER') {
        useSpeckWarsStore.getState().setPhase('victory')
      }
    }

    this.renderer.render(this.sim, this.camera)

    this.rafId = requestAnimationFrame(this.loop)
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.renderer.destroy()
    console.log('GameInstance destroyed')
  }

  getSim(): SimulationState {
    return this.sim
  }

  getCamera() {
    return this.camera
  }

  setCamera(camera: { x: number; y: number; zoom: number }) {
    this.camera = camera
  }
}
