import type { SimulationState, SpeckMeta } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { BUILDING_TYPES } from '../config/building-types'

// Resize all SOA arrays by 1 and insert a new speck at the end
function addSpeck(sim: SimulationState, meta: SpeckMeta, x: number, y: number) {
  const n = sim.speckIds.length

  // Grow Float32Arrays
  const newX = new Float32Array(n + 1); newX.set(sim.speckX); newX[n] = x
  const newY = new Float32Array(n + 1); newY.set(sim.speckY); newY[n] = y
  const newVx = new Float32Array(n + 1); newVx.set(sim.speckVx); newVx[n] = 0
  const newVy = new Float32Array(n + 1); newVy.set(sim.speckVy); newVy[n] = 0
  const newHp = new Float32Array(n + 1); newHp.set(sim.speckHp)
  newHp[n] = SPECK_TYPES[meta.typeId]?.hp ?? 1

  sim.speckX = newX; sim.speckY = newY
  sim.speckVx = newVx; sim.speckVy = newVy; sim.speckHp = newHp
  sim.speckIds.push(meta.id)
  sim.speckMeta.push(meta)

  sim.events.push({ type: 'SPECK_SPAWNED', speckId: meta.id, buildingId: '' })
}

let speckCounter = 0

export function updateSpawners(sim: SimulationState, dt: number) {
  for (const building of Object.values(sim.buildings)) {
    const btype = BUILDING_TYPES[building.typeId]
    if (!btype?.spawnTypeId) continue
    if (sim.players[building.ownerId]?.isDefeated) continue

    building.spawnTimer -= dt
    if (building.spawnTimer > 0) continue

    building.spawnTimer = btype.spawnInterval

    for (let i = 0; i < btype.spawnCount; i++) {
      // Spawn just outside the building radius with slight random offset
      const angle = Math.random() * Math.PI * 2
      const radius = btype.size + 8
      const sx = building.x + Math.cos(angle) * radius
      const sy = building.y + Math.sin(angle) * radius

      const meta: SpeckMeta = {
        id: `speck-${++speckCounter}`,
        typeId: btype.spawnTypeId!,
        ownerId: building.ownerId,
        state: 'idle',
        targetId: null,
        attackCooldown: 0,
      }
      addSpeck(sim, meta, sx, sy)
    }
  }
}
