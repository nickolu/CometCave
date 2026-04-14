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
  startingCombatDistance?: 'close' | 'mid' | 'far'
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
    connectedRegions: ['starting_village', 'dark_forest', 'crystal_caves', 'sunken_ruins', 'feywild_grove'],
    minLevel: 0,
    icon: '\u{1F33F}',
    startingCombatDistance: 'far',
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
    connectedRegions: ['green_meadows', 'scorched_wastes', 'shadow_realm', 'feywild_grove'],
    minLevel: 0,
    icon: '\u{1F332}',
    startingCombatDistance: 'close',
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
    connectedRegions: ['green_meadows', 'frozen_peaks', 'sunken_ruins'],
    minLevel: 0,
    icon: '\u{1F48E}',
    startingCombatDistance: 'close',
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
    connectedRegions: ['dark_forest', 'sky_citadel', 'volcanic_forge'],
    minLevel: 3,
    icon: '\u{1F525}',
    startingCombatDistance: 'far',
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
    startingCombatDistance: 'far',
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
    connectedRegions: ['dark_forest', 'sky_citadel', 'bone_wastes'],
    minLevel: 5,
    icon: '\u{1F311}',
    startingCombatDistance: 'close',
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
    connectedRegions: ['scorched_wastes', 'frozen_peaks', 'shadow_realm', 'dragons_spine'],
    minLevel: 7,
    icon: '\u{26C5}',
    startingCombatDistance: 'mid',
  },
  sunken_ruins: {
    id: 'sunken_ruins',
    name: 'Sunken Ruins',
    description: 'Half-submerged ancient temples where coral-encrusted pillars rise from the depths. Bioluminescent creatures light the flooded halls.',
    difficulty: 'medium',
    difficultyMultiplier: 1.0,
    theme: 'half-submerged ancient temples, coral-encrusted pillars, underwater currents, and bioluminescent sea creatures',
    enemyTypes: ['sea serpents', 'drowned pirates', 'coral golems'],
    element: 'ice',
    connectedRegions: ['green_meadows', 'crystal_caves', 'volcanic_forge'],
    minLevel: 2,
    icon: '\u{1F3DB}\u{FE0F}',
    startingCombatDistance: 'mid',
  },
  volcanic_forge: {
    id: 'volcanic_forge',
    name: 'Volcanic Forge',
    description: 'An active volcanic caldera housing ancient dwarven forges. Rivers of lava flow between obsidian spires and geysers of molten rock.',
    difficulty: 'hard',
    difficultyMultiplier: 1.5,
    theme: 'active volcanic caldera with rivers of lava, ancient dwarven forges, obsidian spires, and geysers of molten rock',
    enemyTypes: ['lava elementals', 'forge golems', 'magma serpents'],
    element: 'fire',
    connectedRegions: ['sunken_ruins', 'scorched_wastes', 'dragons_spine'],
    minLevel: 4,
    icon: '\u{1F30B}',
    startingCombatDistance: 'close',
  },
  feywild_grove: {
    id: 'feywild_grove',
    name: 'Feywild Grove',
    description: 'An enchanted forest where reality bends. Giant mushrooms glow with fairy light, time flows strangely, and mischievous fey creatures play tricks.',
    difficulty: 'medium',
    difficultyMultiplier: 1.2,
    theme: 'enchanted forest where reality bends, giant mushrooms glow with fairy light, time flows strangely, and mischievous fey creatures play tricks',
    enemyTypes: ['fey tricksters', 'enchanted treants', 'pixie swarms'],
    element: 'nature',
    connectedRegions: ['green_meadows', 'dark_forest', 'bone_wastes'],
    minLevel: 2,
    icon: '\u{1F344}',
    startingCombatDistance: 'mid',
  },
  bone_wastes: {
    id: 'bone_wastes',
    name: 'Bone Wastes',
    description: 'A desolate graveyard of ancient leviathans. Bleached bones tower like buildings while restless spirits wander and necromantic energy pulses through the ground.',
    difficulty: 'hard',
    difficultyMultiplier: 1.5,
    theme: 'desolate graveyard of ancient leviathans, bleached bones tower like buildings, restless spirits wander, and necromantic energy pulses through the ground',
    enemyTypes: ['skeleton warriors', 'bone dragons', 'wraith lords'],
    element: 'shadow',
    connectedRegions: ['feywild_grove', 'shadow_realm', 'dragons_spine'],
    minLevel: 4,
    icon: '\u{1F480}',
    startingCombatDistance: 'mid',
  },
  dragons_spine: {
    id: 'dragons_spine',
    name: "Dragon's Spine",
    description: 'A jagged mountain ridge carved by dragon claws, filled with ancient dragon lairs, treasure hoards, volcanic vents, and the bones of fallen heroes.',
    difficulty: 'very_hard',
    difficultyMultiplier: 2.0,
    theme: 'jagged mountain ridge carved by dragon claws, ancient dragon lairs filled with treasure hoards, volcanic vents, and the bones of fallen heroes',
    enemyTypes: ['young dragons', 'dragonkin warriors', 'wyverns'],
    element: 'fire',
    connectedRegions: ['volcanic_forge', 'bone_wastes', 'sky_citadel'],
    minLevel: 8,
    icon: '\u{1F409}',
    startingCombatDistance: 'far',
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
