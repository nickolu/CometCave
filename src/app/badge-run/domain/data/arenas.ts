/** Pokémon type names used in the arena type boost system */
export type ArenaType =
  | 'Normal' | 'Fire' | 'Water' | 'Electric' | 'Grass' | 'Ice'
  | 'Fighting' | 'Poison' | 'Ground' | 'Flying' | 'Psychic' | 'Bug'
  | 'Rock' | 'Ghost' | 'Dragon' | 'Dark' | 'Steel' | 'Fairy'

export type HouseRule =
  | 'fog'        // accuracy of all moves reduced by 30%
  | 'rain'       // Water moves +20%; Fire moves -20%
  | 'wind'       // Flying moves +20%; priority moves lose priority
  | 'overgrown'  // Grass moves +20%; Bug moves +10%
  | 'toxic-spill'// All units take 5% max-HP poison damage each round
  | 'tech-surge' // Special Attack has 10% additive bonus for all units
  | 'volcano'    // Fire moves +25%; Ice moves -25%
  | 'excavation' // Ground moves ignore Flying immunity; Ground +20%
  | 'blizzard'   // Ice moves +25%; Speed of all units -10%

export interface Arena {
  id: string
  name: string
  typeBoosts: Partial<Record<ArenaType, number>> // multiplier, e.g. 1.2 = +20%
  houseRules: HouseRule[]
}

export const ARENAS: Arena[] = [
  {
    id: 'rock-tunnel',
    name: 'Rock Tunnel',
    typeBoosts: { Rock: 1.2, Ground: 1.1 },
    houseRules: ['fog'],
  },
  {
    id: 'tidal-shelf',
    name: 'Tidal Shelf',
    typeBoosts: { Water: 1.2 },
    houseRules: ['rain'],
  },
  {
    id: 'storm-plateau',
    name: 'Storm Plateau',
    typeBoosts: { Electric: 1.2, Flying: 1.1 },
    houseRules: ['wind'],
  },
  {
    id: 'overgrown-ruins',
    name: 'Overgrown Ruins',
    typeBoosts: { Grass: 1.2, Bug: 1.1 },
    houseRules: ['overgrown'],
  },
  {
    id: 'poison-marsh',
    name: 'Poison Marsh',
    typeBoosts: { Poison: 1.2 },
    houseRules: ['toxic-spill'],
  },
  {
    id: 'silph-rooftop',
    name: 'Silph Rooftop',
    typeBoosts: { Psychic: 1.2, Normal: 1.1 },
    houseRules: ['tech-surge'],
  },
  {
    id: 'volcanic-cavern',
    name: 'Volcanic Cavern',
    typeBoosts: { Fire: 1.25 },
    houseRules: ['volcano'],
  },
  {
    id: 'excavation-site',
    name: 'Excavation Site',
    typeBoosts: { Ground: 1.2, Rock: 1.1 },
    houseRules: ['excavation'],
  },
  {
    id: 'frozen-pass',
    name: 'Frozen Pass',
    typeBoosts: { Ice: 1.25 },
    houseRules: ['blizzard'],
  },
]

/** Ordered schedule of arena IDs for a standard Badge Run (9 rounds) */
export const ARENA_SCHEDULE: string[] = ARENAS.map(a => a.id)

/** Lookup arena by id */
export function getArena(id: string): Arena | undefined {
  return ARENAS.find(a => a.id === id)
}
