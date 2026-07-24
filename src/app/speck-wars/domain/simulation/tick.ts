import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { updateSpawners } from './spawner'
import { runSpeckAI } from './speck-ai'
import { moveSpecks } from './movement'
import { resolveCombat, removeDeadSpecks } from './combat'
import { checkVictory } from './victory'
import { updateCapture } from './capture'
import { BUILDING_TYPES } from '../config/building-types'
import { HUD_UPDATE_INTERVAL, DOMINATION_TIME, RALLY_CRY_HP_THRESHOLD, FORTIFY_TIME } from '../constants'

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

  // 5b. Mark low-HP specks as retreating
  for (let i = 0; i < sim.speckCount; i++) {
    const meta = sim.speckMeta[i]
    if (!meta || sim.speckHp[i] <= 0) continue
    if (meta.state === 'retreating') continue  // already retreating
    const maxHp = SPECK_TYPES[meta.typeId]?.hp ?? 1
    if (sim.speckHp[i] / maxHp < 0.25) {
      meta.state = 'retreating'
      meta.targetId = null
    }
  }

  // 6. Remove dead specks (compact arrays)
  removeDeadSpecks(sim)

  // 7. Update outpost capture progress
  updateCapture(sim, dt)

  // 7a. Fortification: outposts held continuously accumulate a combat bonus
  for (const building of Object.values(sim.buildings)) {
    if (building.typeId !== 'outpost') continue
    if (building.ownerId === 'neutral') { building.fortifyDuration = 0; continue }
    // Pause fortification while actively under capture
    const underCapture = (building.captureProgress ?? 0) > 0 && building.captureSide && building.captureSide !== building.ownerId
    if (underCapture) continue
    building.fortifyDuration = Math.min(FORTIFY_TIME, (building.fortifyDuration ?? 0) + dt)
  }

  // 7b. HP regeneration for owned buildings when not under attack
  regenBuildingHp(sim, dt)

  // 7c. Triple outpost bonus — control all 3 outposts = 2× base spawn speed + domination timer
  updateTripleOutpostBonus(sim, dt)

  // 7d. Surge timers
  if (sim.surgeDuration > 0) sim.surgeDuration = Math.max(0, sim.surgeDuration - dt)
  if (sim.surgeCooldown > 0) sim.surgeCooldown = Math.max(0, sim.surgeCooldown - dt)
  if (sim.sacrificeCooldown > 0) sim.sacrificeCooldown = Math.max(0, sim.sacrificeCooldown - dt)

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
      const hasSelection = event.ownerId === 'player' && sim.selectedSpeckIds.size > 0
      if (hasSelection) {
        sim.rallyPoints['player-selected'] = { x: event.x, y: event.y }
      } else {
        sim.rallyPoints[event.ownerId] = { x: event.x, y: event.y }
      }
    }
    if (event.type === 'SET_SPAWN_TYPE') {
      const stype = SPECK_TYPES[event.speckTypeId]
      for (const building of Object.values(sim.buildings)) {
        if (building.ownerId !== event.ownerId || building.typeId !== 'base') continue
        building.spawnTypeOverride = event.speckTypeId
        building.spawnIntervalOverride = stype?.productionTime
      }
    }
    if (event.type === 'BOX_SELECT') {
      // Select player specks in world bounding box
      const { x1, y1, x2, y2 } = event
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
      sim.selectedSpeckIds.clear()
      for (let i = 0; i < sim.speckCount; i++) {
        const meta = sim.speckMeta[i]
        if (!meta || meta.ownerId !== event.ownerId) continue
        if (!sim.speckIds[i]) continue
        if (sim.speckX[i] >= minX && sim.speckX[i] <= maxX &&
            sim.speckY[i] >= minY && sim.speckY[i] <= maxY) {
          sim.selectedSpeckIds.add(meta.id)
        }
      }
      // Selected specks initially use the same rally as unselected
      sim.rallyPoints['player-selected'] = sim.rallyPoints['player']
    }
    if (event.type === 'CLEAR_SELECT') {
      sim.selectedSpeckIds.clear()
      sim.rallyPoints['player-selected'] = null
    }
    if (event.type === 'SURGE') {
      if (event.ownerId === 'player' && sim.surgeCooldown <= 0) {
        sim.surgeDuration = 8000
        sim.surgeCooldown = 45000
      }
    }
    if (event.type === 'SACRIFICE') {
      if (sim.sacrificeCooldown > 0) continue
      const building = sim.buildings[event.buildingId]
      if (!building || building.ownerId !== event.ownerId || building.typeId !== 'base') continue
      // Collect player specks, sorted by lowest HP first (weakest give their life)
      const candidates: Array<{ i: number; hp: number }> = []
      for (let i = 0; i < sim.speckCount; i++) {
        if (!sim.speckIds[i]) continue
        const m = sim.speckMeta[i]
        if (!m || m.ownerId !== event.ownerId) continue
        candidates.push({ i, hp: sim.speckHp[i] })
      }
      if (candidates.length < event.count) continue  // not enough specks
      candidates.sort((a, b) => a.hp - b.hp)
      const toSacrifice = candidates.slice(0, event.count)
      for (const { i } of toSacrifice) {
        sim.events.push({ type: 'SPECK_DIED', speckId: sim.speckIds[i], x: sim.speckX[i], y: sim.speckY[i], killedOwnerId: event.ownerId, killerOwnerId: event.ownerId })
        sim.speckHp[i] = 0  // mark for removeDeadSpecks
      }
      building.hp = Math.min(building.maxHp, building.hp + event.count * 1.5)  // 10 specks → +15 HP
      sim.sacrificeCooldown = 45000
    }
  }
  sim.inputQueue = []
}

