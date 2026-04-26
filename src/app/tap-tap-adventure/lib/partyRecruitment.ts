import { getClassForNPC, deriveNPCCombatStats } from '@/app/tap-tap-adventure/lib/classGenerator'
import type { PartyMember } from '@/app/tap-tap-adventure/models/partyMember'
import { seededRandom } from '@/app/tap-tap-adventure/lib/landmarkGenerator'

// NPC names pool for tavern recruits — unique adventurers looking for work
const TAVERN_RECRUIT_NAMES = [
  'Rowan', 'Kael', 'Lyra', 'Thorne', 'Mira',
  'Dax', 'Selene', 'Flint', 'Ivy', 'Bram',
  'Zara', 'Orrin', 'Piper', 'Jareth', 'Nessa',
  'Cade', 'Ember', 'Sable', 'Wren', 'Gareth',
]

const TAVERN_RECRUIT_ICONS = [
  '🧝', '🧙', '🗡️', '🛡️', '🏹',
  '⚔️', '🔮', '🪓', '🐺', '🌿',
]

export function createPartyMember(params: {
  id: string
  name: string
  description?: string
  icon?: string
  level: number
  dailyCost: number
  recruitCost?: number
  rarity?: PartyMember['rarity']
  personality?: string
  relationship?: number
  role?: PartyMember['role']
}): PartyMember {
  const npcClass = getClassForNPC(params.name)
  const combatStats = deriveNPCCombatStats(npcClass, params.level)
  return {
    id: params.id,
    name: params.name,
    description: params.description ?? `A ${npcClass.name} looking for adventure.`,
    icon: params.icon ?? '⚔️',
    className: npcClass.name,
    generatedClass: npcClass,
    level: params.level,
    hp: combatStats.hp,
    maxHp: combatStats.maxHp,
    stats: combatStats.stats,
    equipment: { weapon: null, armor: null, accessory: null },
    dailyCost: params.dailyCost,
    recruitCost: params.recruitCost ?? 0,
    rarity: params.rarity ?? 'common',
    personality: params.personality,
    relationship: params.relationship ?? 0,
    role: params.role ?? 'combatant',
  }
}

/**
 * Generate tavern recruits — adventurers available for hire.
 * Deterministic per region + day so they don't re-randomize on re-render.
 */
export function getTavernRecruits(characterLevel: number, regionId: string, day: number): PartyMember[] {
  const seed = `tavern-${regionId}-${day}`
  const rng = seededRandom(seed)

  // Pick 2 unique names from pool
  const shuffledNames = [...TAVERN_RECRUIT_NAMES].sort(() => rng() - 0.5)
  const count = 2

  const recruits: PartyMember[] = []
  for (let i = 0; i < count; i++) {
    const name = shuffledNames[i]
    const iconIdx = Math.floor(rng() * TAVERN_RECRUIT_ICONS.length)

    // Rarity based on level
    let rarity: PartyMember['rarity'] = 'common'
    const roll = rng()
    if (characterLevel >= 8 && roll > 0.7) rarity = 'rare'
    else if (characterLevel >= 4 && roll > 0.6) rarity = 'uncommon'
    else if (roll > 0.8) rarity = 'uncommon'

    // Recruit cost scales with rarity and level
    const baseCost = { common: 30, uncommon: 75, rare: 150, legendary: 300 }[rarity]
    const recruitCost = baseCost + characterLevel * 5

    // Daily cost scales with rarity
    const dailyCostBase = { common: 1, uncommon: 2, rare: 4, legendary: 8 }[rarity]
    const dailyCost = Math.max(1, dailyCostBase + Math.floor(characterLevel / 3))

    recruits.push(createPartyMember({
      id: `tavern-${name.toLowerCase()}-${regionId}-${day}`,
      name,
      icon: TAVERN_RECRUIT_ICONS[iconIdx],
      level: Math.max(1, characterLevel - 1 + Math.floor(rng() * 3)),  // level +-1 from player
      dailyCost,
      recruitCost,
      rarity,
      personality: undefined,
      role: 'combatant',
    }))
  }

  return recruits
}
