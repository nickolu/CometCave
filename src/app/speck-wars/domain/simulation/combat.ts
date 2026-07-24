import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { BUILDING_TYPES } from '../config/building-types'

export function resolveCombat(sim: SimulationState, dt: number) {
  const { speckIds, speckX, speckY, speckHp, speckMeta, buildings, spatialGrid } = sim

  // --- Speck vs Speck combat ---
  for (let i = 0; i < speckIds.length; i++) {
    if (speckHp[i] <= 0) continue
    const meta = speckMeta[i]
    const stype = SPECK_TYPES[meta.typeId]
    if (!stype) continue

    if (meta.attackCooldown > 0) {
      meta.attackCooldown -= dt
      continue
    }

    const neighbors = spatialGrid.query(speckX[i], speckY[i])
    for (const j of neighbors) {
      if (i === j || speckHp[j] <= 0) continue
      if (speckMeta[j].ownerId === meta.ownerId) continue  // friendly

      const dx = speckX[j] - speckX[i]
      const dy = speckY[j] - speckY[i]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= stype.attackRange) {
        speckHp[j] -= stype.damage
        meta.attackCooldown = stype.attackCooldown
        meta.state = 'attacking'
        if (speckHp[j] <= 0) {
          sim.events.push({ type: 'SPECK_DIED', speckId: speckIds[j], x: speckX[j], y: speckY[j] })
        }
        break  // one attack per cooldown
      }
    }
  }

  // --- Speck vs Building combat ---
  for (let i = 0; i < speckIds.length; i++) {
    if (speckHp[i] <= 0) continue
    const meta = speckMeta[i]
    if (!meta.targetId) continue
    const building = buildings[meta.targetId]
    if (!building) continue

    const stype = SPECK_TYPES[meta.typeId]
    if (!stype || meta.attackCooldown > 0) continue

    const dx = building.x - speckX[i]
    const dy = building.y - speckY[i]
    const dist = Math.sqrt(dx * dx + dy * dy)
    const btype = BUILDING_TYPES[building.typeId]
    const attackDist = (btype?.size ?? 20) + stype.attackRange

    if (dist <= attackDist) {
      building.hp -= stype.damage
      meta.attackCooldown = stype.attackCooldown
      sim.events.push({ type: 'BUILDING_DAMAGED', buildingId: building.id, hp: building.hp })

      if (building.hp <= 0) {
        sim.events.push({ type: 'BUILDING_DESTROYED', buildingId: building.id, ownerId: building.ownerId })
        delete sim.buildings[building.id]
        // Clear target for all specks pointing at this building
        for (const m of sim.speckMeta) {
          if (m.targetId === building.id) m.targetId = null
        }
      }
    }
  }
}

// Remove dead specks — compact all SOA arrays in one pass
export function removeDeadSpecks(sim: SimulationState) {
  const alive: number[] = []
  for (let i = 0; i < sim.speckIds.length; i++) {
    if (sim.speckHp[i] > 0) alive.push(i)
  }

  if (alive.length === sim.speckIds.length) return  // nothing to remove

  const n = alive.length
  const newX = new Float32Array(n)
  const newY = new Float32Array(n)
  const newVx = new Float32Array(n)
  const newVy = new Float32Array(n)
  const newHp = new Float32Array(n)
  const newIds: string[] = []
  const newMeta: SimulationState['speckMeta'] = []

  for (let j = 0; j < alive.length; j++) {
    const i = alive[j]
    newX[j] = sim.speckX[i]; newY[j] = sim.speckY[i]
    newVx[j] = sim.speckVx[i]; newVy[j] = sim.speckVy[i]
    newHp[j] = sim.speckHp[i]
    newIds.push(sim.speckIds[i])
    newMeta.push(sim.speckMeta[i])
  }

  sim.speckX = newX; sim.speckY = newY
  sim.speckVx = newVx; sim.speckVy = newVy; sim.speckHp = newHp
  sim.speckIds = newIds; sim.speckMeta = newMeta
}
