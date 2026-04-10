import { DEFAULT_STAT_MIN } from './gameDefaults'

export interface StatModifiers {
  strength: number
  intelligence: number
  luck: number
}

export interface RaceOption {
  id: string
  name: string
  description: string
  modifiers: StatModifiers
}

export interface ClassOption {
  id: string
  name: string
  description: string
  modifiers: StatModifiers
}

export const RACES: RaceOption[] = [
  {
    id: 'human',
    name: 'Human',
    description: 'Versatile and adaptable, humans excel in any role with balanced abilities.',
    modifiers: { strength: 1, intelligence: 1, luck: 1 },
  },
  {
    id: 'elf',
    name: 'Elf',
    description: 'Ancient and wise, elves possess keen intellect and a touch of fortune.',
    modifiers: { strength: 0, intelligence: 2, luck: 1 },
  },
  {
    id: 'dwarf',
    name: 'Dwarf',
    description: 'Stout and resilient, dwarves are unmatched in raw physical power.',
    modifiers: { strength: 2, intelligence: 1, luck: 0 },
  },
  {
    id: 'halfling',
    name: 'Halfling',
    description: 'Small but remarkably lucky, halflings have an uncanny knack for survival.',
    modifiers: { strength: 0, intelligence: 1, luck: 2 },
  },
]

export const CLASSES: ClassOption[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    description: 'A master of arms who relies on brute strength to overcome any obstacle.',
    modifiers: { strength: 3, intelligence: 0, luck: 0 },
  },
  {
    id: 'mage',
    name: 'Mage',
    description: 'A wielder of arcane forces, channeling intellect into devastating spells.',
    modifiers: { strength: 0, intelligence: 3, luck: 0 },
  },
  {
    id: 'rogue',
    name: 'Rogue',
    description: 'A cunning trickster who strikes from the shadows with deadly precision.',
    modifiers: { strength: 1, intelligence: 0, luck: 2 },
  },
  {
    id: 'ranger',
    name: 'Ranger',
    description: 'A resourceful survivor equally skilled with bow, blade, and wits.',
    modifiers: { strength: 1, intelligence: 1, luck: 1 },
  },
]


export interface ClassAbility {
  name: string
  description: string
  cooldown: number
}

export const CLASS_ABILITIES: Record<string, ClassAbility> = {
  warrior: {
    name: 'Shield Bash',
    description: 'Deals 0.8x damage and stuns the enemy, skipping their next attack.',
    cooldown: 3,
  },
  mage: {
    name: 'Arcane Blast',
    description: 'Deals 2x damage but takes 20% of max HP as recoil.',
    cooldown: 3,
  },
  rogue: {
    name: 'Backstab',
    description: 'If combo >= 2, deals 3x damage and resets combo. Otherwise deals normal damage.',
    cooldown: 2,
  },
  ranger: {
    name: 'Precise Shot',
    description: 'Ignores enemy defense entirely, dealing full base attack damage.',
    cooldown: 3,
  },
}

export interface StartingStats {
  strength: number
  intelligence: number
  luck: number
}

export function calculateStartingStats(
  race: RaceOption,
  characterClass: ClassOption
): StartingStats {
  return {
    strength: DEFAULT_STAT_MIN + race.modifiers.strength + characterClass.modifiers.strength,
    intelligence:
      DEFAULT_STAT_MIN + race.modifiers.intelligence + characterClass.modifiers.intelligence,
    luck: DEFAULT_STAT_MIN + race.modifiers.luck + characterClass.modifiers.luck,
  }
}
