import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { clampGold } from '@/app/tap-tap-adventure/lib/contextBuilder'

export interface UseItemResult {
  character: FantasyCharacter
  consumed: boolean
  message: string
}

export function useItem(character: FantasyCharacter, item: Item): UseItemResult {
  if (item.type === 'spell_scroll') {
    return {
      character,
      consumed: false,
      message: `${item.name} contains a spell. Use "Learn Spell" to add it to your spellbook.`,
    }
  }

  if (item.type !== 'consumable' || !item.effects) {
    return {
      character,
      consumed: false,
      message: `${item.name} cannot be used.`,
    }
  }

  if (item.status === 'deleted') {
    return {
      character,
      consumed: false,
      message: `${item.name} has been discarded.`,
    }
  }

  let updatedCharacter: FantasyCharacter = { ...character }
  const effects = item.effects
  const effectMessages: string[] = []

  if (effects.gold) {
    updatedCharacter.gold = clampGold(updatedCharacter.gold + effects.gold)
    effectMessages.push(`${effects.gold > 0 ? '+' : ''}${effects.gold} Gold`)
  }
  if (effects.reputation) {
    updatedCharacter.reputation += effects.reputation
    effectMessages.push(`${effects.reputation > 0 ? '+' : ''}${effects.reputation} Reputation`)
  }
  if (effects.heal) {
    const maxHp = updatedCharacter.maxHp ?? 100
    const oldHp = updatedCharacter.hp ?? maxHp
    updatedCharacter.hp = Math.min(maxHp, oldHp + effects.heal)
    const actualHeal = (updatedCharacter.hp ?? 0) - oldHp
    if (actualHeal > 0) {
      effectMessages.push(`+${actualHeal} HP`)
    }
  }
  if (effects.strength) {
    updatedCharacter.strength += effects.strength
    effectMessages.push(`${effects.strength > 0 ? '+' : ''}${effects.strength} Strength`)
  }
  if (effects.intelligence) {
    updatedCharacter.intelligence += effects.intelligence
    effectMessages.push(`${effects.intelligence > 0 ? '+' : ''}${effects.intelligence} Intelligence`)
  }
  if (effects.luck) {
    updatedCharacter.luck += effects.luck
    effectMessages.push(`${effects.luck > 0 ? '+' : ''}${effects.luck} Luck`)
  }
  if (effects.charisma) {
    updatedCharacter.charisma += effects.charisma
    effectMessages.push(`${effects.charisma > 0 ? '+' : ''}${effects.charisma} Charisma`)
  }
  if (effects.revealLandmark) {
    const ls = updatedCharacter.landmarkState
    if (ls) {
      const hiddenIdx = ls.landmarks.findIndex(lm => lm.hidden)
      if (hiddenIdx !== -1) {
        const updatedLandmarks = ls.landmarks.map((lm, i) =>
          i === hiddenIdx ? { ...lm, hidden: false } : lm
        )
        updatedCharacter = {
          ...updatedCharacter,
          landmarkState: { ...ls, landmarks: updatedLandmarks },
        }
        effectMessages.push(`Revealed a hidden landmark: ${ls.landmarks[hiddenIdx].name}`)
      } else {
        effectMessages.push('No hidden landmarks to reveal')
      }
    } else {
      effectMessages.push('No landmarks in this area')
    }
  }

  // Update inventory: decrement quantity or remove
  const updatedInventory = character.inventory
    .map(i => {
      if (i.id !== item.id) return i
      const newQuantity = i.quantity - 1
      if (newQuantity <= 0) {
        return { ...i, quantity: 0, status: 'deleted' as const }
      }
      return { ...i, quantity: newQuantity }
    })
    .filter(i => i.quantity > 0 || i.status === 'deleted')
  updatedCharacter.inventory = updatedInventory

  const message = effectMessages.length > 0
    ? `Used ${item.name}: ${effectMessages.join(', ')}`
    : `Used ${item.name}.`

  return {
    character: updatedCharacter,
    consumed: true,
    message,
  }
}
