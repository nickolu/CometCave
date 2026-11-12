import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { clampGold } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { generateMapLandmark, GeneratedLandmark } from '@/app/tap-tap-adventure/lib/landmarkGenerator'

export interface UseItemResult {
  character: FantasyCharacter
  consumed: boolean
  message: string
  /** Set when a map or chart put a place on the map: where it now sits in `landmarkState.landmarks`. */
  revealedLandmark?: { index: number; name: string }
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
  let revealedLandmark: UseItemResult['revealedLandmark']
  if (effects.revealLandmark) {
    const ls = updatedCharacter.landmarkState
    if (ls) {
      const hiddenIdx = ls.landmarks.findIndex(lm => lm.hidden)
      if (hiddenIdx !== -1) {
        // Reveal existing hidden landmark; "mapped" keeps it on the map at any distance.
        const updatedLandmarks = ls.landmarks.map((lm, i) =>
          i === hiddenIdx ? { ...lm, hidden: false, mapped: true } : lm
        )
        updatedCharacter = {
          ...updatedCharacter,
          landmarkState: { ...ls, landmarks: updatedLandmarks },
        }
        revealedLandmark = { index: hiddenIdx, name: ls.landmarks[hiddenIdx].name }
        effectMessages.push(`Revealed a hidden landmark: ${ls.landmarks[hiddenIdx].name}`)
      } else {
        // No hidden landmarks — generate a new one
        const bounds = ls.regionBounds ?? { width: 500, height: 500 }
        const newLandmark = generateMapLandmark(ls.regionId, ls.landmarks as GeneratedLandmark[], bounds)
        if (newLandmark) {
          const mapped = { ...newLandmark, mapped: true }
          const updatedLandmarks = [...ls.landmarks, mapped].sort(
            (a, b) => a.distanceFromEntry - b.distanceFromEntry
          )
          // The new place slots in by distance, so every index at or after it
          // moves up one. Keep the target (and the exits, which sit past the
          // last landmark) pointing at the same place.
          const newIdx = updatedLandmarks.indexOf(mapped)
          const shift = (idx: number) => (idx >= newIdx ? idx + 1 : idx)
          updatedCharacter = {
            ...updatedCharacter,
            landmarkState: {
              ...ls,
              landmarks: updatedLandmarks,
              activeTargetIndex: shift(ls.activeTargetIndex ?? 0),
              nextLandmarkIndex: shift(ls.nextLandmarkIndex ?? 0),
            },
          }
          revealedLandmark = { index: newIdx, name: newLandmark.name }
          effectMessages.push(`Your map reveals a new location: ${newLandmark.name}`)
        } else {
          effectMessages.push('Your map shows nothing new in this area')
        }
      }
    } else {
      effectMessages.push('No landmarks in this area')
    }
  }

  if (effects.companionGift) {
    return {
      character,
      consumed: false,
      message: `${item.name} is a companion gift. Use it from the Party panel to give it to a party member.`,
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
    ...(revealedLandmark ? { revealedLandmark } : {}),
  }
}
