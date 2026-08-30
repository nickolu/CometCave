/**
 * The Last Ante tuning harness.
 *
 * The mode's whole premise is that a drafted build plus a declared history is
 * enough to survive late-game numbers. That is a claim about arithmetic, and
 * this script checks it: it plays a run headlessly with a greedy player and
 * reports how far a build actually gets against its blinds.
 *
 * It is deliberately a script, not a test — the answer is meant to move while
 * the mode is being tuned. Run it with `npm run sim:last-ante`.
 */
import {
  LAST_ANTE_MEMORY_BUDGET,
  LAST_ANTE_MEMORY_MAX_PER_HAND,
} from '@/app/comet-cards/domain/daily/constants'
import { createLastAnteRun } from '@/app/comet-cards/domain/daily/create-last-ante-run'
import type { MemoryAllocation, RememberedHandId } from '@/app/comet-cards/domain/daily/types'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { calculateAnte, getBlindDefinition } from '@/app/comet-cards/domain/game/utils'
import { findHighestPriorityHand } from '@/app/comet-cards/domain/hand/hands'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { initializeRounds } from '@/app/comet-cards/domain/round/rounds'
import type { BlindState } from '@/app/comet-cards/domain/round/types'

/** A build a competent drafter could plausibly assemble in Shop 0. */
interface Build {
  name: string
  jokerIds: string[]
  allocation: MemoryAllocation
  discards?: number
  handLevels?: Partial<Record<RememberedHandId, number>>
}

/**
 * Builds that bracket real play, now that The Opening hands out free packs.
 *
 * A player leaves the opening with roughly three jokers and two hand levels
 * before spending a penny; the whole purse then goes to the shop. "Opening
 * only" is the floor, "well shopped" is a player who drafted coherently and
 * spent well.
 */
const BUILDS: Build[] = [
  {
    name: 'Opening only (3 jokers, 2 free levels, no shopping)',
    jokerIds: ['supernovaJoker', 'spareTrousersJoker', 'greenJoker'],
    allocation: { fullHouse: LAST_ANTE_MEMORY_MAX_PER_HAND, twoPair: 5 },
    discards: LAST_ANTE_MEMORY_BUDGET - LAST_ANTE_MEMORY_MAX_PER_HAND - 5,
    handLevels: { fullHouse: 3 },
  },
  {
    name: 'Opening + a decent shop (4 jokers, level 6)',
    jokerIds: ['supernovaJoker', 'spareTrousersJoker', 'greenJoker', 'theDuoJoker'],
    allocation: { fullHouse: LAST_ANTE_MEMORY_MAX_PER_HAND, twoPair: 5 },
    discards: LAST_ANTE_MEMORY_BUDGET - LAST_ANTE_MEMORY_MAX_PER_HAND - 5,
    handLevels: { fullHouse: 6 },
  },
  {
    name: 'Well shopped (5 jokers, level 8)',
    jokerIds: ['supernovaJoker', 'spareTrousersJoker', 'greenJoker', 'theDuoJoker', 'baseballCardJoker'],
    allocation: { fullHouse: LAST_ANTE_MEMORY_MAX_PER_HAND, twoPair: 5 },
    discards: LAST_ANTE_MEMORY_BUDGET - LAST_ANTE_MEMORY_MAX_PER_HAND - 5,
    handLevels: { fullHouse: 8 },
  },
  {
    name: 'Built on the newly-reachable jokers (Hiker / Castle / Egg / Flash Card)',
    jokerIds: ['hiker', 'castle', 'egg', 'flashCardJoker', 'redCard'],
    allocation: { fullHouse: LAST_ANTE_MEMORY_MAX_PER_HAND },
    discards: LAST_ANTE_MEMORY_BUDGET - LAST_ANTE_MEMORY_MAX_PER_HAND,
    handLevels: { fullHouse: 6 },
  },
  {
    name: 'No memories at all (the control)',
    jokerIds: ['supernovaJoker', 'spareTrousersJoker', 'greenJoker', 'theDuoJoker'],
    allocation: {},
    handLevels: { fullHouse: 6 },
  },
]

/** Pick the highest-scoring five cards available in hand. */
function bestSelection(game: GameState): string[] {
  const hand = game.gamePlayState.handIds.map(id => game.cards[id]).filter(Boolean)
  let best: { ids: string[]; rank: number } = { ids: [], rank: -1 }

  // Enumerate 5-card subsets of an 8-card hand: 56 combinations, cheap.
  const n = hand.length
  for (let mask = 0; mask < 1 << n; mask++) {
    const picked: typeof hand = []
    for (let i = 0; i < n; i++) if (mask & (1 << i)) picked.push(hand[i])
    if (picked.length === 0 || picked.length > 5) continue
    const { hand: handId } = findHighestPriorityHand(picked, game.staticRules)
    const rank = HAND_RANK[handId] * 10 + picked.length
    if (rank > best.rank) best = { ids: picked.map(c => c.id), rank }
  }
  return best.ids
}

