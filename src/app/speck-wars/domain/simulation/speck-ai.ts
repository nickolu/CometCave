import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'

export function runSpeckAI(sim: SimulationState) {
  const { speckIds, speckX, speckY, speckMeta, buildings } = sim

  for (let i = 0; i < sim.speckCount; i++) {
    if (!speckIds[i]) continue
    const meta = speckMeta[i]
    if (!meta) continue
    const stype = SPECK_TYPES[meta.typeId]
    if (!stype) continue

    // Clear dead or invalid targets
    if (meta.targetId && !buildings[meta.targetId]) {
      meta.targetId = null
    }

    if (meta.targetId) continue  // already has a valid target

    // Find nearest enemy building
    let nearest: string | null = null
    let nearestDist = Infinity

    for (const [_bid, building] of Object.entries(buildings)) {
      if (building.ownerId === meta.ownerId) continue  // skip friendly
      const dx = building.x - speckX[i]
      const dy = building.y - speckY[i]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = _bid
      }
    }

    meta.targetId = nearest
    meta.state = nearest ? 'moving' : 'idle'
  }
}
