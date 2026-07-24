import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { BUILDING_TYPES } from '../config/building-types'

const MORALE_RATIO = 2.0   // if your count > this × enemy count → morale bonus
const MORALE_BONUS = 1.20  // 20% damage boost when morale is active
const RAGE_HP_THRESHOLD = 0.15  // base HP fraction below which rage activates
const RAGE_BONUS = 1.40         // 40% damage boost when base is critical

export function resolveCombat(sim: SimulationState, dt: number) {
  const { speckIds, speckX, speckY, speckHp, speckMeta, buildings, spatialGrid } = sim

  // Compute morale multiplier: owner whose count > 2× all enemies gets +20% damage
  const speckCountByOwner: Record<string, number> = {}
  for (let i = 0; i < sim.speckCount; i++) {
    const ownerId = speckMeta[i]?.ownerId
    if (speckIds[i] && ownerId) speckCountByOwner[ownerId] = (speckCountByOwner[ownerId] ?? 0) + 1
  }
  const moraleMult = (ownerId: string): number => {
    const myCount = speckCountByOwner[ownerId] ?? 0
    let maxEnemyCount = 0
    for (const [id, n] of Object.entries(speckCountByOwner)) {
      if (id !== ownerId && id !== 'neutral' && n > maxEnemyCount) maxEnemyCount = n
    }
    const moraleBonus = (maxEnemyCount > 0 && myCount > MORALE_RATIO * maxEnemyCount) ? MORALE_BONUS : 1.0

    // Rage: if this owner's base is at critical HP, deal 40% more damage (desperation)
    const base = Object.values(buildings).find(b => b.ownerId === ownerId && b.typeId === 'base')
    const rageBonus = (base && base.hp / base.maxHp < RAGE_HP_THRESHOLD) ? RAGE_BONUS : 1.0

    return Math.max(moraleBonus, rageBonus)  // apply highest active bonus (don't stack)
  }

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
        speckHp[j] -= stype.damage * moraleMult(meta.ownerId)
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
      building.hp -= stype.damage * moraleMult(meta.ownerId)
      meta.attackCooldown = stype.attackCooldown
      sim.events.push({ type: 'BUILDING_DAMAGED', buildingId: building.id, hp: building.hp })

      if (building.hp <= 0) {
        sim.events.push({ type: 'BUILDING_DESTROYED', buildingId: building.id, ownerId: building.ownerId, x: building.x, y: building.y })
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
      const deadId = sim.speckIds[i]  // save before clearing
      sim.selectedSpeckIds.delete(deadId)
      sim.freeSlots.push(i)
      sim.speckIds[i] = ''
      sim.speckMeta[i] = null
    }
  }
}
