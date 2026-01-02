import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { initializeCelestialCard } from '@/app/daily-card-game/domain/consumable/utils'
import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { EffectContext, GameEvent } from '@/app/daily-card-game/domain/events/types'
import { uuid } from '@/app/daily-card-game/domain/randomness'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import type { RoundState } from '@/app/daily-card-game/domain/round/types'

import { dealCardsFromDrawPile, getHand } from './card-registry-utils'
import { HAND_SIZE } from './constants'
import { calculateInterest, collectEffects, getBlindDefinition } from './utils'

import type { GamePlayState, GameState } from './types'
import type { Draft } from 'immer'

type HandEndOutcome = 'gameOver' | 'blindRewards' | 'continue'

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
    tags: draft.tags,
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
    draft.gamePlayState.handIds = draft.gamePlayState.handIds.filter(id => !playedIds.has(id))
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
    const cardsInHand = getHand(draft as unknown as GameState)
    const cardsInHandWithBlueSeal = cardsInHand.filter(card => card.flags.seal === 'blue')
    if (playedHand) {
      for (let i = 0; i < cardsInHandWithBlueSeal.length; i++) {
        if (draft.consumables.length < draft.maxConsumables) {
          draft.consumables.push(initializeCelestialCard(celestialCards[playedHand]))
        }
      }
    }

    // Gold enchantment: earn $3 for each card with gold enchantment held in hand (not played)
    const cardsInHandWithGoldEnchantment = cardsInHand.filter(
      card => card.flags.enchantment === 'gold'
    )
    draft.money += cardsInHandWithGoldEnchantment.length * 3

    draft.gamePlayState.handIds = []

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
  const cardsNeeded = HAND_SIZE - draft.gamePlayState.handIds.length
  dealCardsFromDrawPile(draft as unknown as GameState, cardsNeeded)
  draft.gamePhase = 'gameplay'
  resetScoreForNextHand(draft.gamePlayState)
}
