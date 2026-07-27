import { createSim } from './domain/simulation/create-sim'
import { tick } from './domain/simulation/tick'
import type { SimulationState } from './domain/types'
import { useSpeckWarsStore } from './store'
import { Renderer } from './rendering/renderer'
import { createCamera, clampCamera, screenToWorld } from './rendering/camera'
import { InputHandler } from './input/input-handler'
import type { Camera } from './rendering/camera'
import { AIController, type AIPersonality } from './domain/ai/ai-controller'
import { recordBestTime, incrementWinStreak, resetWinStreak, isFirstGame, markFirstGameDone, recordGameResult, markWonToday, updateLifetimeStats, getWinStreak, hasSeenVeteranTip, markVeteranTipSeen } from './lib/personal-best'
import { BUILDING_TYPES } from './domain/config/building-types'

export class GameInstance {
  private canvas: HTMLCanvasElement
  private sim: SimulationState
  private renderer: Renderer
  private rafId: number | null = null
  private destroyed = false
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
  private outpostAttackWarnedAt: Record<string, number> = {}  // outpostId → timestamp
  private outpostHpWarnedAt: Record<string, number> = {}     // outpostId → timestamp (HP critical)
  private enemySurgeWarnedAt = -30000
  private recentKillTimes: number[] = []  // timestamps of recent player kills (combo detection)
  private recentDeathPositions: { x: number; y: number; ts: number }[] = []
  private lastComboNotifiedAt = -5000
  private recentKillTs: number[] = []        // timestamps of player kills in rolling window (kill streak)
  private lastStreakNotifiedAt = 0            // prevent kill streak notification spam
  private idleArmyTimer = 0              // ms with no rally point + specks available
  private lastIdleNudge = -30000         // allow nudge immediately if idle at game start
  private cachedPlayerSpeckCount = 0    // updated from HUD_UPDATE
  private lastAiSpawnMode: string = 'basic'  // track AI spawn mode changes
  private lastTripleHolder: string | null = null  // track triple-outpost ownership changes
  private rallyCryFired = false               // one-time Rally Cry notification per game
  private firstVeteranNotifiedAt = -30000   // allow veteran notification immediately
  private recentPlayerCaptureTimes: number[] = []  // timestamps of recent player captures
  private retreatWarnedAt = -20000          // allow retreat warning after 20s
  private notifGen = 0
  private prevBaseUnderThreat = false
  private prevEnemyAdvance = false
  private prevSurgeCooldown = 0
  private prevCommanderAbilityCooldown = 0
  private dominationWarnedAt15s = false         // true once "15s left" AI domination warning fires
  private dominationWarnedAt10s = false         // true once "10s left" AI domination warning fires
  private dominationPlayerWarnedAt15s = false   // true once "15s left" player domination win warning fires
  private prevWaveCountdown: number | null = null  // track wave countdown for 30s pre-warning
  private fortifyResearchNotified = new Set<string>()  // outpost IDs for which research-ready was notified
  private controlGroups = new Map<number, string[]>()
  private lastAdvanceMs = 0
  private lastAdvanceIdx = 0
  private cinematicMs = 0
  private cinematicStartX = 0
  private cinematicStartY = 0
  private cinematicStartZoom = 0.1
  private cinematicEndX = 0
  private cinematicEndY = 0
  private cinematicEndZoom = 1
  private cinematicTotalMs = 3000
  private gameOverFreezeMs = 0  // freeze sim during dramatic game-over delay
  private pendingBuild: string | null = null  // building type ID awaiting placement click
  private killFeedKillAt = 0    // last time we pushed a kill entry
  private killFeedLossAt = 0    // last time we pushed a loss entry
  private onResize: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const difficulty = useSpeckWarsStore.getState().difficulty
    const mapPreset = useSpeckWarsStore.getState().mapPreset
    const aiTickInterval: Record<string, number> = { easy: 60, medium: 30, hard: 15, 'very-hard': 6 }
    const now = new Date()
    const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
    const diffHash = [...difficulty].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    const dailySeed = dateKey * 1000 + diffHash
    this.sim = createSim(dailySeed, difficulty, mapPreset)
    this.renderer = new Renderer()
    this.camera = createCamera(canvas.clientWidth, canvas.clientHeight)
    const aiPersonality = (): AIPersonality => {
      if (difficulty === 'easy' || difficulty === 'medium') return 'balanced'
      if (difficulty === 'hard') {
        const r = Math.random()
        return r < 0.4 ? 'aggressive' : r < 0.7 ? 'macro' : 'balanced'
      }
      // very-hard: no balanced — pure pressure or macro domination
      return Math.random() < 0.55 ? 'aggressive' : 'macro'
    }
    const adaptiveEnabled = difficulty === 'easy' || difficulty === 'medium'
    const personality = aiPersonality()
    useSpeckWarsStore.getState().setAiPersonality(personality)
    this.aiController = new AIController('ai', aiTickInterval[difficulty] ?? 15, personality, adaptiveEnabled)
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
    this.onResize = () => { clampCamera(this.camera, this.canvas.clientWidth, this.canvas.clientHeight) }
    window.addEventListener('resize', this.onResize)
    await this.renderer.init(this.canvas)
    // destroy() ran while the renderer was initialising (React StrictMode mounts, tears
    // down and remounts the canvas effect). Bail out rather than wiring up input, the
    // store and a render loop that nothing owns — the renderer has already cleaned
    // itself up, and a second GameInstance is running by now.
    if (this.destroyed) return
    this.inputHandler = new InputHandler(
      this.canvas,
      this.camera,
      (wx, wy) => {
        // Build placement mode: place the pending building at the clicked location
        if (this.pendingBuild) {
          const typeId = this.pendingBuild
          const btype = BUILDING_TYPES[typeId]
          const cost = btype?.sacrificeCost ?? 0
          // Guard against silent build failure: check speck count before placing
          const useSelection = this.sim.selectedSpeckIds.size > 0
          let available = 0
          for (let i = 0; i < this.sim.speckCount; i++) {
            if (!this.sim.speckIds[i]) continue
            const m = this.sim.speckMeta[i]
            if (!m || m.ownerId !== 'player') continue
            if (useSelection && !this.sim.selectedSpeckIds.has(m.id)) continue
            available++
          }
          if (available < cost) {
            this.notify(`Need ${cost} specks to build (have ${available})`, '#ff4f7b', 2000)
            return  // stay in build mode so player can gather more specks
          }
          this.pendingBuild = null
          this.inputHandler?.setPendingBuildActive(false)
          this.sim.inputQueue.push({ type: 'BUILD', ownerId: 'player', buildingTypeId: typeId, x: wx, y: wy })
          this.notify('◆ TURRET PLACED', '#ffd700', 1500)
          return
        }

        // Check if click hit a player building — select it instead of rallying
        // Touch devices get a larger buffer to ensure 44px+ screen hit area at default zoom
        const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
        const hitBuffer = isTouchDevice ? 30 : 20
        for (const building of Object.values(this.sim.buildings)) {
          if (building.ownerId !== 'player') continue
          const btype = BUILDING_TYPES[building.typeId]
          const r = btype?.size ?? 20
          if (Math.hypot(wx - building.x, wy - building.y) <= r + hitBuffer) {
            navigator.vibrate?.(10)
            this.sim.inputQueue.push({ type: 'SELECT_BUILDING', ownerId: 'player', buildingId: building.id })
            return
          }
        }

        // If a building is selected, set its rally point
        if (this.sim.selectedBuildingId) {
          this.sim.inputQueue.push({ type: 'SET_BUILDING_RALLY', ownerId: 'player', buildingId: this.sim.selectedBuildingId, x: wx, y: wy })
          this.renderer.showRallyPing(wx, wy)
          return
        }

        // Default: global rally for all units
        this.sim.inputQueue.push({ type: 'RALLY', ownerId: 'player', x: wx, y: wy })
        this.renderer.showRallyPing(wx, wy)
      },
      () => useSpeckWarsStore.getState().togglePause(),   // Space
      () => this.clearRally(),                             // R — clear rally
      () => {},                                            // H — (was: cycle spawn mode; now per-building only via panel)
      () => {                                              // C — recenter camera on player base
        const base = Object.values(this.sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
        if (!base) return
        this.camera.x = this.canvas.clientWidth / 2 - base.x * this.camera.zoom
        this.camera.y = this.canvas.clientHeight / 2 - base.y * this.camera.zoom
      },
      () => { this.defend(); this.notify('🛡 DEFEND', '#4af7c4') },   // D — defend (rally to player base)
      () => { /* onAdvance — no longer called by key; A key now sets pendingModifier in input-handler */ },
      () => { this.advance(); this.notify('→ ADVANCE', '#ffd700') },  // N — advance to nearest outpost
      () => { this.rush(); this.notify('⚡ RUSH!', '#ff4f7b') },      // B — rush enemy base
      (x1, y1, x2, y2) => {                                           // drag — box-select specks
        this.sim.inputQueue.push({ type: 'BOX_SELECT', ownerId: 'player', x1, y1, x2, y2 })
      },
      () => {                                                          // Escape — clear selection / cancel build mode
        if (this.pendingBuild) {
          this.pendingBuild = null
          this.inputHandler?.setPendingBuildActive(false)
          this.notify('Build cancelled', '#aaaaaa', 800)
          return
        }
        this.sim.inputQueue.push({ type: 'CLEAR_SELECT', ownerId: 'player' })
        this.sim.rallyPoints['player-selected'] = null
      },
      () => { this.surge() },  // Q — production surge
      () => { this.snapToAction() },                                        // V — snap camera to battle
      () => { this.snapToBase() },                                          // H — snap camera to home base
      (typeId: 'basic' | 'heavy' | 'scout') => {               // 1/2/3 — set spawn type for selected building only
        const selectedBuildingId = this.sim.selectedBuildingId
        if (!selectedBuildingId) return  // per-building only; select a base/outpost first
        this.sim.inputQueue.push({
          type: 'SET_SPAWN_TYPE',
          ownerId: 'player',
          speckTypeId: typeId,
          buildingId: selectedBuildingId,
        })
        const color = typeId === 'heavy' ? '#ff8844' : typeId === 'scout' ? '#50c8ff' : '#4af7c4'
        this.notify(`→ ${typeId.toUpperCase()}`, color, 900)
      },
      () => {                                                           // X — cycle game speed
        useSpeckWarsStore.getState().cycleSpeed()
        const spd = useSpeckWarsStore.getState().speed
        this.notify(`Speed: ${spd}×`, spd > 1 ? '#4af7c4' : '#ffffff')
      },
      () => {                                                           // E — select all specks
        this.sim.inputQueue.push({ type: 'BOX_SELECT', ownerId: 'player', x1: -1, y1: -1, x2: 3001, y2: 3001 })
      },
      () => { this.sacrifice() },                                       // F — sacrifice specks to repair base
      (slot: number) => {                                               // Ctrl+4-9 — save control group
        const saved = [...this.sim.selectedSpeckIds]
        this.controlGroups.set(slot, saved)
        if (saved.length > 0) {
          this.notify(`★ Group ${slot} — ${saved.length} specks`, '#4af7c4', 900)
        }
      },
      (slot: number) => {                                               // 4-9 — recall control group
        const saved = this.controlGroups.get(slot)
        if (!saved || saved.length === 0) return
        // Filter to living specks
        const aliveIds = new Set<string>()
        for (let i = 0; i < this.sim.speckCount; i++) {
          if (this.sim.speckIds[i] && this.sim.speckMeta[i]) aliveIds.add(this.sim.speckIds[i])
        }
        this.sim.selectedSpeckIds.clear()
        for (const id of saved) {
          if (aliveIds.has(id)) this.sim.selectedSpeckIds.add(id)
        }
        this.sim.rallyPoints['player-selected'] = this.sim.rallyPoints['player']
      },
      () => { this.sim.inputQueue.push({ type: 'STOP', ownerId: 'player' }); this.notify('■ STOP', '#aaaaaa', 700) },   // S — stop
      () => { this.sim.inputQueue.push({ type: 'HOLD', ownerId: 'player' }); this.notify('⊡ HOLD', '#aaaaaa', 700) },  // H — hold
      (wx: number, wy: number) => {                                    // A + right-click — attack-move
        this.sim.inputQueue.push({ type: 'ATTACK_MOVE', ownerId: 'player', x: wx, y: wy })
        this.renderer.showRallyPing(wx, wy, 0xff4f7b)  // red ping for attack-move
        this.notify('⚔ ATTACK MOVE!', '#ff4f7b', 900)
      },
    )
    this.inputHandler.onBuildTurret = () => this.enterBuildMode('turret')  // T — enter turret build mode
    this.inputHandler.onGuard = () => { this.guard(); this.notify('🛡 GUARD', '#4af7c4', 1000) }
    this.inputHandler.onCycleStance = () => this.cycleStance()  // Z — cycle stance
    this.inputHandler.onSaveControlGroup = (slot: number) => {
      const saved = [...this.sim.selectedSpeckIds]
      this.controlGroups.set(slot, saved)
      if (saved.length > 0) {
        this.notify(`★ Group ${slot} — ${saved.length} specks`, '#4af7c4', 900)
      }
    }
    this.inputHandler.onRecallControlGroup = (slot: number) => {
      const saved = this.controlGroups.get(slot)
      if (!saved || saved.length === 0) return
      const aliveIds = new Set<string>()
      for (let i = 0; i < this.sim.speckCount; i++) {
        if (this.sim.speckIds[i] && this.sim.speckMeta[i]) aliveIds.add(this.sim.speckIds[i])
      }
      this.sim.selectedSpeckIds.clear()
      for (const id of saved) {
        if (aliveIds.has(id)) this.sim.selectedSpeckIds.add(id)
      }
      this.sim.rallyPoints['player-selected'] = this.sim.rallyPoints['player']
    }
    this.inputHandler.onCommanderAbility = () => this.commanderAbility()  // Y — Battle Roar / Last Stand
    useSpeckWarsStore.getState().setGameActions({
      defend: () => { this.defend(); this.notify('🛡 DEFEND', '#4af7c4') },
      advance: () => { this.advance(); this.notify('→ ADVANCE', '#ffd700') },
      rush: () => { this.rush(); this.notify('⚡ RUSH!', '#ff4f7b') },
      clearRally: () => this.clearRally(),
      clearSelection: () => {
        this.sim.inputQueue.push({ type: 'CLEAR_SELECT', ownerId: 'player' })
        this.sim.rallyPoints['player-selected'] = null
      },
      surge: () => { this.surge() },
      rally: (x: number, y: number) => this.rally(x, y),
      sacrifice: () => { this.sacrifice() },
      setSpawnType: (typeId: 'basic' | 'heavy' | 'scout') => {
        const selectedBuildingId = this.sim.selectedBuildingId
        if (!selectedBuildingId) return
        this.sim.inputQueue.push({
          type: 'SET_SPAWN_TYPE',
          ownerId: 'player',
          speckTypeId: typeId,
          buildingId: selectedBuildingId,
        })
        const color = typeId === 'heavy' ? '#ff8844' : typeId === 'scout' ? '#50c8ff' : '#4af7c4'
        this.notify(`→ ${typeId.toUpperCase()}`, color, 900)
      },
      buildTurret: () => this.enterBuildMode('turret'),
      panCamera: (wx: number, wy: number) => {
        this.camera.x = this.canvas.clientWidth / 2 - wx * this.camera.zoom
        this.camera.y = this.canvas.clientHeight / 2 - wy * this.camera.zoom
        clampCamera(this.camera, this.canvas.clientWidth, this.canvas.clientHeight)
      },
      stop: () => this.sim.inputQueue.push({ type: 'STOP', ownerId: 'player' }),
      hold: () => this.sim.inputQueue.push({ type: 'HOLD', ownerId: 'player' }),
      guard: () => this.guard(),
      cycleStance: () => this.cycleStance(),
      saveControlGroup: (slot: number) => {
        this.inputHandler.onSaveControlGroup?.(slot)
      },
      recallControlGroup: (slot: number) => {
        this.inputHandler.onRecallControlGroup?.(slot)
      },
      researchUpgrade: (buildingId: string, upgrade: 'carapace' | 'blades' | 'afterburners') => {
        this.sim.inputQueue.push({ type: 'RESEARCH_UPGRADE', ownerId: 'player', buildingId, upgrade })
      },
      selectAll: () => {
        this.sim.inputQueue.push({ type: 'BOX_SELECT', ownerId: 'player', x1: -1, y1: -1, x2: 3001, y2: 3001 })
      },
      snapToBase: () => this.snapToBase(),
      snapToAction: () => this.snapToAction(),
      commanderAbility: () => this.commanderAbility(),
      activatePatrol: () => this.inputHandler.activateTouchPatrol(),
      activateSelectMode: () => this.inputHandler.activateTouchSelectMode(),
      selectByType: (typeId: string) => {
        this.sim.selectedSpeckIds.clear()
        let count = 0
        for (let i = 0; i < this.sim.speckCount; i++) {
          const m = this.sim.speckMeta[i]
          if (m && m.ownerId === 'player' && m.typeId === typeId) {
            this.sim.selectedSpeckIds.add(m.id)
            count++
          }
        }
        this.sim.rallyPoints['player-selected'] = this.sim.rallyPoints['player']
        if (count > 0) {
          const label = typeId === 'heavy' ? 'Heavies' : typeId === 'scout' ? 'Darts' : 'Basics'
          this.notify(`Selected all ${label} (${count})`, '#4af7c4', 900)
        }
      },
      selectBuilding: (buildingId: string) => {
        this.sim.inputQueue.push({ type: 'SELECT_BUILDING', ownerId: 'player', buildingId })
      },
      garrison: (buildingId: string) => this.garrison(buildingId),
      recallGarrison: (buildingId: string) => this.recallGarrison(buildingId),
    })
    // Cinematic intro: start zoomed out to show full world
    const W = this.canvas.clientWidth
    const H = this.canvas.clientHeight
    const WORLD_SIZE = 3000
    const minZoom = Math.min(W / WORLD_SIZE, H / WORLD_SIZE) * 0.9
    // Snap camera to show full map
    this.camera.zoom = minZoom
    this.camera.x = W / 2 - (WORLD_SIZE / 2) * minZoom
    this.camera.y = H / 2 - (WORLD_SIZE / 2) * minZoom
    // Find player base for zoom-in target
    const playerBase = Object.values(this.sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
    const targetZoom = 1.0
    const targetX = playerBase ? W / 2 - playerBase.x * targetZoom : W / 2 - (WORLD_SIZE / 2) * targetZoom
    const targetY = playerBase ? H / 2 - playerBase.y * targetZoom : H / 2 - (WORLD_SIZE / 2) * targetZoom
    // Store cinematic keyframes
    this.cinematicStartX = this.camera.x
    this.cinematicStartY = this.camera.y
    this.cinematicStartZoom = this.camera.zoom
    this.cinematicEndX = targetX
    this.cinematicEndY = targetY
    this.cinematicEndZoom = targetZoom
    this.cinematicTotalMs = 3000

    this.lastTime = performance.now()
    this.loop(this.lastTime)

    // Cinematic countdown: 3-2-1 before gameplay begins
    // Freeze the sim for the countdown duration
    this.cinematicMs = 3000  // 3 seconds total
    useSpeckWarsStore.getState().setCountdown(3)
    setTimeout(() => useSpeckWarsStore.getState().setCountdown(2), 1000)
    setTimeout(() => useSpeckWarsStore.getState().setCountdown(1), 2000)
    setTimeout(() => {
      useSpeckWarsStore.getState().setCountdown(null)
      this.cinematicMs = 0
      this.notify('⚔ FIGHT!', '#4af7c4', 800)
      navigator.vibrate?.([50, 30, 50, 30, 100])
    }, 3000)

    // Show tutorial hints for first-time players
    if (isFirstGame()) {
      markFirstGameDone()
      const touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
      const hints = touch ? [
        { delay: 1200,  message: '💡 Tap the map to rally your specks!', color: '#aaddff' },
        { delay: 6000,  message: '💡 Capture outposts to boost production!', color: '#aaddff' },
        { delay: 13000, message: '💡 Long-press for attack-move — hold 0.5s!', color: '#ff8c44' },
        { delay: 22000, message: '💡 Use ⚡ SURGE button — doubles production for 8s!', color: '#ffd700' },
        { delay: 38000, message: '💡 Double-tap canvas to zoom in/out!', color: '#aaddff' },
        { delay: 50000, message: '💡 Use 🔧 HEAL to sacrifice 10 specks → repair base!', color: '#64c864' },
      ] : [
        { delay: 1200,  message: '💡 Click the map to rally your specks!', color: '#aaddff' },
        { delay: 6000,  message: '💡 Capture outposts to boost production!', color: '#aaddff' },
        { delay: 13000, message: '💡 Press Q for Surge — doubles production for 8s!', color: '#ffd700' },
        { delay: 22000, message: '💡 Press 1/2/3 to switch spawn type (basic/heavy/scout)', color: '#aaddff' },
        { delay: 45000, message: '💡 Press F to sacrifice 10 specks and repair your base!', color: '#64c864' },
      ]
      for (const { delay, message, color } of hints) {
        setTimeout(() => this.notify(message, color, 3000), delay)
      }
    }
  }

  private loop = (now: number) => {
    if (this.destroyed) return   // a frame queued before destroy() can still fire
    const dt = Math.min(now - this.lastTime, 50)
    this.lastTime = now

    const store = useSpeckWarsStore.getState()

    if (this.cinematicMs > 0) {
      const dtMs = dt
      this.cinematicMs = Math.max(0, this.cinematicMs - dtMs)
      // Animate camera: t goes 1→0 as cinematic plays; alpha goes 0→1
      const t = this.cinematicMs / this.cinematicTotalMs
      // Ease-in-out: slow start, fast middle, slow end
      const alpha = 1 - t  // 0 at start, 1 at end
      const eased = alpha < 0.5
        ? 2 * alpha * alpha
        : 1 - Math.pow(-2 * alpha + 2, 2) / 2
      this.camera.zoom = this.cinematicStartZoom + (this.cinematicEndZoom - this.cinematicStartZoom) * eased
      this.camera.x = this.cinematicStartX + (this.cinematicEndX - this.cinematicStartX) * eased
      this.camera.y = this.cinematicStartY + (this.cinematicEndY - this.cinematicStartY) * eased
      const dragRect = this.inputHandler.getDragRect()
      this.renderer.render(this.sim, this.camera, dt, 0, 0, dragRect, null, useSpeckWarsStore.getState().fogEnabled)
      this.rafId = requestAnimationFrame(this.loop)
      return
    }

    if (this.gameOverFreezeMs > 0) {
      this.gameOverFreezeMs = Math.max(0, this.gameOverFreezeMs - dt)
      const { shakeX, shakeY } = this.computeShake(dt)
      const dragRect = this.inputHandler.getDragRect()
      this.renderer.render(this.sim, this.camera, dt, shakeX, shakeY, dragRect, null, useSpeckWarsStore.getState().fogEnabled)
      this.rafId = requestAnimationFrame(this.loop)
      return
    }

    if (store.phase === 'playing') {
      const scaledDt = dt * store.speed
      this.elapsedMs += scaledDt
      store.setElapsedMs(this.elapsedMs)
      store.pruneKillFeed()
      this.aiController.update(this.sim, scaledDt)
      this.sim = tick(this.sim, scaledDt)

      for (const event of this.sim.events) {
        if (event.type === 'GAME_OVER') {
          const won = event.winnerId === 'player'
          store.setWinnerId(event.winnerId)
          store.setVictoryType(event.victoryType)
          // Freeze sim and apply camera shake during dramatic game-over delay
          this.gameOverFreezeMs = 1400
          this.shakeMs = won ? 700 : 450
          this.shakeMaxMs = won ? 700 : 450
          this.shakeStrength = won ? 14 : 9
          // Show dramatic notification, then transition to end screen after a brief delay
          const playerBaseHp = this.sim.buildings['building-player-base']?.hp ?? 100
          const isComeback = won && playerBaseHp < 20  // base barely survived
          store.setNotification({
            message: isComeback ? '🏆 COMEBACK VICTORY!' : won ? '⚡ VICTORY!' : '💀 DEFEATED',
            color: isComeback ? '#ffd700' : won ? '#4af7c4' : '#ff4f7b',
          })
          const elapsedAtEnd = this.elapsedMs
          setTimeout(() => {
            const s = useSpeckWarsStore.getState()
            if (won) {
              const isNew = recordBestTime(s.difficulty, elapsedAtEnd)
              incrementWinStreak()
              recordGameResult(s.difficulty, true, elapsedAtEnd, s.kills)
              updateLifetimeStats(s.kills, getWinStreak())
              markWonToday(s.difficulty)
              s.setIsNewBest(isNew)
              s.setPhase('victory')
            } else {
              resetWinStreak()
              recordGameResult(s.difficulty, false, elapsedAtEnd, s.kills)
              updateLifetimeStats(s.kills, getWinStreak())
              s.setIsNewBest(false)
              s.setPhase('defeat')
            }
          }, 1400)
        }
        if (event.type === 'HUD_UPDATE') {
          const cameraViewport = {
            x: -this.camera.x / this.camera.zoom,
            y: -this.camera.y / this.camera.zoom,
            w: this.canvas.clientWidth / this.camera.zoom,
            h: this.canvas.clientHeight / this.camera.zoom,
          }
          store.setHud({ ...event.data, cameraViewport })
          const bua = event.data.baseUnderThreat ?? false
          if (bua && !this.prevBaseUnderThreat) {
            this.notify('⚠ BASE UNDER ATTACK', '#ff3333')
            navigator.vibrate?.([300, 100, 300])
          }
          this.prevBaseUnderThreat = bua
          const adv = event.data.enemyAdvanceDetected ?? false
          if (adv && !this.prevEnemyAdvance && !event.data.baseUnderThreat) {
            this.notify('⚠ ENEMY ADVANCING', '#ff8844')
          }
          this.prevEnemyAdvance = adv
          this.cachedPlayerSpeckCount = event.data.players.player?.speckCount ?? 0
          const playerSpeckCount = event.data.players.player?.speckCount ?? 0
          store.setPeakArmySize(playerSpeckCount)
          store.setPeakVeteranCount(event.data.players.player?.veteranCount ?? 0)
          store.setPeakEliteCount(event.data.players.player?.eliteCount ?? 0)
          store.setPeakLegendCount(event.data.players.player?.legendCount ?? 0)
          // Warn when an enemy starts capturing a player-owned outpost
          const now = Date.now()
          const playerBuildingHp = event.data.players.player?.buildingHp ?? {}
          for (const outpostId of event.data.attackedBuildingIds) {
            if (!(outpostId in playerBuildingHp)) continue  // not player-owned
            const lastWarn = this.outpostAttackWarnedAt[outpostId] ?? -Infinity
            if (now - lastWarn > 8000) {
              this.outpostAttackWarnedAt[outpostId] = now
              const name = outpostId.replace('outpost-', '').toUpperCase()
              this.notify(`⬡ ${name} UNDER ATTACK!`, '#ff8c00', 2500)
              navigator.vibrate?.([150, 50, 150])
            }
          }
          // Clear warnings for outposts that are no longer under attack
          for (const id of Object.keys(this.outpostAttackWarnedAt)) {
            if (!event.data.attackedBuildingIds.includes(id)) {
              delete this.outpostAttackWarnedAt[id]
            }
          }
          // Enemy surge warning: AI has 2× the player's specks
          const playerSpecks = event.data.players.player?.speckCount ?? 0
          const aiSpecks = event.data.players.ai?.speckCount ?? 0
          if (aiSpecks >= 2 * playerSpecks && playerSpecks > 5 && now - this.enemySurgeWarnedAt > 20000) {
            this.enemySurgeWarnedAt = now
            this.notify('⚠ ENEMY SURGE!', '#ff6b35', 2500)
          }
          // Outpost HP critical: player outpost < 20% max HP (50)
          const OUTPOST_MAX_HP = 50
          const OUTPOST_CRITICAL_HP = OUTPOST_MAX_HP * 0.2  // 10 HP
          for (const [buildingId, hp] of Object.entries(playerBuildingHp)) {
            if (!buildingId.startsWith('outpost-')) continue
            if (hp > OUTPOST_CRITICAL_HP) { delete this.outpostHpWarnedAt[buildingId]; continue }
            const lastHpWarn = this.outpostHpWarnedAt[buildingId] ?? -Infinity
            if (now - lastHpWarn > 12000) {
              this.outpostHpWarnedAt[buildingId] = now
              const name = buildingId.replace('outpost-', '').toUpperCase()
              this.notify(`⬡ ${name} HP CRITICAL!`, '#ff2200', 2500)
              store.pushKillFeedEntry({ icon: '🏗', label: `${name} critical`, color: '#ff2200' })
            }
          }
          // Triple outpost notification: fire when ownership of all 3 outposts changes hands
          const holder = event.data.tripleOutpostOwner ?? null
          if (holder !== this.lastTripleHolder) {
            if (holder === 'player') {
              this.notify('⬡ TRIPLE OUTPOST — 2× PRODUCTION + DOMINATION IN 60s!', '#ffd700', 5000)
            } else if (holder === 'ai' && this.lastTripleHolder !== null) {
              // AI reclaimed triple — only notify if player had just lost it
              this.notify('⬡ ENEMY DOMINATES — 60s TO WIN! RECAPTURE!', '#ff4f7b', 5000)
            } else if (holder === 'ai') {
              this.notify('⬡ ENEMY HAS ALL OUTPOSTS — 60s TO WIN!', '#ff4f7b', 5000)
            }
            this.lastTripleHolder = holder
            // Reset domination warnings when control changes
            if (holder !== 'ai') {
              this.dominationWarnedAt15s = false
              this.dominationWarnedAt10s = false
            }
            if (holder !== 'player') {
              this.dominationPlayerWarnedAt15s = false
            }
          }
          // Domination critical warnings: AI is about to win
          if (holder === 'ai' && event.data.dominationProgress !== null) {
            const progress = event.data.dominationProgress
            const secsLeft = Math.ceil((1 - progress) * 60)
            if (secsLeft <= 15 && !this.dominationWarnedAt15s) {
              this.dominationWarnedAt15s = true
              this.notify(`⬡ ENEMY WINS IN ${secsLeft}s — RECAPTURE NOW!`, '#ff0055', 3000)
              navigator.vibrate?.([200, 100, 200, 100, 200])
            } else if (secsLeft <= 10 && !this.dominationWarnedAt10s) {
              this.dominationWarnedAt10s = true
              this.notify('⬡ DOMINATION IMMINENT!', '#ff0055', 3000)
              navigator.vibrate?.([400, 100, 400])
            }
          }
          // Domination win approaching: player is about to win
          if (holder === 'player' && event.data.dominationProgress !== null) {
            const progress = event.data.dominationProgress
            const secsLeft = Math.ceil((1 - progress) * 60)
            if (secsLeft <= 15 && !this.dominationPlayerWarnedAt15s) {
              this.dominationPlayerWarnedAt15s = true
              this.notify(`⬡ DOMINATION IN ${secsLeft}s — HOLD THE LINE!`, '#ffd700', 3000)
              navigator.vibrate?.([100, 50, 100])
            }
          }

          // Wave pre-warning: fire a toast 30s before each AI wave
          const waveCd = event.data.waveCountdown ?? null
          const waveInProg = event.data.waveInProgress ?? false
          if (!waveInProg && waveCd !== null && waveCd < 30000
              && (this.prevWaveCountdown === null || this.prevWaveCountdown >= 30000)) {
            const secs = Math.ceil(waveCd / 1000)
            this.notify(`⚠ WAVE IN ${secs}s — PREPARE DEFENSES`, '#ff6b35', 2500)
          }
          this.prevWaveCountdown = waveCd

          // Research available notification: outpost held 20s+ unlocks upgrade research
          const RESEARCH_FORTIFY_THRESHOLD = 20000 / 30000  // 0.667 — matches tick.ts gate
          for (const [outpostId, fortLevel] of Object.entries(event.data.outpostFortify ?? {})) {
            if (!(outpostId in playerBuildingHp)) {
              // Lost the outpost — reset so we can re-notify if recaptured
              this.fortifyResearchNotified.delete(outpostId)
              continue
            }
            if (fortLevel >= RESEARCH_FORTIFY_THRESHOLD && !this.fortifyResearchNotified.has(outpostId)) {
              this.fortifyResearchNotified.add(outpostId)
              const name = outpostId.replace('outpost-', '').toUpperCase()
              this.notify(`⚗ ${name} FORTIFIED — upgrade research available`, '#44aaff', 3500)
            }
          }

          // Surge cooldown ready notification
          const surgeCd = event.data.surgeCooldown ?? 0
          const surgeActive = (event.data.surgeDuration ?? 0) > 0
          if (!surgeActive && surgeCd === 0 && this.prevSurgeCooldown > 0) {
            this.notify('⚡ SURGE READY', '#ffd700', 2000)
          }
          this.prevSurgeCooldown = surgeCd

          // Commander ability cooldown ready notification
          const cmdData = event.data.commander
          const cmdCd = cmdData?.abilityCooldown ?? 0
          const commanderAlive = cmdData !== null && (event.data.commanderRespawnMs ?? 0) === 0
          if (commanderAlive && cmdCd === 0 && this.prevCommanderAbilityCooldown > 0) {
            this.notify('★ ABILITY READY', 'rgba(255,215,0,0.85)', 2000)
          }
          this.prevCommanderAbilityCooldown = commanderAlive ? cmdCd : 0

        }
        if (event.type === 'SPECK_DIED') {
          if (event.killedOwnerId === 'ai' && event.killerOwnerId === 'player') {
            store.addKill()
            const nowTs = Date.now()
            if (nowTs - this.killFeedKillAt > 700) {
              this.killFeedKillAt = nowTs
              store.pushKillFeedEntry({ icon: '⚔', label: 'enemy down', color: '#4af7c4' })
            }
            // Combo detection: 3+ kills within 2s
            this.recentKillTimes.push(nowTs)
            this.recentKillTimes = this.recentKillTimes.filter(t => nowTs - t < 2000)
            if (this.recentKillTimes.length >= 3 && nowTs - this.lastComboNotifiedAt > 3000) {
              this.lastComboNotifiedAt = nowTs
              const count = this.recentKillTimes.length
              const comboColors: Record<number, string> = { 3: '#4af7c4', 5: '#ffd700', 8: '#ff8844', 12: '#cc00ff' }
              const color = count >= 12 ? '#cc00ff' : count >= 8 ? '#ff8844' : count >= 5 ? '#ffd700' : '#4af7c4'
              navigator.vibrate?.(count >= 8 ? [30, 30, 30] : 25)
              this.notify(`⚡ COMBO ×${count}!`, color, 1500)
            }
            const k = useSpeckWarsStore.getState().kills
            const milestones: Record<number, { message: string; color: string }> = {
              10:  { message: '💀 10 KILLS',  color: '#4af7c4' },
              25:  { message: '💀 25 KILLS',  color: '#ffd700' },
              50:  { message: '💀 50 KILLS',  color: '#ff8844' },
              100: { message: '💀 100 KILLS', color: '#cc00ff' },
            }
            if (milestones[k]) {
              this.notify(milestones[k].message, milestones[k].color, 2000)
            }
          } else if (event.killedOwnerId === 'player' && event.killerOwnerId === 'ai') {
            store.addLoss()
            const nowTs2 = Date.now()
            if (nowTs2 - this.killFeedLossAt > 500) {
              this.killFeedLossAt = nowTs2
              store.pushKillFeedEntry({ icon: '💀', label: 'ally lost', color: '#ff4f7b' })
            }
          }
          if (!this.firstBloodDone) {
            this.firstBloodDone = true
            const playerGotIt = event.killerOwnerId === 'player'
            this.notify(
              playerGotIt ? '⚔ FIRST BLOOD!' : '☠ FIRST BLOOD!',
              playerGotIt ? '#4af7c4' : '#ff4f7b',
              1800
            )
          }
          this.recentDeathPositions.push({ x: event.x, y: event.y, ts: Date.now() })
          // Keep only last 30 deaths
          if (this.recentDeathPositions.length > 30) this.recentDeathPositions.shift()
          // Kill streak tracking for player killer
          if (event.killerOwnerId === 'player') {
            const now = Date.now()
            this.recentKillTs.push(now)
            // Keep only kills in last 8 seconds
            this.recentKillTs = this.recentKillTs.filter(t => now - t < 8000)
            const killCount = this.recentKillTs.length
            if (now - this.lastStreakNotifiedAt > 4000) {
              if (killCount >= 20) {
                this.lastStreakNotifiedAt = now
                navigator.vibrate?.([25, 30, 40, 30, 25])
                this.notify('⚡ UNSTOPPABLE! ×' + killCount, '#ffffff')
              } else if (killCount >= 10) {
                this.lastStreakNotifiedAt = now
                navigator.vibrate?.([25, 30, 25])
                this.notify('⚡ RAMPAGE! ×' + killCount, '#ffd700')
              } else if (killCount >= 5) {
                this.lastStreakNotifiedAt = now
                navigator.vibrate?.(25)
                this.notify('⚡ KILLING SPREE ×' + killCount, '#ff8844')
              }
            }
          }
        }
        if (event.type === 'BUILDING_DAMAGED' && event.buildingId === 'building-ai-base') {
          const aiBase = this.sim.buildings['building-ai-base']
          if (aiBase) {
            const hpFrac = event.hp / aiBase.maxHp
            const now = Date.now()
            if (hpFrac < 0.1 && now - this.enemyBaseWarnedAt > 8000) {
              this.enemyBaseWarnedAt = now
              this.notify('💥 ENEMY BASE COLLAPSING!', '#ff8844', 3000)
            } else if (hpFrac < 0.2 && hpFrac >= 0.1 && now - this.enemyBaseWarnedAt > 15000) {
              this.enemyBaseWarnedAt = now
              this.notify('⚔ ENEMY BASE CRITICAL!', '#ffd700', 3000)
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
            this.notify('⚠ BASE UNDER ATTACK!', '#ff4f7b', 2500)
          }
          // Rally Cry: one-time notification when base drops to 25% HP
          if (!this.rallyCryFired) {
            const playerBase = this.sim.buildings['building-player-base']
            if (playerBase && playerBase.hp / playerBase.maxHp < 0.25) {
              this.rallyCryFired = true
              setTimeout(() => this.notify('🔥 RALLY CRY! 1.5× PRODUCTION!', '#ff8844', 3000), 500)
            }
          }
        }
        if (event.type === 'CAMP_CAPTURED' && event.newOwner === 'player') {
          this.notify('◈ CAMP SEIZED! +25% SPAWN FOR 30s', '#ff9933', 3000)
          navigator.vibrate?.([20, 30, 20, 30, 20])
          store.pushKillFeedEntry({ icon: '◈', label: 'CAMP SEIZED', color: '#ff9933' })
        }
        if (event.type === 'OUTPOST_UPGRADE_RESEARCHED' && event.ownerId === 'player') {
          const labels = { carapace: 'CARAPACE — +1 HP', blades: 'BLADES — +15% DMG', afterburners: 'AFTERBURNERS — +15% SPD' }
          this.notify(`⚗ ${labels[event.upgrade as keyof typeof labels]}`, '#44aaff', 3000)
          store.pushKillFeedEntry({ icon: '⚗', label: labels[event.upgrade as keyof typeof labels], color: '#44aaff' })
        }
        if (event.type === 'OUTPOST_CAPTURED') {
          if (event.newOwner === 'player') {
            store.addOutpostCaptured()
          }
          const isPlayerGain = event.newOwner === 'player'
          const isPlayerLoss = event.previousOwner === 'player'
          const isRecapture = isPlayerGain && event.previousOwner === 'ai'
          if (isPlayerGain || isPlayerLoss) {
            const outpostName = event.outpostId.replace('outpost-', '').toUpperCase()
            const message = isPlayerLoss ? `⬡ ${outpostName} LOST`
              : isRecapture ? `⬡ ${outpostName} RECAPTURED!`
              : `⬡ ${outpostName} CAPTURED`
            const color = isPlayerLoss ? '#ff4f7b' : isRecapture ? '#ffd700' : '#4af7c4'
            this.notify(message, color, 2500)
            if (isPlayerLoss) navigator.vibrate?.(300)
            else if (isRecapture) navigator.vibrate?.([30, 40, 30, 40, 60])
            else navigator.vibrate?.([20, 30, 20])
            store.pushKillFeedEntry({ icon: '⬡', label: message.replace('⬡ ', ''), color })
          } else if (event.newOwner === 'ai' && event.previousOwner === 'neutral') {
            const outpostName = event.outpostId.replace('outpost-', '').toUpperCase()
            store.pushKillFeedEntry({ icon: '⬡', label: `${outpostName} → enemy`, color: '#ff8844' })
          }
          // Track capture combos
          if (event.newOwner === 'player') {
            const now = Date.now()
            const COMBO_WINDOW = 30_000  // 30 seconds
            // Remove captures older than window
            this.recentPlayerCaptureTimes = this.recentPlayerCaptureTimes.filter(t => now - t < COMBO_WINDOW)
            this.recentPlayerCaptureTimes.push(now)
            const count = this.recentPlayerCaptureTimes.length
            if (count === 3) {
              this.notify('★ TRIPLE CAPTURE! ★', '#ffffff')
            } else if (count === 2) {
              this.notify('DOUBLE CAPTURE!', '#ffd700')
            }
          }
        }
        if (event.type === 'SPECK_VETERAN' && event.ownerId === 'player') {
          const now = Date.now()
          if (!hasSeenVeteranTip()) {
            markVeteranTipSeen()
            this.firstVeteranNotifiedAt = now
            this.notify('⭐ FIRST VETERAN! Keep them alive — 6 kills = ELITE, 12 = LEGEND', '#ffd700', 5000)
          } else if (now - this.firstVeteranNotifiedAt > 20000) {
            this.firstVeteranNotifiedAt = now
            this.notify('⭐ VETERAN SPECK! +20% DAMAGE', '#ffd700', 2000)
          }
        }
        if (event.type === 'SPECK_ELITE' && event.ownerId === 'player') {
          this.notify('✦ ELITE SPECK! +35% DAMAGE', '#ffffff', 2500)
        }
        if (event.type === 'SPECK_LEGEND' && event.ownerId === 'player') {
          this.notify('✦✦ LEGEND BORN! ✦✦', '#cc44ff', 3000)
          store.pushKillFeedEntry({ icon: '✦✦', label: 'LEGEND BORN', color: '#cc44ff' })
        }
        if (event.type === 'UPGRADE_UNLOCKED' && event.ownerId === 'player') {
          const messages = [
            '',
            '⚡ BLOODED — Spawn Speed +10%',
            '🛡 HARDENED — Units +1 HP',
            '🔥 VETERAN ARMY — Damage +15%',
          ]
          this.notify(messages[event.level], '#ffd700', 3000)
        }
        if (event.type === 'VETERAN_FALLEN') {
          const isLegend = event.kills >= 12
          const isElite = event.kills >= 6
          const label = isLegend ? '✦✦ LEGEND FALLEN' : isElite ? '✦ ELITE FALLEN' : '⭐ VETERAN FALLEN'
          const color = isLegend ? '#cc44ff' : isElite ? '#ff8844' : '#ffcc00'
          this.notify(label, color)
        }
        if (event.type === 'AI_WAVE_START') {
          const waveColors = ['#ff4f7b', '#ff6b35', '#cc00ff']
          const color = waveColors[(event.waveNumber - 1) % waveColors.length]
          this.notify(`⚠ WAVE ${event.waveNumber} ASSAULT!`, color, 3000)
        }
        if (event.type === 'AI_LAST_STAND') {
          this.notify('⚠ ENEMY LAST STAND', '#ff4444')
        }

        if (event.type === 'AI_SPAWN_SWITCH' && event.speckTypeId === 'heavy') {
          this.notify('⚠ ENEMY SWITCHING TO HEAVY', '#ff8844')
        }
        if (event.type === 'HERO_LEVELED' && event.ownerId === 'player') {
          if (event.heroLevel === 1) {
            this.notify('⚔ COMMANDER BLOODED — +15% SPEED', '#ffd700', 3000)
          } else if (event.heroLevel === 2) {
            this.notify('⚔ COMMANDER EMPOWERED — AoE PULSE ACTIVE', '#ffd700', 3000)
          }
          store.pushKillFeedEntry({ icon: '⚔', label: 'COMMANDER LEVELS UP', color: '#ffd700' })
        }
        if (event.type === 'HERO_DIED' && event.ownerId === 'player') {
          this.notify('⚔ COMMANDER FALLEN — RESPAWNING IN 15s', '#ff4f7b', 4000)
          store.pushKillFeedEntry({ icon: '†', label: `COMMANDER FALLEN (${event.kills} kills)`, color: '#ff4f7b' })
        }
        if (event.type === 'HERO_SPAWNED' && event.ownerId === 'player') {
          this.notify('⚔ COMMANDER REBORN', '#4af7c4', 2000)
        }
        if (event.type === 'COMMANDER_LEVEL_UP' && event.ownerId === 'player') {
          const label = event.level === 2 ? '⚡ COMMANDER LVL 2 — AoE PULSE' : '🌟 COMMANDER LVL 3 — SPEED AURA'
          this.notify(label, '#ffd700', 4000)
          store.pushKillFeedEntry({ icon: '⭐', label: label.split(' — ')[0].replace('⚡ ', '').replace('🌟 ', ''), color: '#ffd700' })
        }
        if (event.type === 'COMMANDER_DIED' && event.ownerId === 'player') {
          this.notify('💀 COMMANDER FALLEN — respawning in 15s', '#ff6600', 3000)
          store.pushKillFeedEntry({ icon: '💀', label: 'COMMANDER FALLEN', color: '#ff6600' })
        }
      }

      // Retreat wave warning: 10+ player specks retreating = notify
      const nowTs = Date.now()
      if (nowTs - this.retreatWarnedAt > 15000) {
        let retreatingCount = 0
        for (let i = 0; i < this.sim.speckCount; i++) {
          const m = this.sim.speckMeta[i]
          if (m && m.ownerId === 'player' && m.state === 'retreating') retreatingCount++
        }
        if (retreatingCount >= 10) {
          this.retreatWarnedAt = nowTs
          this.notify(`⚡ ${retreatingCount} SPECKS RETREATING!`, '#ff8844', 2000)
        }
      }
    }

    // Detect AI spawn mode changes and notify player
    if (store.phase === 'playing') {
      const aiBase = this.sim.buildings['building-ai-base']
      const aiSpawnMode = aiBase?.spawnTypeOverride ?? 'basic'
      if (aiSpawnMode !== this.lastAiSpawnMode && this.elapsedMs > 5000) {
        this.lastAiSpawnMode = aiSpawnMode
        if (aiSpawnMode === 'heavy') {
          this.notify('⬡ ENEMY BUILDING TANKS', '#ffaa55', 2000)
        }
        // No notification when switching back to basic — less alarming
      }
    }

    // Idle army nudge: remind player to rally when specks sit idle
    if (store.phase === 'playing') {
      const hasRally = !!this.sim.rallyPoints['player']
      if (!hasRally && this.cachedPlayerSpeckCount >= 10) {
        this.idleArmyTimer += dt
        if (this.idleArmyTimer > 20000 && !store.notification
            && Date.now() - this.lastIdleNudge > 30000) {
          this.lastIdleNudge = Date.now()
          this.notify('📍 Click to send your army!', '#aaddff', 2500)
        }
      } else {
        this.idleArmyTimer = 0
      }
    }

    // Arrow key camera panning (works in both playing and paused states)
    if (this.inputHandler) {
      const panSpeed = 450  // px/s in world space
      const dtSec = dt / 1000
      if (this.inputHandler.isKeyHeld('ArrowUp') || this.inputHandler.isKeyHeld('KeyW'))
        this.camera.y += panSpeed * dtSec
      if (this.inputHandler.isKeyHeld('ArrowDown') || this.inputHandler.isKeyHeld('KeyS'))
        this.camera.y -= panSpeed * dtSec
      if (this.inputHandler.isKeyHeld('ArrowLeft'))
        this.camera.x += panSpeed * dtSec
      if (this.inputHandler.isKeyHeld('ArrowRight'))
        this.camera.x -= panSpeed * dtSec
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

    const { shakeX, shakeY } = this.computeShake(dt)
    const dragRect = this.inputHandler.getDragRect()
    let ghostBuild: { typeId: string; wx: number; wy: number } | null = null
    if (this.pendingBuild) {
      const mouse = this.inputHandler.getMouseScreenPos()
      if (mouse) {
        const wpos = screenToWorld(mouse.x, mouse.y, this.camera)
        ghostBuild = { typeId: this.pendingBuild, wx: wpos.x, wy: wpos.y }
      }
    }
    this.renderer.render(this.sim, this.camera, dt, shakeX, shakeY, dragRect, ghostBuild, useSpeckWarsStore.getState().fogEnabled)
    this.rafId = requestAnimationFrame(this.loop)
  }

  private computeShake(dt: number): { shakeX: number; shakeY: number } {
    if (this.shakeMs <= 0) return { shakeX: 0, shakeY: 0 }
    this.shakeMs -= dt
    const t = Math.max(0, this.shakeMs / this.shakeMaxMs)
    const s = this.shakeStrength * t
    return { shakeX: (Math.random() * 2 - 1) * s, shakeY: (Math.random() * 2 - 1) * s }
  }

  destroy() {
    this.destroyed = true
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    if (this.onResize) window.removeEventListener('resize', this.onResize)
    this.renderer.destroy()
    this.inputHandler?.destroy()
    useSpeckWarsStore.getState().setGameActions(null)
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
    const targets = Object.values(this.sim.buildings)
      .filter(b => b.typeId === 'outpost' && b.ownerId !== 'player')
      .sort((a, b) => {
        const da = (a.x - playerBase.x) ** 2 + (a.y - playerBase.y) ** 2
        const db = (b.x - playerBase.x) ** 2 + (b.y - playerBase.y) ** 2
        return da - db
      })
    if (targets.length === 0) return
    const now = Date.now()
    if (now - this.lastAdvanceMs < 3000 && targets.length > 1) {
      this.lastAdvanceIdx = (this.lastAdvanceIdx + 1) % targets.length
    } else {
      this.lastAdvanceIdx = 0
    }
    this.lastAdvanceMs = now
    const target = targets[this.lastAdvanceIdx]
    this.rally(target.x, target.y)
  }

  rush() {
    const enemyBase = Object.values(this.sim.buildings).find(b => b.ownerId === 'ai' && b.typeId === 'base')
    if (enemyBase) this.rally(enemyBase.x, enemyBase.y)
  }

  guard() {
    // Rally selected (or all) specks to nearest friendly outpost
    const playerOutposts = Object.values(this.sim.buildings)
      .filter(b => b.ownerId === 'player' && b.typeId === 'outpost')
    if (playerOutposts.length === 0) {
      this.notify('No friendly outpost to guard', '#aaaaaa', 1200)
      return
    }
    // Use center of mass of selected specks (or player base) as reference point
    let refX = 0, refY = 0, count = 0
    for (let i = 0; i < this.sim.speckCount; i++) {
      const meta = this.sim.speckMeta[i]
      if (!meta || !this.sim.speckIds[i]) continue
      if (this.sim.selectedSpeckIds.size > 0 && !this.sim.selectedSpeckIds.has(meta.id)) continue
      if (meta.ownerId !== 'player') continue
      refX += this.sim.speckX[i]; refY += this.sim.speckY[i]; count++
    }
    if (count > 0) { refX /= count; refY /= count }
    else {
      const base = Object.values(this.sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
      if (base) { refX = base.x; refY = base.y }
    }
    const nearest = playerOutposts.reduce((best, b) => {
      const d = (b.x - refX) ** 2 + (b.y - refY) ** 2
      const bd = (best.x - refX) ** 2 + (best.y - refY) ** 2
      return d < bd ? b : best
    })
    this.rally(nearest.x, nearest.y)
  }

  clearRally() {
    this.sim.rallyPoints['player'] = null
    // Also clear per-building rally so R fully resets all spawn targeting
    for (const building of Object.values(this.sim.buildings)) {
      if (building.ownerId === 'player') building.rallyPoint = null
    }
  }

  surge() {
    if (this.sim.surgeDuration > 0) return  // already active — do nothing
    if (this.sim.surgeCooldown > 0) {
      const remaining = Math.ceil(this.sim.surgeCooldown / 1000)
      this.notify(`Surge ready in ${remaining}s`, 'rgba(255,215,0,0.65)', 1200)
      return
    }
    this.sim.inputQueue.push({ type: 'SURGE', ownerId: 'player' })
    useSpeckWarsStore.getState().addSurgeUsed()
    this.notify('⚡ SURGE ACTIVE!', '#ffd700')
  }

  private sacrifice() {
    if (this.sim.sacrificeCooldown > 0) {
      const remaining = Math.ceil(this.sim.sacrificeCooldown / 1000)
      this.notify(`Sacrifice ready in ${remaining}s`, 'rgba(255,100,100,0.65)', 1200)
      return
    }
    const playerBase = Object.values(this.sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
    if (!playerBase) return
    const speckCount = this.sim.speckMeta.filter((m, i) => m && m.ownerId === 'player' && this.sim.speckIds[i]).length
    if (speckCount < 10) {
      this.notify('Not enough specks to sacrifice!', '#ff4f7b', 1500)
      return
    }
    this.sim.inputQueue.push({ type: 'SACRIFICE', ownerId: 'player', buildingId: playerBase.id, typeId: 'basic', count: 10 })
    useSpeckWarsStore.getState().addSacrificeUsed()
    this.notify('⟡ SACRIFICE — +15 BASE HP', '#ff8844', 1500)
  }

  garrison(buildingId: string) {
    const building = this.sim.buildings[buildingId]
    if (!building || building.ownerId !== 'player') return
    if (building.typeId !== 'outpost') return
    const speckIds: string[] = []
    const useSelection = this.sim.selectedSpeckIds.size > 0
    for (let i = 0; i < this.sim.speckCount; i++) {
      if (!this.sim.speckIds[i]) continue
      const m = this.sim.speckMeta[i]
      if (!m || m.ownerId !== 'player' || m.isGarrisoned) continue
      if (useSelection && !this.sim.selectedSpeckIds.has(m.id)) continue
      speckIds.push(m.id)
      if (speckIds.length >= 5) break
    }
    if (speckIds.length === 0) return
    this.sim.inputQueue.push({ type: 'GARRISON', ownerId: 'player', buildingId, speckIds })
    this.notify('GARRISON', '#44aaff', 1200)
    navigator.vibrate?.([20, 40, 20])
  }

  recallGarrison(buildingId: string) {
    this.sim.inputQueue.push({ type: 'RECALL_GARRISON', ownerId: 'player', buildingId })
    this.notify('RECALL', '#44aaff', 900)
    navigator.vibrate?.([15, 30])
  }

  setStance(stance: 'aggressive' | 'defensive' | 'hold') {
    this.sim.inputQueue.push({ type: 'SET_STANCE', ownerId: 'player', stance })
    useSpeckWarsStore.getState().setStance(stance)
  }

  commanderAbility() {
    // Find the player's commander speck
    let commanderMeta = null
    for (let i = 0; i < this.sim.speckCount; i++) {
      const m = this.sim.speckMeta[i]
      if (m?.isCommander && m.ownerId === 'player' && this.sim.speckHp[i] > 0) {
        commanderMeta = m
        break
      }
    }
    if (!commanderMeta) {
      this.notify('Commander is down!', '#ff4f7b', 1200)
      return
    }
    const level = commanderMeta.commanderLevel ?? 0
    if (level < 2) {
      this.notify('Commander needs rank 2 to use abilities', 'rgba(255,255,255,0.5)', 1500)
      return
    }
    if ((commanderMeta.commanderAbilityCooldown ?? 0) > 0) {
      const remaining = Math.ceil((commanderMeta.commanderAbilityCooldown ?? 0) / 1000)
      this.notify(`Battle Roar ready in ${remaining}s`, 'rgba(255,180,0,0.7)', 1200)
      return
    }
    this.sim.inputQueue.push({ type: 'COMMANDER_ABILITY', ownerId: 'player' })
    const label = level >= 3 ? '★★ LAST STAND!' : '★ BATTLE ROAR!'
    const color = level >= 3 ? '#00ffcc' : '#ffd700'
    this.notify(label, color, 2000)
    navigator.vibrate?.([30, 40, 50])
  }

  cycleStance() {
    const current = useSpeckWarsStore.getState().stance
    const next: 'aggressive' | 'defensive' | 'hold' =
      current === 'aggressive' ? 'defensive'
      : current === 'defensive' ? 'hold'
      : 'aggressive'
    this.setStance(next)
    const labels: Record<string, string> = { aggressive: 'AGGRO', defensive: 'DEF', hold: 'HOLD' }
    const colors: Record<string, string> = { aggressive: '#ff4f7b', defensive: '#4af7c4', hold: '#aaaaaa' }
    this.notify(`Stance: ${labels[next]}`, colors[next], 1200)
  }

  enterBuildMode(buildingTypeId: string) {
    this.pendingBuild = buildingTypeId
    this.inputHandler?.setPendingBuildActive(true)
    this.notify('◆ CLICK TO PLACE TURRET', '#ffd700', 3000)
  }

  snapToAction() {
    const now = Date.now()
    // Use deaths from the last 5 seconds; fall back to all recent deaths
    let positions = this.recentDeathPositions.filter(p => now - p.ts < 5000)
    if (positions.length < 3) positions = this.recentDeathPositions
    if (positions.length === 0) return
    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length
    const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length
    // Convert world centroid to camera position
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.camera.x = w / 2 - cx * this.camera.zoom
    this.camera.y = h / 2 - cy * this.camera.zoom
    clampCamera(this.camera, w, h)
    this.notify('⚔ Battle', '#ff8844', 700)
  }

  private snapToBase() {
    const playerBase = Object.values(this.sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
    if (!playerBase) return
    const zoom = this.camera.zoom
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.camera.x = w / 2 - playerBase.x * zoom
    this.camera.y = h / 2 - playerBase.y * zoom
    this.notify('⌂ Home', '#4af7c4')
  }

  private notify(message: string, color: string, durationMs = 1200) {
    const gen = ++this.notifGen
    useSpeckWarsStore.getState().setNotification({ message, color })
    setTimeout(() => {
      if (this.notifGen === gen) useSpeckWarsStore.getState().setNotification(null)
    }, durationMs)
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
