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
  private elapsedMs = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const difficulty = useSpeckWarsStore.getState().difficulty
    const aiTickInterval: Record<'easy' | 'medium' | 'hard', number> = { easy: 60, medium: 30, hard: 15 }
    this.sim = createSim(Date.now(), difficulty)
    this.renderer = new Renderer()
    this.camera = createCamera(canvas.clientWidth, canvas.clientHeight)
    this.aiController = new AIController('ai', aiTickInterval[difficulty])
  }

  async start() {
    console.log('GameInstance started')
    await this.renderer.init(this.canvas)
    this.inputHandler = new InputHandler(
      this.canvas,
      this.camera,
      (wx, wy) => {
        this.sim.inputQueue.push({ type: 'RALLY', ownerId: 'player', x: wx, y: wy })
        this.renderer.showRallyPing(wx, wy)
      },
      () => useSpeckWarsStore.getState().togglePause(),   // Space
      () => { this.sim.rallyPoints['player'] = null },    // R — clear rally
    )
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  private loop = (now: number) => {
    const dt = Math.min(now - this.lastTime, 50)
    this.lastTime = now

    const store = useSpeckWarsStore.getState()
    if (store.phase === 'playing') {
      const scaledDt = dt * store.speed
      this.elapsedMs += scaledDt
      store.setElapsedMs(this.elapsedMs)
      this.aiController.update(this.sim)
      this.sim = tick(this.sim, scaledDt)

      for (const event of this.sim.events) {
        if (event.type === 'GAME_OVER') {
          store.setPhase('victory')
          store.setWinnerId(event.winnerId)
        }
        if (event.type === 'HUD_UPDATE') {
          store.setHud(event.data)
        }
        if (event.type === 'OUTPOST_CAPTURED') {
          const isPlayerGain = event.newOwner === 'player'
          const isPlayerLoss = event.previousOwner === 'player'
          if (isPlayerGain || isPlayerLoss) {
            const message = isPlayerGain ? '⬡ Outpost Captured!' : '⬡ Outpost Lost!'
            const color = isPlayerGain ? '#4af7c4' : '#ff4f7b'
            store.setNotification({ message, color })
            setTimeout(() => useSpeckWarsStore.getState().setNotification(null), 2500)
          }
        }
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
