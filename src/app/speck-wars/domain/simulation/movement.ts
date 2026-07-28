import type { SimulationState, WallObstacle } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { BUILDING_TYPES } from '../config/building-types'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants'
import { getMusterRadius } from './muster'

function resolveWallCollisions(
  nx: number, ny: number,
  vx: number, vy: number,
  obstacles: WallObstacle[],
  radius: number
): { x: number; y: number; vx: number; vy: number } {
  let rx = nx, ry = ny, rvx = vx, rvy = vy
  for (const obs of obstacles) {
    const left = obs.x - radius
    const right = obs.x + obs.w + radius
    const top = obs.y - radius
    const bottom = obs.y + obs.h + radius
    if (rx < left || rx > right || ry < top || ry > bottom) continue
    // Find minimum penetration axis
    const dLeft   = rx - left
    const dRight  = right - rx
    const dTop    = ry - top
    const dBottom = bottom - ry
    const minH = Math.min(dLeft, dRight)
    const minV = Math.min(dTop, dBottom)
    if (minH <= minV) {
      // Push out horizontally, kill horizontal velocity
      rx += dLeft < dRight ? -dLeft : dRight
      rvx = 0
    } else {
      // Push out vertically, kill vertical velocity
      ry += dTop < dBottom ? -dTop : dBottom
      rvy = 0
    }
  }
  return { x: rx, y: ry, vx: rvx, vy: rvy }
}

const SEPARATION_RADIUS = 8   // px — keep specks this far apart
const SEPARATION_FORCE = 120  // strength of push-apart
const GUARD_BUBBLE = 90              // px — how far a waiting player speck will step off its anchor

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
          {
            const nx = Math.max(0, Math.min(WORLD_WIDTH, speckX[i] + speckVx[i] * dtSec))
            const ny = Math.max(0, Math.min(WORLD_HEIGHT, speckY[i] + speckVy[i] * dtSec))
            const r = resolveWallCollisions(nx, ny, speckVx[i], speckVy[i], sim.obstacles, 4)
            speckX[i] = r.x
            speckY[i] = r.y
            speckVx[i] = r.vx
            speckVy[i] = r.vy
          }
        }
      }
      continue
    }

    // Holding: stay in place; combat.ts still resolves attacks for adjacent enemies
    if (meta.state === 'holding') {
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
      // Attack-move: scan for nearby enemy specks and steer toward them
      // Stagger scan across ticks — each speck rescans every 4 ticks to cut query volume by 75%
      if (meta.attackMoveMode && meta.assignedRallyX !== undefined && (i + sim.tick) % 4 === 0) {
        const ATTACK_MOVE_RANGE = 80  // px
        const amR2 = ATTACK_MOVE_RANGE * ATTACK_MOVE_RANGE
        let closestDist2 = Infinity, closestX = 0, closestY = 0
        const amNeighbors = spatialGrid.query(speckX[i], speckY[i])
        for (const j of amNeighbors) {
          if (i === j || !speckIds[j]) continue
          const jMeta = speckMeta[j]
          if (!jMeta || jMeta.ownerId === meta.ownerId || jMeta.ownerId === 'neutral') continue
          const dx = speckX[j] - speckX[i]
          const dy = speckY[j] - speckY[i]
          const d2 = dx * dx + dy * dy
          if (d2 < amR2 && d2 < closestDist2) {
            closestDist2 = d2
            closestX = speckX[j]
            closestY = speckY[j]
          }
        }
        if (closestDist2 < Infinity) {
          meta.attackMoveTargetX = closestX
          meta.attackMoveTargetY = closestY
        } else {
          meta.attackMoveTargetX = undefined
          meta.attackMoveTargetY = undefined
        }
      }

      const rally = (meta.attackMoveTargetX !== undefined)
        ? { x: meta.attackMoveTargetX, y: meta.attackMoveTargetY! }
        : (meta.assignedRallyX !== undefined)
        ? { x: meta.assignedRallyX, y: meta.assignedRallyY! }
        // Player specks always have assignedRallyX/Y set at spawn — skip global rally for them.
        // AI and other owners may still use the global rally point as a fallback.
        : (meta.ownerId !== 'player' ? sim.rallyPoints[meta.ownerId] : null)
      if (rally) {
        const dx = rally.x - speckX[i]
        const dy = rally.y - speckY[i]
        const dist = Math.sqrt(dx * dx + dy * dy)
        // Attack-move steers at a moving enemy, so only a real rally counts as an anchor to hold.
        const anchored = meta.ownerId === 'player' && meta.attackMoveTargetX === undefined
        // Player specks stop short of the anchor and let separation spread them into a ring,
        // instead of grinding into a single pixel on top of the building or rally flag.
        const stopRadius = anchored ? getMusterRadius(sim, meta) : stype.attackRange

        // Guarding: a player speck standing on its anchor steps out to meet enemies inside a
        // bubble around that anchor. The bubble is measured from the anchor rather than from the
        // speck, so a guard can be drawn a bounded distance off station and never kited away.
        let guarding = false
        if (anchored && dist <= GUARD_BUBBLE) {
          const bubble = GUARD_BUBBLE
          if (dist <= bubble) {
            const bubble2 = bubble * bubble
            let closestDist2 = Infinity, closestX = 0, closestY = 0
            const guardNeighbors = spatialGrid.query(speckX[i], speckY[i])
            for (const j of guardNeighbors) {
              if (i === j || !speckIds[j]) continue
              const jMeta = speckMeta[j]
              if (!jMeta || jMeta.ownerId === meta.ownerId) continue
              const edx = speckX[j] - rally.x
              const edy = speckY[j] - rally.y
              if (edx * edx + edy * edy > bubble2) continue   // outside the bubble — not our fight
              const sdx = speckX[j] - speckX[i]
              const sdy = speckY[j] - speckY[i]
              const d2 = sdx * sdx + sdy * sdy
              if (d2 < closestDist2) { closestDist2 = d2; closestX = speckX[j]; closestY = speckY[j] }
            }
            if (closestDist2 < Infinity) {
              guarding = true
              const d = Math.sqrt(closestDist2)
              if (d > stype.attackRange) {
                ax += ((closestX - speckX[i]) / d) * stype.speed
                ay += ((closestY - speckY[i]) / d) * stype.speed
              }
            }
          }
        }

        if (!guarding && dist > stopRadius) {
          ax += (dx / dist) * stype.speed
          ay += (dy / dist) * stype.speed
        }
      } else {
        // Idle aggression: no target, no rally — pursue nearest enemy speck within detection range

        const AGGRO_RANGE = 80  // fixed flat range for all units
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


    // Simple velocity (no mass — direct velocity override)
    speckVx[i] = ax
    speckVy[i] = ay

    // Integrate position
    {
      const nx = Math.max(0, Math.min(WORLD_WIDTH, speckX[i] + speckVx[i] * dtSec))
      const ny = Math.max(0, Math.min(WORLD_HEIGHT, speckY[i] + speckVy[i] * dtSec))
      const r = resolveWallCollisions(nx, ny, speckVx[i], speckVy[i], sim.obstacles, 4)
      speckX[i] = r.x
      speckY[i] = r.y
      speckVx[i] = r.vx
      speckVy[i] = r.vy
    }
  }
}
