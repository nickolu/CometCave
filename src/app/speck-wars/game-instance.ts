import { createSim } from './domain/simulation/create-sim'
import { tick } from './domain/simulation/tick'
import type { SimulationState } from './domain/types'
import { useSpeckWarsStore } from './store'
import { Renderer } from './rendering/renderer'
import { createCamera, clampCamera } from './rendering/camera'
import { InputHandler } from './input/input-handler'
import type { Camera } from './rendering/camera'
import { AIController } from './domain/ai/ai-controller'
import { recordBestTime, incrementWinStreak, resetWinStreak } from './lib/personal-best'

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
  private firstBloodDone = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const difficulty = useSpeckWarsStore.getState().difficulty
    const aiTickInterval: Record<'easy' | 'medium' | 'hard', number> = { easy: 60, medium: 30, hard: 15 }
    this.sim = createSim(Date.now(), difficulty)
    this.renderer = new Renderer()
    this.camera = createCamera(canvas.clientWidth, canvas.clientHeight)
    this.aiController = new AIController('ai', aiTickInterval[difficulty], difficulty === 'hard')
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
      () => {                                              // H — cycle spawn mode
        const next = useSpeckWarsStore.getState().cycleSpawnMode()
        this.sim.inputQueue.push({ type: 'SET_SPAWN_TYPE', ownerId: 'player', speckTypeId: next })
      },
      () => {                                              // C — recenter camera on player base
        const base = Object.values(this.sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
        if (!base) return
        this.camera.x = this.canvas.clientWidth / 2 - base.x * this.camera.zoom
        this.camera.y = this.canvas.clientHeight / 2 - base.y * this.camera.zoom
      },
      () => {                                              // D — defend (rally to player base)
        const base = Object.values(this.sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
        if (!base) return
        this.rally(base.x, base.y)
      },
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
          if (event.winnerId === 'player') {
            const isNew = recordBestTime(store.difficulty, this.elapsedMs)
            incrementWinStreak()
            store.setIsNewBest(isNew)
            store.setPhase('victory')
          } else {
            resetWinStreak()
            store.setIsNewBest(false)
            store.setPhase('defeat')
          }
          store.setWinnerId(event.winnerId)
          store.setVictoryType(event.victoryType)
        }
        if (event.type === 'HUD_UPDATE') {
          store.setHud(event.data)
        }
        if (event.type === 'SPECK_DIED') {
          if (event.killedOwnerId === 'ai' && event.killerOwnerId === 'player') store.addKill()
          else if (event.killedOwnerId === 'player' && event.killerOwnerId === 'ai') store.addLoss()
          if (!this.firstBloodDone) {
            this.firstBloodDone = true
            const playerGotIt = event.killerOwnerId === 'player'
            store.setNotification({
              message: playerGotIt ? '⚔ FIRST BLOOD!' : '☠ FIRST BLOOD!',
              color: playerGotIt ? '#4af7c4' : '#ff4f7b',
            })
            setTimeout(() => useSpeckWarsStore.getState().setNotification(null), 1800)
          }
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

    // Edge pan (works in both playing and paused states)
    if (this.inputHandler) {
      const isPaused = store.phase === 'paused'
      const { dx, dy } = this.inputHandler.getEdgePanDelta(dt, isPaused)
      this.camera.x -= dx * this.camera.zoom
      this.camera.y -= dy * this.camera.zoom
    }

    // Clamp camera so world doesn't disappear off-screen
    clampCamera(this.camera, this.canvas.clientWidth, this.canvas.clientHeight)

    this.renderer.render(this.sim, this.camera, dt)
    this.rafId = requestAnimationFrame(this.loop)
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.renderer.destroy()
    this.inputHandler?.destroy()
    console.log('GameInstance destroyed')
  }

  rally(x: number, y: number) {
    this.sim.inputQueue.push({ type: 'RALLY', ownerId: 'player', x, y })
    this.renderer.showRallyPing(x, y)
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
