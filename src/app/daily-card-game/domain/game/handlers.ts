import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { initializeCelestialCard } from '@/app/daily-card-game/domain/consumable/utils'
import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { EffectContext, GameEvent } from '@/app/daily-card-game/domain/events/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import {
  buildSeedString,
  getRandomFloatWithSeed,
  uuid,
} from '@/app/daily-card-game/domain/randomness'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import type { RoundState } from '@/app/daily-card-game/domain/round/types'

import { HAND_SIZE } from './constants'
import { calculateInterest } from './reduce-game'
import { collectEffects, getBlindDefinition } from './utils'

import type { GamePlayState, GameState } from './types'
import type { Draft } from 'immer'

type HandEndOutcome = 'gameOver' | 'blindRewards' | 'continue'

/**
 * Gets the probability multiplier based on game state.
 * e.g., "Oops! All 6s" joker doubles all probabilities.
 */
function getProbabilityMultiplier(game: GameState): number {
  const hasOopsAll6s = game.jokers.some(j => j.jokerId === 'oopsAll6s')
  return hasOopsAll6s ? 2 : 1
}

/**
 * Checks if a lucky roll succeeds.
 * @param baseChance - The base chance as "1 in X" (e.g., 5 means 1 in 5 = 20%)
 * @param seed - Seed string for deterministic random
 * @param game - Game state to check for probability modifiers
 */
function checkLuckyRoll(baseChance: number, seed: string, game: GameState): boolean {
  const multiplier = getProbabilityMultiplier(game)
  // Base probability is 1/baseChance, multiplied by the modifier
  const probability = Math.min(1, (1 / baseChance) * multiplier)
  const roll = getRandomFloatWithSeed(seed)
  return roll < probability
}

function getCurrentRound(draft: Draft<GameState>): RoundState {
  return draft.rounds[draft.roundIndex]
}

function computeBlindScoreAndAnte(
  draft: Draft<GameState>,
  currentBlind: ReturnType<typeof getInProgressBlind>,
  round: RoundState
) {
  if (!currentBlind) return null

  const blindScore =
    currentBlind.score + draft.gamePlayState.score.chips * draft.gamePlayState.score.mult
  const blindDefinition = getBlindDefinition(currentBlind.type, round)
  const ante = blindDefinition.anteMultiplier * round.baseAnte
  const newTotalScore = draft.totalScore + blindScore

  // Persist computed blind score onto the round
  round[currentBlind.type].score = blindScore

  return { round, blindScore, ante, newTotalScore }
}

function applyHandScoringEndEffects(
  draft: Draft<GameState>,
  event: GameEvent,
  round: Draft<GameState>['rounds'][number]
) {
  const ctx: EffectContext = {
    event,
    game: draft,
    score: draft.gamePlayState.score,
    playedCards: draft.gamePlayState.selectedHand?.[1],
    round: round,
    bossBlind: round.bossBlind,
    jokers: draft.jokers,
    vouchers: draft.vouchers,
  }
  dispatchEffects(event, ctx, collectEffects(ctx.game))
}

function decideHandEndOutcome(args: {
  blindScore: number
  ante: number
  remainingHands: number
}): HandEndOutcome {
  const { blindScore, ante, remainingHands } = args
  if (blindScore < ante && remainingHands === 0) return 'gameOver'
  if (blindScore >= ante) return 'blindRewards'
  return 'continue'
}

function resetScoreForNextHand(gamePlayState: Draft<GamePlayState>) {
  gamePlayState.isScoring = false
  gamePlayState.scoringEvents.push({
    id: uuid(),
    message: `Hand Score: ${gamePlayState.score.chips} x ${gamePlayState.score.mult}`,
  })
  gamePlayState.score = { chips: 0, mult: 0 }
}

export function handleHandScoringEnd(draft: Draft<GameState>, event: GameEvent) {
  const currentBlind = getInProgressBlind(draft)
  if (!currentBlind) return

  const round = getCurrentRound(draft)
  // Effects (boss blinds / jokers) react BEFORE cleanup/phase transitions
  applyHandScoringEndEffects(draft, event, round)

  const computed = computeBlindScoreAndAnte(draft, currentBlind, round)
  if (!computed) return

  const { blindScore, ante, newTotalScore } = computed

  // Capture the played hand before clearing state (needed for blue seal)
  const playedHand = draft.gamePlayState.selectedHand?.[0]

  // After effects have reacted, discard ALL played cards (even ones that didn't score)
  const playedIds = new Set(draft.gamePlayState.playedCardIds)
  if (playedIds.size > 0) {
    draft.gamePlayState.dealtCards = draft.gamePlayState.dealtCards.filter(
      card => !playedIds.has(card.id)
    )
  }
  draft.gamePlayState.selectedCardIds = []
  draft.gamePlayState.selectedHand = undefined
  draft.gamePlayState.cardsToScore = []
  draft.gamePlayState.playedCardIds = []

  const outcome = decideHandEndOutcome({
    blindScore,
    ante,
    remainingHands: draft.gamePlayState.remainingHands,
  })

  draft.totalScore = newTotalScore

  if (outcome === 'gameOver') {
    draft.gamePhase = 'gameOver'
    draft.gamePlayState.isScoring = false
    return
  }

  if (outcome === 'blindRewards') {
    draft.gamePhase = 'blindRewards'

    // Blue seal: add celestial card for the played hand for each card with blue seal still in hand
    const cardsInHandWithBlueSeal = draft.gamePlayState.dealtCards.filter(
      card => card.flags.seal === 'blue'
    )
    if (playedHand) {
      for (let i = 0; i < cardsInHandWithBlueSeal.length; i++) {
        if (draft.consumables.length < draft.maxConsumables) {
          draft.consumables.push(initializeCelestialCard(celestialCards[playedHand]))
        }
      }
    }

    // Gold enchantment: earn $3 for each card with gold enchantment held in hand (not played)
    const cardsInHandWithGoldEnchantment = draft.gamePlayState.dealtCards.filter(
      card => card.flags.enchantment === 'gold'
    )
    draft.money += cardsInHandWithGoldEnchantment.length * 3

    draft.gamePlayState.dealtCards = []

    if (draft.gamePlayState.remainingHands > 0) {
      currentBlind.additionalRewards.push(['Remaining Hands', draft.gamePlayState.remainingHands])
    }
    const interest = calculateInterest(draft)

    if (interest > 0) {
      currentBlind.additionalRewards.push(['Interest', interest])
    }

    resetScoreForNextHand(draft.gamePlayState)

    return
  }

  // Continue gameplay: refill + reset score
  const cardsToRefill = draft.gamePlayState.remainingDeck.slice(
    0,
    HAND_SIZE - draft.gamePlayState.dealtCards.length
  )
  draft.gamePhase = 'gameplay'
  draft.gamePlayState.dealtCards = draft.gamePlayState.dealtCards.concat(cardsToRefill)
  draft.gamePlayState.remainingDeck = draft.gamePlayState.remainingDeck.slice(cardsToRefill.length)
  resetScoreForNextHand(draft.gamePlayState)
}

