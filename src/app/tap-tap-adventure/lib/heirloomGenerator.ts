import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'

/**
 * Generates an heirloom item from a dead or retired character.
 * Heirloom quality scales with character level and distance traveled.
 */
export function generateHeirloom(character: FantasyCharacter): Item {
  const heirloomType = pickHeirloomType(character)

  switch (heirloomType) {
    case 'spell_scroll':
      return generateSpellScrollHeirloom(character)
    case 'consumable':
      return generateConsumableHeirloom(character)
    case 'equipment':
    default:
      return generateEquipmentHeirloom(character)
  }
}

type HeirloomKind = 'equipment' | 'consumable' | 'spell_scroll'

function pickHeirloomType(character: FantasyCharacter): HeirloomKind {
  const spells = character.spellbook ?? []
  if (spells.length > 0) {
    // 40% spell scroll, 30% equipment, 30% consumable
    const roll = hashRandom(character.id + 'heirloom-type')
    if (roll < 0.4) return 'spell_scroll'
    if (roll < 0.7) return 'equipment'
    return 'consumable'
  }
  // No spells: 60% equipment, 40% consumable
  const roll = hashRandom(character.id + 'heirloom-type')
  if (roll < 0.6) return 'equipment'
  return 'consumable'
}

function qualityTier(character: FantasyCharacter): { tier: string; multiplier: number } {
  const score = character.level + Math.floor((character.distance ?? 0) / 50)
  if (score >= 20) return { tier: 'Legendary', multiplier: 3 }
  if (score >= 12) return { tier: 'Epic', multiplier: 2.2 }
  if (score >= 6) return { tier: 'Rare', multiplier: 1.5 }
  return { tier: 'Common', multiplier: 1 }
}

function strongestStat(character: FantasyCharacter): 'strength' | 'intelligence' | 'luck' {
  const stats = {
    strength: character.strength ?? 0,
    intelligence: character.intelligence ?? 0,
    luck: character.luck ?? 0,
  }
  if (stats.strength >= stats.intelligence && stats.strength >= stats.luck) return 'strength'
  if (stats.intelligence >= stats.luck) return 'intelligence'
  return 'luck'
}

function generateEquipmentHeirloom(character: FantasyCharacter): Item {
  const { tier, multiplier } = qualityTier(character)
  const stat = strongestStat(character)
  const baseBonus = Math.max(1, Math.floor(character.level * multiplier))

  const nameTemplates = [
    `${character.name}'s Lucky Charm`,
    `${character.name}'s Blade`,
    `${character.name}'s Shield`,
    `${character.name}'s Ring`,
  ]
  const nameIndex = Math.abs(simpleHash(character.id + 'name')) % nameTemplates.length
  const name = nameTemplates[nameIndex]

  const effects: Record<string, number> = {}
  effects[stat] = baseBonus

  // Higher tiers get a secondary stat bonus
  if (multiplier >= 1.5) {
    const secondaryStat = stat === 'strength' ? 'intelligence' : stat === 'intelligence' ? 'luck' : 'strength'
    effects[secondaryStat] = Math.max(1, Math.floor(baseBonus * 0.5))
  }

  return {
    id: `heirloom-${character.id}-${Date.now()}`,
    name,
    description: `A ${tier.toLowerCase()} heirloom left behind by ${character.name}, a level ${character.level} ${character.class}. It radiates with the memory of past adventures.`,
    quantity: 1,
    type: 'equipment',
    effects,
    isHeirloom: true,
  }
}

function generateConsumableHeirloom(character: FantasyCharacter): Item {
  const { tier, multiplier } = qualityTier(character)
  const healAmount = Math.floor(30 * multiplier + character.level * 5)

  return {
    id: `heirloom-${character.id}-${Date.now()}`,
    name: `${character.name}'s Final Blessing`,
    description: `A ${tier.toLowerCase()} restorative keepsake imbued with ${character.name}'s lingering spirit. Use it in times of great need.`,
    quantity: 1,
    type: 'consumable',
    effects: {
      heal: healAmount,
    },
    isHeirloom: true,
  }
}

function generateSpellScrollHeirloom(character: FantasyCharacter): Item {
  const spells = character.spellbook ?? []
  // Pick the "best" spell (highest mana cost generally = strongest)
  const spell = [...spells].sort((a, b) => b.manaCost - a.manaCost)[0]

  return {
    id: `heirloom-${character.id}-${Date.now()}`,
    name: `${character.name}'s Spell Scroll`,
    description: `A spell scroll containing ${spell.name}, preserved by ${character.name} before their journey ended.`,
    quantity: 1,
    type: 'spell_scroll',
    spell,
    isHeirloom: true,
  }
}

/** Simple deterministic hash for consistent results given the same character */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}

/** Returns a deterministic float 0..1 for the given seed string */
function hashRandom(seed: string): number {
  const h = Math.abs(simpleHash(seed))
  return (h % 10000) / 10000
}
