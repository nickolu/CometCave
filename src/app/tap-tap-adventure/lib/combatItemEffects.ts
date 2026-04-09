import { CombatPlayerState } from '@/app/tap-tap-adventure/models/combat'
import { Item } from '@/app/tap-tap-adventure/models/item'

export function isUsableInCombat(item: Item): boolean {
  if (item.type !== 'consumable' || !item.effects) return false
  const { strength, intelligence, luck } = item.effects
  return !!(strength || intelligence || luck)
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

  // Strength effect → heal HP
  if (item.effects.strength) {
    const healAmount = item.effects.strength * 5
    const oldHp = updated.hp
    updated.hp = Math.min(updated.maxHp, updated.hp + healAmount)
    const actualHeal = updated.hp - oldHp
    if (actualHeal > 0) {
      parts.push(`restored ${actualHeal} HP`)
    }
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
