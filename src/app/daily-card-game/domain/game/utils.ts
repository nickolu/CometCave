import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { Effect, EffectContext, GameEvent } from '@/app/daily-card-game/domain/events/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import type { JokerState } from '@/app/daily-card-game/domain/joker/types'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { mulberry32, xmur3 } from '@/app/daily-card-game/domain/randomness'
import { bigBlind, getInProgressBlind, smallBlind } from '@/app/daily-card-game/domain/round/blinds'
import { bossBlinds } from '@/app/daily-card-game/domain/round/boss-blinds'
import type {
  BlindDefinition,
  BlindState,
  RoundState,
} from '@/app/daily-card-game/domain/round/types'
import { implementedTags as tags } from '@/app/daily-card-game/domain/tag/tags'
import { getRandomTag } from '@/app/daily-card-game/domain/tag/utils'
import { vouchers } from '@/app/daily-card-game/domain/voucher/vouchers'

import { INTEREST_CALCULATION_FACTOR } from './constants'

import type { GameState } from './types'

/**
 * Calculate the ante target as BigInt, handling the decimal 1.5 multiplier
 * Since BigInt doesn't support decimals, we handle 1.5 as (baseAnte * 3n) / 2n
 */
export function calculateAnte(
  baseAnte: bigint,
  multiplier: BlindDefinition['anteMultiplier']
): bigint {
  if (multiplier === 1.5) {
    return (baseAnte * 3n) / 2n
  }
  return baseAnte * BigInt(multiplier)
}

export function getBlindDefinition(type: BlindState['type'], round: RoundState): BlindDefinition {
  if (type === 'smallBlind') return smallBlind
  if (type === 'bigBlind') return bigBlind
  if (type === 'bossBlind') {
    const bossBlind = bossBlinds.find(blind => blind.name === round.bossBlindName)
    if (!bossBlind) throw new Error(`Boss blind not found: ${round.bossBlindName}`)
    return bossBlind
  }

  throw new Error(`Unknown blind type: ${type}`)
}

export function collectEffects(game: GameState): Effect[] {
  const effects: Effect[] = []

  const blind = getInProgressBlind(game)
  if (blind && blind.type === 'bossBlind') {
    effects.push(...getBlindDefinition(blind.type, game.rounds[game.roundIndex]).effects)
  }

  effects.push(...game.jokers.flatMap(j => jokers[j.jokerId]?.effects || []))

  effects.push(...game.vouchers.flatMap(v => vouchers[v.type]?.effects || []))

  effects.push(...game.tags.flatMap(t => tags[t.tagType]?.effects || []))

  return effects
}

function shuffleArray<T>(array: T[], rng: () => number): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Shuffle an array of card IDs using a seeded RNG
 * @deprecated Use shuffleCardIds instead
 */
export function randomizeDeck({
  deck,
  seed,
  iteration,
}: {
  deck: PlayingCardState[]
  seed: string
  iteration: number
}): PlayingCardState[] {
  const seedFn = xmur3(seed + iteration.toString())
  const rng = mulberry32(seedFn())
  return shuffleArray(deck, rng)
}

/**
 * Shuffle an array of card IDs using a seeded RNG
 * This is the new ID-based version of randomizeDeck
 */
export function shuffleCardIds({
  cardIds,
  seed,
  iteration,
}: {
  cardIds: string[]
  seed: string
  iteration: number
}): string[] {
  const seedFn = xmur3(seed + iteration.toString())
  const rng = mulberry32(seedFn())
  return shuffleArray(cardIds, rng)
}

export function removeJoker(draft: GameState, event: GameEvent, selectedJoker: JokerState) {
  draft.gamePlayState.selectedJokerId = undefined
  const ctx: EffectContext = {
    event,
    game: draft as unknown as GameState,
    score: draft.gamePlayState.score,
    playedCards: [],
    round: draft.rounds[draft.roundIndex],
    bossBlind: draft.rounds[draft.roundIndex].bossBlind,
    jokers: draft.jokers,
    vouchers: draft.vouchers,
    tags: draft.tags,
  }
  // Collect effects *before* removing the joker so "on sold/removed" effects that live on the
  // removed joker itself still get a chance to run. Then dispatch *after* removal so effects
  // can observe the post-removal game state.
  const effectsBeforeRemoval = collectEffects(ctx.game)
  draft.jokers = draft.jokers.filter(joker => joker.id !== selectedJoker.id)
  ctx.jokers = draft.jokers
  dispatchEffects(event, ctx, effectsBeforeRemoval)
}

export function calculateInterest(draft: GameState): number {
  const currentMoney = draft.money
  const maxInterest = draft.maxInterest
  const interestCalculation = Math.floor(currentMoney / INTEREST_CALCULATION_FACTOR)
  return Math.min(interestCalculation, maxInterest)
}

export function populateTags(draft: GameState): void {
  const bigBlindTag = getRandomTag(draft)
  const smallBlindTag = getRandomTag(draft)
  draft.rounds[draft.roundIndex].bigBlind.tag = bigBlindTag
  draft.rounds[draft.roundIndex].smallBlind.tag = smallBlindTag
}

export function getEffectContext(
  draft: GameState,
  event: GameEvent,
  override?: Partial<EffectContext>
): EffectContext {
  return {
    ...{
      event,
      game: draft,
      score: draft.gamePlayState.score,
      playedCards: [],
      round: draft.rounds[draft.roundIndex],
      bossBlind: draft.rounds[draft.roundIndex].bossBlind,
      jokers: draft.jokers,
      vouchers: draft.vouchers,
      tags: draft.tags,
    },
    ...override,
  }
}
