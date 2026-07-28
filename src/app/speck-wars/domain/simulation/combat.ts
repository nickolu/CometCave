import type { SimulationState } from '../types'
import { SPECK_TYPES, getTypeAdvantage } from '../config/speck-types'
import { BUILDING_TYPES } from '../config/building-types'
import { FORTIFY_RADIUS, FORTIFY_TIME, FORTIFY_DAMAGE_BONUS } from '../constants'

export function resolveCombat(sim: SimulationState, dt: number) {
  const { speckIds, speckX, speckY, speckHp, speckMeta, buildings, spatialGrid } = sim

  // --- Speck vs Speck combat ---
  for (let i = 0; i < sim.speckCount; i++) {
    if (!speckIds[i]) continue
    if (speckHp[i] <= 0) continue
    const meta = speckMeta[i]
    if (!meta) continue
    const stype = SPECK_TYPES[meta.typeId]
    if (!stype) continue

    // Garrisoned specks don't fight on the field
    if (meta.isGarrisoned) continue

    if (meta.attackCooldown > 0) {
      meta.attackCooldown -= dt
      continue
    }

    const neighbors = spatialGrid.query(speckX[i], speckY[i])
    for (const j of neighbors) {
      if (i === j || speckHp[j] <= 0) continue
      const jMeta = speckMeta[j]
      if (!jMeta || jMeta.ownerId === meta.ownerId) continue  // dead slot or friendly
      // Garrisoned specks cannot be targeted on the field
      if (jMeta.isGarrisoned) continue

      const dx = speckX[j] - speckX[i]
      const dy = speckY[j] - speckY[i]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= stype.attackRange) {
        const veteranBonus = meta.kills >= 12 ? 1.50 : meta.kills >= 6 ? 1.35 : meta.kills >= 3 ? 1.20 : 1.0  // legend +50%, elite +35%, veteran +20%
        // Fortification bonus: if attacker is near a friendly fortified outpost, deal extra damage
        let fortifyBonus = 1.0
        for (const b of Object.values(buildings)) {
          if (b.typeId !== 'outpost' || b.ownerId !== meta.ownerId) continue
          const fdx = speckX[i] - b.x
          const fdy = speckY[i] - b.y
          if (fdx * fdx + fdy * fdy <= FORTIFY_RADIUS * FORTIFY_RADIUS) {
            const level = Math.min(1, (b.fortifyDuration ?? 0) / FORTIFY_TIME)
            if (level > 0) { fortifyBonus = 1 + FORTIFY_DAMAGE_BONUS * level; break }
          }
        }
        const upgradeBonus = (sim.players[meta.ownerId]?.upgradeLevel ?? 0) >= 3 ? 1.15 : 1.0
        const bladesBonus = (sim.players[meta.ownerId]?.outpostUpgrades?.blades) ? 1.15 : 1.0
        const typeAdvMult = getTypeAdvantage(stype.id, jMeta.typeId)
        speckHp[j] -= stype.damage * veteranBonus * fortifyBonus * upgradeBonus * bladesBonus * typeAdvMult
        // Elite/Legend splash damage — inspired by CoH veteran abilities (issue #2145)
        // Elite (6+ kills): 18px radius, 50% damage; Legend (12+ kills): 28px radius, 75% damage
        const splashRadius = meta.kills >= 12 ? 28 : meta.kills >= 6 ? 18 : 0
        if (splashRadius > 0) {
          const splashDamage = stype.damage * veteranBonus * (meta.kills >= 12 ? 0.75 : 0.50)
          const splashNeighbors = spatialGrid.query(speckX[j], speckY[j])
          for (const k of splashNeighbors) {
            if (k === j || k === i) continue   // skip primary target and attacker
            if (speckHp[k] <= 0) continue
            const kMeta = speckMeta[k]
            if (!kMeta || kMeta.ownerId === meta.ownerId) continue   // friendly
            const sdx = speckX[k] - speckX[j]
            const sdy = speckY[k] - speckY[j]
            if (sdx * sdx + sdy * sdy <= splashRadius * splashRadius) {
              speckHp[k] -= splashDamage
              if (speckHp[k] <= 0) {
                if (kMeta.ownerId === 'player' && kMeta.kills >= 3) {
                  sim.events.push({ type: 'VETERAN_FALLEN', speckId: speckIds[k], ownerId: kMeta.ownerId, kills: kMeta.kills, x: speckX[k], y: speckY[k] })
                }
                sim.events.push({ type: 'SPECK_DIED', speckId: speckIds[k], x: speckX[k], y: speckY[k], killedOwnerId: kMeta.ownerId, killerOwnerId: meta.ownerId })
                meta.kills++
                if (meta.kills === 3) sim.events.push({ type: 'SPECK_VETERAN', speckId: speckIds[i], ownerId: meta.ownerId })
                if (meta.kills === 6) sim.events.push({ type: 'SPECK_ELITE', speckId: speckIds[i], ownerId: meta.ownerId })
                if (meta.kills === 12) sim.events.push({ type: 'SPECK_LEGEND', speckId: speckIds[i], ownerId: meta.ownerId })
                // Kill milestone upgrades (splash kill)
                const splashKillerPlayer = sim.players[meta.ownerId]
                if (splashKillerPlayer) {
                  splashKillerPlayer.totalKills++
                  const splashNewLevel = splashKillerPlayer.totalKills >= 300 ? 3 : splashKillerPlayer.totalKills >= 150 ? 2 : splashKillerPlayer.totalKills >= 50 ? 1 : 0
                  if (splashNewLevel > splashKillerPlayer.upgradeLevel) {
                    splashKillerPlayer.upgradeLevel = splashNewLevel as 0 | 1 | 2 | 3
                    sim.events.push({ type: 'UPGRADE_UNLOCKED', ownerId: meta.ownerId, level: splashNewLevel as 1 | 2 | 3 })
                  }
                }
              }
            }
          }
        }
        meta.attackCooldown = stype.attackCooldown
        meta.state = 'attacking'
        // die_on_impact: missile self-destructs after dealing damage
        if (stype.abilities.includes('die_on_impact')) {
          speckHp[i] = 0
        }
        if (speckHp[j] <= 0) {
          meta.kills++  // attacker earns a kill
          // Notify when player loses a veteran or elite
          if (jMeta.ownerId === 'player' && jMeta.kills >= 3) {
            sim.events.push({
              type: 'VETERAN_FALLEN',
              speckId: speckIds[j],
              ownerId: jMeta.ownerId,
              kills: jMeta.kills,
              x: speckX[j],
              y: speckY[j],
            })
          }
          sim.events.push({ type: 'SPECK_DIED', speckId: speckIds[j], x: speckX[j], y: speckY[j], killedOwnerId: jMeta.ownerId, killerOwnerId: meta.ownerId })
          if (meta.kills === 3) {
            sim.events.push({ type: 'SPECK_VETERAN', speckId: speckIds[i], ownerId: meta.ownerId })
          }
          if (meta.kills === 6) {
            sim.events.push({ type: 'SPECK_ELITE', speckId: speckIds[i], ownerId: meta.ownerId })
          }
          if (meta.kills === 12) {
            sim.events.push({ type: 'SPECK_LEGEND', speckId: speckIds[i], ownerId: meta.ownerId })
          }
          // Kill milestone upgrades
          const killerPlayer = sim.players[meta.ownerId]
          if (killerPlayer) {
            killerPlayer.totalKills++
            const newLevel = killerPlayer.totalKills >= 300 ? 3 : killerPlayer.totalKills >= 150 ? 2 : killerPlayer.totalKills >= 50 ? 1 : 0
            if (newLevel > killerPlayer.upgradeLevel) {
              killerPlayer.upgradeLevel = newLevel as 0 | 1 | 2 | 3
              sim.events.push({ type: 'UPGRADE_UNLOCKED', ownerId: meta.ownerId, level: newLevel as 1 | 2 | 3 })
            }
          }
        }
        break  // one attack per cooldown
      }
    }
  }

  // --- Speck vs Building combat ---
  for (let i = 0; i < sim.speckCount; i++) {
    if (!speckIds[i]) continue
    if (speckHp[i] <= 0) continue
    const meta = speckMeta[i]
    if (!meta) continue
    if (!meta.targetId) continue
    const building = buildings[meta.targetId]
    if (!building) continue

    const stype = SPECK_TYPES[meta.typeId]
    if (!stype || meta.attackCooldown > 0) continue

    const dx = building.x - speckX[i]
    const dy = building.y - speckY[i]
    const dist = Math.sqrt(dx * dx + dy * dy)
    const btype = BUILDING_TYPES[building.typeId]
    const attackDist = (btype?.size ?? 20) + stype.attackRange

    if (dist <= attackDist) {
      // Outposts are captured, not destroyed — immune to direct combat damage
      if (building.typeId === 'outpost') continue
      const siegeBonus = meta.typeId === 'heavy' ? 1.5 : 1.0
      building.hp -= stype.damage * siegeBonus
      building.lastDamagedAt = Date.now()
      meta.attackCooldown = stype.attackCooldown
      sim.events.push({ type: 'BUILDING_DAMAGED', buildingId: building.id, hp: building.hp })

      if (building.hp <= 0) {
        sim.events.push({ type: 'BUILDING_DESTROYED', buildingId: building.id, ownerId: building.ownerId, x: building.x, y: building.y })
        delete sim.buildings[building.id]
        // Clear target for all specks pointing at this building
        for (let k = 0; k < sim.speckCount; k++) {
          const m = sim.speckMeta[k]
          if (m && m.targetId === building.id) m.targetId = null
        }
      }
    }
  }
}

// Mark dead specks and push their slots onto the free-list — no array allocation
export function removeDeadSpecks(sim: SimulationState) {
  for (let i = 0; i < sim.speckCount; i++) {
    if (sim.speckIds[i] !== '' && sim.speckHp[i] <= 0) {
      const deadId = sim.speckIds[i]  // save before clearing
      const deadMeta = sim.speckMeta[i]
      // Return supply to owner
      if (deadMeta && deadMeta.ownerId !== 'neutral' && sim.players[deadMeta.ownerId]) {
        const cost = SPECK_TYPES[deadMeta.typeId]?.supplyCost ?? 1
        sim.players[deadMeta.ownerId].supply = Math.max(0, (sim.players[deadMeta.ownerId].supply ?? 0) - cost)
      }
      sim.selectedSpeckIds.delete(deadId)
      sim.freeSlots.push(i)
      sim.speckIds[i] = ''
      sim.speckMeta[i] = null
    }
  }
}
