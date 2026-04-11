import { CLASS_ABILITIES, getSpellConfigForCharacter } from '@/app/tap-tap-adventure/config/characterOptions'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import {
  CombatActionRequest,
  CombatEnemy,
  CombatLogEntry,
  CombatPlayerState,
  CombatState,
  EnemyTelegraph,
} from '@/app/tap-tap-adventure/models/combat'
import { Item } from '@/app/tap-tap-adventure/models/item'

import { applyCombatItemEffect, isUsableInCombat } from './combatItemEffects'
import { calculateMaxMana } from './leveling'
import {
  applyShieldAbsorption,
  castSpell,
  getActiveDamageReduction,
  tickSpellCooldowns,
  tickSpellEffects,
} from './spellEngine'

export function initializePlayerCombatState(character: FantasyCharacter): CombatPlayerState {
  // Calculate equipment bonuses
  const equipment = character.equipment ?? { weapon: null, armor: null, accessory: null }
  const weaponBonus = equipment.weapon?.effects?.strength ?? 0
  const armorBonus = equipment.armor?.effects?.intelligence ?? 0
  const accessoryLuckBonus = equipment.accessory?.effects?.luck ?? 0

  // Use persistent HP from character, falling back to max if not set
  const maxHp = character.maxHp ?? (30 + character.strength * 3 + character.level * 8)
  const currentHp = character.hp ?? maxHp
  const maxMana = character.maxMana ?? calculateMaxMana(character)
  const currentMana = character.mana ?? maxMana

  return {
    hp: currentHp,
    maxHp,
    attack: 2 + character.strength + Math.floor(character.level / 2) + weaponBonus * 2,
    defense: 1 + Math.floor(character.intelligence / 2) + Math.floor(character.level / 2) + armorBonus,
    isDefending: false,
    activeBuffs: accessoryLuckBonus > 0
      ? [{ stat: 'attack' as const, value: accessoryLuckBonus, turnsRemaining: 999 }]
      : [],
    comboCount: 0,
    abilityCooldown: 0,
    enemyStunned: false,
    mana: currentMana,
    maxMana,
    spellCooldowns: {},
    activeSpellEffects: [],
    spellTagsUsed: [],
    shield: 0,
  }
}

function randomVariance(base: number, pct: number = 0.2): number {
  const variance = base * pct
  return base + (Math.random() * 2 - 1) * variance
}

/**
 * Combo multiplier: consecutive attacks build damage.
 * 0 combo = 1x, 1 = 1.25x, 2 = 1.5x, 3+ = 1.75x (capped)
 */
function getComboMultiplier(comboCount: number): number {
  return Math.min(1.75, 1 + comboCount * 0.25)
}

export function calculatePlayerDamage(
  playerState: CombatPlayerState,
  enemy: CombatEnemy
): number {
  const buffedAttack =
    playerState.attack +
    (playerState.activeBuffs ?? [])
      .filter(b => b.stat === 'attack')
      .reduce((sum, b) => sum + b.value, 0)
  const comboMultiplier = getComboMultiplier(playerState.comboCount)
  const raw = randomVariance(buffedAttack) * comboMultiplier - enemy.defense
  return Math.max(1, Math.round(raw))
}

export function calculateEnemyDamage(
  enemy: CombatEnemy,
  playerState: CombatPlayerState,
  isHeavyAttack: boolean = false
): number {
  const effectiveDefense = playerState.isDefending
    ? playerState.defense * 2
    : playerState.defense
  const buffedDefense =
    effectiveDefense +
    (playerState.activeBuffs ?? [])
      .filter(b => b.stat === 'defense')
      .reduce((sum, b) => sum + b.value, 0)
  const attackPower = isHeavyAttack ? enemy.attack * 1.5 : enemy.attack
  const raw = randomVariance(attackPower) - buffedDefense
  return Math.max(1, Math.round(raw))
}

export function calculateFleeChance(
  character: FantasyCharacter,
  enemy: CombatEnemy
): number {
  const chance = 0.3 + character.luck * 0.02 - enemy.level * 0.05
  return Math.max(0.1, Math.min(0.9, chance))
}

function tickBuffs(playerState: CombatPlayerState): CombatPlayerState {
  const activeBuffs = (playerState.activeBuffs ?? [])
    .map(b => ({ ...b, turnsRemaining: b.turnsRemaining - 1 }))
    .filter(b => b.turnsRemaining > 0)
  return { ...playerState, activeBuffs }
}

