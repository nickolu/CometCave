import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { WORLD_WIDTH, WORLD_HEIGHT, OUTPOST_AURA_RADIUS } from '../constants'

const SEPARATION_RADIUS = 8   // px — keep specks this far apart
const SEPARATION_FORCE = 120  // strength of push-apart
const AURA_SPEED_MULT = 1.35  // 35% speed boost inside outpost aura

export function moveSpecks(sim: SimulationState, dt: number) {
  const { speckIds, speckX, speckY, speckVx, speckVy, speckMeta, buildings, spatialGrid } = sim
  const dtSec = dt / 1000

  // Cache outpost positions once per tick (only 3 buildings, negligible cost)
  const outposts = Object.values(buildings).filter(b => b.typeId === 'outpost')

  // Rebuild grid with current positions before applying separation
  spatialGrid.clear()
  for (let i = 0; i < sim.speckCount; i++) {
    if (speckIds[i]) spatialGrid.insert(i, speckX[i], speckY[i])
  }

  for (let i = 0; i < sim.speckCount; i++) {
    if (!speckIds[i]) continue
    const meta = speckMeta[i]
    if (!meta) continue
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

    // Outpost speed aura: boost movement if inside a friendly outpost's aura
    if (ax !== 0 || ay !== 0) {
      const auraR2 = OUTPOST_AURA_RADIUS * OUTPOST_AURA_RADIUS
      for (const building of outposts) {
        if (building.ownerId !== meta.ownerId) continue
        const bdx = speckX[i] - building.x
        const bdy = speckY[i] - building.y
        if (bdx * bdx + bdy * bdy < auraR2) {
          ax *= AURA_SPEED_MULT
          ay *= AURA_SPEED_MULT
          break
        }
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
