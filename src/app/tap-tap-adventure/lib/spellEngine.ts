import { CLASS_SPELL_CONFIG } from '@/app/tap-tap-adventure/config/characterOptions'
import { getElementalMultiplier, getEffectivenessText } from '@/app/tap-tap-adventure/config/elements'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import {
  ActiveSpellEffect,
  CombatEnemy,
  CombatLogEntry,
  CombatPlayerState,
  CombatState,
  StatusEffectType,
} from '@/app/tap-tap-adventure/models/combat'
import { Spell, SpellCondition } from '@/app/tap-tap-adventure/models/spell'

import {
  applyStatusEffect,
  createStatusEffectFromAbility,
  getCurseHealingMultiplier,
} from './statusEffects'
import { checkSpellCombo, getSpellElement } from './spellCombos'

export interface CastSpellResult {
  playerState: CombatPlayerState
  enemy: CombatEnemy
  logs: CombatLogEntry[]
  manaUsed: number
  spellCooldown: number
  comboName: string | null
}

/**
 * Check if a spell condition is currently met.
 */
function isConditionMet(
  condition: SpellCondition,
  playerState: CombatPlayerState,
  enemy: CombatEnemy,
  combatState: CombatState
): boolean {
  switch (condition.when) {
    case 'target_hp_below_50':
      return enemy.hp < enemy.maxHp * 0.5
    case 'caster_hp_below_30':
      return playerState.hp < playerState.maxHp * 0.3
    case 'caster_combo_3_plus':
      return (playerState.comboCount ?? 0) >= 3
    case 'caster_defending':
      return playerState.isDefending
    case 'target_debuffed': {
      // Check if enemy has any debuffs applied via spell effects
      const debuffs = (playerState.activeSpellEffects ?? []).filter(
        e => e.effectType === 'debuff'
      )
      return debuffs.length > 0
    }
    case 'after_class_ability':
      return combatState.combatLog.some(
        log => log.actor === 'player' && log.action === 'class_ability' && log.turn === combatState.turnNumber
      )
    default:
      return false
  }
}

/**
 * Calculate tag synergy bonus. If any previously cast spell in this combat
 * shares a tag with the current spell, apply a 30% bonus.
 */
function getTagSynergyMultiplier(
  spell: Spell,
  spellTagsUsed: string[]
): number {
  if (spellTagsUsed.length === 0) return 1
  const hasMatchingTag = (spell.tags ?? []).some(tag => spellTagsUsed.includes(tag))
  return hasMatchingTag ? 1.3 : 1
}

/**
 * Get class school bonus multiplier.
 */
function getSchoolBonusMultiplier(
  spell: Spell,
  character: FantasyCharacter
): number {
  const classConfig = CLASS_SPELL_CONFIG[character.class.toLowerCase()]
  if (!classConfig) return 1
  if (spell.school === classConfig.favoredSchool) {
    return 1 + classConfig.schoolBonus
  }
  return 1
}

/**
 * Cast a spell during combat.
 */
