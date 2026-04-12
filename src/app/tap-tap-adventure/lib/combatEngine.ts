import { CLASS_ABILITIES, getClassElement, getSpellConfigForCharacter } from '@/app/tap-tap-adventure/config/characterOptions'
import { getElementalMultiplier, getEffectivenessText } from '@/app/tap-tap-adventure/config/elements'
import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Skill } from '@/app/tap-tap-adventure/models/skill'
import { getSkillBonus, hasSkill } from '@/app/tap-tap-adventure/lib/skillTracker'
import {
  CombatActionRequest,
  CombatEnemy,
  CombatLogEntry,
  CombatPlayerState,
  CombatState,
  EnemyTelegraph,
} from '@/app/tap-tap-adventure/models/combat'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { getRandomMount } from '@/app/tap-tap-adventure/config/mounts'

import { applyCombatItemEffect, isUsableInCombat } from './combatItemEffects'
import { calculateMaxMana } from './leveling'
import {
  applyShieldAbsorption,
  castSpell,
  getActiveDamageReduction,
  tickSpellCooldowns,
  tickSpellEffects,
} from './spellEngine'
import {
  applyStatusEffect,
  checkFearSkip,
  createStatusEffectFromAbility,
  getBerserkAttackMultiplier,
  getBerserkDefenseMultiplier,
  getBurnDefenseMultiplier,
  getSlowMultiplier,
  getThornsDamage,
  hasStatusEffect,
  processReflect,
  tickStatusEffects,
} from './statusEffects'

/** Resolve unlocked Skill objects from the character's stored skill IDs. */
function resolveSkills(character: FantasyCharacter): Skill[] {
  const ids = character.unlockedSkills ?? []
  return SKILLS.filter(s => ids.includes(s.id))
}

