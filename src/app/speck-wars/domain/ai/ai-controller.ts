import type { SimulationState, InputEvent, BuildingEntity } from '../types'

export class AIController {
  private playerId: string
  private tickInterval: number
  private readonly baseTickInterval: number
  private lastDecisionTick: number = 0
  private aggressive: boolean  // true = Hard/Brutal: every 4th decision rushes base
  private decisionCount: number = 0
  private spawnMode: 'basic' | 'heavy' = 'basic'
  private spawnModeCountdown: number = 0  // ticks until next spawn mode decision
  private dominanceTimer: number = 0  // ms enemy has held a 3:1 count advantage

  constructor(playerId: string, tickInterval: number = 30, aggressive = false) {
    this.playerId = playerId
    this.tickInterval = tickInterval
    this.baseTickInterval = tickInterval
    this.aggressive = aggressive
  }

  update(sim: SimulationState, dt: number = 16) {
    // Adaptive difficulty: if the enemy holds a 3:1 speck advantage for 30s, speed up AI decisions
    let aiCount = 0, enemyCount = 0
    for (let i = 0; i < sim.speckCount; i++) {
      if (!sim.speckIds[i]) continue
      const m = sim.speckMeta[i]
      if (!m) continue
      if (m.ownerId === this.playerId) aiCount++
      else if (m.ownerId !== 'neutral') enemyCount++
    }
    if (enemyCount >= 3 * aiCount && aiCount > 0) {
      this.dominanceTimer += dt
      if (this.dominanceTimer > 30000) {
        // Enemy has dominated for 30s — reduce tick interval by 25% (floor at 75% of base)
        const floor = Math.max(Math.floor(this.baseTickInterval * 0.75), 4)
        this.tickInterval = Math.max(Math.floor(this.tickInterval * 0.75), floor)
      }
    } else {
      this.dominanceTimer = 0
      this.tickInterval = this.baseTickInterval
    }

    if (sim.tick - this.lastDecisionTick < this.tickInterval) return
    this.lastDecisionTick = sim.tick

    if (sim.players[this.playerId]?.isDefeated) return

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

    // Counter-spawn (non-aggressive only): mirror player's heavy ratio
    if (!this.aggressive) {
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
      } else if (wantBasic && this.spawnMode !== 'basic') {
        this.spawnMode = 'basic'
        sim.inputQueue.push({ type: 'SET_SPAWN_TYPE', ownerId: this.playerId, speckTypeId: 'basic' })
      }
    }

    // Hard/Brutal mode: vary spawn type to add unpredictability
    if (this.aggressive) {
      this.spawnModeCountdown--
      if (this.spawnModeCountdown <= 0) {
        // 40% chance to switch to heavy, 60% stay/go basic
        const next = Math.random() < 0.4 ? 'heavy' : 'basic'
        if (next !== this.spawnMode) {
          this.spawnMode = next
          sim.inputQueue.push({ type: 'SET_SPAWN_TYPE', ownerId: this.playerId, speckTypeId: next })
        }
        this.spawnModeCountdown = 8 + Math.floor(Math.random() * 8)  // re-evaluate in 8–16 decisions
      }
    }

    // Emergency: detect if the enemy (player) is about to win by domination
    const outposts = Object.values(sim.buildings).filter(b => b.typeId === 'outpost')
    const enemyId = Object.keys(sim.players).find(pid => pid !== this.playerId) ?? null
    const enemyHasAllOutposts = enemyId !== null && outposts.length > 0 && outposts.every(o => o.ownerId === enemyId)
    // If enemy has all outposts, temporarily halve decision interval to react faster
    if (enemyHasAllOutposts) {
      this.tickInterval = Math.max(Math.floor(this.baseTickInterval * 0.5), 2)
    } else if (this.dominanceTimer === 0) {
      // Only restore base interval if not already tracking dominance-timer speedup
      this.tickInterval = this.baseTickInterval
    }

    // Hard mode: every 4th decision, rush player base directly (pressure waves)
    // Exception: never base-rush during enemy domination threat — must recapture
    const forceBaseRush = this.aggressive && this.decisionCount % 4 === 0 && !enemyHasAllOutposts

    // Defensive rally: when AI base is low HP, sometimes pull back to defend
    const myBaseHpFrac = (myBase?.hp ?? 100) / (myBase?.maxHp ?? 100)
    if (!forceBaseRush && myBaseHpFrac < 0.6 && myBase) {
      // Aggressive AI defends reluctantly; easy/medium AI defends more readily
      const defendChance = this.aggressive
        ? (myBaseHpFrac < 0.3 ? 0.35 : 0.15)
        : (myBaseHpFrac < 0.3 ? 0.70 : 0.45)
      if (Math.random() < defendChance) {
        sim.inputQueue.push({ type: 'RALLY', ownerId: this.playerId, x: myBase.x, y: myBase.y })
        return
      }
    }

    // Priority 1 (always): recapture player-held outpost
    // Priority 2: capture neutral outpost
    // Priority 3: attack enemy base
    // Hard mode override: directly rush base on pressure-wave ticks
    const target = forceBaseRush
      ? nearest(b => b.ownerId !== this.playerId && b.ownerId !== 'neutral' && b.typeId === 'base')
      : (
          nearest(b => b.typeId === 'outpost' && b.ownerId !== this.playerId && b.ownerId !== 'neutral') ??
          nearest(b => b.typeId === 'outpost' && b.ownerId === 'neutral') ??
          nearest(b => b.ownerId !== this.playerId && b.ownerId !== 'neutral' && b.typeId === 'base')
        )

    if (!target) return

    sim.inputQueue.push({ type: 'RALLY', ownerId: this.playerId, x: target.x, y: target.y })
  }
}
