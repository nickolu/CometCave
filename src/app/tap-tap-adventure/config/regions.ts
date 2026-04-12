import { SpellElement } from '@/app/tap-tap-adventure/models/spell'

export type RegionDifficulty = 'easy' | 'medium' | 'hard' | 'very_hard'

export interface Region {
  id: string
  name: string
  description: string
  difficulty: RegionDifficulty
  difficultyMultiplier: number
  theme: string
  enemyTypes: string[]
  element: SpellElement
  connectedRegions: string[]
  minLevel: number
  icon: string
}

export const REGIONS: Record<string, Region> = {
  starting_village: {
    id: 'starting_village',
    name: 'Starting Village',
    description: 'A safe hub where adventurers rest and resupply. No combat here.',
    difficulty: 'easy',
    difficultyMultiplier: 0.5,
    theme: 'peaceful village with taverns, shops, and friendly NPCs',
    enemyTypes: [],
    element: 'none',
    connectedRegions: ['green_meadows'],
    minLevel: 0,
    icon: '\u{1F3D8}\u{FE0F}',
  },
  green_meadows: {
    id: 'green_meadows',
    name: 'Green Meadows',
    description: 'Rolling hills dotted with wildflowers and gentle streams. A good place for new adventurers.',
    difficulty: 'easy',
    difficultyMultiplier: 0.8,
    theme: 'rolling green hills, wildflower meadows, gentle streams, and scattered farmsteads',
    enemyTypes: ['wolves', 'bandits', 'wild boars'],
    element: 'nature',
    connectedRegions: ['starting_village', 'dark_forest', 'crystal_caves'],
    minLevel: 0,
    icon: '\u{1F33F}',
  },
  dark_forest: {
    id: 'dark_forest',
    name: 'Dark Forest',
    description: 'Dense, ancient woods where sunlight barely reaches the floor. Strange creatures lurk in the shadows.',
    difficulty: 'medium',
    difficultyMultiplier: 1.0,
    theme: 'dense dark woods, twisted trees, thick fog, and eerie silence',
    enemyTypes: ['shadow beasts', 'giant spiders', 'corrupted treants'],
    element: 'shadow',
    connectedRegions: ['green_meadows', 'scorched_wastes', 'shadow_realm'],
    minLevel: 0,
    icon: '\u{1F332}',
  },
  crystal_caves: {
    id: 'crystal_caves',
    name: 'Crystal Caves',
    description: 'A vast underground network of glittering caverns filled with magical crystals and ancient secrets.',
    difficulty: 'medium',
    difficultyMultiplier: 1.0,
    theme: 'underground caverns, glowing crystals, echoing tunnels, and underground rivers',
    enemyTypes: ['crystal golems', 'cave bats', 'gem serpents'],
    element: 'arcane',
    connectedRegions: ['green_meadows', 'frozen_peaks'],
    minLevel: 0,
    icon: '\u{1F48E}',
  },
  scorched_wastes: {
    id: 'scorched_wastes',
    name: 'Scorched Wastes',
    description: 'A barren desert of cracked earth and ancient ruins, baked under a merciless sun.',
    difficulty: 'hard',
    difficultyMultiplier: 1.5,
    theme: 'scorching desert, ancient ruins, sand dunes, and volcanic vents',
    enemyTypes: ['fire elementals', 'sand wyrms', 'scorpion warriors'],
    element: 'fire',
    connectedRegions: ['dark_forest', 'sky_citadel'],
    minLevel: 3,
    icon: '\u{1F525}',
  },
  frozen_peaks: {
    id: 'frozen_peaks',
    name: 'Frozen Peaks',
    description: 'Towering snow-capped mountains battered by howling blizzards. Only the hardiest survive.',
    difficulty: 'hard',
    difficultyMultiplier: 1.5,
    theme: 'snow-capped mountains, howling blizzards, frozen lakes, and ice caverns',
    enemyTypes: ['ice wraiths', 'frost giants', 'snow wolves'],
    element: 'ice',
    connectedRegions: ['crystal_caves', 'sky_citadel'],
    minLevel: 3,
    icon: '\u{2744}\u{FE0F}',
  },
  shadow_realm: {
    id: 'shadow_realm',
    name: 'Shadow Realm',
    description: 'A dark dimension where reality warps and nightmares walk. Only the bravest dare enter.',
    difficulty: 'very_hard',
    difficultyMultiplier: 2.0,
    theme: 'dark otherworldly dimension, floating islands of shadow, warped reality, and nightmare landscapes',
    enemyTypes: ['demons', 'undead knights', 'shadow dragons'],
    element: 'shadow',
    connectedRegions: ['dark_forest', 'sky_citadel'],
    minLevel: 5,
    icon: '\u{1F311}',
  },
  sky_citadel: {
    id: 'sky_citadel',
    name: 'Sky Citadel',
    description: 'A massive floating fortress high above the clouds. The ultimate challenge for legendary adventurers.',
    difficulty: 'very_hard',
    difficultyMultiplier: 2.0,
    theme: 'floating fortress in the sky, ancient arcane machinery, cloud platforms, and celestial architecture',
    enemyTypes: ['sky knights', 'ancient dragons', 'arcane sentinels'],
    element: 'arcane',
    connectedRegions: ['scorched_wastes', 'frozen_peaks', 'shadow_realm'],
    minLevel: 7,
    icon: '\u{26C5}',
  },
}

export function getRegion(regionId: string): Region {
  return REGIONS[regionId] ?? REGIONS.green_meadows
}

export function getConnectedRegions(regionId: string): Region[] {
  const region = getRegion(regionId)
  return region.connectedRegions.map(id => getRegion(id))
}

export function canEnterRegion(region: Region, characterLevel: number): boolean {
  return characterLevel >= region.minLevel
}

export const CROSSROADS_INTERVAL = 75