export function castSpell(
  spell: Spell,
  casterState: CombatPlayerState,
  enemy: CombatEnemy,
  character: FantasyCharacter,
  combatState: CombatState
): CastSpellResult {
  const logs: CombatLogEntry[] = []
  let playerState = { ...casterState }
  let updatedEnemy = { ...enemy }
  const turnNumber = combatState.turnNumber

  // 1. Check mana
  if ((playerState.mana ?? 0) < spell.manaCost) {
    logs.push({
      turn: turnNumber,
      actor: 'player',
      action: 'cast_spell',
      description: `Not enough mana to cast ${spell.name}! (Need ${spell.manaCost}, have ${playerState.mana ?? 0})`,
    })
    return { playerState, enemy: updatedEnemy, logs, manaUsed: 0, spellCooldown: 0, comboName: null }
  }

  // 2. Check cooldown
  const cooldowns = playerState.spellCooldowns ?? {}
  if ((cooldowns[spell.id] ?? 0) > 0) {
    logs.push({
      turn: turnNumber,
      actor: 'player',
      action: 'cast_spell',
      description: `${spell.name} is on cooldown! (${cooldowns[spell.id]} turns remaining)`,
    })
    return { playerState, enemy: updatedEnemy, logs, manaUsed: 0, spellCooldown: 0, comboName: null }
  }

  // 3. Check conditions and determine bonuses
  const activeConditionBonuses: string[] = []
  if (spell.conditions) {
    for (const condition of spell.conditions) {
      if (isConditionMet(condition, playerState, updatedEnemy, combatState)) {
        activeConditionBonuses.push(condition.bonus)
      }
    }
  }

  // Check for free_cast
  const isFreeCast = activeConditionBonuses.includes('free_cast')

  // 4. Tag synergy
  const spellTagsUsed = playerState.spellTagsUsed ?? []
  const synergyMultiplier = getTagSynergyMultiplier(spell, spellTagsUsed)
  const schoolMultiplier = getSchoolBonusMultiplier(spell, character)

  // Apply double_damage / double_heal condition bonuses
  const doubleDamage = activeConditionBonuses.includes('double_damage')
  const doubleHeal = activeConditionBonuses.includes('double_heal')
  const trueDamageBonus = activeConditionBonuses.includes('true_damage')
  const extendDuration = activeConditionBonuses.includes('extend_duration')

  let conditionText = ''
  if (activeConditionBonuses.length > 0) {
    conditionText = ` [Bonus: ${activeConditionBonuses.join(', ')}]`
  }

  // 5. Iterate effects
  const newActiveEffects: ActiveSpellEffect[] = [...(playerState.activeSpellEffects ?? [])]
  let totalDamageDealt = 0

  for (const effect of spell.effects ?? []) {
    const damageMultiplier = synergyMultiplier * schoolMultiplier * (doubleDamage ? 2 : 1)
    const healMultiplier = synergyMultiplier * (doubleHeal ? 2 : 1)
    const durationBonus = extendDuration ? 2 : 0

    switch (effect.type) {
      case 'damage': {
        const elemMultiplier = getElementalMultiplier(effect.element, updatedEnemy.element)
        const baseDmg = effect.value * damageMultiplier * elemMultiplier
        const dmg = Math.max(1, Math.round(baseDmg - (trueDamageBonus ? 0 : updatedEnemy.defense * 0.3)))
        totalDamageDealt += dmg
        updatedEnemy = { ...updatedEnemy, hp: Math.max(0, updatedEnemy.hp - dmg) }
        const elemText = getEffectivenessText(elemMultiplier)
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          damage: dmg,
          description: `${spell.name} hits ${updatedEnemy.name} for ${dmg} ${effect.element ?? ''} damage!${conditionText}${elemText ? ` ${elemText}` : ''}`,
        })
        break
      }
      case 'true_damage': {
        const dmg = Math.max(1, Math.round(effect.value * damageMultiplier))
        totalDamageDealt += dmg
        updatedEnemy = { ...updatedEnemy, hp: Math.max(0, updatedEnemy.hp - dmg) }
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          damage: dmg,
          description: `${spell.name} deals ${dmg} true damage to ${updatedEnemy.name}!`,
        })
        break
      }
      case 'damage_over_time': {
        newActiveEffects.push({
          spellId: spell.id,
          effectType: 'damage_over_time',
          value: Math.round(effect.value * damageMultiplier),
          turnsRemaining: (effect.duration ?? 3) + durationBonus,
        })
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} applies a damage-over-time effect to ${updatedEnemy.name}!`,
        })
        break
      }
      case 'heal': {
        const curseMultiplier = getCurseHealingMultiplier(playerState.statusEffects)
        const healAmount = Math.round(effect.value * healMultiplier * curseMultiplier)
        playerState = {
          ...playerState,
          hp: Math.min(playerState.maxHp, playerState.hp + healAmount),
        }
        const curseText = curseMultiplier < 1 ? ' (reduced by curse!)' : ''
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} heals you for ${healAmount} HP!${curseText}`,
        })
        break
      }
      case 'heal_over_time': {
        newActiveEffects.push({
          spellId: spell.id,
          effectType: 'heal_over_time',
          value: Math.round(effect.value * healMultiplier),
          turnsRemaining: (effect.duration ?? 3) + durationBonus,
        })
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} applies a healing-over-time effect!${conditionText}`,
        })
        break
      }
      case 'shield': {
        const shieldAmount = Math.round(effect.value * synergyMultiplier)
        playerState = {
          ...playerState,
          shield: (playerState.shield ?? 0) + shieldAmount,
        }
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} grants a ${shieldAmount} point shield!`,
        })
        break
      }
      case 'damage_reduction': {
        newActiveEffects.push({
          spellId: spell.id,
          effectType: 'damage_reduction',
          value: 0,
          percentage: effect.percentage ?? 0,
          turnsRemaining: (effect.duration ?? 2) + durationBonus,
        })
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} reduces incoming damage by ${effect.percentage}%!${conditionText}`,
        })
        break
      }
      case 'buff': {
        const buffValue = Math.round(effect.value * synergyMultiplier)
        const buffs = [...(playerState.activeBuffs ?? [])]
        buffs.push({
          stat: effect.stat ?? 'attack',
          value: buffValue,
          turnsRemaining: (effect.duration ?? 2) + durationBonus,
        })
        playerState = { ...playerState, activeBuffs: buffs }
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} grants +${buffValue} ${effect.stat ?? 'attack'} for ${(effect.duration ?? 2) + durationBonus} turns!`,
        })
        break
      }
      case 'debuff': {
        // Debuffs are tracked as active spell effects
        newActiveEffects.push({
          spellId: spell.id,
          effectType: 'debuff',
          value: Math.round(effect.value * synergyMultiplier),
          turnsRemaining: (effect.duration ?? 2) + durationBonus,
        })
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} debuffs ${updatedEnemy.name} with -${effect.value} ${effect.stat ?? 'attack'}!`,
        })
        break
      }
      case 'stun': {
        playerState = { ...playerState, enemyStunned: true }
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} stuns ${updatedEnemy.name}!`,
        })
        break
      }
      case 'bleed': {
        newActiveEffects.push({
          spellId: spell.id,
          effectType: 'bleed',
          value: Math.round(effect.value * damageMultiplier),
          turnsRemaining: (effect.duration ?? 3) + durationBonus,
        })
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} causes ${updatedEnemy.name} to bleed!`,
        })
        break
      }
      case 'lifesteal': {
        const lstElemMultiplier = getElementalMultiplier(effect.element, updatedEnemy.element)
        const lstDmg = Math.max(1, Math.round(effect.value * damageMultiplier * lstElemMultiplier - updatedEnemy.defense * 0.3))
        const healPct = (effect.percentage ?? 50) / 100
        const lstHeal = Math.max(1, Math.round(lstDmg * healPct))
        totalDamageDealt += lstDmg
        updatedEnemy = { ...updatedEnemy, hp: Math.max(0, updatedEnemy.hp - lstDmg) }
        playerState = {
          ...playerState,
          hp: Math.min(playerState.maxHp, playerState.hp + lstHeal),
        }
        const lstElemText = getEffectivenessText(lstElemMultiplier)
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          damage: lstDmg,
          description: `${spell.name} drains ${lstDmg} from ${updatedEnemy.name}, healing you for ${lstHeal}!${lstElemText ? ` ${lstElemText}` : ''}`,
        })
        break
      }
      case 'cleanse': {
        // Remove debuffs from player (negative buffs)
        const cleansedBuffs = (playerState.activeBuffs ?? []).filter(b => b.value >= 0)
        const cleansedEffects = newActiveEffects.filter(
          e => e.effectType !== 'damage_over_time' && e.effectType !== 'bleed'
        )
        playerState = { ...playerState, activeBuffs: cleansedBuffs }
        newActiveEffects.length = 0
        newActiveEffects.push(...cleansedEffects)
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} cleanses harmful effects!`,
        })
        break
      }
      case 'mana_restore': {
        const manaAmount = Math.round(effect.value)
        playerState = {
          ...playerState,
          mana: Math.min(playerState.maxMana ?? 0, (playerState.mana ?? 0) + manaAmount),
        }
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} restores ${manaAmount} mana!`,
        })
        break
      }
      case 'combo_boost': {
        playerState = {
          ...playerState,
          comboCount: (playerState.comboCount ?? 0) + effect.value,
        }
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name} boosts your combo by ${effect.value}!`,
        })
        break
      }
      case 'apply_poison':
      case 'apply_burn':
      case 'apply_slow':
      case 'apply_thorns':
      case 'apply_berserk': {
        const statusType = effect.type.replace('apply_', '') as StatusEffectType
        const duration = (effect.duration ?? 3) + durationBonus
        const statusEffect = createStatusEffectFromAbility(
          statusType,
          Math.round(effect.value * synergyMultiplier),
          duration,
          'player'
        )
        if (statusType === 'thorns' || statusType === 'berserk') {
          playerState = {
            ...playerState,
            statusEffects: applyStatusEffect(playerState.statusEffects ?? [], statusEffect),
          }
          logs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'cast_spell',
            description: `${spell.name} applies ${statusEffect.name} to you for ${duration} turns!`,
          })
        } else {
          updatedEnemy = {
            ...updatedEnemy,
            statusEffects: applyStatusEffect(updatedEnemy.statusEffects ?? [], statusEffect),
          }
          logs.push({
            turn: turnNumber,
            actor: 'player',
            action: 'cast_spell',
            description: `${spell.name} applies ${statusEffect.name} to ${updatedEnemy.name} for ${duration} turns!`,
          })
        }
        break
      }
      default: {
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'cast_spell',
          description: `${spell.name}'s ${effect.type} effect activates!`,
        })
        break
      }
    }
  }

  // 5b. Spell combo system — track element history and check for combos
  const prevElements = casterState.lastCastSpellElements ?? []
  const spellElement = getSpellElement(spell)
  const updatedElements = [...prevElements, spellElement].slice(-3)

  let comboName: string | null = null
  const comboResult = checkSpellCombo(updatedElements)

  if (comboResult !== null) {
    comboName = comboResult.comboName

    // Apply bonus damage (skip if multiplier is 1.0 — e.g., Nature's Wrath is heal-only)
    if (comboResult.damageMultiplier > 1.0 && totalDamageDealt > 0) {
      const bonusDmg = Math.round(totalDamageDealt * (comboResult.damageMultiplier - 1))
      updatedEnemy = { ...updatedEnemy, hp: Math.max(0, updatedEnemy.hp - bonusDmg) }

      let bonusDesc = `+${bonusDmg} bonus damage`

      // Frostfire: halve enemy defense (simplification — no activeBuffs on CombatEnemy)
      if (comboResult.removeEnemyDefenseBuff) {
        updatedEnemy = { ...updatedEnemy, defense: Math.max(0, Math.floor(updatedEnemy.defense / 2)) }
        bonusDesc += ', enemy defense halved'
      }

      // Wild Lightning: chain hit at 50% damage
      if (comboResult.chainHit) {
        const chainDmg = Math.round(totalDamageDealt * 0.5)
        updatedEnemy = { ...updatedEnemy, hp: Math.max(0, updatedEnemy.hp - chainDmg) }
        bonusDesc += `, chain hit for ${chainDmg}`
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'spell_combo',
          damage: chainDmg,
          description: `Chain hit! ${updatedEnemy.name} takes an additional ${chainDmg} damage!`,
        })
      }

      logs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'spell_combo',
        damage: bonusDmg,
        description: `COMBO: ${comboResult.comboName}! ${bonusDesc}.`,
      })
    } else if (comboResult.damageMultiplier <= 1.0) {
      // Non-damage combo (e.g., Nature's Wrath)
      logs.push({
        turn: turnNumber,
        actor: 'player',
        action: 'spell_combo',
        description: `COMBO: ${comboResult.comboName}! `,
      })
    }

    // Nature's Wrath: heal caster for 15% maxHp
    if (comboResult.bonusHealPct > 0) {
      const healAmount = Math.round(playerState.maxHp * comboResult.bonusHealPct)
      playerState = {
        ...playerState,
        hp: Math.min(playerState.maxHp, playerState.hp + healAmount),
      }
      // Update the combo log to include the heal info
      const lastLog = logs[logs.length - 1]
      if (lastLog?.action === 'spell_combo') {
        logs[logs.length - 1] = {
          ...lastLog,
          description: lastLog.description + `healed ${healAmount} HP.`,
        }
      }
    }

    // Void Freeze: apply slow to enemy
    if (comboResult.slowEnemy) {
      const slowEffect = createStatusEffectFromAbility('slow', 5, 2, 'player')
      updatedEnemy = {
        ...updatedEnemy,
        statusEffects: applyStatusEffect(updatedEnemy.statusEffects ?? [], slowEffect),
      }
    }
  }

  // 6. Deduct mana (unless free cast)
  const manaUsed = isFreeCast ? 0 : spell.manaCost
  playerState = {
    ...playerState,
    mana: Math.max(0, (playerState.mana ?? 0) - manaUsed),
    activeSpellEffects: newActiveEffects,
    spellCooldowns: {
      ...cooldowns,
      [spell.id]: spell.cooldown,
    },
    spellTagsUsed: [...spellTagsUsed, ...(spell.tags ?? [])],
    lastCastSpellElements: updatedElements,
  }

  // Casting a spell resets combo unless the spell has combo_boost
  const hasComboBoost = (spell.effects ?? []).some(e => e.type === 'combo_boost')
  if (!hasComboBoost) {
    playerState = { ...playerState, comboCount: 0 }
  }

  return {
    playerState,
    enemy: updatedEnemy,
    logs,
    manaUsed,
    spellCooldown: spell.cooldown,
    comboName,
  }
}

