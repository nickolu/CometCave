import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { updateSpawners, spawnCampDefenders } from './spawner'
import { runSpeckAI } from './speck-ai'
import { moveSpecks } from './movement'
import { resolveCombat, removeDeadSpecks } from './combat'
import { checkVictory } from './victory'
import { updateCapture } from './capture'
import { BUILDING_TYPES } from '../config/building-types'
import { HUD_UPDATE_INTERVAL, CREEP_CAMP_ZONE_RADIUS, DOMINATION_TIME } from '../constants'
import { updateConstruction } from './construction'
import { updateTurrets } from './turret'

export function tick(sim: SimulationState, dt: number): SimulationState {
  sim.events = []  // clear outbound events from previous tick

  // 1. Process player/AI input commands
  consumeInputs(sim)

  // 2. Spawn new specks from buildings
  updateSpawners(sim, dt)

  // 2a. Construction: absorb sacrificing specks, count down build timer
  updateConstruction(sim, dt)

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

  // 5c. Heal retreating specks that have reached a friendly building
  regenRetreatingSpecks(sim, dt)


  // 6. Remove dead specks (compact arrays)
  removeDeadSpecks(sim)

  // 7. Update outpost capture progress
  updateCapture(sim, dt)

  // 7a-pre. Creep camp timers: boost decay, camp reset
  updateCreepCamps(sim, dt)

  // 7b. HP regeneration for owned buildings when not under attack
  regenBuildingHp(sim, dt)

  // 7c. Surge timers
  if (sim.surgeDuration > 0) sim.surgeDuration = Math.max(0, sim.surgeDuration - dt)
  if (sim.surgeCooldown > 0) sim.surgeCooldown = Math.max(0, sim.surgeCooldown - dt)
  if (sim.sacrificeCooldown > 0) sim.sacrificeCooldown = Math.max(0, sim.sacrificeCooldown - dt)

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

  // 9. Emit HUD update every N ticks
  sim.tick++
  if (sim.tick % HUD_UPDATE_INTERVAL === 0) emitHudUpdate(sim)

  return sim
}