export function initializePlayerCombatState(character: FantasyCharacter): CombatPlayerState {
  // Calculate equipment bonuses
  const equipment = character.equipment ?? { weapon: null, armor: null, accessory: null }
  const weaponBonus = equipment.weapon?.effects?.strength ?? 0
  const armorBonus = equipment.armor?.effects?.intelligence ?? 0
  const accessoryLuckBonus = equipment.accessory?.effects?.luck ?? 0

  // Calculate mount bonuses
  const mountStrBonus = character.activeMount?.bonuses?.strength ?? 0
  const mountIntBonus = character.activeMount?.bonuses?.intelligence ?? 0
  const mountLuckBonus = character.activeMount?.bonuses?.luck ?? 0

  // Resolve passive skill bonuses
  const skills = resolveSkills(character)
  const attackBonus = getSkillBonus(skills, 'attack')
  const allStatsBonus = getSkillBonus(skills, 'all_stats')

  // Use persistent HP from character, falling back to max if not set
  const maxHp = character.maxHp ?? (30 + character.strength * 3 + character.level * 8)
  const currentHp = character.hp ?? maxHp
  const maxMana = character.maxMana ?? calculateMaxMana(character)
  const currentMana = character.mana ?? maxMana

  const baseAttack = 2 + character.strength + mountStrBonus + Math.floor(character.level / 2) + weaponBonus * 2
  const baseDefense = 1 + Math.floor((character.intelligence + mountIntBonus) / 2) + Math.floor(character.level / 2) + armorBonus

  return {
    hp: currentHp,
    maxHp,
    attack: baseAttack + attackBonus.flat + allStatsBonus.flat,
    defense: baseDefense + allStatsBonus.flat,
    isDefending: false,
    activeBuffs: [
      ...(accessoryLuckBonus > 0 ? [{ stat: 'attack' as const, value: accessoryLuckBonus, turnsRemaining: 999 }] : []),
      ...(mountLuckBonus > 0 ? [{ stat: 'attack' as const, value: mountLuckBonus, turnsRemaining: 999 }] : []),
    ],
    comboCount: 0,
    abilityCooldown: 0,
    enemyStunned: false,
    mana: currentMana,
    maxMana,
    spellCooldowns: {},
    activeSpellEffects: [],
    spellTagsUsed: [],
    shield: 0,
    statusEffects: [],
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
  enemy: CombatEnemy,
  character?: FantasyCharacter
): { damage: number; elementalMultiplier: number } {
  const buffedAttack =
    playerState.attack +
    (playerState.activeBuffs ?? [])
      .filter(b => b.stat === 'attack')
      .reduce((sum, b) => sum + b.value, 0)
  const comboMultiplier = getComboMultiplier(playerState.comboCount)
  const berserkMultiplier = getBerserkAttackMultiplier(playerState.statusEffects)
  const enemyDefense = enemy.defense * getBurnDefenseMultiplier(enemy.statusEffects)

  const attackElement = character
    ? getClassElement(character.class, character.classData)
    : undefined
  const elementalMultiplier = getElementalMultiplier(attackElement, enemy.element)

  const raw = randomVariance(buffedAttack) * comboMultiplier * berserkMultiplier * elementalMultiplier - enemyDefense
  return { damage: Math.max(1, Math.round(raw)), elementalMultiplier }
}

export function calculateEnemyDamage(
  enemy: CombatEnemy,
  playerState: CombatPlayerState,
  isHeavyAttack: boolean = false,
  character?: FantasyCharacter
): { damage: number; elementalMultiplier: number } {
  const effectiveDefense = playerState.isDefending
    ? playerState.defense * 2
    : playerState.defense
  const burnDefMult = getBurnDefenseMultiplier(playerState.statusEffects)
  const berserkDefMult = getBerserkDefenseMultiplier(playerState.statusEffects)
  const buffedDefense =
    (effectiveDefense * burnDefMult * berserkDefMult) +
    (playerState.activeBuffs ?? [])
      .filter(b => b.stat === 'defense')
      .reduce((sum, b) => sum + b.value, 0)
  const slowMultiplier = getSlowMultiplier(enemy.statusEffects)

  const defenseElement = character
    ? getClassElement(character.class, character.classData)
    : undefined
  const elementalMultiplier = getElementalMultiplier(enemy.element, defenseElement)

  const attackPower = (isHeavyAttack ? enemy.attack * 1.5 : enemy.attack) * slowMultiplier * elementalMultiplier
  const raw = randomVariance(attackPower) - buffedDefense
  return { damage: Math.max(1, Math.round(raw)), elementalMultiplier }
}

export function calculateFleeChance(
  character: FantasyCharacter,
  enemy: CombatEnemy
): number {
  const skills = resolveSkills(character)
  const fleeBonus = getSkillBonus(skills, 'flee_chance')
  const allStatsBonus = getSkillBonus(skills, 'all_stats')
  const effectiveLuck = character.luck + allStatsBonus.flat
  const chance = 0.3 + effectiveLuck * 0.02 - enemy.level * 0.05 + fleeBonus.percentage / 100
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

  // Telegraph status ability
  if (enemy.statusAbility && Math.random() < 0.3) {
    const statusNames: Record<string, string> = {
      poison: 'venomous',
      burn: 'fiery',
      slow: 'chilling',
      curse: 'cursed',
      fear: 'terrifying',
    }
    const adjective = statusNames[enemy.statusAbility.type] ?? 'empowered'
    return {
      action: 'normal_attack',
      description: `${enemy.name} prepares a ${adjective} strike!`,
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
  turnNumber: number,
  character?: FantasyCharacter
): { playerState: CombatPlayerState; logs: CombatLogEntry[]; enemyDefenseBoost: boolean } {
  const logs: CombatLogEntry[] = []
  let updatedPlayer = { ...playerState }
  let enemyDefenseBoost = false

  switch (telegraph.action) {
    case 'heavy_attack': {
      const { damage: dmg, elementalMultiplier } = calculateEnemyDamage(enemy, updatedPlayer, true, character)
      updatedPlayer.hp = Math.max(0, updatedPlayer.hp - dmg)
      const elemText = getEffectivenessText(elementalMultiplier)
      logs.push({
        turn: turnNumber,
        actor: 'enemy',
        action: 'heavy_attack',
        damage: dmg,
        description: `${enemy.name} unleashes a powerful blow for ${dmg} damage!${elemText ? ` ${elemText}` : ''}`,
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
      const { damage: dmg, elementalMultiplier } = calculateEnemyDamage(enemy, updatedPlayer, false, character)
      updatedPlayer.hp = Math.max(0, updatedPlayer.hp - dmg)
      const elemText = getEffectivenessText(elementalMultiplier)
      logs.push({
        turn: turnNumber,
        actor: 'enemy',
        action: 'attack',
        damage: dmg,
        description: `${enemy.name} attacks you for ${dmg} damage!${elemText ? ` ${elemText}` : ''}`,
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
      const { damage, elementalMultiplier } = calculatePlayerDamage(playerState, effectiveEnemy, character)
      enemy.hp = Math.max(0, enemy.hp - damage)
      playerState.comboCount = (playerState.comboCount ?? 0) + 1
      const comboText = playerState.comboCount > 1 ? ` (${playerState.comboCount}x combo!)` : ''
      const elemText = getEffectivenessText(elementalMultiplier)
      newLogs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'attack',
        damage,
        description: `You strike ${enemy.name} for ${damage} damage!${comboText}${elemText ? ` ${elemText}` : ''}`,
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
          const { damage: baseDmg, elementalMultiplier } = calculatePlayerDamage(playerState, enemy, character)
          const damage = Math.max(1, Math.round(baseDmg * 0.8))
          enemy.hp = Math.max(0, enemy.hp - damage)
          playerState.enemyStunned = true
          playerState.comboCount = (playerState.comboCount ?? 0) + 1
          const elemText = getEffectivenessText(elementalMultiplier)
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'class_ability',
            damage,
            description: `You bash ${enemy.name} with your shield for ${damage} damage, stunning them!${elemText ? ` ${elemText}` : ''}`,
          })
          break
        }
        case 'mage': {
          const { damage: baseDmg, elementalMultiplier } = calculatePlayerDamage(playerState, enemy, character)
          const damage = Math.max(1, Math.round(baseDmg * 2))
          const recoil = Math.max(1, Math.round(playerState.maxHp * 0.2))
          enemy.hp = Math.max(0, enemy.hp - damage)
          playerState.hp = Math.max(1, playerState.hp - recoil)
          playerState.comboCount = 0
          const elemText = getEffectivenessText(elementalMultiplier)
          newLogs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'class_ability',
            damage,
            description: `You unleash an Arcane Blast for ${damage} damage! The magical recoil deals ${recoil} damage to you.${elemText ? ` ${elemText}` : ''}`,
          })
          break
        }
        case 'rogue': {
          const combo = playerState.comboCount ?? 0
          if (combo >= 2) {
            const { damage: baseDmg, elementalMultiplier } = calculatePlayerDamage(playerState, enemy, character)
            const damage = Math.max(1, Math.round(baseDmg * 3))
            enemy.hp = Math.max(0, enemy.hp - damage)
            playerState.comboCount = 0
            const elemText = getEffectivenessText(elementalMultiplier)
            newLogs.push({
              turn: turnNumber,
              actor: 'player',
              action: 'class_ability',
              damage,
              description: `You exploit your ${combo}x combo with a devastating Backstab for ${damage} damage!${elemText ? ` ${elemText}` : ''}`,
            })
          } else {
            const { damage, elementalMultiplier } = calculatePlayerDamage(playerState, enemy, character)
            enemy.hp = Math.max(0, enemy.hp - damage)
            playerState.comboCount = (playerState.comboCount ?? 0) + 1
            const elemText = getEffectivenessText(elementalMultiplier)
            newLogs.push({
              turn: turnNumber,
              actor: 'player',
              action: 'class_ability',
              damage,
              description: `Your Backstab lacks setup and deals ${damage} normal damage.${elemText ? ` ${elemText}` : ''}`,
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
      try {
        const spellCombatState = { ...combatState, turnNumber, combatLog: [...combatLog, ...newLogs] }
        const spellResult = castSpell(spell, playerState, enemy, character, spellCombatState)
        playerState = spellResult.playerState
        enemy = spellResult.enemy
        newLogs.push(...spellResult.logs)
      } catch (err) {
        console.error('Spell casting error:', err)
        newLogs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `Failed to cast ${spell.name}. The spell fizzles.`,
        })
      }
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
  // Check fear: 50% chance to skip action
  const enemyFeared = checkFearSkip(enemy.statusEffects)
  if (playerState.enemyStunned) {
    playerState.enemyStunned = false
    newLogs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'stunned',
      description: `${enemy.name} is stunned and cannot act!`,
    })
  } else if (enemyFeared) {
    newLogs.push({
      turn: turnNumber,
      actor: 'enemy',
      action: 'feared',
      description: `${enemy.name} is paralyzed with fear and cannot act!`,
    })
  } else if (enemyTelegraph) {
    const result = executeEnemyTelegraph(enemyTelegraph, enemy, playerState, turnNumber, character)
    playerState = result.playerState
    const enemyDmgLog = result.logs.find(l => l.damage && l.damage > 0)
    let actualDamageDealt = 0
    if (enemyDmgLog && enemyDmgLog.damage) {
      const originalDmg = enemyDmgLog.damage
      playerState.hp = Math.min(playerState.maxHp, playerState.hp + originalDmg)

      const dmgReduction = getActiveDamageReduction(playerState)
      const reducedDmg = Math.max(1, Math.round(originalDmg * (1 - dmgReduction / 100)))
      const shieldResult = applyShieldAbsorption(playerState, reducedDmg)
      playerState = shieldResult.playerState
      actualDamageDealt = shieldResult.damageAfterShield

      // Apply reflect
      if (hasStatusEffect(playerState.statusEffects, 'reflect')) {
        const reflectResult = processReflect(playerState.statusEffects ?? [], actualDamageDealt)
        if (reflectResult.reflectedDamage > 0) {
          enemy.hp = Math.max(0, enemy.hp - reflectResult.reflectedDamage)
          playerState = { ...playerState, statusEffects: reflectResult.updatedEffects }
          newLogs.push({
            turn: turnNumber, actor: 'player', action: 'reflect', damage: reflectResult.reflectedDamage,
            description: `Your reflect barrier sends ${reflectResult.reflectedDamage} damage back to ${enemy.name}!`,
          })
        }
      }

      playerState.hp = Math.max(0, playerState.hp - actualDamageDealt)

      if (dmgReduction > 0 || actualDamageDealt < reducedDmg) {
        const shieldAbsorbed = reducedDmg - actualDamageDealt
        const parts: string[] = []
        if (dmgReduction > 0) parts.push(`${dmgReduction}% reduced`)
        if (shieldAbsorbed > 0) parts.push(`${shieldAbsorbed} absorbed by shield`)
        newLogs.push({
          turn: turnNumber, actor: 'player', action: 'spell_mitigation',
          description: `Spell effects mitigate damage (${parts.join(', ')})!`,
        })
      }

      // Apply thorns damage back to enemy
      const thornsDmg = getThornsDamage(playerState.statusEffects)
      if (thornsDmg > 0) {
        enemy.hp = Math.max(0, enemy.hp - thornsDmg)
        newLogs.push({
          turn: turnNumber, actor: 'player', action: 'thorns', damage: thornsDmg,
          description: `Thorns deal ${thornsDmg} damage back to ${enemy.name}!`,
        })
      }
    }
    newLogs.push(...result.logs)

    // Enemy status ability: chance to inflict status effect on player
    if (enemy.statusAbility && actualDamageDealt > 0) {
      if (Math.random() < enemy.statusAbility.chance) {
        const statusEffect = createStatusEffectFromAbility(
          enemy.statusAbility.type, enemy.statusAbility.value, enemy.statusAbility.duration, 'enemy'
        )
        playerState = { ...playerState, statusEffects: applyStatusEffect(playerState.statusEffects ?? [], statusEffect) }
        newLogs.push({
          turn: turnNumber, actor: 'enemy', action: 'status_effect',
          description: `${enemy.name} inflicts ${statusEffect.name} on you!`,
        })
      }
    }
  } else {
    const { damage: enemyDmg, elementalMultiplier: enemyElemMult } = calculateEnemyDamage(enemy, playerState, false, character)
    const dmgReduction = getActiveDamageReduction(playerState)
    const reducedDmg = Math.max(1, Math.round(enemyDmg * (1 - dmgReduction / 100)))
    const shieldResult = applyShieldAbsorption(playerState, reducedDmg)
    playerState = shieldResult.playerState
    const actualDmg = shieldResult.damageAfterShield

    // Apply reflect
    if (hasStatusEffect(playerState.statusEffects, 'reflect')) {
      const reflectResult = processReflect(playerState.statusEffects ?? [], actualDmg)
      if (reflectResult.reflectedDamage > 0) {
        enemy.hp = Math.max(0, enemy.hp - reflectResult.reflectedDamage)
        playerState = { ...playerState, statusEffects: reflectResult.updatedEffects }
        newLogs.push({
          turn: turnNumber, actor: 'player', action: 'reflect', damage: reflectResult.reflectedDamage,
          description: `Your reflect barrier sends ${reflectResult.reflectedDamage} damage back to ${enemy.name}!`,
        })
      }
    }

    const enemyElemText = getEffectivenessText(enemyElemMult)
    playerState.hp = Math.max(0, playerState.hp - actualDmg)
    newLogs.push({
      turn: turnNumber, actor: 'enemy', action: 'attack', damage: actualDmg,
      description: `${enemy.name} attacks you for ${actualDmg} damage!${dmgReduction > 0 ? ` (${dmgReduction}% reduced)` : ''}${(playerState.shield ?? 0) > 0 || reducedDmg !== actualDmg ? ' (shield absorbed some)' : ''}${enemyElemText ? ` ${enemyElemText}` : ''}`,
    })

    // Apply thorns damage back to enemy
    const thornsDmg = getThornsDamage(playerState.statusEffects)
    if (thornsDmg > 0) {
      enemy.hp = Math.max(0, enemy.hp - thornsDmg)
      newLogs.push({
        turn: turnNumber, actor: 'player', action: 'thorns', damage: thornsDmg,
        description: `Thorns deal ${thornsDmg} damage back to ${enemy.name}!`,
      })
    }

    // Enemy status ability: chance to inflict status effect on player
    if (enemy.statusAbility) {
      if (Math.random() < enemy.statusAbility.chance) {
        const statusEffect = createStatusEffectFromAbility(
          enemy.statusAbility.type, enemy.statusAbility.value, enemy.statusAbility.duration, 'enemy'
        )
        playerState = { ...playerState, statusEffects: applyStatusEffect(playerState.statusEffects ?? [], statusEffect) }
        newLogs.push({
          turn: turnNumber, actor: 'enemy', action: 'status_effect',
          description: `${enemy.name} inflicts ${statusEffect.name} on you!`,
        })
      }
    }
  }

  // Check defeat
  if (playerState.hp <= 0) {
    status = 'defeat'
    newLogs.push({
      turn: turnNumber, actor: 'enemy', action: 'defeat',
      description: `You have been defeated by ${enemy.name}...`,
    })
  }

  // Tick spell effects (DOTs, HOTs, bleeds)
  if (status === 'active') {
    const spellTickResult = tickSpellEffects(playerState, enemy, turnNumber)
    playerState = spellTickResult.playerState
    enemy = spellTickResult.enemy
    newLogs.push(...spellTickResult.logs)

    // Tick status effects (poison, burn, etc.)
    const statusTickResult = tickStatusEffects(playerState, enemy, turnNumber)
    playerState = statusTickResult.playerState
    enemy = statusTickResult.enemy
    newLogs.push(...statusTickResult.logs)

    // Check victory from DOT/bleed/status effects
    if (enemy.hp <= 0) {
      status = 'victory'
      newLogs.push({
        turn: turnNumber, actor: 'player', action: 'victory',
        description: `You defeated ${enemy.name} with lingering effects!`,
      })
    }

    // Check defeat from status effects
    if (playerState.hp <= 0) {
      status = 'defeat'
      newLogs.push({
        turn: turnNumber, actor: 'enemy', action: 'defeat',
        description: `You succumbed to status effects...`,
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
  mountDrop?: Mount
}

export function getCombatRewards(
  combatState: CombatState,
  character: FantasyCharacter
): CombatRewards {
  const { enemy } = combatState
  const skills = resolveSkills(character)
  const goldBonus = getSkillBonus(skills, 'gold_bonus')
  const lootBonus = getSkillBonus(skills, 'loot_chance')
  const gold = Math.round(enemy.goldReward * (1 + goldBonus.percentage / 100))

  const loot: Item[] = []
  if (enemy.lootTable) {
    for (const item of enemy.lootTable) {
      const baseDropChance = combatState.isBoss ? 1.0 : 0.3 + character.luck * 0.03
      const dropChance = Math.min(1, baseDropChance + lootBonus.percentage / 100)
      if (Math.random() < dropChance) {
        loot.push(item)
      }
    }
  }

  // Bosses have a chance to drop a mount
  let mountDrop: Mount | undefined
  if (combatState.isBoss) {
    const mountDropChance = 0.25 + character.luck * 0.02
    if (Math.random() < mountDropChance) {
      mountDrop = getRandomMount(character.luck)
    }
  }

  return { gold, loot, mountDrop }
}

// Re-export for tests
export { getComboMultiplier, generateEnemyTelegraph, checkBossPhaseChange }
