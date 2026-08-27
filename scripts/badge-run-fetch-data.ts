/**
 * One-time script to vendor the static Pokémon dataset for Badge Run.
 *
 * Fetches from PokéAPI (https://pokeapi.co/api/v2/) and writes:
 *   src/app/badge-run/domain/data/units.json
 *   src/app/badge-run/domain/data/type-chart.json
 *
 * Scope: Kanto Pokémon dexIds 1–149 only (excludes Mewtwo #150 and Mew #151).
 *
 * Usage:
 *   npx tsx scripts/badge-run-fetch-data.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Unit {
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
}

/** type-chart.json: { "Fire": { "Grass": 2, "Water": 0.5, ... }, ... }
 *  Only non-1 values are stored. */
type TypeChart = Record<string, Record<string, number>>

// ── PokéAPI response shapes (partial) ─────────────────────────────────────────

interface PokeApiNamedResource {
  name: string
  url: string
}

interface PokeApiPokemon {
  id: number
  name: string
  types: Array<{ slot: number; type: PokeApiNamedResource }>
  stats: Array<{ base_stat: number; stat: PokeApiNamedResource }>
  moves: Array<{
    move: PokeApiNamedResource
    version_group_details: Array<{
      level_learned_at: number
      move_learn_method: PokeApiNamedResource
      version_group: PokeApiNamedResource
    }>
  }>
}

interface PokeApiSpecies {
  egg_groups: Array<{ name: string; url: string }>
  evolution_chain: { url: string }
}

interface PokeApiEvolutionChain {
  chain: EvolutionChainLink
}

interface EvolutionChainLink {
  species: PokeApiNamedResource
  evolves_to: EvolutionChainLink[]
}

interface PokeApiMove {
  power: number | null
}

interface PokeApiType {
  name: string
  damage_relations: {
    double_damage_to: PokeApiNamedResource[]
    half_damage_to: PokeApiNamedResource[]
    no_damage_to: PokeApiNamedResource[]
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  if (!s) return s
  // Handle hyphenated names like "special-attack" → handle each word
  return s
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-')
}

/** Capitalize first letter only (for types, egg groups) */
function cap(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Sleep for the given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const BASE_URL = 'https://pokeapi.co/api/v2'

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return response.json() as Promise<T>
}

/** Extract dex ID from a species URL like https://pokeapi.co/api/v2/pokemon-species/4/ */
function dexIdFromSpeciesUrl(url: string): number {
  const match = url.match(/\/(\d+)\/$/)
  if (!match) throw new Error(`Cannot parse dex ID from ${url}`)
  return parseInt(match[1], 10)
}

// ── Evolution chain traversal ─────────────────────────────────────────────────

/**
 * Walk an evolution chain and build a map of dexId → evolvesTo dexId.
 * Only maps direct (next) evolutions.
 */
function walkChain(
  link: EvolutionChainLink,
  result: Map<number, number>
): void {
  const fromId = dexIdFromSpeciesUrl(link.species.url)
  for (const next of link.evolves_to) {
    const toId = dexIdFromSpeciesUrl(next.species.url)
    // Only track Kanto scope (1-149)
    if (fromId >= 1 && fromId <= 149 && toId >= 1 && toId <= 149) {
      result.set(fromId, toId)
    }
    walkChain(next, result)
  }
}

// ── Move power cache ──────────────────────────────────────────────────────────

const movePowerCache = new Map<string, number | null>()
let movesFetched = 0

async function getMovePower(moveName: string): Promise<number | null> {
  if (movePowerCache.has(moveName)) {
    return movePowerCache.get(moveName)!
  }
  try {
    const data = await fetchJson<PokeApiMove>(`${BASE_URL}/move/${moveName}`)
    const power = data.power ?? null
    movePowerCache.set(moveName, power)
    movesFetched++
    // Small delay to be respectful
    await sleep(50)
    return power
  } catch (error) {
    console.warn(`    Could not fetch move "${moveName}": ${String(error)}`)
    movePowerCache.set(moveName, null)
    return null
  }
}

// ── Stat name mapping ─────────────────────────────────────────────────────────

const STAT_MAP: Record<string, keyof Unit['baseStats']> = {
  hp: 'hp',
  attack: 'attack',
  defense: 'defense',
  'special-attack': 'specialAttack',
  'special-defense': 'specialDefense',
  speed: 'speed',
}

// ── Type chart ────────────────────────────────────────────────────────────────

const ALL_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
]

