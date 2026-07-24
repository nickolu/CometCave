import { createSim } from './domain/simulation/create-sim'
import { tick } from './domain/simulation/tick'
import type { SimulationState } from './domain/types'
import { useSpeckWarsStore } from './store'
import { Renderer } from './rendering/renderer'
import { createCamera, clampCamera } from './rendering/camera'
import { InputHandler } from './input/input-handler'
import type { Camera } from './rendering/camera'
import { AIController } from './domain/ai/ai-controller'
import { recordBestTime, incrementWinStreak, resetWinStreak, isFirstGame, markFirstGameDone, recordGameResult } from './lib/personal-best'

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
  private baseAttackWarnedAt = -30000  // allow warning immediately on first hit
  private shakeMs = 0
  private shakeMaxMs = 300
  private shakeStrength = 0
  private enemyBaseWarnedAt = -30000

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const difficulty = useSpeckWarsStore.getState().difficulty
    const aiTickInterval: Record<string, number> = { easy: 60, medium: 30, hard: 15, 'very-hard': 6 }
    const now = new Date()
    const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
    const diffHash = [...difficulty].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    const dailySeed = dateKey * 1000 + diffHash
    this.sim = createSim(dailySeed, difficulty)
    this.renderer = new Renderer()
    this.camera = createCamera(canvas.clientWidth, canvas.clientHeight)
    this.aiController = new AIController('ai', aiTickInterval[difficulty] ?? 15, difficulty === 'hard' || difficulty === 'very-hard')
  }

  private onVisibilityChange = () => {
    if (document.hidden) {
      const store = useSpeckWarsStore.getState()
      if (store.phase === 'playing') store.togglePause()
    }
  }

  async start() {
    console.log('GameInstance started')
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    await this.renderer.init(this.canvas)
    this.inputHandler = new InputHandler(
      this.canvas,
      this.camera,
      (wx, wy) => {
        this.sim.inputQueue.push({ type: 'RALLY', ownerId: 'player', x: wx, y: wy })
        this.renderer.showRallyPing(wx, wy)
      },
      () => useSpeckWarsStore.getState().togglePause(),   // Space
      () => this.clearRally(),                             // R — clear rally
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
      () => this.defend(),                                 // D — defend (rally to player base)
      () => this.advance(),                                // A — advance to nearest non-player outpost
      () => this.rush(),                                   // B — rush enemy base
    )
    this.lastTime = performance.now()
    this.loop(this.lastTime)

    // Show tutorial hints for first-time players
    if (isFirstGame()) {
      markFirstGameDone()
      const hints = [
        { delay: 1200, message: '💡 Click the map to rally your specks!', color: '#aaddff' },
        { delay: 6000, message: '💡 Capture outposts to boost production!', color: '#aaddff' },
        { delay: 13000, message: '💡 Hold all 3 outposts for 60s to dominate!', color: '#ffd700' },
      ]
      for (const { delay, message, color } of hints) {
        setTimeout(() => {
          useSpeckWarsStore.getState().setNotification({ message, color })
          setTimeout(() => useSpeckWarsStore.getState().setNotification(null), 3000)
        }, delay)
      }
    }
  }

  private loop = (now: number) => {
    const dt = Math.min(now - this.lastTime, 50)
    this.lastTime = now

    const store = useSpeckWarsStore.getState()
    if (store.phase === 'playing') {
      const scaledDt = dt * store.speed
      this.elapsedMs += scaledDt
      store.setElapsedMs(this.elapsedMs)
      this.aiController.update(this.sim, scaledDt)
      this.sim = tick(this.sim, scaledDt)

      for (const event of this.sim.events) {
        if (event.type === 'GAME_OVER') {
          const won = event.winnerId === 'player'
          store.setWinnerId(event.winnerId)
          store.setVictoryType(event.victoryType)
          // Show dramatic notification, then transition to end screen after a brief delay
          store.setNotification({
            message: won ? '⚡ VICTORY!' : '💀 DEFEATED',
            color: won ? '#4af7c4' : '#ff4f7b',
          })
          const elapsedAtEnd = this.elapsedMs
          setTimeout(() => {
            const s = useSpeckWarsStore.getState()
            if (won) {
              const isNew = recordBestTime(s.difficulty, elapsedAtEnd)
              incrementWinStreak()
              recordGameResult(s.difficulty, true, elapsedAtEnd, s.kills)
              s.setIsNewBest(isNew)
              s.setPhase('victory')
            } else {
              resetWinStreak()
              recordGameResult(s.difficulty, false, elapsedAtEnd, s.kills)
              s.setIsNewBest(false)
              s.setPhase('defeat')
            }
          }, 1400)
        }
        if (event.type === 'HUD_UPDATE') {
          store.setHud(event.data)
        }
        if (event.type === 'SPECK_DIED') {
          if (event.killedOwnerId === 'ai' && event.killerOwnerId === 'player') {
            store.addKill()
            const k = useSpeckWarsStore.getState().kills
            const milestones: Record<number, { message: string; color: string }> = {
              10:  { message: '💀 10 KILLS',  color: '#4af7c4' },
              25:  { message: '💀 25 KILLS',  color: '#ffd700' },
              50:  { message: '💀 50 KILLS',  color: '#ff8844' },
              100: { message: '💀 100 KILLS', color: '#cc00ff' },
            }
            if (milestones[k]) {
              store.setNotification(milestones[k])
              setTimeout(() => useSpeckWarsStore.getState().setNotification(null), 2000)
            }
          } else if (event.killedOwnerId === 'player' && event.killerOwnerId === 'ai') store.addLoss()
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
        if (event.type === 'BUILDING_DAMAGED' && event.buildingId === 'building-ai-base') {
          const aiBase = this.sim.buildings['building-ai-base']
          if (aiBase && event.hp / aiBase.maxHp < 0.2) {
            const now = Date.now()
            if (now - this.enemyBaseWarnedAt > 15000) {
              this.enemyBaseWarnedAt = now
              store.setNotification({ message: '⚔ ENEMY BASE CRITICAL!', color: '#ffd700' })
              setTimeout(() => useSpeckWarsStore.getState().setNotification(null), 3000)
            }
          }
        }
        if (event.type === 'BUILDING_DAMAGED' && event.buildingId === 'building-player-base') {
          // Screen shake on base hit
          this.shakeMs = this.shakeMaxMs
          this.shakeStrength = 5
          const now = Date.now()
          if (now - this.baseAttackWarnedAt > 12000) {
            this.baseAttackWarnedAt = now
            store.setNotification({ message: '⚠ BASE UNDER ATTACK!', color: '#ff4f7b' })
            setTimeout(() => useSpeckWarsStore.getState().setNotification(null), 2500)
          }
        }
        if (event.type === 'OUTPOST_CAPTURED') {
          const isPlayerGain = event.newOwner === 'player'
          const isPlayerLoss = event.previousOwner === 'player'
          if (isPlayerGain || isPlayerLoss) {
            const outpostName = event.outpostId.replace('outpost-', '').toUpperCase()
            const message = isPlayerGain ? `⬡ ${outpostName} CAPTURED` : `⬡ ${outpostName} LOST`
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

    let shakeX = 0, shakeY = 0
    if (this.shakeMs > 0) {
      this.shakeMs -= dt
      const t = Math.max(0, this.shakeMs / this.shakeMaxMs)
      const s = this.shakeStrength * t
      shakeX = (Math.random() * 2 - 1) * s
      shakeY = (Math.random() * 2 - 1) * s
    }
    this.renderer.render(this.sim, this.camera, dt, shakeX, shakeY)
    this.rafId = requestAnimationFrame(this.loop)
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.renderer.destroy()
    this.inputHandler?.destroy()
    console.log('GameInstance destroyed')
  }

  rally(x: number, y: number) {
    this.sim.inputQueue.push({ type: 'RALLY', ownerId: 'player', x, y })
    this.renderer.showRallyPing(x, y)
  }

  defend() {
    const base = Object.values(this.sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
    if (base) this.rally(base.x, base.y)
  }

  advance() {
    const playerBase = Object.values(this.sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
    if (!playerBase) return
    let best = null, bestD2 = Infinity
    for (const b of Object.values(this.sim.buildings)) {
      if (b.typeId !== 'outpost' || b.ownerId === 'player') continue
      const dx = b.x - playerBase.x, dy = b.y - playerBase.y
      const d2 = dx * dx + dy * dy
      if (d2 < bestD2) { bestD2 = d2; best = b }
    }
    if (best) this.rally(best.x, best.y)
  }

  rush() {
    const enemyBase = Object.values(this.sim.buildings).find(b => b.ownerId === 'ai' && b.typeId === 'base')
    if (enemyBase) this.rally(enemyBase.x, enemyBase.y)
  }

  clearRally() {
    this.sim.rallyPoints['player'] = null
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