/**
 * Generate a telegraph for the enemy's NEXT action.
 * This lets the player see what's coming and react.
 */
function generateEnemyTelegraph(enemy: CombatEnemy, turnNumber: number, isBoss: boolean): EnemyTelegraph {
  const hasSpecial = !!enemy.specialAbility
  const specialReady = hasSpecial && enemy.specialAbility!.cooldown > 0
    ? turnNumber > 0 && (turnNumber + 1) % enemy.specialAbility!.cooldown === 0
    : hasSpecial && Math.random() < 0.3

  if (specialReady) {
    return {
      action: 'special',
      description: `${enemy.name} is preparing ${enemy.specialAbility!.name}!`,
    }
  }

  const heavyChance = isBoss ? 0.35 : 0.2
  if (Math.random() < heavyChance) {
    return {
      action: 'heavy_attack',
      description: `${enemy.name} winds up for a powerful strike!`,
    }
  }

  const defendChance = isBoss ? 0.2 : 0.1
  if (Math.random() < defendChance) {
    return {
      action: 'defend',
      description: `${enemy.name} braces and raises their guard.`,
    }
  }

  return {
    action: 'normal_attack',
    description: `${enemy.name} readies an attack.`,
  }
}

/**
 * Execute the enemy's telegraphed action.
 */
function executeEnemyTelegraph(
  telegraph: EnemyTelegraph,
  enemy: CombatEnemy,
  playerState: CombatPlayerState,
  turnNumber: number
): { playerState: CombatPlayerState; logs: CombatLogEntry[]; enemyDefenseBoost: boolean } {
  const logs: CombatLogEntry[] = []
  let updatedPlayer = { ...playerState }
  let enemyDefenseBoost = false

  switch (telegraph.action) {
    case 'heavy_attack': {
      const dmg = calculateEnemyDamage(enemy, updatedPlayer, true)
      updatedPlayer.hp = Math.max(0, updatedPlayer.hp - dmg)
      logs.push({
        turn: turnNumber,
        actor: 'enemy',
        action: 'heavy_attack',
        damage: dmg,
        description: `${enemy.name} unleashes a powerful blow for ${dmg} damage!`,
      })
      break
    }
    case 'special': {
      if (enemy.specialAbility) {
        const specialDmg = Math.max(
          1,
          Math.round(
            randomVariance(enemy.specialAbility.damage) -
            (updatedPlayer.isDefending ? updatedPlayer.defense : updatedPlayer.defense / 2)
          )
        )
        updatedPlayer.hp = Math.max(0, updatedPlayer.hp - specialDmg)
        logs.push({
          turn: turnNumber,
          actor: 'enemy',
          action: 'special',
          damage: specialDmg,
          description: `${enemy.name} uses ${enemy.specialAbility.name}! You take ${specialDmg} damage!`,
        })
      }
      break
    }
    case 'defend': {
      enemyDefenseBoost = true
      logs.push({
        turn: turnNumber,
        actor: 'enemy',
        action: 'defend',
        description: `${enemy.name} takes a defensive stance, reducing incoming damage.`,
      })
      break
    }
    case 'normal_attack':
    default: {
      const dmg = calculateEnemyDamage(enemy, updatedPlayer)
      updatedPlayer.hp = Math.max(0, updatedPlayer.hp - dmg)
      logs.push({
        turn: turnNumber,
        actor: 'enemy',
        action: 'attack',
        damage: dmg,
        description: `${enemy.name} attacks you for ${dmg} damage!`,
      })
      break
    }
  }

  return { playerState: updatedPlayer, logs, enemyDefenseBoost }
}

/**
 * Boss phase change: when a boss drops below 50% HP, boost their stats.
 */
function checkBossPhaseChange(
  enemy: CombatEnemy,
  isBoss: boolean,
  alreadyPhased: boolean
): { enemy: CombatEnemy; phaseChanged: boolean; log?: CombatLogEntry } {
  if (!isBoss || alreadyPhased) return { enemy, phaseChanged: false }
  if (enemy.hp > enemy.maxHp * 0.5) return { enemy, phaseChanged: false }

  const enragedEnemy = {
    ...enemy,
    attack: Math.round(enemy.attack * 1.4),
    defense: Math.round(enemy.defense * 1.3),
    name: `${enemy.name} (Enraged)`,
  }

  return {
    enemy: enragedEnemy,
    phaseChanged: true,
    log: {
      turn: 0,
      actor: 'enemy',
      action: 'phase_change',
      description: `${enemy.name} becomes enraged! Attack and defense increased!`,
    },
  }
}

