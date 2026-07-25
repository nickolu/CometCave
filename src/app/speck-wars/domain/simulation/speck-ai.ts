import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'

const RALLY_ARRIVAL_THRESHOLD = 30   // px — how close before speck is considered "arrived"
const ATTACK_MOVE_PROXIMITY = 100    // px — attack enemy buildings within this range while moving to rally
const DEFENDER_PRIORITY_RANGE = 100 // px — clear enemy specks this close before attacking buildings

export function runSpeckAI(sim: SimulationState) {
  const { speckIds, speckX, speckY, speckMeta, buildings } = sim

  for (let i = 0; i < sim.speckCount; i++) {
    if (!speckIds[i]) continue
    const meta = speckMeta[i]
    if (!meta) continue
    const stype = SPECK_TYPES[meta.typeId]
    if (!stype) continue

    // Missile: home directly toward mission target
    if (meta.typeId === 'missile' && meta.missionTargetId) {
      let ti = -1
      for (let j = 0; j < sim.speckCount; j++) {
        if (sim.speckIds[j] === meta.missionTargetId) { ti = j; break }
      }
      if (ti === -1) {
        // Target dead — missile self-destructs
        sim.speckHp[i] = 0
      } else {
        meta.state = 'moving'
        meta.targetId = null
        meta.assignedRallyX = sim.speckX[ti]
        meta.assignedRallyY = sim.speckY[ti]
      }
      continue
    }

    // Construction march: selected specks march to construction site
    if (meta.constructTargetId) {
      const target = buildings[meta.constructTargetId]
      if (!target || !target.underConstruction) {
        meta.constructTargetId = null
      } else {
        meta.state = 'moving'
        meta.assignedRallyX = target.x
        meta.assignedRallyY = target.y
      }
      continue
    }

    // Clear dead or invalid targets
    if (meta.targetId && !buildings[meta.targetId]) {
      meta.targetId = null
    }

    // Hold position flag: don't move or attack
    if (meta.holdPosition) {
      meta.state = 'idle'
      meta.targetId = null
      continue
    }

    // Holding specks: don't move or pursue, but attack enemies within melee range
    if (meta.state === 'holding') {
      const HOLD_ATTACK_RANGE = 20  // px — only attack enemies that are literally adjacent
      let adjacentEnemy: string | null = null
      let adjacentDist = Infinity
      for (let j = 0; j < sim.speckCount; j++) {
        if (!speckIds[j] || j === i) continue
        const jMeta = speckMeta[j]
        if (!jMeta || jMeta.ownerId === meta.ownerId) continue
        const dx = speckX[j] - speckX[i]
        const dy = speckY[j] - speckY[i]
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < HOLD_ATTACK_RANGE && dist < adjacentDist) {
          adjacentDist = dist
          adjacentEnemy = speckIds[j]
        }
      }
      // Stay holding — movement.ts will not move 'holding' specks; combat handles adjacency
      meta.targetId = null  // no building targets while holding
      // If an enemy is adjacent, transition to attacking briefly; otherwise remain holding
      if (adjacentEnemy) {
        meta.state = 'attacking'
      }
      continue
    }

    // Selection-aware rally: selected player specks use 'player-selected' rally;
    // unselected specks with an active selection use no rally (auto-target)
    const getEffectiveRally = () => {
      if (meta.ownerId !== 'player') return sim.rallyPoints[meta.ownerId]
      // Individual sub-group rally takes priority — persists across deselection
      if (meta.assignedRallyX !== undefined && meta.assignedRallyY !== undefined) {
        return { x: meta.assignedRallyX, y: meta.assignedRallyY }
      }
      const hasSelection = sim.selectedSpeckIds.size > 0
      if (!hasSelection) return sim.rallyPoints['player']
      const isSelected = sim.selectedSpeckIds.has(meta.id)
      if (isSelected) return sim.rallyPoints['player-selected'] ?? sim.rallyPoints['player']
      return null  // unselected specks: no rally, auto-target normally
    }
    const rally = getEffectiveRally()

    // If owner has an active rally point and speck hasn't arrived, defer to rally
    if (rally) {
      const dx = rally.x - speckX[i]
      const dy = rally.y - speckY[i]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > RALLY_ARRIVAL_THRESHOLD) {
        // Attack-move: find enemy building within proximity rather than pure move
        let closeTarget: string | null = null
        let closeDist = Infinity
        for (const [bid, building] of Object.entries(buildings)) {
          if (building.ownerId === meta.ownerId) continue   // skip friendly
          if (building.ownerId === 'neutral') continue      // skip neutral — only capture those
          const bdx = building.x - speckX[i]
          const bdy = building.y - speckY[i]
          const bdist = Math.sqrt(bdx * bdx + bdy * bdy)
          if (bdist < ATTACK_MOVE_PROXIMITY && bdist < closeDist) {
            closeDist = bdist
            closeTarget = bid
          }
        }
        meta.targetId = closeTarget  // null = pure move toward rally, non-null = attack en route
        meta.state = 'moving'
        continue
      }
      // Arrived at individual rally — clear assignment so speck reverts to normal AI
      if (meta.assignedRallyX !== undefined) {
        meta.assignedRallyX = undefined
        meta.assignedRallyY = undefined
      }
    }

    // Defender priority: if enemy specks are within range, fight them before attacking buildings
    // This ensures specks clear defenders instead of running past them to hit the structure
    let nearestEnemySpeckDist = Infinity
    for (let j = 0; j < sim.speckCount; j++) {
      if (!speckIds[j] || j === i) continue
      const jMeta = speckMeta[j]
      if (!jMeta || jMeta.ownerId === meta.ownerId) continue
      const dx = speckX[j] - speckX[i]
      const dy = speckY[j] - speckY[i]
      const dist = dx * dx + dy * dy  // squared — avoid sqrt for perf
      if (dist < nearestEnemySpeckDist) nearestEnemySpeckDist = dist
    }
    if (nearestEnemySpeckDist < DEFENDER_PRIORITY_RANGE * DEFENDER_PRIORITY_RANGE) {
      meta.targetId = null  // engage defenders via idle aggression in movement.ts
      meta.state = 'idle'
      continue
    }

    if (meta.targetId) continue  // already has a valid target

    // Find nearest enemy building
    let nearest: string | null = null
    let nearestDist = Infinity

    for (const [_bid, building] of Object.entries(buildings)) {
      if (building.ownerId === meta.ownerId) continue  // skip friendly
      const dx = building.x - speckX[i]
      const dy = building.y - speckY[i]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = _bid
      }
    }

    // Scout specks prefer outpost targets — they're too fragile to assault the enemy base
    // but excel at rapid outpost capturing. Override the nearest target with the nearest
    // non-friendly outpost if one exists.
    if (meta.typeId === 'scout') {
      let outpostNearest: string | null = null
      let outpostNearestDist = Infinity
      for (const [bid, building] of Object.entries(buildings)) {
        if (building.typeId !== 'outpost') continue
        if (building.ownerId === meta.ownerId) continue
        const odx = building.x - speckX[i]
        const ody = building.y - speckY[i]
        const odist = Math.sqrt(odx * odx + ody * ody)
        if (odist < outpostNearestDist) { outpostNearestDist = odist; outpostNearest = bid }
      }
      if (outpostNearest) nearest = outpostNearest
    }

    meta.targetId = nearest
    meta.state = nearest ? 'moving' : 'idle'
  }
}
