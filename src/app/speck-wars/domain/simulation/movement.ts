import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { BUILDING_TYPES } from '../config/building-types'
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

    // Retreating: flee to nearest friendly building
    if (meta.state === 'retreating') {
      let nearestBuilding = null
      let nearestDist2 = Infinity
      for (const b of Object.values(buildings)) {
        if (b.ownerId !== meta.ownerId) continue
        const dx = b.x - speckX[i]
        const dy = b.y - speckY[i]
        const d2 = dx * dx + dy * dy
        if (d2 < nearestDist2) {
          nearestDist2 = d2
          nearestBuilding = b
        }
      }
      if (nearestBuilding) {
        const btype = BUILDING_TYPES[nearestBuilding.typeId]
        const bRadius = btype?.size ?? 20
        if (nearestDist2 <= bRadius * bRadius) {
          // Retreating specks: stop movement, let regenRetreatingSpecks handle idle transition
          sim.speckVx[i] = 0
          sim.speckVy[i] = 0
        } else {
          const dist = Math.sqrt(nearestDist2)
          const dx = nearestBuilding.x - speckX[i]
          const dy = nearestBuilding.y - speckY[i]
          speckVx[i] = (dx / dist) * stype.speed
          speckVy[i] = (dy / dist) * stype.speed
          speckX[i] = Math.max(0, Math.min(WORLD_WIDTH, speckX[i] + speckVx[i] * dtSec))
          speckY[i] = Math.max(0, Math.min(WORLD_HEIGHT, speckY[i] + speckVy[i] * dtSec))
        }
      }
      continue
    }

    // Hold position flag: stay in place, don't pursue (even idle aggression)
    if (meta.holdPosition) {
      speckVx[i] = 0
      speckVy[i] = 0
      continue
    }


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
      const rally = (meta.assignedRallyX !== undefined)
        ? { x: meta.assignedRallyX, y: meta.assignedRallyY! }
        : sim.rallyPoints[meta.ownerId]
      if (rally) {
        const dx = rally.x - speckX[i]
        const dy = rally.y - speckY[i]
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > stype.attackRange) {
          ax += (dx / dist) * stype.speed
          ay += (dy / dist) * stype.speed
        }
      } else {
        // Idle aggression: no target, no rally — pursue nearest enemy speck within detection range
        const AGGRO_RANGE = 150  // px
        const aggroR2 = AGGRO_RANGE * AGGRO_RANGE
        let closestDist2 = Infinity, closestX = 0, closestY = 0
        const neighbors = spatialGrid.query(speckX[i], speckY[i])
        for (const j of neighbors) {
          if (i === j || !speckIds[j]) continue
          const jMeta = speckMeta[j]
          if (!jMeta || jMeta.ownerId === meta.ownerId) continue
          const dx = speckX[j] - speckX[i]
          const dy = speckY[j] - speckY[i]
          const d2 = dx * dx + dy * dy
          if (d2 < aggroR2 && d2 < closestDist2) {
            closestDist2 = d2
            closestX = speckX[j]
            closestY = speckY[j]
          }
        }
        if (closestDist2 < Infinity) {
          const dist = Math.sqrt(closestDist2)
          if (dist > stype.attackRange) {
            ax += ((closestX - speckX[i]) / dist) * stype.speed
            ay += ((closestY - speckY[i]) / dist) * stype.speed
          }
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
