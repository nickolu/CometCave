import { createSim } from './domain/simulation/create-sim'
import { tick } from './domain/simulation/tick'
import type { SimulationState } from './domain/types'
import { useSpeckWarsStore } from './store'
import { Renderer } from './rendering/renderer'
import { createCamera } from './rendering/camera'
import { InputHandler } from './input/input-handler'
import type { Camera } from './rendering/camera'
import { AIController } from './domain/ai/ai-controller'

export class GameInstance {
  private canvas: HTMLCanvasElement
  private sim: SimulationState
  private renderer: Renderer
  private rafId: number | null = null
  private lastTime: number = 0
  private camera: Camera
  private inputHandler!: InputHandler
  private aiController: AIController

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.sim = createSim()
    this.renderer = new Renderer()
    this.camera = createCamera(canvas.clientWidth, canvas.clientHeight)
    this.aiController = new AIController('ai')
  }

  async start() {
    console.log('GameInstance started')
    await this.renderer.init(this.canvas)
    this.inputHandler = new InputHandler(this.canvas, this.camera, (wx, wy) => {
      this.sim.inputQueue.push({ type: 'RALLY', ownerId: 'player', x: wx, y: wy })
      this.renderer.showRallyPing(wx, wy)
    })
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  private loop = (now: number) => {
    const dt = Math.min(now - this.lastTime, 50)
    this.lastTime = now

    this.aiController.update(this.sim)
    this.sim = tick(this.sim, dt)

    // Forward sim events to Zustand store
    for (const event of this.sim.events) {
      if (event.type === 'GAME_OVER') {
        useSpeckWarsStore.getState().setPhase('victory')
        useSpeckWarsStore.getState().setWinnerId(event.winnerId)
      }
      if (event.type === 'HUD_UPDATE') {
        useSpeckWarsStore.getState().setHud(event.data)
      }
    }

    this.renderer.render(this.sim, this.camera, dt)

    this.rafId = requestAnimationFrame(this.loop)
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.renderer.destroy()
    this.inputHandler?.destroy()
    console.log('GameInstance destroyed')
  }

  getSim(): SimulationState {
    return this.sim
  }

  getCamera() {
    return this.camera
  }

  setCamera(camera: Camera) {
    this.camera = camera
  }
}
