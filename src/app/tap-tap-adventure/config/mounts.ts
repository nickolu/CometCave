import { Mount } from '@/app/tap-tap-adventure/models/mount'

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

export function getRandomMount(luckBonus: number = 0): Mount {
  const roll = Math.random() + luckBonus * 0.02
  let pool: Mount[]
  if (roll > 0.95) { pool = getMountsByRarity('legendary') }
  else if (roll > 0.8) { pool = getMountsByRarity('rare') }
  else if (roll > 0.5) { pool = getMountsByRarity('uncommon') }
  else { pool = getMountsByRarity('common') }
  return pool[Math.floor(Math.random() * pool.length)]
}
