import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character'
import {
  CombatActionRequest,
  CombatEnemy,
  CombatLogEntry,
  CombatPlayerState,
  CombatState,
} from '@/app/fantasy-tycoon/models/combat'
import { Item } from '@/app/fantasy-tycoon/models/item'

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
  }
}

function randomVariance(base: number, pct: number = 0.2): number {
  const variance = base * pct
  return base + (Math.random() * 2 - 1) * variance
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
  const raw = randomVariance(buffedAttack) - enemy.defense / 2
  return Math.max(1, Math.round(raw))
}

export function calculateEnemyDamage(
  enemy: CombatEnemy,
  playerState: CombatPlayerState
): number {
  const effectiveDefense = playerState.isDefending
    ? playerState.defense * 2
    : playerState.defense
  const buffedDefense =
    effectiveDefense +
    (playerState.activeBuffs ?? [])
      .filter(b => b.stat === 'defense')
      .reduce((sum, b) => sum + b.value, 0)
  const raw = randomVariance(enemy.attack) - buffedDefense / 2
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

function shouldUseSpecialAbility(enemy: CombatEnemy, turnNumber: number): boolean {
  if (!enemy.specialAbility) return false
  if (enemy.specialAbility.cooldown <= 0) return Math.random() < 0.3
  return turnNumber > 0 && turnNumber % enemy.specialAbility.cooldown === 0
}

export function processPlayerAction(
  combatState: CombatState,
  action: CombatActionRequest,
  character: FantasyCharacter
): { combatState: CombatState; consumedItemId?: string } {
  let { enemy, playerState, turnNumber, combatLog, status } = structuredClone(combatState)
  const newLogs: CombatLogEntry[] = []
  let consumedItemId: string | undefined

  if (status !== 'active') {
    return { combatState }
  }

  turnNumber += 1
  playerState.isDefending = false

  // Process player action
  switch (action.action) {
    case 'attack': {
      const damage = calculatePlayerDamage(playerState, enemy)
      enemy.hp = Math.max(0, enemy.hp - damage)
      newLogs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'attack',
        damage,
        description: `You strike ${enemy.name} for ${damage} damage!`,
      })
      break
    }
    case 'defend': {
      playerState.isDefending = true
      newLogs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'defend',
        description: 'You brace yourself, doubling your defense for this turn.',
      })
      break
    }
    case 'use_item': {
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
      },
      consumedItemId,
    }
  }

  // Enemy turn
  const useSpecial = shouldUseSpecialAbility(enemy, turnNumber)
  if (useSpecial && enemy.specialAbility) {
    const specialDmg = Math.max(
      1,
      Math.round(randomVariance(enemy.specialAbility.damage) - (playerState.isDefending ? playerState.defense : playerState.defense / 2))
    )
    playerState.hp = Math.max(0, playerState.hp - specialDmg)
    newLogs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'special',
      damage: specialDmg,
      description: `${enemy.name} uses ${enemy.specialAbility.name}! You take ${specialDmg} damage!`,
    })
  } else {
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

  return {
    combatState: {
      ...combatState,
      enemy,
      playerState,
      turnNumber,
      combatLog: [...combatLog, ...newLogs],
      status,
    },
    consumedItemId,
  }
}

export interface CombatRewards {
  xp: number
  gold: number
  loot: Item[]
}

export function getCombatRewards(
  combatState: CombatState,
  character: FantasyCharacter
): CombatRewards {
  const { enemy } = combatState
  const xp = enemy.xpReward
  const gold = enemy.goldReward

  // Select loot based on luck
  const loot: Item[] = []
  if (enemy.lootTable) {
    for (const item of enemy.lootTable) {
      const dropChance = 0.3 + character.luck * 0.03
      if (Math.random() < dropChance) {
        loot.push(item)
      }
    }
  }

  return { xp, gold, loot }
}
