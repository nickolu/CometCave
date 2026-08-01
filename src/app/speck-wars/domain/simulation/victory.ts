import type { SimulationState } from '../types'

export function checkVictory(sim: SimulationState) {
  // Survival mode: AI can't be defeated (no base), player wins by outlasting timer
  if (sim.isSurvival) {
    if (sim.survivalTimeRemaining <= 0 && !sim.waveInProgress) {
      sim.events.push({ type: 'GAME_OVER', winnerId: 'player', victoryType: 'survival' })
    }
    // Check player defeat: player base destroyed
    const playerAlive = Object.values(sim.buildings).some(b => b.ownerId === 'player')
    if (!playerAlive) {
      const player = sim.players['player']
      if (player) player.isDefeated = true
      sim.events.push({ type: 'GAME_OVER', winnerId: 'ai', victoryType: 'destruction' })
    }
    return
  }

  // Normal mode (original logic)
  for (const [pid, player] of Object.entries(sim.players)) {
    if (player.isDefeated) continue
    if (pid === 'neutral') continue  // neutral is never defeated and never wins
    const hasBuildings = Object.values(sim.buildings).some(b => b.ownerId === pid)
    if (!hasBuildings) {
      player.isDefeated = true
    }
  }

  const alive = Object.values(sim.players).filter(p => !p.isDefeated && p.id !== 'neutral')
  if (alive.length === 1) {
    sim.events.push({ type: 'GAME_OVER', winnerId: alive[0].id, victoryType: 'destruction' })
  }
}