function scoreCardOnce(
  draft: GameState,
  card: (typeof draft.gamePlayState.cardsToScore)[number],
  event: GameEvent
) {
  const gamePlayState = draft.gamePlayState

  let cardChips = playingCards[card.playingCardId].baseChips
  let cardMult = 0

  // Enchantments (additive)
  if (card.flags.enchantment === 'bonus') cardChips += 30
  if (card.flags.enchantment === 'mult') cardMult += 5

  // Editions (additive)
  if (card.flags.edition === 'foil') cardChips += 50
  if (card.flags.edition === 'holographic') cardMult += 10

  if (cardChips > 0) {
    draft.gamePlayState.scoringEvents.push({
      id: uuid(),
      type: 'chips',
      value: cardChips,
      source: playingCards[card.playingCardId].value,
    })
  }

  if (cardMult > 0) {
    draft.gamePlayState.scoringEvents.push({
      id: uuid(),
      type: 'mult',
      value: cardMult,
      source: playingCards[card.playingCardId].value,
    })
  }

  gamePlayState.score = {
    chips: gamePlayState.score.chips + cardChips,
    mult: gamePlayState.score.mult + cardMult,
  }

  // Polychrome edition: X1.5 Mult (multiplicative, applied after additive bonuses)
  if (card.flags.edition === 'polychrome') {
    gamePlayState.score.mult *= 1.5
    draft.gamePlayState.scoringEvents.push({
      id: uuid(),
      type: 'mult',
      operator: 'x',
      value: 1.5,
      source: playingCards[card.playingCardId].value,
    })
  }

  // Gold seal: earn $3 immediately when scored
  if (card.flags.seal === 'gold') {
    draft.money += 3
  }

  // Lucky enchantment: 1 in 5 chance for +20 Mult, 1 in 15 chance for $20
  // Both effects roll separately and can both trigger
  if (card.flags.enchantment === 'lucky') {
    const multSeed = buildSeedString([
      draft.gameSeed,
      card.id,
      'lucky-mult',
      String(draft.handsPlayed),
    ])
    const moneySeed = buildSeedString([
      draft.gameSeed,
      card.id,
      'lucky-money',
      String(draft.handsPlayed),
    ])

    if (checkLuckyRoll(5, multSeed, draft)) {
      draft.gamePlayState.scoringEvents.push({
        id: uuid(),
        type: 'mult',
        value: 20,
        source: 'Lucky',
      })
      gamePlayState.score.mult += 20
    }

    if (checkLuckyRoll(15, moneySeed, draft)) {
      draft.money += 20
    }
  }

  const currentBlind = getInProgressBlind(draft as unknown as GameState)
  if (!currentBlind) return

  const playedCards = draft.gamePlayState.selectedHand?.[1]
  const ctx: EffectContext = {
    event,
    game: draft as unknown as GameState,
    score: gamePlayState.score,
    playedCards,
    scoredCards: [card],
    round: draft.rounds[draft.roundIndex],
    bossBlind: draft.rounds[draft.roundIndex].bossBlind,
    jokers: draft.jokers,
    vouchers: draft.vouchers,
  }
  dispatchEffects(event, ctx, collectEffects(ctx.game))
}

export function handleCardScored(draft: GameState, event: GameEvent) {
  const gamePlayState = draft.gamePlayState
  const currentCardToScore = gamePlayState.cardsToScore.shift()
  if (!currentCardToScore) return
  const scoredCardId = currentCardToScore.id
  const hasRedSeal = currentCardToScore.flags.seal === 'red'

  // Score the card (and score again if it has a red seal)
  scoreCardOnce(draft, currentCardToScore, event)
  if (hasRedSeal) {
    scoreCardOnce(draft, currentCardToScore, event)
  }

  // remove card from selection & hand UI (only once, regardless of red seal)
  gamePlayState.selectedCardIds = gamePlayState.selectedCardIds.filter(id => id !== scoredCardId)
  if (gamePlayState.selectedHand) {
    gamePlayState.selectedHand = [
      gamePlayState.selectedHand[0],
      gamePlayState.selectedHand[1].filter(card => card.id !== scoredCardId),
    ]
  }

  // remove scored card from dealt cards
  gamePlayState.dealtCards = gamePlayState.dealtCards.filter(card => card.id !== scoredCardId)
}
