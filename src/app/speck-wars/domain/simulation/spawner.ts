import type { SimulationState, SpeckMeta } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { BUILDING_TYPES } from '../config/building-types'
import { MAX_SPECKS, RALLY_CRY_HP_THRESHOLD } from '../constants'

// Place a new speck into a recycled or fresh slot — never allocates new arrays
function addSpeck(sim: SimulationState, meta: SpeckMeta, x: number, y: number, buildingId: string) {
  const hp = SPECK_TYPES[meta.typeId]?.hp ?? 1

  let slot: number
  if (sim.freeSlots.length > 0) {
    slot = sim.freeSlots.pop()!
  } else if (sim.speckCount < MAX_SPECKS) {
    slot = sim.speckCount
    sim.speckCount++
  } else {
    return  // at capacity, drop spawn
  }

  sim.speckX[slot] = x
  sim.speckY[slot] = y
  sim.speckVx[slot] = 0
  sim.speckVy[slot] = 0
  sim.speckHp[slot] = hp
  sim.speckIds[slot] = meta.id
  sim.speckMeta[slot] = meta

  sim.events.push({ type: 'SPECK_SPAWNED', speckId: meta.id, buildingId })
}

let speckCounter = 0

export function updateSpawners(sim: SimulationState, dt: number) {
  // Rally Cry: player base at critical HP spawns 1.5× faster (desperation comeback bonus)
  const playerBase = Object.values(sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
  const rallyCryActive = playerBase ? playerBase.hp / playerBase.maxHp < RALLY_CRY_HP_THRESHOLD : false

  for (const building of Object.values(sim.buildings)) {
    if (building.ownerId === 'neutral') continue
    const btype = BUILDING_TYPES[building.typeId]
    if (!btype?.spawnTypeId) continue
    if (sim.players[building.ownerId]?.isDefeated) continue

    building.spawnTimer -= dt
    if (building.spawnTimer > 0) continue

    const baseInterval = building.spawnIntervalOverride ?? btype.spawnInterval
    const hasSurge = building.ownerId === 'player' && sim.surgeDuration > 0
    const hasRallyCry = building.ownerId === 'player' && rallyCryActive
    const divisor = (building.tripleOutpostBonus ? 2 : 1) * (hasSurge ? 2 : 1) * (hasRallyCry ? 1.5 : 1)
    building.spawnTimer = baseInterval / divisor

    for (let i = 0; i < btype.spawnCount; i++) {
      // Spawn just outside the building radius with slight random offset
      const angle = Math.random() * Math.PI * 2
      const radius = btype.size + 8
      const sx = building.x + Math.cos(angle) * radius
      const sy = building.y + Math.sin(angle) * radius

      const meta: SpeckMeta = {
        id: `speck-${++speckCounter}`,
        typeId: building.spawnTypeOverride ?? btype.spawnTypeId!,
        ownerId: building.ownerId,
        state: 'idle',
        targetId: null,
        attackCooldown: 0,
        kills: 0,
      }
      // Auto-assign the building's per-building rally point so the speck marches there on spawn
      const sourceBuildingRally = building.rallyPoint
      if (sourceBuildingRally) {
        meta.assignedRallyX = sourceBuildingRally.x
        meta.assignedRallyY = sourceBuildingRally.y
      }
      addSpeck(sim, meta, sx, sy, building.id)
    }
  }
}
