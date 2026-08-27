import rawUnits from './data/units.json'

export type Tier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5'
export type Kin = 'Pack' | 'Flock' | 'Brood' | 'Shell' | 'Mineral' | 'Serpent' | 'Humanoid' | 'Amorphous'

const EGG_GROUP_TO_KIN: Record<string, Kin> = {
  Monster:       'Brood',
  Plant:         'Brood',
  Bug:           'Brood',
  Dragon:        'Serpent',
  Water1:        'Shell',
  Water2:        'Shell',
  Water3:        'Shell',
  Flying:        'Flock',
  Fairy:         'Flock',
  Ground:        'Pack',
  Humanshape:    'Humanoid',
  Mineral:       'Mineral',
  Amorphous:     'Amorphous',
  Indeterminate: 'Amorphous',
  Ditto:         'Amorphous',
  'No-eggs':     'Amorphous',
}

export interface CatalogUnit {
  dexId: number
  name: string
  types: string[]
  baseStats: {
    hp: number
    attack: number
    defense: number
    specialAttack: number
    specialDefense: number
    speed: number
  }
  eggGroups: string[]
  evolvesTo: number | null
  signatureMove: string | null
  tier: Tier
  kin: Kin
}

function computeBST(stats: CatalogUnit['baseStats']): number {
  return stats.hp + stats.attack + stats.defense + stats.specialAttack + stats.specialDefense + stats.speed
}

function getTier(bst: number): Tier {
  if (bst <= 340) return 'T1'
  if (bst <= 450) return 'T2'
  if (bst <= 534) return 'T3'
  if (bst <= 579) return 'T4'
  return 'T5'
}

function getKin(eggGroups: string[]): Kin {
  for (const eg of eggGroups) {
    const kin = EGG_GROUP_TO_KIN[eg]
    if (kin) return kin
  }
  return 'Amorphous'  // fallback
}

export const UNIT_CATALOG: CatalogUnit[] = (rawUnits as typeof rawUnits).map(u => ({
  ...u,
  tier: getTier(computeBST(u.baseStats)),
  kin: getKin(u.eggGroups),
}))
