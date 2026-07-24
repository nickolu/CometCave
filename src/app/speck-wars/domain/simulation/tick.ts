import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { updateSpawners } from './spawner'
import { runSpeckAI } from './speck-ai'
import { moveSpecks } from './movement'
import { resolveCombat, removeDeadSpecks } from './combat'
import { checkVictory } from './victory'
import { updateCapture } from './capture'
import { BUILDING_TYPES } from '../config/building-types'
import { HUD_UPDATE_INTERVAL, DOMINATION_TIME } from '../constants'

export function tick(sim: SimulationState, dt: number): SimulationState {
  sim.events = []  // clear outbound events from previous tick

  // 1. Process player/AI input commands
  consumeInputs(sim)

  // 2. Spawn new specks from buildings
  updateSpawners(sim, dt)

  // 3. Each speck picks/validates its target
  runSpeckAI(sim)

  // 4. Move specks + apply separation
  moveSpecks(sim, dt)

  // 5. Deal damage, destroy buildings/specks
  resolveCombat(sim, dt)

  // 6. Remove dead specks (compact arrays)
  removeDeadSpecks(sim)

  // 7. Update outpost capture progress
  updateCapture(sim, dt)

  // 7b. HP regeneration for owned buildings when not under attack
  regenBuildingHp(sim, dt)

  // 7c. Triple outpost bonus — control all 3 outposts = 2× base spawn speed + domination timer
  updateTripleOutpostBonus(sim, dt)

  // 8. Check win/loss
  checkVictory(sim)

  // 9. Emit HUD update every N ticks
  sim.tick++
  if (sim.tick % HUD_UPDATE_INTERVAL === 0) emitHudUpdate(sim)

  return sim
}

function regenBuildingHp(sim: SimulationState, dt: number) {
  const dtSec = dt / 1000
  for (const building of Object.values(sim.buildings)) {
    if (building.hp >= building.maxHp) continue
    if (building.ownerId === 'neutral') continue
    const btype = BUILDING_TYPES[building.typeId]
    if (!btype?.hpRegen) continue
    // No regen while actively being captured
    if (building.captureProgress && building.captureProgress > 0) continue
    building.hp = Math.min(building.maxHp, building.hp + btype.hpRegen * dtSec)
  }
}

function updateTripleOutpostBonus(sim: SimulationState, dt: number) {
  const outposts = Object.values(sim.buildings).filter(b => b.typeId === 'outpost')
  if (outposts.length === 0) return

  let tripleHolder: string | null = null
  for (const [pid] of Object.entries(sim.players)) {
    if (pid === 'neutral') continue
    const ownsAll = outposts.every(o => o.ownerId === pid)
    for (const building of Object.values(sim.buildings)) {
      if (building.ownerId !== pid || building.typeId !== 'base') continue
      building.tripleOutpostBonus = ownsAll
    }
    if (ownsAll) tripleHolder = pid
  }

  if (tripleHolder) {
    sim.dominationTimer += dt
    if (sim.dominationTimer >= DOMINATION_TIME) {
      sim.events.push({ type: 'GAME_OVER', winnerId: tripleHolder, victoryType: 'domination' })
    }
  } else {
    sim.dominationTimer = 0
  }
}

function consumeInputs(sim: SimulationState) {
  for (const event of sim.inputQueue) {
    if (event.type === 'RALLY') {
      sim.rallyPoints[event.ownerId] = { x: event.x, y: event.y }
    }
    if (event.type === 'SET_SPAWN_TYPE') {
      const stype = SPECK_TYPES[event.speckTypeId]
      for (const building of Object.values(sim.buildings)) {
        if (building.ownerId !== event.ownerId || building.typeId !== 'base') continue
        building.spawnTypeOverride = event.speckTypeId
        building.spawnIntervalOverride = stype?.productionTime
      }
    }
  }
  sim.inputQueue = []
}

function emitHudUpdate(sim: SimulationState) {
  const data: Record<string, { speckCount: number; buildingCount: number; buildingHp: Record<string, number>; speckTypes: Record<string, number> }> = {}
  for (const [pid] of Object.entries(sim.players)) {
    const myBuildings = Object.values(sim.buildings).filter(b => b.ownerId === pid)
    let liveCount = 0
    const speckTypes: Record<string, number> = {}
    for (let i = 0; i < sim.speckCount; i++) {
      const m = sim.speckMeta[i]
      if (m && m.ownerId === pid) {
        liveCount++
        speckTypes[m.typeId] = (speckTypes[m.typeId] ?? 0) + 1
      }
    }
    data[pid] = {
      speckCount: liveCount,
      buildingCount: myBuildings.length,
      buildingHp: Object.fromEntries(myBuildings.map(b => [b.id, b.hp])),
      speckTypes,
    }
  }
  // Buildings that are owned but actively being captured by the enemy
  const attackedBuildingIds = Object.values(sim.buildings)
    .filter(b => b.typeId === 'outpost' && b.ownerId !== 'neutral' && b.captureProgress && b.captureProgress > 0 && b.captureSide && b.captureSide !== b.ownerId)
    .map(b => b.id)

  // Which player (if any) owns all outposts and has the triple bonus
  const outposts = Object.values(sim.buildings).filter(b => b.typeId === 'outpost')
  let tripleOutpostOwner: string | null = null
  if (outposts.length > 0) {
    for (const [pid] of Object.entries(sim.players)) {
      if (pid === 'neutral') continue
      if (outposts.every(o => o.ownerId === pid)) { tripleOutpostOwner = pid; break }
    }
  }

  const dominationProgress = tripleOutpostOwner ? Math.min(1, sim.dominationTimer / DOMINATION_TIME) : null

  // Minimap: sample every 8th speck, capped at 300
  const minimapSpecks: Array<{ x: number; y: number; ownerId: string }> = []
  const step = Math.max(1, Math.floor(sim.speckCount / 300)) * 8
  for (let i = 0; i < sim.speckCount && minimapSpecks.length < 300; i += step) {
    const m = sim.speckMeta[i]
    if (m) minimapSpecks.push({ x: sim.speckX[i], y: sim.speckY[i], ownerId: m.ownerId })
  }
  const minimapBuildings = Object.values(sim.buildings).map(b => ({ x: b.x, y: b.y, ownerId: b.ownerId, typeId: b.typeId }))
  const rp = sim.rallyPoints['player']

  sim.events.push({ type: 'HUD_UPDATE', data: { players: data, attackedBuildingIds, tripleOutpostOwner, dominationProgress, minimap: { specks: minimapSpecks, buildings: minimapBuildings, rallyX: rp?.x ?? null, rallyY: rp?.y ?? null } } })
}
