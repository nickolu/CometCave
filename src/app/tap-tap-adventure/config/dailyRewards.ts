import { Item } from '@/app/tap-tap-adventure/models/item'
import { generateSpellForLevel } from '@/app/tap-tap-adventure/lib/spellGenerator'

export type DailyRewardType = 'gold' | 'item' | 'gold_and_reputation' | 'spell_scroll' | 'gold_and_rare_item'

export interface DailyReward {
  day: number
  label: string
  description: string
  type: DailyRewardType
  gold?: number
  reputation?: number
  /** Called at claim time to generate any items for this reward. */
  generateItems?: (characterLevel: number) => Item[]
}

function makeId(): string {
  return `daily-${Date.now()}-${Math.floor(Math.random() * 100000)}`
}

const EQUIPMENT_NAMES = [
  'Traveler\'s Blade',
  'Iron Shield',
  'Worn Leather Armor',
  'Lucky Charm',
  'Silver Ring',
  'Hunter\'s Bow',
]

const RARE_ITEM_NAMES = [
  'Phoenix Feather Amulet',
  'Dragon Scale Armor',
  'Enchanted Crystal Staff',
  'Shadow Cloak of Stealth',
  'Ancient Hero\'s Blade',
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export const DAILY_REWARDS: DailyReward[] = [
  {
    day: 1,
    label: '10 Gold',
    description: 'A small purse of gold to start your week.',
    type: 'gold',
    gold: 10,
  },
  {
    day: 2,
    label: 'Healing Potion',
    description: 'A restorative potion that mends wounds.',
    type: 'item',
    generateItems: () => [
      {
        id: makeId(),
        name: 'Daily Healing Potion',
        description: 'A healing potion received as a daily reward.',
        quantity: 1,
        type: 'consumable' as const,
        effects: { heal: 15 },
      },
    ],
  },
  {
    day: 3,
    label: '20 Gold',
    description: 'A decent haul of gold for a faithful adventurer.',
    type: 'gold',
    gold: 20,
  },
  {
    day: 4,
    label: 'Random Equipment',
    description: 'A piece of equipment found on the road.',
    type: 'item',
    generateItems: () => {
      const name = pickRandom(EQUIPMENT_NAMES)
      return [
        {
          id: makeId(),
          name,
          description: `Equipment received as a daily reward: ${name}.`,
          quantity: 1,
          type: 'equipment' as const,
          effects: {
            strength: Math.floor(Math.random() * 3) + 1,
          },
        },
      ]
    },
  },
  {
    day: 5,
    label: '30 Gold + Reputation',
    description: 'Gold and a boost to your standing among the people.',
    type: 'gold_and_reputation',
    gold: 30,
    reputation: 3,
  },
  {
    day: 6,
    label: 'Spell Scroll',
    description: 'A magical scroll containing a random spell.',
    type: 'spell_scroll',
    generateItems: (characterLevel: number) => {
      const spell = generateSpellForLevel(characterLevel)
      return [
        {
          id: makeId(),
          name: `Scroll of ${spell.name}`,
          description: `A spell scroll received as a daily reward. Contains: ${spell.name}.`,
          quantity: 1,
          type: 'spell_scroll' as const,
          spell,
        },
      ]
    },
  },
  {
    day: 7,
    label: '50 Gold + Rare Item',
    description: 'The grand prize! Riches and a rare treasure.',
    type: 'gold_and_rare_item',
    gold: 50,
    generateItems: () => {
      const name = pickRandom(RARE_ITEM_NAMES)
      return [
        {
          id: makeId(),
          name,
          description: `A rare item received as a daily reward: ${name}.`,
          quantity: 1,
          type: 'equipment' as const,
          effects: {
            strength: Math.floor(Math.random() * 3) + 2,
            luck: Math.floor(Math.random() * 3) + 1,
          },
        },
      ]
    },
  },
]
