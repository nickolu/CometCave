import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'

const RALLY_ARRIVAL_THRESHOLD = 30   // px — how close before speck is considered "arrived"
const ATTACK_MOVE_PROXIMITY = 100    // px — attack enemy buildings within this range while moving to rally

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

    // If owner has an active rally point and speck hasn't arrived, defer to rally
    const rally = sim.rallyPoints[meta.ownerId]
    if (rally) {
      const dx = rally.x - speckX[i]
      const dy = rally.y - speckY[i]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > RALLY_ARRIVAL_THRESHOLD) {
        // Attack-move: find enemy building within proximity rather than pure move
        let closeTarget: string | null = null
        let closeDist = Infinity
        for (const [bid, building] of Object.entries(buildings)) {
          if (building.ownerId === meta.ownerId) continue   // skip friendly
          if (building.ownerId === 'neutral') continue      // skip neutral — only capture those
          const bdx = building.x - speckX[i]
          const bdy = building.y - speckY[i]
          const bdist = Math.sqrt(bdx * bdx + bdy * bdy)
          if (bdist < ATTACK_MOVE_PROXIMITY && bdist < closeDist) {
            closeDist = bdist
            closeTarget = bid
          }
        }
        meta.targetId = closeTarget  // null = pure move toward rally, non-null = attack en route
        meta.state = 'moving'
        continue
      }
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
