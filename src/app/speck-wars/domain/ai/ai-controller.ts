import type { SimulationState, InputEvent, BuildingEntity } from '../types'

export type AIPersonality = 'aggressive' | 'macro' | 'balanced'

export class AIController {
  private playerId: string
  private readonly baseTickInterval: number
  private lastDecisionTick: number = 0
  private personality: AIPersonality
  private decisionCount: number = 0
  private spawnMode: 'basic' | 'heavy' | 'scout' = 'basic'
  private spawnModeCountdown: number = 0  // ticks until next spawn mode decision
  private waveTimer: number  // ms until next wave
  private waveRemainingMs = 0  // ms left in active wave (0 = not in wave)
  private waveNumber = 0       // which wave this is (1, 2, 3...)
  private waveEnabled: boolean  // only hard/very-hard get waves

  constructor(playerId: string, tickInterval: number = 30, personality: AIPersonality = 'balanced') {
    this.playerId = playerId
    this.baseTickInterval = tickInterval
    this.personality = personality
    this.waveTimer = 90000 + Math.random() * 30000  // stagger first wave: 90-120s
    this.waveEnabled = tickInterval <= 15  // hard (15) and very-hard (6) only
  }

  update(sim: SimulationState, dt: number = 16) {
    // Survival mode manages its own wave spawning via survival-spawner.ts
    if (this.waveEnabled && !sim.isSurvival) {
      this.waveTimer -= dt
      if (this.waveRemainingMs > 0) {
        this.waveRemainingMs = Math.max(0, this.waveRemainingMs - dt)
      }
      if (this.waveTimer <= 0) {
        this.waveNumber++
        sim.waveNumber = this.waveNumber
        this.waveRemainingMs = 15000
        this.waveTimer = 90000
        sim.events.push({ type: 'AI_WAVE_START', waveNumber: this.waveNumber })
      }
      // Keep waveCountdown fresh every frame (not just during decisions) for smooth HUD display
      sim.waveCountdown = this.waveTimer
      sim.waveInProgress = this.waveRemainingMs > 0
    }

    if (sim.tick - this.lastDecisionTick < this.baseTickInterval) return
    this.lastDecisionTick = sim.tick

    if (sim.players[this.playerId]?.isDefeated) return
    // In survival mode the AI has no base — specks are managed by survival-spawner.ts
    if (sim.isSurvival) return

    // Compute AI swarm centroid (or fall back to own base)
    let cx = 0, cy = 0, count = 0
    for (let i = 0; i < sim.speckCount; i++) {
      const m = sim.speckMeta[i]
      if (m && m.ownerId === this.playerId) {
        cx += sim.speckX[i]
        cy += sim.speckY[i]
        count++
      }
    }
    const myBase = Object.values(sim.buildings).find(b => b.ownerId === this.playerId && b.typeId === 'base')
    if (count === 0) {
      cx = myBase?.x ?? 0
      cy = myBase?.y ?? 0
    } else {
      cx /= count
      cy /= count
    }

    // Helper: nearest building matching predicate
    const nearest = (pred: (b: BuildingEntity) => boolean): BuildingEntity | null => {
      let best: BuildingEntity | null = null
      let bestD2 = Infinity
      for (const b of Object.values(sim.buildings)) {
        if (!pred(b)) continue
        const dx = b.x - cx, dy = b.y - cy
        const d2 = dx * dx + dy * dy
        if (d2 < bestD2) { bestD2 = d2; best = b }
      }
      return best
    }

    this.decisionCount++

    const outposts = Object.values(sim.buildings).filter(b => b.typeId === 'outpost')

    // Aggressive: every 4th decision, rush player base directly (pressure waves)
    const forceBaseRush = this.personality === 'aggressive' && this.decisionCount % 4 === 0

    // Defensive rally: when AI base is low HP, sometimes pull back to defend
    const myBaseHpFrac = (myBase?.hp ?? 100) / (myBase?.maxHp ?? 100)

    if (!forceBaseRush && myBaseHpFrac < 0.6 && myBase) {
      const defendChance = this.personality === 'aggressive'
        ? (myBaseHpFrac < 0.3 ? 0.35 : 0.15)   // aggressive defends reluctantly
        : this.personality === 'macro'
          ? (myBaseHpFrac < 0.3 ? 0.85 : 0.55)  // macro defends to protect production base
          : (myBaseHpFrac < 0.3 ? 0.70 : 0.45)  // balanced
      if (Math.random() < defendChance) {
        sim.inputQueue.push({ type: 'ATTACK_MOVE', ownerId: this.playerId, x: myBase.x, y: myBase.y })
        return
      }
    }

    // Wave assault: during active wave, always rush the enemy base
    if (this.waveRemainingMs > 0) {
      const enemyBase = nearest(b => b.ownerId !== this.playerId && b.ownerId !== 'neutral' && b.typeId === 'base')
      if (enemyBase) {
        sim.inputQueue.push({ type: 'ATTACK_MOVE', ownerId: this.playerId, x: enemyBase.x, y: enemyBase.y })
        return
      }
    }

    // Rally target priority per personality:
    //   Aggressive: rush base every 4th decision; otherwise recapture/neutral/base
    //   Macro: only target outposts until all 3 are held, then attack base
    //   Balanced: recapture → neutral outpost → base
    let target: BuildingEntity | null
    const myOutpostCount = outposts.filter(o => o.ownerId === this.playerId).length

    if (forceBaseRush) {
      target = nearest(b => b.ownerId !== this.playerId && b.ownerId !== 'neutral' && b.typeId === 'base')
    } else if (this.personality === 'macro') {
      if (myOutpostCount === outposts.length && outposts.length > 0) {
        // Holding all outposts — press the base
        target = nearest(b => b.ownerId !== this.playerId && b.ownerId !== 'neutral' && b.typeId === 'base')
      } else {
        // Still building outpost control — ignore base entirely
        target =
          nearest(b => b.typeId === 'outpost' && b.ownerId !== this.playerId && b.ownerId !== 'neutral') ??
          nearest(b => b.typeId === 'outpost' && b.ownerId === 'neutral')
      }
    } else {
      // Balanced: recapture → neutral outpost → base
      target =
        nearest(b => b.typeId === 'outpost' && b.ownerId !== this.playerId && b.ownerId !== 'neutral') ??
        nearest(b => b.typeId === 'outpost' && b.ownerId === 'neutral') ??
        nearest(b => b.ownerId !== this.playerId && b.ownerId !== 'neutral' && b.typeId === 'base')
    }

    if (!target) return

    // Spawn mode decisions (runs after target is known so it can react to what we're targeting)
    // Scout rush: when targeting an outpost, use scouts (they arrive faster)
    const rushingOutpost = target.typeId === 'outpost'
    if (rushingOutpost) {
      if (this.spawnMode !== 'scout') {
        this.spawnMode = 'scout'
        sim.inputQueue.push({ type: 'SET_SPAWN_TYPE', ownerId: this.playerId, speckTypeId: 'scout' })
      }
    } else {
      // Not rushing an outpost — exit scout mode, run normal spawn logic
      if (this.spawnMode === 'scout') {
        this.spawnMode = 'basic'
        sim.inputQueue.push({ type: 'SET_SPAWN_TYPE', ownerId: this.playerId, speckTypeId: 'basic' })
      }
      if (this.personality === 'aggressive') {
        // Aggressive: unpredictable spawn mix — re-evaluate every 8–16 decisions
        this.spawnModeCountdown--
        if (this.spawnModeCountdown <= 0) {
          const next = Math.random() < 0.45 ? 'heavy' : 'basic'
          if (next !== this.spawnMode) {
            this.spawnMode = next
            sim.inputQueue.push({ type: 'SET_SPAWN_TYPE', ownerId: this.playerId, speckTypeId: next })
            if (next === 'heavy') sim.events.push({ type: 'AI_SPAWN_SWITCH', speckTypeId: 'heavy' })
          }
          this.spawnModeCountdown = 8 + Math.floor(Math.random() * 8)
        }
      } else {
        // Balanced + Macro: counter-spawn — mirror player's heavy ratio
        let playerHeavy = 0, playerBasic = 0
        for (let i = 0; i < sim.speckCount; i++) {
          const m = sim.speckMeta[i]
          if (!m || m.ownerId === this.playerId || m.ownerId === 'neutral') continue
          if (m.typeId === 'heavy') playerHeavy++
          else playerBasic++
        }
        const playerTotal = playerHeavy + playerBasic
        const playerHeavyFrac = playerTotal > 0 ? playerHeavy / playerTotal : 0
        const wantHeavy = playerHeavyFrac > 0.55
        const wantBasic = playerHeavyFrac < 0.30
        if (wantHeavy && this.spawnMode !== 'heavy') {
          this.spawnMode = 'heavy'
          sim.inputQueue.push({ type: 'SET_SPAWN_TYPE', ownerId: this.playerId, speckTypeId: 'heavy' })
          sim.events.push({ type: 'AI_SPAWN_SWITCH', speckTypeId: 'heavy' })
        } else if (wantBasic && this.spawnMode !== 'basic') {
          this.spawnMode = 'basic'
          sim.inputQueue.push({ type: 'SET_SPAWN_TYPE', ownerId: this.playerId, speckTypeId: 'basic' })
        }
      }
    }

    sim.inputQueue.push({ type: 'ATTACK_MOVE', ownerId: this.playerId, x: target.x, y: target.y })

    // Expose wave state to sim so HUD can display it
    sim.waveCountdown = this.waveEnabled ? this.waveTimer : null
    sim.waveInProgress = this.waveRemainingMs > 0
  }
}