function emitHudUpdate(sim: SimulationState) {
  const data: Record<string, { speckCount: number; buildingCount: number; buildingHp: Record<string, number>; speckTypes: Record<string, number>; veteranCount: number; eliteCount: number }> = {}
  for (const [pid] of Object.entries(sim.players)) {
    const myBuildings = Object.values(sim.buildings).filter(b => b.ownerId === pid)
    let liveCount = 0
    let veteranCount = 0, eliteCount = 0
    const speckTypes: Record<string, number> = {}
    for (let i = 0; i < sim.speckCount; i++) {
      const m = sim.speckMeta[i]
      if (m && m.ownerId === pid) {
        liveCount++
        speckTypes[m.typeId] = (speckTypes[m.typeId] ?? 0) + 1
        if (m.kills >= 6) eliteCount++
        else if (m.kills >= 3) veteranCount++
      }
    }
    data[pid] = {
      speckCount: liveCount,
      buildingCount: myBuildings.length,
      buildingHp: Object.fromEntries(myBuildings.map(b => [b.id, b.hp])),
      speckTypes,
      veteranCount,
      eliteCount,
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

  // Capture progress for each outpost
  const captureInfo: Record<string, { progress: number; side: string } | null> = {}
  for (const o of outposts) {
    captureInfo[o.id] = (o.captureProgress && o.captureSide)
      ? { progress: o.captureProgress, side: o.captureSide }
      : null
  }

  // Compute effective spawn rate (specks/min) for each player
  const playerBaseBuilding = Object.values(sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
  const rallyCryActive = playerBaseBuilding
    ? playerBaseBuilding.hp / playerBaseBuilding.maxHp < RALLY_CRY_HP_THRESHOLD
    : false

  const spawnRates: Record<string, number> = {}
  for (const [pid] of Object.entries(sim.players)) {
    if (pid === 'neutral') continue
    let totalRate = 0
    const hasSurge = pid === 'player' && sim.surgeDuration > 0
    const hasRallyCry = pid === 'player' && rallyCryActive
    for (const building of Object.values(sim.buildings)) {
      if (building.ownerId !== pid) continue
      const btype = BUILDING_TYPES[building.typeId]
      if (!btype?.spawnTypeId) continue
      const baseInterval = building.spawnIntervalOverride ?? btype.spawnInterval
      const divisor = (building.tripleOutpostBonus ? 2 : 1) * (hasSurge ? 2 : 1) * (hasRallyCry ? 1.5 : 1)
      const effectiveInterval = baseInterval / divisor
      totalRate += (btype.spawnCount ?? 1) * 60000 / effectiveInterval
    }
    spawnRates[pid] = Math.round(totalRate)
  }

  // Mini-map data: downsampled specks + all buildings + rally point
  const minimapBuildings = Object.values(sim.buildings).map(b => ({
    id: b.id, x: b.x, y: b.y, ownerId: b.ownerId, typeId: b.typeId,
  }))
  const step = Math.max(1, Math.ceil(sim.speckCount / 400))
  const minimapSpecks: { x: number; y: number; ownerId: string }[] = []
  for (let i = 0; i < sim.speckCount; i += step) {
    const meta = sim.speckMeta[i]
    if (meta && sim.speckHp[i] > 0) {
      minimapSpecks.push({ x: sim.speckX[i], y: sim.speckY[i], ownerId: meta.ownerId })
    }
  }
  const minimap = {
    specks: minimapSpecks,
    buildings: minimapBuildings,
    rallyPoint: sim.rallyPoints['player'] ?? null,
  }

  const outpostFortify: Record<string, number> = {}
  for (const building of Object.values(sim.buildings)) {
    if (building.typeId !== 'outpost') continue
    outpostFortify[building.id] = Math.min(1, (building.fortifyDuration ?? 0) / FORTIFY_TIME)
  }

  let baseUnderThreat = false
  const playerBase = Object.values(sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
  if (playerBase) {
    const threatRange = 280
    for (let i = 0; i < sim.speckCount; i++) {
      const m = sim.speckMeta[i]
      if (!m || m.ownerId !== 'ai') continue
      if (sim.speckHp[i] <= 0) continue
      const dx = sim.speckX[i] - playerBase.x
      const dy = sim.speckY[i] - playerBase.y
      if (dx * dx + dy * dy <= threatRange * threatRange) { baseUnderThreat = true; break }
    }
  }

  sim.events.push({ type: 'HUD_UPDATE', data: { players: data, attackedBuildingIds, tripleOutpostOwner, dominationProgress, captureInfo, surgeDuration: sim.surgeDuration, surgeCooldown: sim.surgeCooldown, selectedSpeckCount: sim.selectedSpeckIds.size, spawnRates, minimap, outpostFortify, dailyModifier: sim.dailyModifier, waveCountdown: sim.waveCountdown, waveInProgress: sim.waveInProgress, sacrificeCooldown: sim.sacrificeCooldown, baseUnderThreat } })
}
