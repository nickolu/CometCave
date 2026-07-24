import type { SimulationState, InputEvent, BuildingEntity } from '../types'

export class AIController {
  private playerId: string
  private tickInterval: number
  private lastDecisionTick: number = 0
  private aggressive: boolean  // true = Hard mode: every 4th decision rushes base
  private decisionCount: number = 0

  constructor(playerId: string, tickInterval: number = 30, aggressive = false) {
    this.playerId = playerId
    this.tickInterval = tickInterval
    this.aggressive = aggressive
  }

  update(sim: SimulationState) {
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

    // Hard mode: every 4th decision, rush player base directly (pressure waves)
    const forceBaseRush = this.aggressive && this.decisionCount % 4 === 0

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