const HAND_RANK: Record<string, number> = {
  highCard: 1, pair: 2, twoPair: 3, threeOfAKind: 4, straight: 5, flush: 6,
  fullHouse: 7, fourOfAKind: 8, straightFlush: 9, flushHouse: 10, fiveOfAKind: 11, flushFive: 12,
}

function playOneHand(game: GameState): GameState {
  let next = game
  if (!next.gamePlayState.handDealt) next = reduceGame(next, { type: 'HAND_DEALT' })

  for (const id of bestSelection(next)) {
    next = reduceGame(next, { type: 'CARD_SELECTED', id })
  }

  next = reduceGame(next, { type: 'HAND_SCORING_START' })
  const toScore = next.gamePlayState.cardsToScore.length
  for (let i = 0; i < toScore; i++) next = reduceGame(next, { type: 'CARD_SCORED' })
  next = reduceGame(next, { type: 'HAND_SCORING_DONE_CARD_SCORING' })
  return reduceGame(next, { type: 'HAND_SCORING_FINALIZE' })
}

const BLIND_EVENT = {
  smallBlind: 'SMALL_BLIND_SELECTED',
  bigBlind: 'BIG_BLIND_SELECTED',
  bossBlind: 'BOSS_BLIND_SELECTED',
} as const

function runBuild(build: Build, day: string, roundIndex: number) {
  let game = structuredClone(createLastAnteRun(day))
  game.rounds = [initializeRounds(game.gameSeed)[roundIndex]]

  game.jokers = build.jokerIds.map(id => initializeJoker(jokers[id], game))
  for (const [handId, level] of Object.entries(build.handLevels ?? {})) {
    game.pokerHands[handId as RememberedHandId].level = level as number
  }

  game = reduceGame(game, { type: 'OPENING_CONFIRMED' })
  game = reduceGame(game, { type: 'SHOP_SELECT_BLIND' })
  for (const [handId, count] of Object.entries(build.allocation)) {
    game = reduceGame(game, { type: 'MEMORY_ALLOCATED', handId: handId as RememberedHandId, count: count as number })
  }
  game = reduceGame(game, { type: 'DISCARDS_REMEMBERED', count: build.discards ?? 0 })
  game = reduceGame(game, { type: 'MEMORIES_CONFIRMED' })

  const results: string[] = []

  for (const type of ['smallBlind', 'bigBlind', 'bossBlind'] as BlindState['type'][]) {
    game = reduceGame(game, { type: BLIND_EVENT[type] })

    let handsPlayed = 0
    while (game.gamePhase === 'gameplay' && game.gamePlayState.remainingHands > 0) {
      game = playOneHand(game)
      handsPlayed++
      if (handsPlayed > 10) break
    }

    const round = game.rounds[0]
    const target = calculateAnte(round.baseAnte, getBlindDefinition(type, round).anteMultiplier)
    const scored = round[type].score
    const cleared = scored >= target
    const ratio = target > 0n ? Number((scored * 1000n) / target) / 10 : 0

    results.push(
      `    ${type.padEnd(10)} ${scored.toString().padStart(12)} / ${target.toString().padEnd(10)} ` +
        `${ratio.toFixed(1).padStart(6)}%  ${cleared ? 'CLEARED' : 'FAILED'}  (${handsPlayed} hands)`
    )

    if (!cleared) break
    if (game.gamePhase === 'blindRewards') game = reduceGame(game, { type: 'BLIND_REWARDS_END' })
    if (game.gamePhase === 'gameOver') break
  }

  return results
}

const day = process.argv[2] ?? '2026-01-15'
const indices = process.argv[3] ? [Number(process.argv[3])] : [4, 5, 6, 7, 8]
const probe = createLastAnteRun(day)

console.log(`\nThe Last Ante — ${day}`)
console.log(`  deck: ${probe.selectedDeck}   boss: ${probe.rounds[0].bossBlindName}`)
console.log(`  purse: $${probe.money}   memories: ${LAST_ANTE_MEMORY_BUDGET}`)

for (const roundIndex of indices) {
  const base = initializeRounds(probe.gameSeed)[roundIndex].baseAnte
  console.log(`\n=== round index ${roundIndex} — small blind ${base} ===`)
  for (const build of BUILDS) {
    console.log(`  ${build.name}`)
    for (const line of runBuild(build, day, roundIndex)) console.log(line)
  }
}
