import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'

const GARRISON_RANGE = 180           // px — garrison fire range
const GARRISON_FIRE_INTERVAL = 1000  // ms per shot
const GARRISON_DAMAGE_MULT = 0.75    // 75% of base damage

export function updateGarrison(sim: SimulationState, dt: number) {
  for (const building of Object.values(sim.buildings)) {
    const garrison = building.garrisonedSpeckIds
    if (!garrison || garrison.length === 0) continue

    // Tick building fire timer
    building.fireTimer = (building.fireTimer ?? GARRISON_FIRE_INTERVAL) - dt
    if (building.fireTimer > 0) continue
    building.fireTimer = GARRISON_FIRE_INTERVAL

    // Each garrisoned speck fires one shot at nearest enemy within range
    for (const garrisonedId of garrison) {
      // Find the garrisoned speck's meta to get its damage
      let garrisonedMeta = null
      for (let i = 0; i < sim.speckCount; i++) {
        if (sim.speckMeta[i]?.id === garrisonedId) {
          garrisonedMeta = sim.speckMeta[i]
          break
        }
      }
      if (!garrisonedMeta) continue
      const stype = SPECK_TYPES[garrisonedMeta.typeId]
      if (!stype) continue

      // Find nearest enemy within range
      let nearestDist2 = GARRISON_RANGE * GARRISON_RANGE
      let nearestI = -1
      for (let i = 0; i < sim.speckCount; i++) {
        if (!sim.speckIds[i]) continue
        const m = sim.speckMeta[i]
        if (!m || m.ownerId === building.ownerId || m.ownerId === 'neutral') continue
        if (m.isGarrisoned) continue
        const dx = sim.speckX[i] - building.x
        const dy = sim.speckY[i] - building.y
        const d2 = dx * dx + dy * dy
        if (d2 < nearestDist2) { nearestDist2 = d2; nearestI = i }
      }

      if (nearestI < 0) continue
      const player = sim.players[building.ownerId]
      const bladesBonus = player?.outpostUpgrades?.blades ? 1.15 : 1.0
      const veteranBonus = garrisonedMeta.kills >= 12 ? 1.50 : garrisonedMeta.kills >= 6 ? 1.35 : garrisonedMeta.kills >= 3 ? 1.20 : 1.0
      const damage = stype.damage * GARRISON_DAMAGE_MULT * bladesBonus * veteranBonus
      sim.speckHp[nearestI] -= damage
    }
  }
}
