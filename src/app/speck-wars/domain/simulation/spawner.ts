import type { SimulationState, SpeckMeta } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { BUILDING_TYPES } from '../config/building-types'
import { MAX_SPECKS, RALLY_CRY_HP_THRESHOLD, CREEP_CAMP_DEFENDER_COUNT, CREEP_CAMP_BOOST_MULT } from '../constants'

// Place a new speck into a recycled or fresh slot — never allocates new arrays
function addSpeck(sim: SimulationState, meta: SpeckMeta, x: number, y: number, buildingId: string) {
  const baseHp = SPECK_TYPES[meta.typeId]?.hp ?? 1
  const upgradeHpBonus = (sim.players[meta.ownerId]?.upgradeLevel ?? 0) >= 2 ? 1 : 0
  const carapaceBonus = (sim.players[meta.ownerId]?.outpostUpgrades?.carapace) ? 1 : 0
  const hp = (baseHp + upgradeHpBonus + carapaceBonus)

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

export function spawnCampDefenders(sim: SimulationState, campId: string) {
  const camp = sim.buildings[campId]
  if (!camp) return
  for (let i = 0; i < CREEP_CAMP_DEFENDER_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / CREEP_CAMP_DEFENDER_COUNT
    const r = 30
    const sx = camp.x + Math.cos(angle) * r
    const sy = camp.y + Math.sin(angle) * r
    const meta: SpeckMeta = {
      id: `speck-${++speckCounter}`,
      typeId: 'defender',
      ownerId: 'neutral',
      state: 'idle',
      targetId: null,
      attackCooldown: 0,
      kills: 0,
      assignedRallyX: camp.x,
      assignedRallyY: camp.y,
    }
    addSpeck(sim, meta, sx, sy, campId)
  }
}

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
    const upgradeSpawnBonus = sim.players[building.ownerId]?.upgradeLevel && sim.players[building.ownerId].upgradeLevel >= 1 ? 1.1 : 1
    const hasCampBoost = (sim.players[building.ownerId]?.creepCampBoostMs ?? 0) > 0
    const divisor = (building.tripleOutpostBonus ? 2 : 1) * (hasSurge ? 2 : 1) * (hasRallyCry ? 1.5 : 1) * upgradeSpawnBonus * (hasCampBoost ? CREEP_CAMP_BOOST_MULT : 1)
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
