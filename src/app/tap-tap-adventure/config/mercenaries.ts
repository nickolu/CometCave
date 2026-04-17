import { Mercenary, MercenaryRarity } from '@/app/tap-tap-adventure/models/mercenary'

export const MERCENARY_DEFINITIONS: Mercenary[] = [
  // Common (recruit: 50g, daily: 2g, HP: 25)
  {
    id: 'town-guard',
    name: 'Town Guard',
    description: 'A stalwart defender, trained to hold the line.',
    class: 'warrior',
    rarity: 'common',
    attack: 5,
    defense: 2,
    icon: '🛡️',
    dailyCost: 2,
    recruitCost: 50,
  },
  {
    id: 'wandering-archer',
    name: 'Wandering Archer',
    description: 'A steady hand with a bow, reliable in skirmishes.',
    class: 'ranger',
    rarity: 'common',
    attack: 6,
    defense: 1,
    icon: '🏹',
    dailyCost: 2,
    recruitCost: 50,
  },
  {
    id: 'hedge-witch',
    name: 'Hedge Witch',
    description: 'A folk healer with a few destructive cantrips up her sleeve.',
    class: 'cleric',
    rarity: 'common',
    attack: 4,
    defense: 2,
    icon: '🌿',
    dailyCost: 2,
    recruitCost: 50,
  },

  // Uncommon (recruit: 120g, daily: 4g, HP: 40)
  {
    id: 'sellsword',
    name: 'Sellsword',
    description: 'A seasoned mercenary with scars to prove it.',
    class: 'warrior',
    rarity: 'uncommon',
    attack: 10,
    defense: 4,
    icon: '⚔️',
    dailyCost: 4,
    recruitCost: 120,
  },
  {
    id: 'shadow-thief',
    name: 'Shadow Thief',
    description: 'Strikes from the blind spot and vanishes before retaliation.',
    class: 'rogue',
    rarity: 'uncommon',
    attack: 13,
    defense: 3,
    icon: '🗡️',
    dailyCost: 4,
    recruitCost: 120,
  },
  {
    id: 'battle-mage',
    name: 'Battle Mage',
    description: 'Combines raw spellcraft with martial discipline.',
    class: 'mage',
    rarity: 'uncommon',
    attack: 11,
    defense: 3,
    icon: '🔮',
    dailyCost: 4,
    recruitCost: 120,
  },

  // Rare (recruit: 250g, daily: 7g, HP: 60)
  {
    id: 'veteran-knight',
    name: 'Veteran Knight',
    description: 'A knight who has survived a hundred campaigns.',
    class: 'warrior',
    rarity: 'rare',
    attack: 15,
    defense: 7,
    icon: '🏰',
    dailyCost: 7,
    recruitCost: 250,
  },
  {
    id: 'elven-scout',
    name: 'Elven Scout',
    description: 'Fleet of foot, never misses her mark.',
    class: 'ranger',
    rarity: 'rare',
    attack: 18,
    defense: 5,
    icon: '🌲',
    dailyCost: 7,
    recruitCost: 250,
  },
  {
    id: 'war-cleric',
    name: 'War Cleric',
    description: 'Channels divine wrath into each blow.',
    class: 'cleric',
    rarity: 'rare',
    attack: 16,
    defense: 6,
    icon: '✨',
    dailyCost: 7,
    recruitCost: 250,
  },

  // Legendary (recruit: 500g, daily: 12g, HP: 90)
  {
    id: 'dread-knight',
    name: 'Dread Knight',
    description: 'A fallen paladin, channeling destruction without mercy.',
    class: 'warrior',
    rarity: 'legendary',
    attack: 25,
    defense: 11,
    icon: '💀',
    dailyCost: 12,
    recruitCost: 500,
  },
  {
    id: 'archmage-exile',
    name: 'Archmage Exile',
    description: 'Cast out from the tower, still commands terrible power.',
    class: 'mage',
    rarity: 'legendary',
    attack: 28,
    defense: 8,
    icon: '🌌',
    dailyCost: 12,
    recruitCost: 500,
  },
  {
    id: 'phantom-blade',
    name: 'Phantom Blade',
    description: 'An assassin whose name is spoken only in whispers.',
    class: 'rogue',
    rarity: 'legendary',
    attack: 26,
    defense: 9,
    icon: '👤',
    dailyCost: 12,
    recruitCost: 500,
  },
]

export function getMercenaryById(id: string): Mercenary | undefined {
  return MERCENARY_DEFINITIONS.find(m => m.id === id)
}

export function getMercenariesByRarity(rarity: MercenaryRarity): Mercenary[] {
  return MERCENARY_DEFINITIONS.filter(m => m.rarity === rarity)
}

export function getMercenaryMaxHp(rarity: MercenaryRarity): number {
  switch (rarity) {
    case 'common': return 25
    case 'uncommon': return 40
    case 'rare': return 60
    case 'legendary': return 90
  }
}

export function getMercenaryRecruitCost(rarity: MercenaryRarity): number {
  switch (rarity) {
    case 'common': return 50
    case 'uncommon': return 120
    case 'rare': return 250
    case 'legendary': return 500
  }
}

export function getMercenaryDailyCost(rarity: MercenaryRarity): number {
  switch (rarity) {
    case 'common': return 2
    case 'uncommon': return 4
    case 'rare': return 7
    case 'legendary': return 12
  }
}

/**
 * Calculate mercenary damage against an enemy.
 * Warrior gets +2 bonus. Mage gets +1 if enemy.defense > merc.attack (to punish heavily-armored targets).
 * Uses inline variance to avoid importing private combatEngine functions.
 */
export function calculateMercenaryDamage(merc: Mercenary, enemyDefense: number): number {
  let base = merc.attack
  if (merc.class === 'warrior') base += 2
  if (merc.class === 'mage' && enemyDefense > merc.attack) base += 1

  const raw = base - enemyDefense * 0.4 + (Math.random() - 0.5) * base * 0.3
  return Math.max(1, Math.round(raw))
}

/**
 * Returns 3 recruitable mercenaries appropriate for the character's level.
 * Below level 4: common only
 * Level 4-7: common + uncommon
 * Level 8+: uncommon + rare
 */
export function getTavernMercenaries(characterLevel: number): Mercenary[] {
  let pool: Mercenary[]
  if (characterLevel >= 8) {
    pool = [...getMercenariesByRarity('uncommon'), ...getMercenariesByRarity('rare')]
  } else if (characterLevel >= 4) {
    pool = [...getMercenariesByRarity('common'), ...getMercenariesByRarity('uncommon')]
  } else {
    pool = getMercenariesByRarity('common')
  }
  // Shuffle and take 3
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}
