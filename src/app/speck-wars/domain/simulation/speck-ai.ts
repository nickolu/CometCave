import type { SimulationState } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { getHomeBuilding, getMusterRadius } from './muster'

const RALLY_ARRIVAL_THRESHOLD = 30   // px — how close before speck is considered "arrived"
const ATTACK_MOVE_PROXIMITY = 100    // px — attack enemy buildings within this range while moving to rally
const DEFENDER_PRIORITY_RANGE = 100 // px — clear enemy specks this close before attacking buildings
const GUARD_ENGAGE_RANGE = 130      // px — a waiting player speck attacks enemy buildings this close.
                                    // Wider than ATTACK_MOVE_PROXIMITY so a group rallied onto an
                                    // enemy structure keeps hitting it after it stops marching.

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

    // Clear dead or invalid targets (also clear if building changed to friendly ownership)
    if (meta.targetId && (!buildings[meta.targetId] || buildings[meta.targetId].ownerId === meta.ownerId)) {
      meta.targetId = null
    }

    // Hold position flag: force state to 'holding' so movement.ts keeps them stationary,
    // then fall through to the 'holding' block to handle adjacent attacks
    if (meta.holdPosition) {
      meta.state = 'holding'
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

    // Rally resolution.
    //  - A player speck still under standing orders reads its home building's rally live, so
    //    changing that rally redirects everyone waiting there on the next tick.
    //  - A direct command clears homeBuildingId and stamps assignedRallyX/Y, which then wins.
    //  - AI and neutral owners keep the old global-rally behavior untouched.
    const getEffectiveRally = () => {
      if (meta.ownerId !== 'player') return sim.rallyPoints[meta.ownerId]
      const home = getHomeBuilding(sim, meta)
      if (home) {
        const rp = home.rallyPoint ?? { x: home.x, y: home.y }
        meta.assignedRallyX = rp.x   // keep in sync — movement.ts steers by the stamped anchor
        meta.assignedRallyY = rp.y
        return rp
      }
      meta.homeBuildingId = undefined  // home lost — hold the last anchor instead of wandering
      // The last direct order, which persists across deselection. There is deliberately no global
      // player rally fallback: a speck with no home and no order stands still, so STOP can't be
      // undone by a rally point the player set minutes ago somewhere else.
      if (meta.assignedRallyX !== undefined && meta.assignedRallyY !== undefined) {
        return { x: meta.assignedRallyX, y: meta.assignedRallyY }
      }
      return null
    }
    const rally = getEffectiveRally()

    // If owner has an active rally point and speck hasn't arrived, defer to rally
    if (rally) {
      const dx = rally.x - speckX[i]
      const dy = rally.y - speckY[i]
      const dist = Math.sqrt(dx * dx + dy * dy)
      const arrivalThreshold = meta.ownerId === 'player'
        ? getMusterRadius(sim, meta) + 8   // matches where movement.ts stops seeking, plus slack
        : RALLY_ARRIVAL_THRESHOLD
      if (dist > arrivalThreshold) {
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
      // Arrived. Player specks keep the anchor and hold it — they never choose their own next
      // objective (see the guard block below). AI specks clear it and revert to normal AI.
      if (meta.ownerId !== 'player' && meta.assignedRallyX !== undefined) {
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

    // Player specks never choose their own objective. Once a speck is standing where it was told
    // to stand — its spawn building, that building's rally point, or the last direct order — it
    // only engages what comes to it. Marching on the nearest enemy building unprompted is AI-only
    // behavior; for the player that is what the rally point is for.
    if (meta.ownerId === 'player') {
      let guardTarget: string | null = null
      let guardDist = Infinity
      for (const [bid, building] of Object.entries(buildings)) {
        if (building.ownerId === meta.ownerId) continue   // skip friendly
        if (building.ownerId === 'neutral') continue      // skip neutral — only capture those
        const bdx = building.x - speckX[i]
        const bdy = building.y - speckY[i]
        const bdist = Math.sqrt(bdx * bdx + bdy * bdy)
        if (bdist < GUARD_ENGAGE_RANGE && bdist < guardDist) {
          guardDist = bdist
          guardTarget = bid
        }
      }
      meta.targetId = guardTarget
      meta.state = guardTarget ? 'moving' : 'idle'
      continue
    }

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
