import { EternalUpgrade } from '@/app/tap-tap-adventure/models/metaProgression'

export const ETERNAL_UPGRADES: EternalUpgrade[] = [
  {
    id: 'resilience',
    name: 'Resilience',
    description: 'Increases maximum HP for all future characters.',
    maxLevel: 5,
    costPerLevel: [50, 150, 300, 500, 800],
    effects: { bonusHp: 5 },
  },
  {
    id: 'fortune',
    name: 'Fortune',
    description: 'Grants bonus starting gold to all future characters.',
    maxLevel: 5,
    costPerLevel: [30, 100, 200, 400, 700],
    effects: { bonusGold: 3 },
  },
  {
    id: 'scholars_mind',
    name: "Scholar's Mind",
    description: 'Increases intelligence for all future characters.',
    maxLevel: 5,
    costPerLevel: [40, 120, 250, 450, 750],
    effects: { bonusIntelligence: 1 },
  },
  {
    id: 'warriors_blood',
    name: "Warrior's Blood",
    description: 'Increases strength for all future characters.',
    maxLevel: 5,
    costPerLevel: [40, 120, 250, 450, 750],
    effects: { bonusStrength: 1 },
  },
  {
    id: 'lucky_star',
    name: 'Lucky Star',
    description: 'Increases luck for all future characters.',
    maxLevel: 5,
    costPerLevel: [40, 120, 250, 450, 750],
    effects: { bonusLuck: 1 },
  },
  {
    id: 'inner_focus',
    name: 'Inner Focus',
    description: 'Increases maximum mana for all future characters.',
    maxLevel: 5,
    costPerLevel: [60, 180, 350, 550, 850],
    effects: { bonusMana: 3 },
  },
  {
    id: 'swift_recovery',
    name: 'Swift Recovery',
    description: 'Increases heal rate while traveling.',
    maxLevel: 5,
    costPerLevel: [80, 200, 400, 650, 1000],
    effects: { healRateMultiplier: 10 },
  },
  {
    id: 'merchant_favor',
    name: "Merchant's Favor",
    description: 'Grants a discount at all shops.',
    maxLevel: 5,
    costPerLevel: [50, 150, 300, 500, 800],
    effects: { shopDiscount: 5 },
  },
  {
    id: 'veterans_instinct',
    name: "Veteran's Instinct",
    description: 'Increases experience gained from traveling.',
    maxLevel: 5,
    costPerLevel: [70, 180, 350, 600, 900],
    effects: { xpMultiplier: 5 },
  },
  {
    id: 'treasure_hunter',
    name: 'Treasure Hunter',
    description: 'Increases chance of finding loot.',
    maxLevel: 5,
    costPerLevel: [60, 160, 320, 520, 850],
    effects: { lootBonusChance: 5 },
  },
]

export function getUpgradeById(id: string): EternalUpgrade | undefined {
  return ETERNAL_UPGRADES.find(u => u.id === id)
}
