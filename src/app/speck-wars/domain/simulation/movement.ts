import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants'

const SEPARATION_RADIUS = 8   // px — keep specks this far apart
const SEPARATION_FORCE = 120  // strength of push-apart

export function moveSpecks(sim: SimulationState, dt: number) {
  const { speckIds, speckX, speckY, speckVx, speckVy, speckMeta, buildings, spatialGrid } = sim
  const dtSec = dt / 1000

  // Rebuild grid with current positions before applying separation
  spatialGrid.clear()
  for (let i = 0; i < speckIds.length; i++) {
    spatialGrid.insert(i, speckX[i], speckY[i])
  }

  for (let i = 0; i < speckIds.length; i++) {
    const meta = speckMeta[i]
    const stype = SPECK_TYPES[meta.typeId]
    if (!stype) continue

    let ax = 0, ay = 0

    // Seek target
    if (meta.targetId) {
      const target = buildings[meta.targetId]
      if (target) {
        const dx = target.x - speckX[i]
        const dy = target.y - speckY[i]
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > stype.attackRange) {
          ax += (dx / dist) * stype.speed
          ay += (dy / dist) * stype.speed
        }
      }
    } else {
      const rally = sim.rallyPoints[meta.ownerId]
      if (rally) {
        const dx = rally.x - speckX[i]
        const dy = rally.y - speckY[i]
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > stype.attackRange) {
          ax += (dx / dist) * stype.speed
          ay += (dy / dist) * stype.speed
        }
      }
    }

    // Separation from nearby specks (same owner to avoid interleaving)
    const neighbors = spatialGrid.query(speckX[i], speckY[i])
    for (const j of neighbors) {
      if (i === j) continue
      const dx = speckX[i] - speckX[j]
      const dy = speckY[i] - speckY[j]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < SEPARATION_RADIUS && dist > 0) {
        const force = (SEPARATION_RADIUS - dist) / SEPARATION_RADIUS * SEPARATION_FORCE
        ax += (dx / dist) * force
        ay += (dy / dist) * force
      }
    }

    // Simple velocity (no mass — direct velocity override)
    speckVx[i] = ax
    speckVy[i] = ay

    // Integrate position
    speckX[i] = Math.max(0, Math.min(WORLD_WIDTH, speckX[i] + speckVx[i] * dtSec))
    speckY[i] = Math.max(0, Math.min(WORLD_HEIGHT, speckY[i] + speckVy[i] * dtSec))
  }
}
