import { makePRNG } from '../rng'
import { UNIT_CATALOG, type CatalogUnit } from '../unit-catalog'
import { ARENA_SCHEDULE } from '../data/arenas'
import { runBattle } from '../battle/runner'
import type { BattleUnit, Team } from '../battle/types'
import type { BattleResult } from '../battle/events'

export type BlitzPhase = 'idle' | 'draft' | 'battle' | 'evolve' | 'summary'

export interface BlitzRun {
  seed: number
  round: number          // 1-8, current round
  phase: BlitzPhase
  team: CatalogUnit[]    // player's accumulated team (up to 6)
  offers: [CatalogUnit, CatalogUnit, CatalogUnit] | null  // current draft offers
  lastPickedDexId: number | null  // for evolution tracking
  lastBattleResult: BattleResult | null
  opponentTeams: CatalogUnit[][]  // pre-generated, one per round (8 total)
  won: boolean           // true if completed round 8
  lost: boolean          // true if lost a battle
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a CatalogUnit to a BattleUnit for use in runBattle.
 */
function catalogToUnit(cat: CatalogUnit, prefix: string, idx: number): BattleUnit {
  return {
    instanceId: `${prefix}-${idx}`,
    dexId: cat.dexId,
    name: cat.name,
    types: cat.types,
    tier: cat.tier,
    kin: cat.kin,
    maxHp: cat.baseStats.hp,
    currentHp: cat.baseStats.hp,
    attack: cat.baseStats.attack,
    defense: cat.baseStats.defense,
    specialAttack: cat.baseStats.specialAttack,
    specialDefense: cat.baseStats.specialDefense,
    speed: cat.baseStats.speed,
    signatureMove: cat.signatureMove,
    fainted: false,
  }
}

/**
 * Generate 6 random units from UNIT_CATALOG for an opponent team.
 * Uses a seeded PRNG derived from the main seed and round number.
 */
function generateOpponentTeam(seed: number, round: number): CatalogUnit[] {
  const rng = makePRNG(seed ^ (round * 0x9e3779b9))
  const picks: CatalogUnit[] = []
  const used = new Set<number>()

  while (picks.length < 6) {
    const idx = rng.nextInt(UNIT_CATALOG.length)
    const unit = UNIT_CATALOG[idx]
    if (!used.has(unit.dexId)) {
      used.add(unit.dexId)
      picks.push(unit)
    }
  }

  return picks
}

/**
 * Generate 3 draft offers from UNIT_CATALOG, excluding units already on the team.
 * Uses a seeded PRNG derived from the main seed and round number.
 */
function generateOffers(
  seed: number,
  round: number,
  existingTeam: CatalogUnit[],
): [CatalogUnit, CatalogUnit, CatalogUnit] {
  const rng = makePRNG((seed ^ (round * 0x45d9f3b)) >>> 0)
  const teamDexIds = new Set(existingTeam.map(u => u.dexId))
  const picks: CatalogUnit[] = []
  const used = new Set<number>()

  while (picks.length < 3) {
    const idx = rng.nextInt(UNIT_CATALOG.length)
    const unit = UNIT_CATALOG[idx]
    if (!used.has(unit.dexId) && !teamDexIds.has(unit.dexId)) {
      used.add(unit.dexId)
      picks.push(unit)
    }
  }

  return picks as [CatalogUnit, CatalogUnit, CatalogUnit]
}

/**
 * Get the arena ID for the given round (1-indexed).
 * Blitz uses the first 8 arenas from ARENA_SCHEDULE.
 */
function arenaForRound(round: number): string {
  return ARENA_SCHEDULE[round - 1]
}

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

/**
 * Initialize a fresh Blitz run.
 */
export function startBlitz(seed: number): BlitzRun {
  // Pre-generate all 8 opponent teams
  const opponentTeams: CatalogUnit[][] = []
  for (let r = 1; r <= 8; r++) {
    opponentTeams.push(generateOpponentTeam(seed, r))
  }

  const offers = generateOffers(seed, 1, [])

  return {
    seed,
    round: 1,
    phase: 'draft',
    team: [],
    offers,
    lastPickedDexId: null,
    lastBattleResult: null,
    opponentTeams,
    won: false,
    lost: false,
  }
}

/**
 * Pick a unit from the current draft offers.
 * Validates that the dexId is among the offers, then adds it to the team.
 * Advances phase to 'battle'.
 */
export function pickUnit(run: BlitzRun, dexId: number): BlitzRun {
  if (run.phase !== 'draft') {
    throw new Error(`Cannot pick unit in phase '${run.phase}'`)
  }
  if (!run.offers) {
    throw new Error('No offers available')
  }

  const picked = run.offers.find(u => u.dexId === dexId)
  if (!picked) {
    throw new Error(`dexId ${dexId} is not among the current offers`)
  }

  return {
    ...run,
    team: [...run.team, picked],
    lastPickedDexId: dexId,
    offers: null,
    phase: 'battle',
  }
}

/**
 * Resolve the battle for the current round.
 * Runs the battle simulation and advances the phase based on the outcome.
 */
export function resolveBattle(run: BlitzRun): BlitzRun {
  if (run.phase !== 'battle') {
    throw new Error(`Cannot resolve battle in phase '${run.phase}'`)
  }

  const arenaId = arenaForRound(run.round)
  const battleSeed = run.seed ^ (run.round * 0xdeadbeef)

  // Build attacker team from player's team
  const attackerTeam: Team = {
    id: 'player',
    units: run.team.map((u, i) => catalogToUnit(u, 'player', i)),
  }

  // Build defender team from pre-generated opponent team
  const opponentCatalog = run.opponentTeams[run.round - 1]
  const defenderTeam: Team = {
    id: 'opponent',
    units: opponentCatalog.map((u, i) => catalogToUnit(u, 'opponent', i)),
  }

  const { result } = runBattle(attackerTeam, defenderTeam, arenaId, battleSeed)
  const playerWon = result.winnerId === 'player'

  if (!playerWon) {
    // Loss — run ends
    return {
      ...run,
      lastBattleResult: result,
      phase: 'summary',
      lost: true,
    }
  }

  // Player won
  // Check if last picked unit can evolve
  const lastPicked = run.lastPickedDexId !== null
    ? UNIT_CATALOG.find(u => u.dexId === run.lastPickedDexId)
    : null
  const hasEvolution = lastPicked?.evolvesTo !== null && lastPicked?.evolvesTo !== undefined

  if (run.round === 8) {
    // Round 8 win — run complete
    return {
      ...run,
      lastBattleResult: result,
      phase: 'summary',
      won: true,
    }
  }

  if (hasEvolution) {
    // Has evolution — go to evolve phase before advancing
    return {
      ...run,
      lastBattleResult: result,
      phase: 'evolve',
    }
  }

  // No evolution — advance round and generate new offers
  const nextRound = run.round + 1
  const newOffers = generateOffers(run.seed, nextRound, run.team)

  return {
    ...run,
    lastBattleResult: result,
    round: nextRound,
    phase: 'draft',
    offers: newOffers,
  }
}

/**
 * Apply evolution to the last picked unit and advance to the next round.
 */
export function resolveEvolution(run: BlitzRun): BlitzRun {
  if (run.phase !== 'evolve') {
    throw new Error(`Cannot resolve evolution in phase '${run.phase}'`)
  }
  if (run.lastPickedDexId === null) {
    throw new Error('No unit to evolve')
  }

  const lastPicked = UNIT_CATALOG.find(u => u.dexId === run.lastPickedDexId)
  if (!lastPicked || lastPicked.evolvesTo === null) {
    throw new Error(`Unit ${run.lastPickedDexId} has no evolution`)
  }

  const evolvedUnit = UNIT_CATALOG.find(u => u.dexId === lastPicked.evolvesTo)
  if (!evolvedUnit) {
    throw new Error(`Evolution target dexId ${lastPicked.evolvesTo} not found in catalog`)
  }

  // Replace the last picked unit in the team with its evolved form
  const newTeam = run.team.map(u =>
    u.dexId === run.lastPickedDexId ? evolvedUnit : u
  )

  const nextRound = run.round + 1

  if (nextRound > 8) {
    // Already completed round 8 — summary
    return {
      ...run,
      team: newTeam,
      phase: 'summary',
      won: true,
    }
  }

  const newOffers = generateOffers(run.seed, nextRound, newTeam)

  return {
    ...run,
    team: newTeam,
    round: nextRound,
    phase: 'draft',
    offers: newOffers,
  }
}
