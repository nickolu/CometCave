/**
 * Hand-authored boss boards for the 13 gym leaders / Elite Four / Champion.
 * Each board is on-type and tuned to its stage in the gauntlet.
 *
 * Unit dexIds verified against the Gen-1 catalog (149 units total).
 * Tier progression: early gyms T1-T2, mid gyms T2-T3, E4 T3-T4, Champion T4-T5.
 */
import { UNIT_CATALOG, type CatalogUnit } from '../unit-catalog'

function units(...dexIds: number[]): CatalogUnit[] {
  return dexIds.map(id => {
    const unit = UNIT_CATALOG.find(u => u.dexId === id)
    if (!unit) throw new Error(`Boss unit dexId ${id} not found in catalog`)
    return unit
  })
}

export const BOSS_BOARDS: Record<string, CatalogUnit[]> = {
  // Gym 1 — Brock (Round 3) — Rock/Ground — rock-tunnel
  // Target: early-game, beatable with any starter line
  'brock': units(
    95,   // Onix       T1 (Rock/Ground)
    74,   // Geodude    T1 (Rock/Ground)
    138,  // Omanyte    T1 (Rock/Water)
    140,  // Kabuto     T1 (Rock/Water)
    75,   // Graveler   T2 (Rock/Ground)
    111,  // Rhyhorn    T2 (Ground/Rock)
  ),

  // Gym 2 — Misty (Round 6) — Water — tidal-shelf
  // Target: mid-early, water advantage over fire starters
  'misty': units(
    120,  // Staryu     T1 (Water)
    54,   // Psyduck    T1 (Water)
    60,   // Poliwag    T1 (Water)
    90,   // Shellder   T1 (Water)
    55,   // Golduck    T2 (Water)
    121,  // Starmie    T3 (Water/Psychic)
  ),

  // Gym 3 — Lt. Surge (Round 9) — Electric — storm-plateau
  'surge': units(
    100,  // Voltorb    T1 (Electric)
    81,   // Magnemite  T1 (Electric/Steel)
    25,   // Pikachu    T1 (Electric)
    26,   // Raichu     T3 (Electric)
    82,   // Magneton   T3 (Electric/Steel)
    101,  // Electrode  T3 (Electric)
  ),

  // Gym 4 — Erika (Round 12) — Grass — overgrown-ruins
  'erika': units(
    43,   // Oddish     T1 (Grass/Poison)
    69,   // Bellsprout T1 (Grass/Poison)
    46,   // Paras      T1 (Bug/Grass)
    70,   // Weepinbell T2 (Grass/Poison)
    44,   // Gloom      T2 (Grass/Poison)
    103,  // Exeggutor  T3 (Grass/Psychic)
  ),

  // Gym 5 — Koga (Round 15) — Poison — poison-marsh
  'koga': units(
    88,   // Grimer     T1 (Poison)
    109,  // Koffing    T1 (Poison)
    72,   // Tentacool  T1 (Water/Poison)
    73,   // Tentacruel T3 (Water/Poison)
    89,   // Muk        T3 (Poison)
    110,  // Weezing    T3 (Poison)
  ),

  // Gym 6 — Sabrina (Round 18) — Psychic — silph-rooftop
  'sabrina': units(
    96,   // Drowzee    T1 (Psychic)
    79,   // Slowpoke   T1 (Water/Psychic)
    122,  // Mr. Mime   T3 (Psychic)
    97,   // Hypno      T3 (Psychic)
    80,   // Slowbro    T3 (Water/Psychic)
    65,   // Alakazam   T3 (Psychic)
  ),

  // Gym 7 — Blaine (Round 21) — Fire — volcanic-cavern
  'blaine': units(
    77,   // Ponyta     T1 (Fire)
    58,   // Growlithe  T1 (Fire)
    126,  // Magmar     T3 (Fire)
    136,  // Flareon    T3 (Fire)
    78,   // Rapidash   T3 (Fire)
    59,   // Arcanine   T4 (Fire)
  ),

  // Gym 8 — Giovanni (Round 24) — Ground — excavation-site
  'giovanni': units(
    27,   // Sandshrew  T1 (Ground)
    50,   // Diglett    T1 (Ground)
    28,   // Sandslash  T2 (Ground)
    51,   // Dugtrio    T2 (Ground)
    112,  // Rhydon     T3 (Ground/Rock)
    34,   // Nidoking   T3 (Poison/Ground)
  ),

  // Elite Four 1 — Lorelei (Round 25) — Ice — frozen-pass
  // Note: only 5 true Ice units in Gen 1; filled with Water/Ice adjacents
  'lorelei': units(
    87,   // Dewgong    T3 (Water/Ice)
    91,   // Cloyster   T3 (Water/Ice)
    124,  // Jynx       T3 (Ice/Psychic)
    80,   // Slowbro    T3 (Water/Psychic) — Lorelei's Slowbro
    131,  // Lapras     T4 (Water/Ice)
    144,  // Articuno   T5 (Ice/Flying)
  ),

  // Elite Four 2 — Bruno (Round 26) — Fighting — rock-tunnel
  'bruno': units(
    56,   // Mankey     T1 (Fighting)
    66,   // Machop     T1 (Fighting)
    57,   // Primeape   T3 (Fighting)
    106,  // Hitmonlee  T3 (Fighting)
    107,  // Hitmonchan T3 (Fighting)
    68,   // Machamp    T3 (Fighting)
  ),

  // Elite Four 3 — Agatha (Round 27) — Ghost/Poison — silph-rooftop
  // Only 3 Ghost units in Gen 1; filled with Poison (Ghost/Poison synergy)
  'agatha': units(
    92,   // Gastly     T1 (Ghost/Poison)
    93,   // Haunter    T2 (Ghost/Poison)
    109,  // Koffing    T1 (Poison) — Agatha's poisoner
    110,  // Weezing    T3 (Poison)
    89,   // Muk        T3 (Poison)
    94,   // Gengar     T3 (Ghost/Poison)
  ),

  // Elite Four 4 — Lance (Round 28) — Dragon — storm-plateau
  // Only 3 Dragon units in Gen 1; filled with strong Flying adjacents
  'lance': units(
    147,  // Dratini    T1 (Dragon)
    148,  // Dragonair  T2 (Dragon)
    18,   // Pidgeot    T2 (Normal/Flying) — Flying support
    142,  // Aerodactyl T3 (Rock/Flying)
    130,  // Gyarados   T4 (Water/Flying) — Lance's Gyarados
    149,  // Dragonite  T5 (Dragon/Flying)
  ),

  // Champion — Blue (Round 29) — Mixed — excavation-site
  // The hardest board: T4-T5 mix across types
  'champion': units(
    59,   // Arcanine   T4 (Fire)
    130,  // Gyarados   T4 (Water/Flying)
    131,  // Lapras     T4 (Water/Ice)
    145,  // Zapdos     T5 (Electric/Flying)
    146,  // Moltres    T5 (Fire/Flying)
    149,  // Dragonite  T5 (Dragon/Flying)
  ),
}

/** Get the boss team for a given boss ID. */
export function getBossTeam(bossId: string): CatalogUnit[] {
  const team = BOSS_BOARDS[bossId]
  if (!team) throw new Error(`Unknown boss: ${bossId}`)
  return team
}