export function processPlayerAction(
  combatState: CombatState,
  action: CombatActionRequest,
  character: FantasyCharacter
): { combatState: CombatState; consumedItemId?: string } {
  let { enemy, playerState, turnNumber, combatLog, status, enemyTelegraph, isBoss } = structuredClone(combatState)
  const newLogs: CombatLogEntry[] = []
  let consumedItemId: string | undefined
  const bossAlreadyPhased = isBoss ? enemy.name.includes('(Enraged)') : false

  if (status !== 'active') {
    return { combatState }
  }

  turnNumber += 1
  playerState.isDefending = false

  // Track if enemy is defending this turn (from telegraph)
  let enemyDefending = enemyTelegraph?.action === 'defend'

  // Process player action
  switch (action.action) {
    case 'attack': {
      const effectiveEnemy = enemyDefending
        ? { ...enemy, defense: enemy.defense * 2 }
        : enemy
      const damage = calculatePlayerDamage(playerState, effectiveEnemy)
      enemy.hp = Math.max(0, enemy.hp - damage)
      playerState.comboCount = (playerState.comboCount ?? 0) + 1
      const comboText = playerState.comboCount > 1 ? ` (${playerState.comboCount}x combo!)` : ''
      newLogs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'attack',
        damage,
        description: `You strike ${enemy.name} for ${damage} damage!${comboText}`,
      })
      break
    }
    case 'defend': {
      playerState.isDefending = true
      playerState.comboCount = 0
      newLogs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'defend',
        description: 'You brace yourself, doubling your defense for this turn.',
      })
      break
    }
    case 'use_item': {
      playerState.comboCount = 0
      if (!action.itemId) {
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'use_item',
          description: 'You fumble with your pack but find nothing to use.',
        })
        break
      }
      const item = character.inventory.find(
        i => i.id === action.itemId && i.status !== 'deleted' && isUsableInCombat(i)
      )
      if (!item) {
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'use_item',
          description: 'That item cannot be used in combat.',
        })
        break
      }
      const result = applyCombatItemEffect(item, playerState)
      playerState = result.playerState
      consumedItemId = item.id
      newLogs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'use_item',
        description: result.description,
      })
      break
    }
    case 'flee': {
      playerState.comboCount = 0
      const fleeChance = calculateFleeChance(character, enemy)
      if (Math.random() < fleeChance) {
        status = 'fled'
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'flee',
          description: 'You successfully escape from combat!',
        })
        return {
          combatState: {
            ...combatState,
            enemy,
            playerState,
            turnNumber,
            combatLog: [...combatLog, ...newLogs],
            status,
            enemyTelegraph: null,
          },
        }
      }
      newLogs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'flee',
        description: `You try to flee but ${enemy.name} blocks your escape!`,
      })
      break
    }
    case 'class_ability': {
      const classId = character.class.toLowerCase()
      const ability = character.classData?.startingAbility
        ? { name: character.classData.startingAbility.name, description: character.classData.startingAbility.description, cooldown: character.classData.startingAbility.cooldown }
        : CLASS_ABILITIES[classId]
      if (!ability) {
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'class_ability',
          description: 'You have no class ability available.',
        })
        break
      }
      if ((playerState.abilityCooldown ?? 0) > 0) {
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'class_ability',
          description: `${ability.name} is not ready yet! (${playerState.abilityCooldown} turns remaining)`,
        })
        break
      }

      switch (classId) {
        case 'warrior': {
          const baseDmg = calculatePlayerDamage(playerState, enemy)
          const damage = Math.max(1, Math.round(baseDmg * 0.8))
          enemy.hp = Math.max(0, enemy.hp - damage)
          playerState.enemyStunned = true
          playerState.comboCount = (playerState.comboCount ?? 0) + 1
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'class_ability',
            damage,
            description: `You bash ${enemy.name} with your shield for ${damage} damage, stunning them!`,
          })
          break
        }
        case 'mage': {
          const baseDmg = calculatePlayerDamage(playerState, enemy)
          const damage = Math.max(1, Math.round(baseDmg * 2))
          const recoil = Math.max(1, Math.round(playerState.maxHp * 0.2))
          enemy.hp = Math.max(0, enemy.hp - damage)
          playerState.hp = Math.max(1, playerState.hp - recoil)
          playerState.comboCount = 0
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'class_ability',
            damage,
            description: `You unleash an Arcane Blast for ${damage} damage! The magical recoil deals ${recoil} damage to you.`,
          })
          break
        }
        case 'rogue': {
          const combo = playerState.comboCount ?? 0
          if (combo >= 2) {
            const baseDmg = calculatePlayerDamage(playerState, enemy)
            const damage = Math.max(1, Math.round(baseDmg * 3))
            enemy.hp = Math.max(0, enemy.hp - damage)
            playerState.comboCount = 0
            newLogs.push({
              turn: turnNumber,
              actor: 'player',
              action: 'class_ability',
              damage,
              description: `You exploit your ${combo}x combo with a devastating Backstab for ${damage} damage!`,
            })
          } else {
            const damage = calculatePlayerDamage(playerState, enemy)
            enemy.hp = Math.max(0, enemy.hp - damage)
            playerState.comboCount = (playerState.comboCount ?? 0) + 1
            newLogs.push({
              turn: turnNumber,
              actor: 'player',
              action: 'class_ability',
              damage,
              description: `Your Backstab lacks setup and deals ${damage} normal damage.`,
            })
          }
          break
        }
        case 'ranger': {
          const buffedAttack =
            playerState.attack +
            (playerState.activeBuffs ?? [])
              .filter(b => b.stat === 'attack')
              .reduce((sum, b) => sum + b.value, 0)
          const damage = Math.max(1, Math.round(buffedAttack))
          enemy.hp = Math.max(0, enemy.hp - damage)
          playerState.comboCount = (playerState.comboCount ?? 0) + 1
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'class_ability',
            damage,
            description: `Your Precise Shot pierces through all defenses for ${damage} damage!`,
          })
          break
        }
      }
      playerState.abilityCooldown = ability.cooldown
      break
    }
    case 'cast_spell': {
      if (!action.spellId) {
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: 'No spell selected.',
        })
        break
      }
      const spellbook = character.spellbook ?? []
      const spell = spellbook.find(s => s.id === action.spellId)
      if (!spell) {
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: 'You do not know that spell.',
        })
        break
      }
      // Use the current combat state with updated turn number for condition checking
      const spellCombatState = { ...combatState, turnNumber, combatLog: [...combatLog, ...newLogs] }
      const spellResult = castSpell(spell, playerState, enemy, character, spellCombatState)
      playerState = spellResult.playerState
      enemy = spellResult.enemy
      newLogs.push(...spellResult.logs)
      break
    }
  }

  // Check boss phase change
  if (enemy.hp > 0) {
    const phase = checkBossPhaseChange(enemy, !!isBoss, bossAlreadyPhased)
    if (phase.phaseChanged) {
      enemy = phase.enemy
      if (phase.log) {
        newLogs.push({ ...phase.log, turn: turnNumber })
      }
    }
  }

  // Check victory
  if (enemy.hp <= 0) {
    status = 'victory'
    newLogs.push({
      turn: turnNumber,
      actor: 'player',
      action: 'victory',
      description: `You defeated ${enemy.name}!`,
    })
    return {
      combatState: {
        ...combatState,
        enemy,
        playerState: tickBuffs(playerState),
        turnNumber,
        combatLog: [...combatLog, ...newLogs],
        status,
        enemyTelegraph: null,
      },
      consumedItemId,
    }
  }

  // Execute enemy's telegraphed action (or normal attack if no telegraph)
  // If enemy is stunned, they skip their action
  if (playerState.enemyStunned) {
    playerState.enemyStunned = false
    newLogs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'stunned',
      description: `${enemy.name} is stunned and cannot act!`,
    })
  } else if (enemyTelegraph) {
    const result = executeEnemyTelegraph(enemyTelegraph, enemy, playerState, turnNumber)
    playerState = result.playerState
    // Apply shield absorption and damage reduction to enemy's damage
    const enemyDmgLog = result.logs.find(l => l.damage && l.damage > 0)
    if (enemyDmgLog && enemyDmgLog.damage) {
      // Undo the direct HP damage from the telegraph, and re-apply with shield/reduction
      const originalDmg = enemyDmgLog.damage
      playerState.hp = Math.min(playerState.maxHp, playerState.hp + originalDmg) // restore

      const dmgReduction = getActiveDamageReduction(playerState)
      const reducedDmg = Math.max(1, Math.round(originalDmg * (1 - dmgReduction / 100)))
      const shieldResult = applyShieldAbsorption(playerState, reducedDmg)
      playerState = shieldResult.playerState
      playerState.hp = Math.max(0, playerState.hp - shieldResult.damageAfterShield)

      if (dmgReduction > 0 || shieldResult.damageAfterShield < reducedDmg) {
        const shieldAbsorbed = reducedDmg - shieldResult.damageAfterShield
        const parts: string[] = []
        if (dmgReduction > 0) parts.push(`${dmgReduction}% reduced`)
        if (shieldAbsorbed > 0) parts.push(`${shieldAbsorbed} absorbed by shield`)
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'spell_mitigation',
          description: `Spell effects mitigate damage (${parts.join(', ')})!`,
        })
      }
    }
    newLogs.push(...result.logs)
  } else {
    const enemyDmg = calculateEnemyDamage(enemy, playerState)
    const dmgReduction = getActiveDamageReduction(playerState)
    const reducedDmg = Math.max(1, Math.round(enemyDmg * (1 - dmgReduction / 100)))
    const shieldResult = applyShieldAbsorption(playerState, reducedDmg)
    playerState = shieldResult.playerState
    playerState.hp = Math.max(0, playerState.hp - shieldResult.damageAfterShield)
    newLogs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'attack',
      damage: shieldResult.damageAfterShield,
      description: `${enemy.name} attacks you for ${shieldResult.damageAfterShield} damage!${dmgReduction > 0 ? ` (${dmgReduction}% reduced)` : ''}${(playerState.shield ?? 0) > 0 || reducedDmg !== shieldResult.damageAfterShield ? ' (shield absorbed some)' : ''}`,
    })
  }

  // Check defeat
  if (playerState.hp <= 0) {
    status = 'defeat'
    newLogs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'defeat',
      description: `You have been defeated by ${enemy.name}...`,
    })
  }

  // Tick spell effects (DOTs, HOTs, bleeds)
  if (status === 'active') {
    const spellTickResult = tickSpellEffects(playerState, enemy, turnNumber)
    playerState = spellTickResult.playerState
    enemy = spellTickResult.enemy
    newLogs.push(...spellTickResult.logs)

    // Check victory from DOT/bleed
    if (enemy.hp <= 0) {
      status = 'victory'
      newLogs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'victory',
        description: `You defeated ${enemy.name} with lingering spell effects!`,
      })
    }
  }

  // Tick buffs
  playerState = tickBuffs(playerState)

  // Tick ability cooldown
  if ((playerState.abilityCooldown ?? 0) > 0) {
    playerState = { ...playerState, abilityCooldown: playerState.abilityCooldown! - 1 }
  }

  // Tick spell cooldowns
  playerState = tickSpellCooldowns(playerState)

  // Generate telegraph for enemy's NEXT action
  const nextTelegraph = status === 'active'
    ? generateEnemyTelegraph(enemy, turnNumber, !!isBoss)
    : null

  return {
    combatState: {
      ...combatState,
      enemy,
      playerState,
      turnNumber,
      combatLog: [...combatLog, ...newLogs],
      status,
      enemyTelegraph: nextTelegraph,
      isBoss,
    },
    consumedItemId,
  }
}

export interface CombatRewards {
  gold: number
  loot: Item[]
}

export function getCombatRewards(
  combatState: CombatState,
  character: FantasyCharacter
): CombatRewards {
  const { enemy } = combatState
  const gold = enemy.goldReward

  const loot: Item[] = []
  if (enemy.lootTable) {
    for (const item of enemy.lootTable) {
      const dropChance = combatState.isBoss ? 1.0 : 0.3 + character.luck * 0.03
      if (Math.random() < dropChance) {
        loot.push(item)
      }
    }
  }

  return { gold, loot }
}

// Re-export for tests
export { getComboMultiplier, generateEnemyTelegraph, checkBossPhaseChange }
