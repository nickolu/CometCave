import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { BUILDING_TYPES } from '../config/building-types'

export function resolveCombat(sim: SimulationState, dt: number) {
  const { speckIds, speckX, speckY, speckHp, speckMeta, buildings, spatialGrid } = sim

  // --- Speck vs Speck combat ---
  for (let i = 0; i < sim.speckCount; i++) {
    if (!speckIds[i]) continue
    if (speckHp[i] <= 0) continue
    const meta = speckMeta[i]
    if (!meta) continue
    const stype = SPECK_TYPES[meta.typeId]
    if (!stype) continue

    if (meta.attackCooldown > 0) {
      meta.attackCooldown -= dt
      continue
    }

    const neighbors = spatialGrid.query(speckX[i], speckY[i])
    for (const j of neighbors) {
      if (i === j || speckHp[j] <= 0) continue
      const jMeta = speckMeta[j]
      if (!jMeta || jMeta.ownerId === meta.ownerId) continue  // dead slot or friendly

      const dx = speckX[j] - speckX[i]
      const dy = speckY[j] - speckY[i]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= stype.attackRange) {
        speckHp[j] -= stype.damage
        meta.attackCooldown = stype.attackCooldown
        meta.state = 'attacking'
        if (speckHp[j] <= 0) {
          sim.events.push({ type: 'SPECK_DIED', speckId: speckIds[j], x: speckX[j], y: speckY[j], killedOwnerId: jMeta.ownerId, killerOwnerId: meta.ownerId })
        }
        break  // one attack per cooldown
      }
    }
  }

  // --- Speck vs Building combat ---
  for (let i = 0; i < sim.speckCount; i++) {
    if (!speckIds[i]) continue
    if (speckHp[i] <= 0) continue
    const meta = speckMeta[i]
    if (!meta) continue
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
        for (let k = 0; k < sim.speckCount; k++) {
          const m = sim.speckMeta[k]
          if (m && m.targetId === building.id) m.targetId = null
        }
      }
    }
  }
}

// Mark dead specks and push their slots onto the free-list — no array allocation
export function removeDeadSpecks(sim: SimulationState) {
  for (let i = 0; i < sim.speckCount; i++) {
    if (sim.speckIds[i] !== '' && sim.speckHp[i] <= 0) {
      sim.freeSlots.push(i)
      sim.speckIds[i] = ''
      sim.speckMeta[i] = null
    }
  }
}
