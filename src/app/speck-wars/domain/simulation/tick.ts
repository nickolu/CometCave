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
import { updateTurrets } from './turret'

export function tick(sim: SimulationState, dt: number): SimulationState {
  sim.events = []  // clear outbound events from previous tick

  // 1. Process player/AI input commands
  consumeInputs(sim)

  // 2. Spawn new specks from buildings
  updateSpawners(sim, dt)

  // 2b. Turrets: fire missiles at nearby enemies
  updateTurrets(sim, dt)

  // 3. Each speck picks/validates its target
  runSpeckAI(sim)

  // 4. Move specks + apply separation
  moveSpecks(sim, dt)

  // 5. Deal damage, destroy buildings/specks
  resolveCombat(sim, dt)

  // 5a. Auto-clear selectedBuildingId if the building was destroyed this tick
  if (sim.selectedBuildingId && !sim.buildings[sim.selectedBuildingId]) {
    sim.selectedBuildingId = null
  }

  // 6. Remove dead specks (compact arrays)
  removeDeadSpecks(sim)
  pruneCommandGroups(sim)

  // 7. Update outpost capture progress
  updateCapture(sim, dt)


  // 7b. HP regeneration for owned buildings when not under attack
  regenBuildingHp(sim, dt)

  // 7c. Surge timers
  if (sim.surgeDuration > 0) sim.surgeDuration = Math.max(0, sim.surgeDuration - dt)
  if (sim.surgeCooldown > 0) sim.surgeCooldown = Math.max(0, sim.surgeCooldown - dt)

  // 8. Check win/loss + domination timer
  checkVictory(sim)

  // Domination: hold all 3 outposts for DOMINATION_TIME ms to win
  const outpostsForDom = Object.values(sim.buildings).filter(b => b.typeId === 'outpost')
  let domOwner: string | null = null
  if (outpostsForDom.length > 0) {
    for (const [pid] of Object.entries(sim.players)) {
      if (pid === 'neutral') continue
      if (outpostsForDom.every(o => o.ownerId === pid)) { domOwner = pid; break }
    }
  }
  if (domOwner !== null) {
    sim.dominationTimer += dt
    if (sim.dominationTimer >= DOMINATION_TIME) {
      sim.events.push({ type: 'GAME_OVER', winnerId: domOwner, victoryType: 'domination' })
    }
  } else {
    sim.dominationTimer = 0
  }

  // Survival win: on survival levels, winning enough waves beats the level
  if (sim.survivalWinWaves !== null &&
      sim.waveNumber >= sim.survivalWinWaves &&
      !sim.waveInProgress) {
    sim.events.push({ type: 'GAME_OVER', winnerId: 'player', victoryType: 'survival' })
  }

  // 9. Emit HUD update every N ticks
  sim.tick++
  if (sim.tick % HUD_UPDATE_INTERVAL === 0) emitHudUpdate(sim)

  return sim
}

function regenBuildingHp(sim: SimulationState, dt: number) {
  const dtSec = dt / 1000
  const REGEN_COOLDOWN_MS = 5000
  for (const building of Object.values(sim.buildings)) {
    if (building.hp >= building.maxHp) continue
    if (building.ownerId === 'neutral') continue
    const btype = BUILDING_TYPES[building.typeId]
    if (!btype?.hpRegen) continue
    // No regen while actively being captured
    if (building.captureProgress && building.captureProgress > 0) continue
    // No regen within 5 seconds of last taking damage
    if (Date.now() - (building.lastDamagedAt ?? 0) < REGEN_COOLDOWN_MS) continue
    building.hp = Math.min(building.maxHp, building.hp + btype.hpRegen * dtSec)
  }
}


