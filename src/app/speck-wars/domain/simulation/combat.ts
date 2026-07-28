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

    // Stunned specks cannot attack
    if ((meta.stunTimer ?? 0) > 0) continue
    if (meta.attackCooldown > 0) {
      meta.attackCooldown -= dt
      continue
    }

    const neighbors = spatialGrid.query(speckX[i], speckY[i])
    for (const j of neighbors) {
      if (i === j || speckHp[j] <= 0) continue
      const jMeta = speckMeta[j]
      if (!jMeta || jMeta.ownerId === meta.ownerId) continue  // dead slot or friendly

      const dx = speckX[j] - speckX[i]
      const dy = speckY[j] - speckY[i]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= stype.attackRange) {
        const veteranBonus = meta.kills >= 12 ? 1.50 : meta.kills >= 6 ? 1.35 : meta.kills >= 3 ? 1.20 : 1.0  // legend +50%, elite +35%, veteran +20%
        const heroBonus = meta.isHero ? 1.5 : 1.0
        const commanderBonus = meta.isCommander ? 2.0 : 1.0
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
        // Commander Last Stand: invulnerable target cannot be damaged
        if (jMeta.isCommander && (jMeta.commanderAbilityActive ?? 0) > 0) break
        const typeAdvMult = getTypeAdvantage(stype.id, jMeta.typeId)
        const lastStandMult = (meta.isCommander && (meta.commanderAbilityActive ?? 0) > 0) ? 3.0 : 1.0
        speckHp[j] -= stype.damage * veteranBonus * heroBonus * fortifyBonus * upgradeBonus * bladesBonus * commanderBonus * typeAdvMult * lastStandMult
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
                // When hero is killed by splash damage, set respawn timer
                if (kMeta.isHero) {
                  sim.events.push({ type: 'HERO_DIED', ownerId: kMeta.ownerId, kills: kMeta.kills })
                  sim.heroRespawnTimer[kMeta.ownerId] = 15000
                }
                // When commander is killed by splash damage, set commanderRespawnMs
                if (kMeta.isCommander) {
                  const ownerPlayer = sim.players[kMeta.ownerId]
                  if (ownerPlayer) ownerPlayer.commanderRespawnMs = 15000
                  sim.events.push({ type: 'COMMANDER_DIED', ownerId: kMeta.ownerId, xp: kMeta.commanderXp ?? 0 })
                }
                sim.events.push({ type: 'SPECK_DIED', speckId: speckIds[k], x: speckX[k], y: speckY[k], killedOwnerId: kMeta.ownerId, killerOwnerId: meta.ownerId })
                meta.kills++
                if (meta.kills === 3) sim.events.push({ type: 'SPECK_VETERAN', speckId: speckIds[i], ownerId: meta.ownerId })
                if (meta.kills === 6) sim.events.push({ type: 'SPECK_ELITE', speckId: speckIds[i], ownerId: meta.ownerId })
                if (meta.kills === 12) sim.events.push({ type: 'SPECK_LEGEND', speckId: speckIds[i], ownerId: meta.ownerId })
                // Hero leveling (splash kill)
                if (meta.isHero) {
                  const newHeroLevel: 0 | 1 | 2 = meta.kills >= 15 ? 2 : meta.kills >= 5 ? 1 : 0
                  if ((meta.heroLevel ?? 0) < newHeroLevel) {
                    meta.heroLevel = newHeroLevel
                    if (meta.heroLevel === 2) meta.abilityTimer = 3000
                    sim.events.push({ type: 'HERO_LEVELED', ownerId: meta.ownerId, heroLevel: newHeroLevel as 1 | 2 })
                  }
                }
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
          // When hero is killed, set respawn timer
          if (jMeta.isHero) {
            sim.events.push({ type: 'HERO_DIED', ownerId: jMeta.ownerId, kills: jMeta.kills })
            sim.heroRespawnTimer[jMeta.ownerId] = 15000
          }
          // When commander is killed, set commanderRespawnMs
          if (jMeta.isCommander) {
            const ownerPlayer = sim.players[jMeta.ownerId]
            if (ownerPlayer) ownerPlayer.commanderRespawnMs = 15000
            sim.events.push({ type: 'COMMANDER_DIED', ownerId: jMeta.ownerId, xp: jMeta.commanderXp ?? 0 })
          }
          sim.events.push({ type: 'SPECK_DIED', speckId: speckIds[j], x: speckX[j], y: speckY[j], killedOwnerId: jMeta.ownerId, killerOwnerId: meta.ownerId })
          // Commander XP: award XP to commanders within 150px of the kill
          {
            const COMMANDER_XP_RANGE = 150
            const xpR2 = COMMANDER_XP_RANGE * COMMANDER_XP_RANGE
            for (let k = 0; k < sim.speckCount; k++) {
              const cm = sim.speckMeta[k]
              if (!cm?.isCommander || sim.speckHp[k] <= 0) continue
              if (cm.ownerId === jMeta.ownerId) continue  // don't award XP for killing own team
              const cdx = sim.speckX[k] - sim.speckX[j]
              const cdy = sim.speckY[k] - sim.speckY[j]
              if (cdx * cdx + cdy * cdy <= xpR2) {
                cm.commanderXp = (cm.commanderXp ?? 0) + 1
                const newLevel = (cm.commanderXp ?? 0) >= 15 ? 3 : (cm.commanderXp ?? 0) >= 5 ? 2 : 0
                if (newLevel > (cm.commanderLevel ?? 0)) {
                  cm.commanderLevel = newLevel as 0 | 1 | 2 | 3
                  if (cm.pulseTimer === undefined) cm.pulseTimer = 3000
                  sim.events.push({ type: 'COMMANDER_LEVEL_UP', ownerId: cm.ownerId, level: newLevel as 2 | 3 })
                }
              }
            }
          }
          if (meta.kills === 3) {
            sim.events.push({ type: 'SPECK_VETERAN', speckId: speckIds[i], ownerId: meta.ownerId })
          }
          if (meta.kills === 6) {
            sim.events.push({ type: 'SPECK_ELITE', speckId: speckIds[i], ownerId: meta.ownerId })
          }
          if (meta.kills === 12) {
            sim.events.push({ type: 'SPECK_LEGEND', speckId: speckIds[i], ownerId: meta.ownerId })
          }
          // Hero leveling: check after each kill
          if (meta.isHero) {
            const newHeroLevel: 0 | 1 | 2 = meta.kills >= 15 ? 2 : meta.kills >= 5 ? 1 : 0
            if ((meta.heroLevel ?? 0) < newHeroLevel) {
              meta.heroLevel = newHeroLevel
              if (meta.heroLevel === 2) meta.abilityTimer = 3000
              sim.events.push({ type: 'HERO_LEVELED', ownerId: meta.ownerId, heroLevel: newHeroLevel as 1 | 2 })
            }
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

// Hero AoE pulse ability (level 2): tick timer and fire pulse when it hits 0
export function updateHeroAbilities(sim: SimulationState, dt: number) {
  const { speckIds, speckX, speckY, speckHp, speckMeta, spatialGrid } = sim
  for (let i = 0; i < sim.speckCount; i++) {
    if (!speckIds[i]) continue
    if (speckHp[i] <= 0) continue
    const meta = speckMeta[i]
    if (!meta || !meta.isHero) continue
    if ((meta.heroLevel ?? 0) < 2) continue
    if ((meta.abilityTimer ?? 0) <= 0) continue

    meta.abilityTimer = (meta.abilityTimer ?? 0) - dt
    if (meta.abilityTimer > 0) continue

    // Pulse fired — reset timer
    meta.abilityTimer = 3000

    // Deal AoE damage to enemies within 60px
    const stype = SPECK_TYPES[meta.typeId]
    if (!stype) continue
    const pulseDamage = stype.damage * 1.5 * 0.5  // 50% of hero's full damage
    const PULSE_RADIUS = 60
    const pulseR2 = PULSE_RADIUS * PULSE_RADIUS
    const neighbors = spatialGrid.query(speckX[i], speckY[i])
    for (const j of neighbors) {
      if (i === j || !speckIds[j]) continue
      if (speckHp[j] <= 0) continue
      const jMeta = speckMeta[j]
      if (!jMeta || jMeta.ownerId === meta.ownerId) continue
      const dx = speckX[j] - speckX[i]
      const dy = speckY[j] - speckY[i]
      if (dx * dx + dy * dy > pulseR2) continue
      speckHp[j] -= pulseDamage
      if (speckHp[j] <= 0) {
        // When hero is killed by AoE pulse
        if (jMeta.isHero) {
          sim.events.push({ type: 'HERO_DIED', ownerId: jMeta.ownerId, kills: jMeta.kills })
          sim.heroRespawnTimer[jMeta.ownerId] = 15000
        }
        sim.events.push({ type: 'SPECK_DIED', speckId: speckIds[j], x: speckX[j], y: speckY[j], killedOwnerId: jMeta.ownerId, killerOwnerId: meta.ownerId })
        meta.kills++
        // Hero leveling from pulse kills
        const newHeroLevel: 0 | 1 | 2 = meta.kills >= 15 ? 2 : meta.kills >= 5 ? 1 : 0
        if ((meta.heroLevel ?? 0) < newHeroLevel) {
          meta.heroLevel = newHeroLevel
          sim.events.push({ type: 'HERO_LEVELED', ownerId: meta.ownerId, heroLevel: newHeroLevel as 1 | 2 })
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
    }
  }
}

// Mark dead specks and push their slots onto the free-list — no array allocation
export function removeDeadSpecks(sim: SimulationState) {
  for (let i = 0; i < sim.speckCount; i++) {
    if (sim.speckIds[i] !== '' && sim.speckHp[i] <= 0) {
      const deadId = sim.speckIds[i]  // save before clearing
      sim.selectedSpeckIds.delete(deadId)
      sim.freeSlots.push(i)
      sim.speckIds[i] = ''
      sim.speckMeta[i] = null
    }
  }
}