async function buildTypeChart(): Promise<TypeChart> {
  console.log('Building type chart...')
  const chart: TypeChart = {}

  for (let i = 0; i < ALL_TYPES.length; i++) {
    const typeName = ALL_TYPES[i]
    console.log(`  Fetching type ${i + 1}/${ALL_TYPES.length}: ${typeName}`)
    try {
      const data = await fetchJson<PokeApiType>(`${BASE_URL}/type/${typeName}`)
      const attackerKey = cap(typeName)
      chart[attackerKey] = {}

      for (const defender of data.damage_relations.double_damage_to) {
        chart[attackerKey][cap(defender.name)] = 2
      }
      for (const defender of data.damage_relations.half_damage_to) {
        chart[attackerKey][cap(defender.name)] = 0.5
      }
      for (const defender of data.damage_relations.no_damage_to) {
        chart[attackerKey][cap(defender.name)] = 0
      }
    } catch (error) {
      console.error(`  ERROR fetching type ${typeName}: ${String(error)}`)
    }
    await sleep(100)
  }

  return chart
}

// ── Main fetch loop ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Badge Run data fetch — Kanto Pokémon dex IDs 1-149')
  console.log('='.repeat(60))

  // Step 1: Build type chart
  const typeChart = await buildTypeChart()
  console.log(`Type chart built with ${Object.keys(typeChart).length} types.\n`)

  // Step 2: Collect all species/evolution chain URLs we'll need
  const evolutionChainUrls = new Set<string>()
  const pokemonDataMap = new Map<number, PokeApiPokemon>()
  const speciesDataMap = new Map<number, PokeApiSpecies>()

  // Fetch in batches of 10 with a pause between batches
  const BATCH_SIZE = 10
  const BATCH_PAUSE = 500 // ms between batches
  const DEX_IDS = Array.from({ length: 149 }, (_, i) => i + 1) // 1..149

  console.log('Fetching Pokémon data (batches of 10)...')
  for (let batchStart = 0; batchStart < DEX_IDS.length; batchStart += BATCH_SIZE) {
    const batchIds = DEX_IDS.slice(batchStart, batchStart + BATCH_SIZE)
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(DEX_IDS.length / BATCH_SIZE)
    console.log(`  Batch ${batchNum}/${totalBatches}: dex IDs ${batchIds[0]}–${batchIds[batchIds.length - 1]}`)

    await Promise.all(
      batchIds.map(async id => {
        try {
          const [pokemon, species] = await Promise.all([
            fetchJson<PokeApiPokemon>(`${BASE_URL}/pokemon/${id}`),
            fetchJson<PokeApiSpecies>(`${BASE_URL}/pokemon-species/${id}`),
          ])
          pokemonDataMap.set(id, pokemon)
          speciesDataMap.set(id, species)
          evolutionChainUrls.add(species.evolution_chain.url)
        } catch (error) {
          console.error(`    ERROR for dex #${id}: ${String(error)}`)
        }
      })
    )

    if (batchStart + BATCH_SIZE < DEX_IDS.length) {
      await sleep(BATCH_PAUSE)
    }
  }

  console.log(`\nFetched ${pokemonDataMap.size} Pokémon, ${evolutionChainUrls.size} evolution chains.`)

  // Step 3: Fetch all evolution chains
  console.log('\nFetching evolution chains...')
  const evolvesToMap = new Map<number, number>() // dexId → next evolution dexId

  const chainUrls = Array.from(evolutionChainUrls)
  for (let i = 0; i < chainUrls.length; i++) {
    const url = chainUrls[i]
    if (i % 5 === 0) {
      console.log(`  Chain ${i + 1}/${chainUrls.length}...`)
    }
    try {
      const chainData = await fetchJson<PokeApiEvolutionChain>(url)
      walkChain(chainData.chain, evolvesToMap)
    } catch (error) {
      console.error(`  ERROR fetching evolution chain ${url}: ${String(error)}`)
    }
    await sleep(100)
  }

  console.log(`Evolution map built: ${evolvesToMap.size} entries.`)

  // Step 4: Build units with signature moves
  console.log('\nBuilding units and resolving signature moves...')
  const units: Unit[] = []

  for (const id of DEX_IDS) {
    const pokemon = pokemonDataMap.get(id)
    const species = speciesDataMap.get(id)
    if (!pokemon || !species) {
      console.warn(`  Skipping dex #${id}: missing data`)
      continue
    }

    // Parse types
    const types = pokemon.types
      .sort((a, b) => a.slot - b.slot)
      .map(t => cap(t.type.name))

    // Parse base stats
    const baseStats: Unit['baseStats'] = {
      hp: 0, attack: 0, defense: 0,
      specialAttack: 0, specialDefense: 0, speed: 0,
    }
    for (const stat of pokemon.stats) {
      const key = STAT_MAP[stat.stat.name]
      if (key) baseStats[key] = stat.base_stat
    }

    // Parse egg groups
    const eggGroups = species.egg_groups.map(g => cap(g.name))

    // evolves to
    const evolvesTo = evolvesToMap.get(id) ?? null

    // Signature move: highest base-power level-up move matching primary type,
    // falling back to highest base-power level-up move of any type.
    const levelUpMoves = pokemon.moves
      .filter(m =>
        m.version_group_details.some(
          d => d.move_learn_method.name === 'level-up'
        )
      )
      .map(m => m.move.name)

    let signatureMove: string | null = null

    if (levelUpMoves.length > 0) {
      // Fetch power for all level-up moves (uses cache heavily)
      const movePowers: Array<{ name: string; power: number }> = []

      for (const moveName of levelUpMoves) {
        const power = await getMovePower(moveName)
        if (power !== null && power > 0) {
          movePowers.push({ name: moveName, power })
        }
      }

      if (movePowers.length > 0) {
        const primaryType = types[0].toLowerCase()

        // Try to find a STAB move first
        // We need to know what type each move is — but fetching all move types would be too
        // expensive. For simplicity, we use the cached move data.
        // Since we already fetched move power, we can check if the move is STAB
        // by checking if the move's type matches the Pokémon's primary type.
        // However, the move power endpoint also has a `type` field.
        // We'll look up the move type from the cache-enriched data.

        // Get move types for STAB check
        const movesWithType: Array<{ name: string; power: number; typeName: string | null }> = []
        for (const { name, power } of movePowers) {
          // Fetch the full move data to get its type (already cached)
          try {
            const moveData = await fetchJson<PokeApiMove & { type?: PokeApiNamedResource }>(
              `${BASE_URL}/move/${name}`
            )
            const typeName = (moveData as { type?: PokeApiNamedResource }).type?.name ?? null
            movesWithType.push({ name, power, typeName })
          } catch {
            movesWithType.push({ name, power, typeName: null })
          }
        }

        // Sort descending by power
        movesWithType.sort((a, b) => b.power - a.power)

        // Prefer STAB
        const stabMove = movesWithType.find(m => m.typeName === primaryType)
        signatureMove = stabMove ? stabMove.name : movesWithType[0]?.name ?? null
      }
    }

    // Format move name for display (e.g., "flamethrower" → "Flamethrower")
    const formattedSignatureMove = signatureMove
      ? signatureMove
          .split('-')
          .map(word => cap(word))
          .join(' ')
      : null

    const unit: Unit = {
      dexId: id,
      name: cap(pokemon.name),
      types,
      baseStats,
      eggGroups,
      evolvesTo,
      signatureMove: formattedSignatureMove,
    }

    units.push(unit)

    if (id % 25 === 0 || id === 149) {
      console.log(`  Processed up to dex #${id} (${units.length} units so far, ${movesFetched} moves fetched)`)
    }
  }

  console.log(`\nBuilt ${units.length} units total.`)

  // Step 5: Write output files
  const dataDir = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../src/app/badge-run/domain/data'
  )
  fs.mkdirSync(dataDir, { recursive: true })

  const unitsPath = path.join(dataDir, 'units.json')
  const typeChartPath = path.join(dataDir, 'type-chart.json')

  fs.writeFileSync(unitsPath, JSON.stringify(units, null, 2))
  console.log(`\nWrote ${units.length} units to ${unitsPath}`)

  fs.writeFileSync(typeChartPath, JSON.stringify(typeChart, null, 2))
  console.log(`Wrote type chart to ${typeChartPath}`)

  // Sanity check
  const typeCount = Object.keys(typeChart).length
  console.log(`\nSanity check: ${typeCount} types in chart, ${units.length} Pokémon in units.`)
  if (typeCount !== 18) {
    console.warn(`WARNING: Expected 18 types, got ${typeCount}`)
  }
  if (units.length < 140) {
    console.warn(`WARNING: Expected at least 140 units, got ${units.length}`)
  }

  console.log('\nDone.')
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
