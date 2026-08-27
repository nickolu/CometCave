import { makePRNG } from '../rng'
import { UNIT_CATALOG, type CatalogUnit } from '../unit-catalog'
import { ARENA_SCHEDULE } from '../data/arenas'
import { runBattle } from '../battle/runner'
import type { BattleUnit, Team } from '../battle/types'
import type { BattleResult } from '../battle/events'
import { computeRoundIncome } from '../economy/gold'
import { maxSlotsForLevel, pickTierByOdds, XP_PER_BUY, XP_COST, REROLL_COST, XP_TO_NEXT_LEVEL } from '../shop/tier-odds'
import { applyLevelBonus, survivedRound } from '../levels/survival'
import { computeLossDamage, applyDamage, MAX_PLAYER_HP } from '../matchmaking/hp'
import { isGymRound, getRoundInfo } from '../gauntlet/schedule'
import { detectActiveSecrets, getUnitSecretMultiplier, applySecretBonus } from '../secrets/secrets'
import type { DraftPick } from '../run-record'

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
  gold: number          // current gold
  winStreak: number     // consecutive rounds won
  lossStreak: number    // consecutive rounds lost
  level: number         // player level 1-10
  xp: number            // accumulated XP toward next level
  maxSlots: number      // max team size (1-6, derived from level)
  rerollCount: number   // number of rerolls this round (for seeding)
  boardLevels: Record<number, number>  // dexId → survival level (0-25)
  playerHp: number      // player HP, starts at 100
  eliminated: boolean   // true when playerHp reaches 0
  firstTeamDexIds: number[]  // team dexIds recorded after round 1 win (for Old Friend secret)
  draftSequence: DraftPick[]  // ordered list of picks — ghost replay log
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a CatalogUnit to a BattleUnit for use in runBattle.
 * secretMultiplier is the total secret stat bonus for this unit (0 if none).
 */
