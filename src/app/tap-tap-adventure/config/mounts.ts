import { Mount, MountPersonality } from '@/app/tap-tap-adventure/models/mount'

export const MOUNT_DEFINITIONS: Mount[] = [
  { id: 'horse', name: 'Horse', description: 'A reliable steed.', rarity: 'common', bonuses: { strength: 1, autoWalkSpeed: 1.5 }, icon: '🐴', dailyCost: 1 },
  { id: 'mule', name: 'Mule', description: 'Slow but lucky.', rarity: 'common', bonuses: { luck: 2 }, icon: '🫏', dailyCost: 1 },
  { id: 'war-horse', name: 'War Horse', description: 'Trained for battle.', rarity: 'uncommon', bonuses: { strength: 2, autoWalkSpeed: 1.3 }, icon: '🐎', dailyCost: 2 },
  { id: 'owl', name: 'Owl', description: 'Sees all, knows all.', rarity: 'uncommon', bonuses: { intelligence: 2, autoWalkSpeed: 1.2 }, icon: '🦉', dailyCost: 2 },
  { id: 'wolf', name: 'Wolf', description: 'Fast and fierce.', rarity: 'uncommon', bonuses: { strength: 1, luck: 1, autoWalkSpeed: 1.4 }, icon: '🐺', dailyCost: 2 },
  { id: 'griffin', name: 'Griffin', description: 'Majestic and swift.', rarity: 'rare', bonuses: { strength: 2, intelligence: 1, autoWalkSpeed: 2 }, icon: '🦅', dailyCost: 3 },
  { id: 'phoenix', name: 'Phoenix', description: 'Burns with restorative fire.', rarity: 'rare', bonuses: { intelligence: 2, healRate: 1 }, icon: '🔥', dailyCost: 3 },
  { id: 'shadow-steed', name: 'Shadow Steed', description: 'Moves between shadows.', rarity: 'rare', bonuses: { luck: 2, strength: 1, autoWalkSpeed: 1.5 }, icon: '🌑', dailyCost: 3 },
  { id: 'dragon', name: 'Dragon', description: 'The ultimate mount.', rarity: 'legendary', bonuses: { strength: 3, intelligence: 2, luck: 1, autoWalkSpeed: 2 }, icon: '🐉', dailyCost: 5 },
]

export function getMountById(id: string): Mount | undefined {
  return MOUNT_DEFINITIONS.find(m => m.id === id)
}

export function getMountsByRarity(rarity: Mount['rarity']): Mount[] {
  return MOUNT_DEFINITIONS.filter(m => m.rarity === rarity)
}

export function getMountPrice(rarity: Mount['rarity']): number {
  switch (rarity) {
    case 'common': return 30
    case 'uncommon': return 60
    case 'rare': return 120
    case 'legendary': return 300
  }
}

export function getMountSellPrice(rarity: Mount['rarity']): number {
  return Math.floor(getMountPrice(rarity) / 2)
}

/** Returns the number of free movement actions per turn based on mount rarity. */
export function getMountFreeMoves(rarity: Mount['rarity']): number {
  switch (rarity) {
    case 'common': return 0
    case 'uncommon': return 1
    case 'rare': return 2
    case 'legendary': return 4
  }
}

/** Returns the flee chance bonus (as a percentage, e.g. 10 = +10%) based on mount rarity. */
export function getMountFleeBonus(rarity: Mount['rarity']): number {
  switch (rarity) {
    case 'common': return 10
    case 'uncommon': return 20
    case 'rare': return 30
    case 'legendary': return 50
  }
}

export const MOUNT_PERSONALITY_INFO: Record<MountPersonality, { label: string; description: string; icon: string }> = {
  loyal: { label: 'Loyal', description: 'Never abandons you. +5% flee chance.', icon: '🤝' },
  skittish: { label: 'Skittish', description: 'Nervous in combat. -5% flee chance.', icon: '😰' },
  aggressive: { label: 'Aggressive', description: '+2 bonus damage at close range.', icon: '😤' },
  cautious: { label: 'Cautious', description: 'Prefers safety. +15% flee chance.', icon: '🛡️' },
  prideful: { label: 'Prideful', description: 'Prideful nature. +10% damage at high reputation.', icon: '👑' },
  wild: { label: 'Wild', description: 'Untamed spirit. Occasionally disobeys.', icon: '🌪️' },
  gentle: { label: 'Gentle', description: '+1 heal rate while traveling.', icon: '🌿' },
  fierce: { label: 'Fierce', description: 'Reflects 10% damage back to attackers.', icon: '🔥' },
  stubborn: { label: 'Stubborn', description: 'Immune to fear effects.', icon: '🪨' },
  greedy: { label: 'Greedy', description: '+10% gold from combat.', icon: '💰' },
}

const PERSONALITY_POOL: MountPersonality[] = [
  'loyal', 'skittish', 'aggressive', 'cautious', 'prideful',
  'wild', 'gentle', 'fierce', 'stubborn', 'greedy',
]

export function assignMountPersonality(): MountPersonality {
  return PERSONALITY_POOL[Math.floor(Math.random() * PERSONALITY_POOL.length)]
}

/** Returns a mount appropriate for the character's level (never legendary in shops). */
export function getShopMount(characterLevel: number): Mount {
  let pool: Mount[]
  if (characterLevel >= 7) {
    pool = [...getMountsByRarity('uncommon'), ...getMountsByRarity('rare')]
  } else if (characterLevel >= 4) {
    pool = [...getMountsByRarity('common'), ...getMountsByRarity('uncommon')]
  } else {
    pool = getMountsByRarity('common')
  }
  const mount = pool[Math.floor(Math.random() * pool.length)]
  return { ...mount, personality: assignMountPersonality() }
}

export function getRandomMount(luckBonus: number = 0): Mount {
  const roll = Math.random() + luckBonus * 0.02
  let pool: Mount[]
  if (roll > 0.95) { pool = getMountsByRarity('legendary') }
  else if (roll > 0.8) { pool = getMountsByRarity('rare') }
  else if (roll > 0.5) { pool = getMountsByRarity('uncommon') }
  else { pool = getMountsByRarity('common') }
  const mount = pool[Math.floor(Math.random() * pool.length)]
  return { ...mount, personality: assignMountPersonality() }
}