/**
 * Tick active spell effects (DOTs, HOTs) at end of turn.
 */
export function tickSpellEffects(
  playerState: CombatPlayerState,
  enemy: CombatEnemy,
  turnNumber: number
): { playerState: CombatPlayerState; enemy: CombatEnemy; logs: CombatLogEntry[] } {
  const logs: CombatLogEntry[] = []
  let updatedPlayer = { ...playerState }
  let updatedEnemy = { ...enemy }
  const activeEffects = [...(updatedPlayer.activeSpellEffects ?? [])]
  const newEffects: ActiveSpellEffect[] = []

  for (const effect of activeEffects) {
    if (effect.turnsRemaining <= 0) continue

    switch (effect.effectType) {
      case 'damage_over_time': {
        updatedEnemy = { ...updatedEnemy, hp: Math.max(0, updatedEnemy.hp - effect.value) }
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'spell_dot',
          damage: effect.value,
          description: `Spell effect deals ${effect.value} damage over time to ${updatedEnemy.name}!`,
        })
        break
      }
      case 'heal_over_time': {
        const curseHotMult = getCurseHealingMultiplier(updatedPlayer.statusEffects)
        const healAmount = Math.round(effect.value * curseHotMult)
        updatedPlayer = {
          ...updatedPlayer,
          hp: Math.min(updatedPlayer.maxHp, updatedPlayer.hp + healAmount),
        }
        const curseHotText = curseHotMult < 1 ? ' (reduced by curse!)' : ''
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'spell_hot',
          description: `Healing spell restores ${healAmount} HP!${curseHotText}`,
        })
        break
      }
      case 'bleed': {
        updatedEnemy = { ...updatedEnemy, hp: Math.max(0, updatedEnemy.hp - effect.value) }
        logs.push({
          turn: turnNumber,
          actor: 'player',
          action: 'spell_bleed',
          damage: effect.value,
          description: `${updatedEnemy.name} bleeds for ${effect.value} damage!`,
        })
        break
      }
      // damage_reduction and debuff don't tick damage; they're checked during combat
    }

    const remaining = effect.turnsRemaining - 1
    if (remaining > 0) {
      newEffects.push({ ...effect, turnsRemaining: remaining })
    }
  }

  updatedPlayer = { ...updatedPlayer, activeSpellEffects: newEffects }

  return { playerState: updatedPlayer, enemy: updatedEnemy, logs }
}

