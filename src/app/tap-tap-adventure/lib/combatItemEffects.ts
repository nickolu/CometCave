import { CombatPlayerState } from '@/app/tap-tap-adventure/models/combat'
import { Item } from '@/app/tap-tap-adventure/models/item'

export function isUsableInCombat(item: Item): boolean {
  if (item.type !== 'consumable' || !item.effects) return false
  const { strength, intelligence, luck, charisma, heal, shield, manaRestore, cleanse, damageBoost } = item.effects
  return !!(strength || intelligence || luck || charisma || heal || shield || manaRestore || cleanse || damageBoost)
}

export function applyCombatItemEffect(
  item: Item,
  playerState: CombatPlayerState
): { playerState: CombatPlayerState; description: string } {
  if (!item.effects) {
    return { playerState, description: `${item.name} has no effect in combat.` }
  }

  const updated = {
    ...playerState,
    activeBuffs: [...(playerState.activeBuffs ?? [])],
    statusEffects: [...(playerState.statusEffects ?? [])],
  }
  const parts: string[] = []

  // Heal effect → restore HP directly
  if (item.effects.heal) {
    const oldHp = updated.hp
    updated.hp = Math.min(updated.maxHp, updated.hp + item.effects.heal)
    const actualHeal = updated.hp - oldHp
    if (actualHeal > 0) {
      parts.push(`restored ${actualHeal} HP`)
    }
  }

  // Shield effect → add damage-absorbing shield
  if (item.effects.shield) {
    updated.shield = (updated.shield ?? 0) + item.effects.shield
    parts.push(`gained ${item.effects.shield} shield`)
  }

  // Mana restore → restore MP directly
  if (item.effects.manaRestore) {
    const oldMana = updated.mana ?? 0
    const maxMana = updated.maxMana ?? 0
    updated.mana = Math.min(maxMana, oldMana + item.effects.manaRestore)
    const actualRestore = (updated.mana ?? 0) - oldMana
    if (actualRestore > 0) {
      parts.push(`restored ${actualRestore} MP`)
    }
  }

  // Cleanse → remove all negative status effects
  if (item.effects.cleanse) {
    const debuffTypes = new Set(['poison', 'burn', 'slow', 'curse', 'fear'])
    const before = updated.statusEffects.length
    updated.statusEffects = updated.statusEffects.filter(e => !debuffTypes.has(e.type))
    const removed = before - updated.statusEffects.length
    if (removed > 0) {
      parts.push(`cleansed ${removed} debuff${removed !== 1 ? 's' : ''}`)
    } else {
      parts.push('no debuffs to cleanse')
    }
  }

  // Damage boost → temporary attack buff
  if (item.effects.damageBoost) {
    const boostValue = Math.round((item.effects.damageBoost - 1) * 100)
    updated.activeBuffs.push({
      stat: 'attack',
      value: Math.max(3, Math.round(updated.attack * (item.effects.damageBoost - 1))),
      turnsRemaining: 2,
    })
    parts.push(`+${boostValue}% damage for 2 turns`)
  }

  // Strength effect → attack buff
  if (item.effects.strength) {
    updated.activeBuffs.push({
      stat: 'attack',
      value: item.effects.strength * 2,
      turnsRemaining: 3,
    })
    parts.push(`+${item.effects.strength * 2} attack for 3 turns`)
  }

  // Intelligence effect → defense buff
  if (item.effects.intelligence) {
    updated.activeBuffs.push({
      stat: 'defense',
      value: item.effects.intelligence * 2,
      turnsRemaining: 3,
    })
    parts.push(`+${item.effects.intelligence * 2} defense for 3 turns`)
  }

  // Luck effect → attack buff (critical hit boost)
  if (item.effects.luck) {
    updated.activeBuffs.push({
      stat: 'attack',
      value: item.effects.luck * 2,
      turnsRemaining: 3,
    })
    parts.push(`+${item.effects.luck * 2} attack for 3 turns`)
  }

  // Charisma effect → defense buff (intimidating presence)
  if (item.effects.charisma) {
    updated.activeBuffs.push({
      stat: 'defense',
      value: item.effects.charisma * 2,
      turnsRemaining: 3,
    })
    parts.push(`+${item.effects.charisma * 2} defense for 3 turns`)
  }

  const description =
    parts.length > 0
      ? `You use ${item.name}: ${parts.join(', ')}!`
      : `You use ${item.name}, but it has no combat effect.`

  return { playerState: updated, description }
}