function consumeInputs(sim: SimulationState) {
  for (const event of sim.inputQueue) {
    if (event.type === 'RALLY') {
      if (event.ownerId === 'player') {
        // Require an explicit selection — bare map click has already been converted to CLEAR_SELECT
        // by the input layer, and Defend/Advance/Rush/Guard only issue RALLY when something is selected.
        if (sim.selectedSpeckIds.size === 0) continue
        sim.nextCommandGroupId++
        const groupId = sim.nextCommandGroupId
        sim.commandGroupRallies.set(groupId, { x: event.x, y: event.y })
        sim.rallyPoints['player-selected'] = { x: event.x, y: event.y }
        for (let i = 0; i < sim.speckCount; i++) {
          const meta = sim.speckMeta[i]
          if (!meta || !sim.speckIds[i] || meta.ownerId !== 'player') continue
          if (!sim.selectedSpeckIds.has(meta.id)) continue
          meta.assignedRallyX = event.x
          meta.assignedRallyY = event.y
          meta.commandGroupId = groupId
          meta.homeBuildingId = undefined
          meta.holdPosition = false
          meta.attackMoveMode = false
        }
      } else {
        // AI (and any non-player owner): keep global rally logic
        sim.rallyPoints[event.ownerId] = { x: event.x, y: event.y }
      }
    }
    if (event.type === 'ATTACK_MOVE') {
      const hasSelection = event.ownerId === 'player' && sim.selectedSpeckIds.size > 0
      if (hasSelection) {
        sim.rallyPoints['player-selected'] = { x: event.x, y: event.y }
        for (let i = 0; i < sim.speckCount; i++) {
          const meta = sim.speckMeta[i]
          if (!meta || !sim.speckIds[i] || !sim.selectedSpeckIds.has(meta.id)) continue
          meta.assignedRallyX = event.x
          meta.assignedRallyY = event.y
          meta.homeBuildingId = undefined
          meta.holdPosition = false
          meta.targetId = null
          meta.state = 'moving'
          meta.attackMoveMode = true
        }
      } else {
        sim.rallyPoints[event.ownerId] = { x: event.x, y: event.y }
        for (let i = 0; i < sim.speckCount; i++) {
          const meta = sim.speckMeta[i]
          if (!meta || !sim.speckIds[i] || meta.ownerId !== event.ownerId) continue
          meta.assignedRallyX = event.x
          meta.assignedRallyY = event.y
          meta.homeBuildingId = undefined
          meta.holdPosition = false
          meta.targetId = null
          meta.state = 'moving'
          meta.attackMoveMode = true
        }
        // Deliberately does NOT repoint every building's rally: an attack-move commits the army
        // that exists now, it does not silently redirect production forever. Spawn destinations
        // are only ever changed by selecting a building (SET_BUILDING_RALLY).
      }
    }
    if (event.type === 'SET_SPAWN_TYPE') {
      const stype = SPECK_TYPES[event.speckTypeId]
      for (const building of Object.values(sim.buildings)) {
        if (building.ownerId !== event.ownerId) continue
        if (building.typeId !== 'base' && building.typeId !== 'outpost') continue
        if (event.buildingId && building.id !== event.buildingId) continue  // skip if targeting specific building
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
      // Mutual exclusion: selecting specks always clears any building selection
      sim.selectedBuildingId = null
    }
    if (event.type === 'CLEAR_SELECT') {
      sim.selectedSpeckIds.clear()
      sim.rallyPoints['player-selected'] = null
      sim.selectedBuildingId = null
    }
    if (event.type === 'SELECT_BUILDING') {
      if (event.ownerId === 'player') {
        sim.selectedBuildingId = event.buildingId
        if (event.buildingId !== null) {
          // Clear speck selection when selecting a building
          sim.selectedSpeckIds.clear()
          sim.rallyPoints['player-selected'] = null
        }
      }
    }
    if (event.type === 'SET_BUILDING_RALLY') {
      const building = sim.buildings[event.buildingId]
      if (!building || building.ownerId !== event.ownerId) continue
      building.rallyPoint = { x: event.x, y: event.y }
      // Everyone still under this building's standing orders — the specks mustered at it plus
      // every future spawn — follows automatically: speck-ai.ts re-reads the rally from
      // homeBuildingId each tick. Specks given a direct order elsewhere have already dropped that
      // link and are deliberately left where the player put them.
    }
    if (event.type === 'SURGE') {
      if (event.ownerId === 'player' && sim.surgeCooldown <= 0) {
        sim.surgeDuration = 8000
        sim.surgeCooldown = 45000
      }
    }
    if (event.type === 'BUILD_TURRET') {
      if (event.ownerId !== 'player') continue
      if (sim.turretBudget <= 0) continue
      // Don't allow placing on top of an existing building (within 60px)
      const tooClose = Object.values(sim.buildings).some(b => {
        const dx = b.x - event.x, dy = b.y - event.y
        return dx * dx + dy * dy < 60 * 60
      })
      if (tooClose) continue
      const turretId = `building-player-turret-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      sim.buildings[turretId] = {
        id: turretId,
        typeId: 'turret',
        ownerId: 'player',
        x: event.x,
        y: event.y,
        hp: 35,
        maxHp: 35,
        spawnTimer: 0,
        fireTimer: 0,
      }
      sim.turretBudget--
    }
    if (event.type === 'STOP') {
      if (event.ownerId === 'player' && sim.selectedSpeckIds.size === 0) continue
      // Stop selected specks: clear their assigned rally and targeting, enter idle
      for (let i = 0; i < sim.speckCount; i++) {
        const meta = sim.speckMeta[i]
        if (!meta || !sim.speckIds[i] || meta.ownerId !== event.ownerId) continue
        const isSelected = sim.selectedSpeckIds.has(meta.id)
        if (sim.selectedSpeckIds.size > 0 && !isSelected) continue
        meta.assignedRallyX = undefined
        meta.assignedRallyY = undefined
        meta.homeBuildingId = undefined  // stop means stop here, not "walk back to your building"
        meta.targetId = null
        meta.holdPosition = false
        meta.attackMoveMode = false
        meta.state = 'idle'
      }
      if (event.ownerId === 'player') {
        sim.rallyPoints['player-selected'] = null
      }
    }
    if (event.type === 'HOLD') {
      if (event.ownerId === 'player' && sim.selectedSpeckIds.size === 0) continue
      // Hold position: selected specks stop and don't attack
      for (let i = 0; i < sim.speckCount; i++) {
        const meta = sim.speckMeta[i]
        if (!meta || !sim.speckIds[i] || meta.ownerId !== event.ownerId) continue
        const isSelected = sim.selectedSpeckIds.has(meta.id)
        if (sim.selectedSpeckIds.size > 0 && !isSelected) continue
        meta.assignedRallyX = undefined
        meta.assignedRallyY = undefined
        meta.homeBuildingId = undefined
        meta.targetId = null
        meta.holdPosition = true
        meta.attackMoveMode = false
        meta.state = 'holding'
      }
      if (event.ownerId === 'player') {
        sim.rallyPoints['player-selected'] = null
      }
    }
  }
  sim.inputQueue = []
}

function emitHudUpdate(sim: SimulationState) {
  const data: Record<string, { speckCount: number; buildingCount: number; buildingHp: Record<string, number>; speckTypes: Record<string, number>; veteranCount: number; eliteCount: number; legendCount: number }> = {}
  for (const [pid] of Object.entries(sim.players)) {
    const myBuildings = Object.values(sim.buildings).filter(b => b.ownerId === pid)
    let liveCount = 0
    let veteranCount = 0, eliteCount = 0, legendCount = 0
    const speckTypes: Record<string, number> = {}
    for (let i = 0; i < sim.speckCount; i++) {
      const m = sim.speckMeta[i]
      if (m && m.ownerId === pid) {
        liveCount++
        speckTypes[m.typeId] = (speckTypes[m.typeId] ?? 0) + 1
        if (m.kills >= 12) legendCount++
        else if (m.kills >= 6) eliteCount++
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
      legendCount,
    }
  }
  // Buildings that are owned but actively being captured by the enemy
  const attackedBuildingIds = Object.values(sim.buildings)
    .filter(b => b.typeId === 'outpost' && b.ownerId !== 'neutral' && b.captureProgress && b.captureProgress > 0 && b.captureSide && b.captureSide !== b.ownerId)
    .map(b => b.id)

  // Capture progress for each outpost
  const outposts = Object.values(sim.buildings).filter(b => b.typeId === 'outpost')
  const captureInfo: Record<string, { progress: number; side: string } | null> = {}
  for (const o of outposts) {
    captureInfo[o.id] = (o.captureProgress && o.captureSide)
      ? { progress: o.captureProgress, side: o.captureSide }
      : null
  }

  // Compute effective spawn rate (specks/min) for each player
  const spawnRates: Record<string, number> = {}
  for (const [pid] of Object.entries(sim.players)) {
    if (pid === 'neutral') continue
    let totalRate = 0
    const hasSurge = pid === 'player' && sim.surgeDuration > 0
    for (const building of Object.values(sim.buildings)) {
      if (building.ownerId !== pid) continue
      const btype = BUILDING_TYPES[building.typeId]
      if (!btype?.spawnTypeId) continue
      const baseInterval = building.spawnIntervalOverride ?? btype.spawnInterval
      const divisor = (hasSurge ? 2 : 1)
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
    aiRallyPoint: sim.rallyPoints['ai'] ?? null,
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

  let enemyAdvanceDetected = false
  const aiBase = sim.buildings['building-ai-base']
  if (playerBase && aiBase) {
    // Midpoint between the two bases — defines "player's half"
    const midX = (playerBase.x + aiBase.x) / 2
    const midY = (playerBase.y + aiBase.y) / 2
    const ADVANCE_THRESHOLD = 15  // enemy specks needed in player half
    let enemySpecksInPlayerHalf = 0
    for (let i = 0; i < sim.speckCount; i++) {
      const m = sim.speckMeta[i]
      if (!m || m.ownerId !== 'ai') continue
      if (sim.speckHp[i] <= 0) continue
      // Is this speck closer to player base than to midpoint?
      const dxP = sim.speckX[i] - playerBase.x
      const dyP = sim.speckY[i] - playerBase.y
      const dxM = sim.speckX[i] - midX
      const dyM = sim.speckY[i] - midY
      if (dxP * dxP + dyP * dyP < dxM * dxM + dyM * dyM) {
        enemySpecksInPlayerHalf++
        if (enemySpecksInPlayerHalf >= ADVANCE_THRESHOLD) { enemyAdvanceDetected = true; break }
      }
    }
  }
  // Suppress "advance" when base is already under direct threat (avoid double-warning)
  if (baseUnderThreat) enemyAdvanceDetected = false

  // Selection composition breakdown
  let selectedComposition: { types: Record<string, number>; veteranCount: number; eliteCount: number; legendCount: number } | null = null
  if (sim.selectedSpeckIds.size > 0) {
    const types: Record<string, number> = {}
    let selVet = 0, selElite = 0, selLegend = 0
    for (let i = 0; i < sim.speckCount; i++) {
      const m = sim.speckMeta[i]
      if (!m || !sim.speckIds[i] || !sim.selectedSpeckIds.has(sim.speckIds[i])) continue
      types[m.typeId] = (types[m.typeId] ?? 0) + 1
      if (m.kills >= 12) selLegend++
      else if (m.kills >= 6) selElite++
      else if (m.kills >= 3) selVet++
    }
    selectedComposition = { types, veteranCount: selVet, eliteCount: selElite, legendCount: selLegend }
  }

  let selectedBuilding: { id: string; typeId: string; ownerId: string; hp: number; maxHp: number; spawnTypeOverride?: string } | null = null
  if (sim.selectedBuildingId) {
    const b = sim.buildings[sim.selectedBuildingId]
    if (b) selectedBuilding = { id: b.id, typeId: b.typeId, ownerId: b.ownerId, hp: b.hp, maxHp: b.maxHp, spawnTypeOverride: b.spawnTypeOverride }
  }

  sim.events.push({ type: 'HUD_UPDATE', data: { players: data, attackedBuildingIds, captureInfo, surgeDuration: sim.surgeDuration, surgeCooldown: sim.surgeCooldown, selectedSpeckCount: sim.selectedSpeckIds.size, selectedComposition, spawnRates, minimap, waveCountdown: sim.waveCountdown, waveInProgress: sim.waveInProgress, waveNumber: sim.waveNumber, baseUnderThreat, enemyAdvanceDetected, selectedBuilding, turretBudget: sim.turretBudget } })
}

function pruneCommandGroups(sim: SimulationState) {
  if (sim.commandGroupRallies.size === 0) return
  const liveGroups = new Set<number>()
  for (let i = 0; i < sim.speckCount; i++) {
    const meta = sim.speckMeta[i]
    if (meta?.commandGroupId !== undefined) liveGroups.add(meta.commandGroupId)
  }
  for (const gid of sim.commandGroupRallies.keys()) {
    if (!liveGroups.has(gid)) sim.commandGroupRallies.delete(gid)
  }
}
