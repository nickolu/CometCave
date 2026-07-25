import type { SimulationState } from '../types'

export function updateConstruction(sim: SimulationState, dt: number) {
  for (const building of Object.values(sim.buildings)) {
    if (!building.underConstruction) continue

    const sacrificeRadius = 40
    const required = building.sacrificeRequired ?? 0

    if ((building.sacrificeArrived ?? 0) < required) {
      // Absorb specks that have arrived at the construction site
      for (let i = 0; i < sim.speckCount; i++) {
        if (!sim.speckIds[i]) continue
        const meta = sim.speckMeta[i]
        if (!meta || meta.constructTargetId !== building.id) continue
        const dx = sim.speckX[i] - building.x
        const dy = sim.speckY[i] - building.y
        if (dx * dx + dy * dy > sacrificeRadius * sacrificeRadius) continue
        // Sacrifice this speck
        sim.speckHp[i] = 0  // mark for removal
        building.sacrificeArrived = (building.sacrificeArrived ?? 0) + 1
        sim.events.push({
          type: 'SPECK_DIED',
          speckId: meta.id, x: sim.speckX[i], y: sim.speckY[i],
          killedOwnerId: building.ownerId, killerOwnerId: building.ownerId,
        })
      }
    }

    // Once all specks have arrived, start the construction timer
    if ((building.sacrificeArrived ?? 0) >= required) {
      if (building.constructionTimer === undefined) {
        building.constructionTimer = 2000  // 2s build animation
      }
    }

    if (building.constructionTimer !== undefined && building.constructionTimer > 0) {
      building.constructionTimer = Math.max(0, building.constructionTimer - dt)
      if (building.constructionTimer === 0) {
        building.underConstruction = false
        sim.events.push({ type: 'CONSTRUCTION_COMPLETE', buildingId: building.id, x: building.x, y: building.y })
      }
    }
  }
}
