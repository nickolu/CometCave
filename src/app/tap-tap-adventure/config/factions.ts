export type FactionId = 'silver_dawn' | 'shadow_covenant' | 'verdant_circle' | 'iron_consortium'

export interface FactionRepThreshold {
  label: string
  minRep: number
}

export interface FactionGearItem {
  id: string
  name: string
  description: string
  type: 'equipment'
  effects: { strength?: number; intelligence?: number; luck?: number; charisma?: number }
  price: number
  requiredRep: number
  slot: 'weapon' | 'armor' | 'accessory'
}

export interface Faction {
  id: FactionId
  name: string
  description: string
  icon: string
  regions: string[]
  rivalFactionId: FactionId | null
  repThresholds: FactionRepThreshold[]
  gear: FactionGearItem[]
}

const REP_THRESHOLDS: FactionRepThreshold[] = [
  { label: 'Neutral', minRep: 0 },
  { label: 'Friendly', minRep: 25 },
  { label: 'Honored', minRep: 75 },
  { label: 'Exalted', minRep: 150 },
]

export const FACTIONS: Record<FactionId, Faction> = {
  silver_dawn: {
    id: 'silver_dawn',
    name: 'Order of the Silver Dawn',
    description: 'A holy order of paladins and clerics dedicated to protecting the celestial realms from darkness.',
    icon: '☀️',
    regions: ['celestial_throne', 'crystal_caves'],
    rivalFactionId: 'shadow_covenant',
    repThresholds: REP_THRESHOLDS,
    gear: [
      {
        id: 'silver_dawn_radiant_blade',
        name: 'Radiant Blade',
        description: 'A sword blessed by celestial light. Strikes burn with holy fire.',
        type: 'equipment',
        effects: { strength: 4 },
        price: 100,
        requiredRep: 25,
        slot: 'weapon',
      },
      {
        id: 'silver_dawn_blessed_plate',
        name: 'Blessed Plate',
        description: 'Gleaming armor infused with divine protection and celestial ward.',
        type: 'equipment',
        effects: { strength: 3, luck: 2 },
        price: 250,
        requiredRep: 75,
        slot: 'armor',
      },
      {
        id: 'silver_dawn_sacred_amulet',
        name: 'Sacred Amulet',
        description: 'An ancient amulet channelling the wisdom of the Silver Dawn\'s founders.',
        type: 'equipment',
        effects: { intelligence: 4 },
        price: 500,
        requiredRep: 150,
        slot: 'accessory',
      },
    ],
  },
  shadow_covenant: {
    id: 'shadow_covenant',
    name: 'Shadow Covenant',
    description: 'A secretive guild operating from the deepest shadows, trading in forbidden knowledge and dark power.',
    icon: '🌑',
    regions: ['shadow_realm', 'abyssal_depths'],
    rivalFactionId: 'silver_dawn',
    repThresholds: REP_THRESHOLDS,
    gear: [
      {
        id: 'shadow_covenant_shadow_dagger',
        name: 'Shadow Dagger',
        description: 'A blade forged from solidified shadow. Strikes leave darkness behind.',
        type: 'equipment',
        effects: { strength: 3, luck: 2 },
        price: 100,
        requiredRep: 25,
        slot: 'weapon',
      },
      {
        id: 'shadow_covenant_void_cloak',
        name: 'Void Cloak',
        description: 'A cloak woven from the void itself. The wearer becomes nearly invisible.',
        type: 'equipment',
        effects: { luck: 4 },
        price: 250,
        requiredRep: 75,
        slot: 'armor',
      },
      {
        id: 'shadow_covenant_spectral_ring',
        name: 'Spectral Ring',
        description: 'A ring bound to a spectral entity that whispers dark secrets.',
        type: 'equipment',
        effects: { intelligence: 3, luck: 2 },
        price: 500,
        requiredRep: 150,
        slot: 'accessory',
      },
    ],
  },
  verdant_circle: {
    id: 'verdant_circle',
    name: 'Verdant Circle',
    description: 'Ancient druids and nature spirits who guard the wild places of the world.',
    icon: '🌿',
    regions: ['green_meadows', 'dark_forest', 'feywild_grove'],
    rivalFactionId: 'iron_consortium',
    repThresholds: REP_THRESHOLDS,
    gear: [
      {
        id: 'verdant_circle_natures_bow',
        name: "Nature's Bow",
        description: 'A bow carved from a living branch, guided by the spirits of the forest.',
        type: 'equipment',
        effects: { strength: 3, intelligence: 2 },
        price: 100,
        requiredRep: 25,
        slot: 'weapon',
      },
      {
        id: 'verdant_circle_druid_bark_armor',
        name: 'Druid Bark Armor',
        description: 'Armor grown from ancient bark, hardened by decades of druidic magic.',
        type: 'equipment',
        effects: { intelligence: 3, luck: 2 },
        price: 250,
        requiredRep: 75,
        slot: 'armor',
      },
      {
        id: 'verdant_circle_fey_charm',
        name: 'Fey Charm',
        description: 'A charm gifted by the fey courts. Fortune smiles on its bearer.',
        type: 'equipment',
        effects: { luck: 5 },
        price: 500,
        requiredRep: 150,
        slot: 'accessory',
      },
    ],
  },
  iron_consortium: {
    id: 'iron_consortium',
    name: 'Iron Consortium',
    description: 'A powerful guild of engineers and industrialists who harness the raw power of forge and industry.',
    icon: '⚙️',
    regions: ['scorched_wastes', 'volcanic_forge', 'bone_wastes'],
    rivalFactionId: 'verdant_circle',
    repThresholds: REP_THRESHOLDS,
    gear: [
      {
        id: 'iron_consortium_forged_hammer',
        name: 'Forged Hammer',
        description: 'A massive war hammer forged in the volcanic heart of the world.',
        type: 'equipment',
        effects: { strength: 5 },
        price: 100,
        requiredRep: 25,
        slot: 'weapon',
      },
      {
        id: 'iron_consortium_iron_plate',
        name: 'Iron Plate',
        description: 'Heavy plate armor masterforged by the Consortium\'s finest smiths.',
        type: 'equipment',
        effects: { strength: 4, luck: 1 },
        price: 250,
        requiredRep: 75,
        slot: 'armor',
      },
      {
        id: 'iron_consortium_commerce_token',
        name: 'Commerce Token',
        description: 'A Consortium token granting access to arcane trade networks and forbidden knowledge.',
        type: 'equipment',
        effects: { intelligence: 4 },
        price: 500,
        requiredRep: 150,
        slot: 'accessory',
      },
    ],
  },
}

export const FACTION_IDS: FactionId[] = ['silver_dawn', 'shadow_covenant', 'verdant_circle', 'iron_consortium']

export function getFactionForRegion(regionId: string): FactionId | null {
  for (const faction of Object.values(FACTIONS)) {
    if (faction.regions.includes(regionId)) {
      return faction.id
    }
  }
  return null
}

export function getFactionRepTier(rep: number): FactionRepThreshold {
  const thresholds = [...REP_THRESHOLDS].reverse()
  for (const threshold of thresholds) {
    if (rep >= threshold.minRep) {
      return threshold
    }
  }
  return REP_THRESHOLDS[0]
}
