import type { SimulationState, InputEvent } from '../types'

export class AIController {
  private playerId: string
  private tickInterval: number  // how often AI makes decisions (every N ticks)
  private lastDecisionTick: number = 0

  constructor(playerId: string, tickInterval: number = 30) {
    this.playerId = playerId
    this.tickInterval = tickInterval
  }

  // Called once per sim tick — pushes InputEvents into sim.inputQueue
  update(sim: SimulationState) {
    if (sim.tick - this.lastDecisionTick < this.tickInterval) return
    this.lastDecisionTick = sim.tick

    if (sim.players[this.playerId]?.isDefeated) return

    // Find the player's nearest base to rally toward
    const enemyBase = Object.values(sim.buildings).find(
      b => b.ownerId !== this.playerId
    )
    if (!enemyBase) return

    // Rally all AI specks toward the enemy base
    const rally: InputEvent = {
      type: 'RALLY',
      ownerId: this.playerId,
      x: enemyBase.x,
      y: enemyBase.y,
    }
    sim.inputQueue.push(rally)
  }
}