function regenRetreatingSpecks(sim: SimulationState, dt: number) {
  const dtSec = dt / 1000
  const REGEN_RATE = 2  // HP per second while sheltering at base
  const REENGAGE_THRESHOLD = 0.75  // re-engage when HP is at 75% of max

  for (let i = 0; i < sim.speckCount; i++) {
    const meta = sim.speckMeta[i]
    if (!meta || meta.state !== 'retreating') continue
    if (sim.speckHp[i] <= 0) continue

    // Only heal if within range of a friendly building
    let nearFriendly = false
    for (const building of Object.values(sim.buildings)) {
      if (building.ownerId !== meta.ownerId) continue
      const bsize = BUILDING_TYPES[building.typeId]?.size ?? 40
      const dx = sim.speckX[i] - building.x
      const dy = sim.speckY[i] - building.y
      if (dx * dx + dy * dy <= (bsize + 30) * (bsize + 30)) {
        nearFriendly = true
        break
      }
    }

    if (!nearFriendly) continue

    const maxHp = SPECK_TYPES[meta.typeId]?.hp ?? 1
    sim.speckHp[i] = Math.min(maxHp, sim.speckHp[i] + REGEN_RATE * dtSec)

    // Re-engage once healed enough
    if (sim.speckHp[i] >= maxHp * REENGAGE_THRESHOLD) {
      meta.state = 'idle'
    }
  }
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

function updateCreepCamps(sim: SimulationState, dt: number) {
  // Tick boost timers for all players
  for (const player of Object.values(sim.players)) {
    if (player.creepCampBoostMs > 0) {
      player.creepCampBoostMs = Math.max(0, player.creepCampBoostMs - dt)
    }
  }

  // Tick camp reset timers and handle reset
  for (const building of Object.values(sim.buildings)) {
    if (building.typeId !== 'creep_camp') continue
    if (building.ownerId === 'neutral') continue
    if ((building.campResetMs ?? 0) <= 0) continue
    building.campResetMs = (building.campResetMs ?? 0) - dt
    if (building.campResetMs <= 0) {
      building.campResetMs = 0
      sim.events.push({ type: 'CAMP_RESET', campId: building.id, previousOwner: building.ownerId })
      building.ownerId = 'neutral'
      building.hp = building.maxHp
      building.captureProgress = 0
      building.captureSide = undefined
      spawnCampDefenders(sim, building.id)
    }
  }

  // Leash defenders: pull back defenders that have strayed too far from their camp
  const leashR2 = CREEP_CAMP_ZONE_RADIUS * CREEP_CAMP_ZONE_RADIUS
  for (let i = 0; i < sim.speckCount; i++) {
    const meta = sim.speckMeta[i]
    if (!meta || meta.typeId !== 'defender') continue
    if (meta.assignedRallyX === undefined || meta.assignedRallyY === undefined) continue
    const dx = sim.speckX[i] - meta.assignedRallyX
    const dy = sim.speckY[i] - meta.assignedRallyY
    const dist2 = dx * dx + dy * dy
    if (dist2 > leashR2 * 2.25) {  // > 1.5× leash radius
      // Force the speck to return to camp
      meta.state = 'moving'
      meta.targetId = null
    }
  }
}

function consumeInputs(sim: SimulationState) {
  for (const event of sim.inputQueue) {
    if (event.type === 'RALLY') {
      if (event.ownerId === 'player') {
        // With a selection this moves that group; with none it is an army-wide order from the
        // Defend / Advance / Rush / Guard verbs. A bare map click never gets here — game-instance
        // drops it when nothing is selected, so specks are never moved by accident.
        const useSelection = sim.selectedSpeckIds.size > 0
        sim.rallyPoints['player-selected'] = useSelection ? { x: event.x, y: event.y } : null
        for (let i = 0; i < sim.speckCount; i++) {
          const meta = sim.speckMeta[i]
          if (!meta || !sim.speckIds[i] || meta.ownerId !== 'player') continue
          if (useSelection && !sim.selectedSpeckIds.has(meta.id)) continue
          meta.assignedRallyX = event.x
          meta.assignedRallyY = event.y
          meta.homeBuildingId = undefined  // a direct order outranks the spawn building's rally
          meta.holdPosition = false  // clear hold when a new rally is issued
          meta.attackMoveMode = false  // normal move cancels attack-move
        }
      } else {
        // AI (and any non-player owner): keep global rally logic
        sim.rallyPoints[event.ownerId] = { x: event.x, y: event.y }
      }
      // Player with no selection: do nothing — player rally is per-building only (SET_BUILDING_RALLY)
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
    if (event.type === 'STOP') {
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
    if (event.type === 'BUILD') {
      const btype = BUILDING_TYPES[event.buildingTypeId]
      if (!btype) continue
      const sacrificeCost = btype.sacrificeCost ?? 0
      // Count how many player specks are selected (or all if no selection)
      let selectedCount = 0
      const useSelection = sim.selectedSpeckIds.size > 0
      for (let i = 0; i < sim.speckCount; i++) {
        if (!sim.speckIds[i]) continue
        const m = sim.speckMeta[i]
        if (!m || m.ownerId !== event.ownerId) continue
        if (useSelection && !sim.selectedSpeckIds.has(m.id)) continue
        selectedCount++
      }
      if (selectedCount < sacrificeCost) continue  // not enough specks
      // Create the construction site
      const buildId = `building-${event.ownerId}-turret-${sim.tick}`
      sim.buildings[buildId] = {
        id: buildId,
        typeId: event.buildingTypeId,
        ownerId: event.ownerId,
        x: event.x, y: event.y,
        hp: btype.maxHp, maxHp: btype.maxHp,
        spawnTimer: 0,
        underConstruction: true,
        sacrificeRequired: sacrificeCost,
        sacrificeArrived: 0,
      }
      // Send selected (or all) specks to march
      let sent = 0
      for (let i = 0; i < sim.speckCount; i++) {
        if (sent >= sacrificeCost) break
        if (!sim.speckIds[i]) continue
        const m = sim.speckMeta[i]
        if (!m || m.ownerId !== event.ownerId) continue
        if (useSelection && !sim.selectedSpeckIds.has(m.id)) continue
        m.constructTargetId = buildId
        m.assignedRallyX = event.x
        m.assignedRallyY = event.y
        m.homeBuildingId = undefined
        m.holdPosition = false
        sent++
      }
      // Clear selection after dispatching
      sim.selectedSpeckIds.clear()
      sim.rallyPoints['player-selected'] = null
    }
    if (event.type === 'SET_STANCE') {
      const p = sim.players[event.ownerId]
      if (p) p.stance = event.stance
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
      sim.sacrificeCooldown = 20000
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

  sim.events.push({ type: 'HUD_UPDATE', data: { players: data, attackedBuildingIds, captureInfo, surgeDuration: sim.surgeDuration, surgeCooldown: sim.surgeCooldown, selectedSpeckCount: sim.selectedSpeckIds.size, selectedComposition, spawnRates, minimap, dailyModifier: sim.dailyModifier, waveCountdown: sim.waveCountdown, waveInProgress: sim.waveInProgress, waveNumber: sim.waveNumber, sacrificeCooldown: sim.sacrificeCooldown, baseUnderThreat, enemyAdvanceDetected, creepCampBoostMs: sim.players['player']?.creepCampBoostMs ?? 0, selectedBuilding } })
}
