import type { SimulationState, SpeckMeta } from '../types'
import { BUILDING_TYPES } from '../config/building-types'
import { SPECK_TYPES } from '../config/speck-types'
import { MAX_SPECKS } from '../constants'

let missileCounter = 0

function spawnMissile(sim: SimulationState, bx: number, by: number, ownerId: string, targetId: string) {
  const meta: SpeckMeta = {
    id: `missile-${++missileCounter}`,
    typeId: 'missile',
    ownerId,
    state: 'moving',
    targetId: null,
    attackCooldown: 0,
    kills: 0,
    missionTargetId: targetId,
  }
  const hp = SPECK_TYPES['missile']?.hp ?? 1
  let slot: number
  if (sim.freeSlots.length > 0) {
    slot = sim.freeSlots.pop()!
  } else if (sim.speckCount < MAX_SPECKS) {
    slot = sim.speckCount++
  } else {
    return  // at capacity, skip missile
  }
  sim.speckX[slot] = bx
  sim.speckY[slot] = by
  sim.speckVx[slot] = 0
  sim.speckVy[slot] = 0
  sim.speckHp[slot] = hp
  sim.speckIds[slot] = meta.id
  sim.speckMeta[slot] = meta
}

export function updateTurrets(sim: SimulationState, dt: number) {
  for (const building of Object.values(sim.buildings)) {
    if (building.typeId !== 'turret') continue
    if (building.ownerId === 'neutral') continue

    const btype = BUILDING_TYPES['turret']
    const fireInterval = btype.fireInterval ?? 1200
    const attackRange = btype.attackRange ?? 220

    building.fireTimer = (building.fireTimer ?? 0) - dt
    if (building.fireTimer > 0) continue
    building.fireTimer = fireInterval

    // Find nearest enemy speck in range
    let nearestId: string | null = null
    let nearestDist = Infinity
    for (let i = 0; i < sim.speckCount; i++) {
      if (!sim.speckIds[i]) continue
      const meta = sim.speckMeta[i]
      if (!meta || meta.ownerId === building.ownerId || meta.typeId === 'missile') continue
      const dx = sim.speckX[i] - building.x
      const dy = sim.speckY[i] - building.y
      const d2 = dx * dx + dy * dy
      if (d2 <= attackRange * attackRange) {
        const dist = Math.sqrt(d2)
        if (dist < nearestDist) {
          nearestDist = dist
          nearestId = sim.speckIds[i]
        }
      }
    }
    if (!nearestId) continue
    spawnMissile(sim, building.x, building.y, building.ownerId, nearestId)
  }
}
