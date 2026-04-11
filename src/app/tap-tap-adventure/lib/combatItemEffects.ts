import { CombatPlayerState } from '@/app/tap-tap-adventure/models/combat'
import { Item } from '@/app/tap-tap-adventure/models/item'

export function isUsableInCombat(item: Item): boolean {
  if (item.type !== 'consumable' || !item.effects) return false
  const { strength, intelligence, luck, heal } = item.effects
  return !!(strength || intelligence || luck || heal)
}

export function applyCombatItemEffect(
  item: Item,
  playerState: CombatPlayerState
): { playerState: CombatPlayerState; description: string } {
  if (!item.effects) {
    return { playerState, description: `${item.name} has no effect in combat.` }
  }

  const updated = { ...playerState, activeBuffs: [...(playerState.activeBuffs ?? [])] }
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

  const description =
    parts.length > 0
      ? `You use ${item.name}: ${parts.join(', ')}!`
      : `You use ${item.name}, but it has no combat effect.`

  return { playerState: updated, description }
}
