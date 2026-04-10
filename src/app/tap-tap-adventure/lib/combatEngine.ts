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

export function initializePlayerCombatState(character: FantasyCharacter): CombatPlayerState {
  const maxHp = 50 + character.strength * 5 + character.level * 10
  return {
    hp: maxHp,
    maxHp,
    attack: 5 + character.strength * 2 + character.level,
    defense: 3 + character.intelligence + character.level,
    isDefending: false,
    activeBuffs: [],
    comboCount: 0,
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
  const raw = randomVariance(buffedAttack) * comboMultiplier - enemy.defense / 2
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
  const raw = randomVariance(attackPower) - buffedDefense / 2
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

  // Bosses and stronger enemies telegraph heavy attacks more often
  const heavyChance = isBoss ? 0.35 : 0.2
  if (Math.random() < heavyChance) {
    return {
      action: 'heavy_attack',
      description: `${enemy.name} winds up for a powerful strike!`,
    }
  }

  // Rare enemy defend (boss only)
  if (isBoss && Math.random() < 0.15) {
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
  let enemyDefending = false

  // Process player action
  switch (action.action) {
    case 'attack': {
      // Apply enemy defense boost if they telegraphed defend
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
      playerState.comboCount = 0 // defending breaks combo
      newLogs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'defend',
        description: 'You brace yourself, doubling your defense for this turn.',
      })
      break
    }
    case 'use_item': {
      playerState.comboCount = 0 // using item breaks combo
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
  if (enemyTelegraph) {
    const result = executeEnemyTelegraph(enemyTelegraph, enemy, playerState, turnNumber)
    playerState = result.playerState
    newLogs.push(...result.logs)
    enemyDefending = result.enemyDefenseBoost
  } else {
    // First turn or no telegraph — normal attack
    const enemyDmg = calculateEnemyDamage(enemy, playerState)
    playerState.hp = Math.max(0, playerState.hp - enemyDmg)
    newLogs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'attack',
      damage: enemyDmg,
      description: `${enemy.name} attacks you for ${enemyDmg} damage!`,
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

  // Tick buffs
  playerState = tickBuffs(playerState)

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

  // Select loot based on luck. Boss loot always drops.
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