/**
 * Tick spell cooldowns at end of turn (decrement by 1).
 */
export function tickSpellCooldowns(playerState: CombatPlayerState): CombatPlayerState {
  const cooldowns = playerState.spellCooldowns ?? {}
  const newCooldowns: Record<string, number> = {}
  for (const [spellId, turns] of Object.entries(cooldowns)) {
    if (turns > 1) {
      newCooldowns[spellId] = turns - 1
    }
    // if turns <= 1, it drops off (cooldown expired)
  }
  return { ...playerState, spellCooldowns: newCooldowns }
}

/**
 * Get the damage reduction percentage from active spell effects.
 */
export function getActiveDamageReduction(playerState: CombatPlayerState): number {
  const effects = playerState.activeSpellEffects ?? []
  let totalReduction = 0
  for (const effect of effects) {
    if (effect.effectType === 'damage_reduction' && effect.turnsRemaining > 0) {
      totalReduction += effect.percentage ?? 0
    }
  }
  return Math.min(75, totalReduction) // cap at 75%
}

/**
 * Apply shield absorption to incoming damage.
 * Returns the remaining damage after shield absorbs some.
 */
export function applyShieldAbsorption(
  playerState: CombatPlayerState,
  incomingDamage: number
): { playerState: CombatPlayerState; damageAfterShield: number } {
  const shield = playerState.shield ?? 0
  if (shield <= 0) return { playerState, damageAfterShield: incomingDamage }

  if (shield >= incomingDamage) {
    return {
      playerState: { ...playerState, shield: shield - incomingDamage },
      damageAfterShield: 0,
    }
  } else {
    return {
      playerState: { ...playerState, shield: 0 },
      damageAfterShield: incomingDamage - shield,
    }
  }
}
