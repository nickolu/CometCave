import type { SimulationState } from '../types'

export function checkVictory(sim: SimulationState) {
  for (const [pid, player] of Object.entries(sim.players)) {
    if (player.isDefeated) continue
    const hasBuildings = Object.values(sim.buildings).some(b => b.ownerId === pid)
    if (!hasBuildings) {
      player.isDefeated = true
    }
  }

  const alive = Object.values(sim.players).filter(p => !p.isDefeated)
  if (alive.length === 1) {
    sim.events.push({ type: 'GAME_OVER', winnerId: alive[0].id })
  }
}