function catalogToUnit(cat: CatalogUnit, prefix: string, idx: number, survivalLevel: number = 0, secretMultiplier: number = 0): BattleUnit {
  const survivedStats = applyLevelBonus({
    hp: cat.baseStats.hp,
    attack: cat.baseStats.attack,
    defense: cat.baseStats.defense,
    specialAttack: cat.baseStats.specialAttack,
    specialDefense: cat.baseStats.specialDefense,
    speed: cat.baseStats.speed,
  }, survivalLevel)
  const stats = applySecretBonus(survivedStats, secretMultiplier)
  return {
    instanceId: `${prefix}-${idx}`,
    dexId: cat.dexId,
    name: cat.name,
    types: cat.types,
    tier: cat.tier,
    kin: cat.kin,
    maxHp: stats.hp,
    currentHp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    specialAttack: stats.specialAttack,
    specialDefense: stats.specialDefense,
    speed: stats.speed,
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
 * Picks units by tier based on the player's current level.
 */
function generateOffers(
  seed: number,
  round: number,
  existingTeam: CatalogUnit[],
  level: number = 1,
): [CatalogUnit, CatalogUnit, CatalogUnit] {
  const rng = makePRNG((seed ^ (round * 0x45d9f3b)) >>> 0)
  const teamDexIds = new Set(existingTeam.map(u => u.dexId))
  const picks: CatalogUnit[] = []
  const used = new Set<number>()

  while (picks.length < 3) {
    // Pick a tier based on level odds
    const tierRand = rng.nextInt(1000000) / 1000000
    const tier = pickTierByOdds(level, tierRand)

    // Get available units of that tier
    const tierUnits = UNIT_CATALOG.filter(u => u.tier === tier && !used.has(u.dexId) && !teamDexIds.has(u.dexId))
    if (tierUnits.length === 0) {
      // Fall back to any available unit if no units of this tier available
      const anyUnit = UNIT_CATALOG.filter(u => !used.has(u.dexId) && !teamDexIds.has(u.dexId))
      if (anyUnit.length === 0) break
      const unit = anyUnit[rng.nextInt(anyUnit.length)]
      used.add(unit.dexId)
      picks.push(unit)
    } else {
      const unit = tierUnits[rng.nextInt(tierUnits.length)]
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

  const offers = generateOffers(seed, 1, [], 1)

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
    gold: 0,
    winStreak: 0,
    lossStreak: 0,
    level: 1,
    xp: 0,
    maxSlots: 1,
    rerollCount: 0,
    boardLevels: {},
    playerHp: MAX_PLAYER_HP,
    eliminated: false,
    firstTeamDexIds: [],
    draftSequence: [],
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

  const roundInfo = getRoundInfo(run.round)
  if (!roundInfo.draftEnabled) {
    throw new Error(`Draft is locked for round ${run.round} (Elite Four / Champion)`)
  }

  if (!run.offers) {
    throw new Error('No offers available')
  }

  const picked = run.offers.find(u => u.dexId === dexId)
  if (!picked) {
    throw new Error(`dexId ${dexId} is not among the current offers`)
  }

  const pick: DraftPick = {
    round: run.round,
    pick: dexId,
    offers: run.offers.map(u => u.dexId),
  }

  return {
    ...run,
    team: [...run.team, picked],
    lastPickedDexId: dexId,
    offers: null,
    phase: 'battle',
    draftSequence: [...run.draftSequence, pick],
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

  // Detect active secrets for the player's team this round
  const activeSecrets = detectActiveSecrets({
    team: run.team,
    boardLevels: run.boardLevels,
    round: run.round,
    firstTeamDexIds: run.firstTeamDexIds,
  })

  // Build attacker team from player's team (applying survival levels + secret bonuses)
  const attackerTeam: Team = {
    id: 'player',
    units: run.team.map((u, i) =>
      catalogToUnit(u, 'player', i, run.boardLevels[u.dexId] ?? 0, getUnitSecretMultiplier(u.dexId, activeSecrets))
    ),
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
    const newLossStreak = run.lossStreak + 1
    const income = computeRoundIncome(run.gold, newLossStreak)
    const opponentFaints = result.events.filter(e => {
      if (e.type !== 'faint') return false
      return e.unitId.startsWith('opponent-')
    }).length
    const survivingEnemies = opponentCatalog.length - opponentFaints
    const damage = computeLossDamage(run.round, survivingEnemies, isGymRound(run.round))
    const newHp = applyDamage(run.playerHp, damage)
    return {
      ...run,
      lastBattleResult: result,
      phase: 'summary',
      lost: true,
      gold: run.gold + income,
      winStreak: 0,
      lossStreak: newLossStreak,
      playerHp: newHp,
      eliminated: newHp <= 0,
    }
  }

  // Player won
  const newWinStreak = run.winStreak + 1
  const income = computeRoundIncome(run.gold, newWinStreak)
  const newBoardLevels = survivedRound(run.boardLevels, run.team.map(u => u.dexId))

  // Record team composition after round 1 win (used by Old Friend secret)
  const newFirstTeamDexIds = run.firstTeamDexIds.length === 0 && run.round === 1
    ? run.team.map(u => u.dexId)
    : run.firstTeamDexIds

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
      gold: run.gold + income,
      winStreak: newWinStreak,
      lossStreak: 0,
      boardLevels: newBoardLevels,
      firstTeamDexIds: newFirstTeamDexIds,
    }
  }

  if (hasEvolution) {
    // Has evolution — go to evolve phase before advancing
    return {
      ...run,
      lastBattleResult: result,
      phase: 'evolve',
      gold: run.gold + income,
      winStreak: newWinStreak,
      lossStreak: 0,
      boardLevels: newBoardLevels,
      firstTeamDexIds: newFirstTeamDexIds,
    }
  }

  // No evolution — advance round and generate new offers
  const nextRound = run.round + 1
  const newOffers = generateOffers(run.seed, nextRound, run.team, run.level)

  return {
    ...run,
    lastBattleResult: result,
    round: nextRound,
    phase: 'draft',
    offers: newOffers,
    gold: run.gold + income,
    winStreak: newWinStreak,
    lossStreak: 0,
    boardLevels: newBoardLevels,
    firstTeamDexIds: newFirstTeamDexIds,
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
      boardLevels: run.boardLevels,
    }
  }

  const newOffers = generateOffers(run.seed, nextRound, newTeam, run.level)

  return {
    ...run,
    team: newTeam,
    round: nextRound,
    phase: 'draft',
    offers: newOffers,
    boardLevels: run.boardLevels,
  }
}

/**
 * Reroll the current draft offers. Costs REROLL_COST gold.
 * Uses rerollCount to produce a unique seed each time.
 */
export function rerollOffers(run: BlitzRun): BlitzRun {
  if (run.phase !== 'draft') {
    throw new Error(`Cannot reroll in phase '${run.phase}'`)
  }
  if (run.gold < REROLL_COST) {
    throw new Error(`Insufficient gold: have ${run.gold}, need ${REROLL_COST}`)
  }

  const newRerollCount = run.rerollCount + 1
  // Derive a unique seed for this reroll from the base seed, round, and reroll count
  const rerollSeed = (run.seed ^ (run.round * 0x45d9f3b) ^ (newRerollCount * 0xf3a4b5)) >>> 0
  const newOffers = generateOffers(rerollSeed, 0, run.team, run.level)

  return {
    ...run,
    gold: run.gold - REROLL_COST,
    offers: newOffers,
    rerollCount: newRerollCount,
  }
}

/**
 * Swap two units in the team by board position index (0-5).
 * Indices 0-2 are front row, 3-5 are back row.
 * Swapping with an empty slot moves the unit to that position.
 */
export function swapTeamPositions(run: BlitzRun, fromIdx: number, toIdx: number): BlitzRun {
  if (fromIdx === toIdx) return run

  // Build padded 6-slot array (null = empty slot)
  const slots: Array<(typeof run.team)[0] | null> = Array(6).fill(null)
  run.team.forEach((u, i) => { slots[i] = u })

  // Swap the two positions
  ;[slots[fromIdx], slots[toIdx]] = [slots[toIdx], slots[fromIdx]]

  // Re-pack: keep non-null items, maintaining slot order
  const newTeam = slots.filter((u): u is (typeof run.team)[0] => u !== null)

  return { ...run, team: newTeam }
}

/**
 * Buy XP. Costs XP_COST gold, grants XP_PER_BUY XP.
 * May trigger a level-up if XP threshold is crossed.
 */
export function buyXP(run: BlitzRun): BlitzRun {
  if (run.gold < XP_COST) {
    throw new Error(`Insufficient gold: have ${run.gold}, need ${XP_COST}`)
  }

  let newXp = run.xp + XP_PER_BUY
  let newLevel = run.level

  // Level up while XP meets or exceeds the threshold, and level is not capped
  while (newLevel < 10) {
    const threshold = XP_TO_NEXT_LEVEL[newLevel]
    if (newXp >= threshold) {
      newXp -= threshold
      newLevel++
    } else {
      break
    }
  }

  return {
    ...run,
    gold: run.gold - XP_COST,
    xp: newXp,
    level: newLevel,
    maxSlots: maxSlotsForLevel(newLevel),
  }
}
