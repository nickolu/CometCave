import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { EffectContext, GameEvent } from '@/app/daily-card-game/domain/events/types'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import type { BossBlindDefinition, RoundDefinition } from '@/app/daily-card-game/domain/round/types'

import { HAND_SIZE } from './constants'
import { collectEffects } from './utils'

import type { GamePlayState, GameState } from './types'
import type { Draft } from 'immer'

type HandEndOutcome = 'gameOver' | 'blindRewards' | 'continue'

function getCurrentRound(draft: Draft<GameState>): RoundDefinition {
  return draft.rounds[draft.roundIndex]
}

function computeBlindScoreAndAnte(
  draft: Draft<GameState>,
  currentBlind: ReturnType<typeof getInProgressBlind>,
  round: RoundDefinition
) {
  if (!currentBlind) return null

  const blindScore =
    currentBlind.score + draft.gamePlayState.score.chips * draft.gamePlayState.score.mult
  const ante = currentBlind.anteMultiplier * round.baseAnte
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
    game: draft as unknown as GameState,
    score: draft.gamePlayState.score,
    playedCards: draft.gamePlayState.selectedHand?.[1],
    round: round as unknown as RoundDefinition,
    bossBlind: round.bossBlind as unknown as BossBlindDefinition,
    jokers: draft.jokers,
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
    id: crypto.randomUUID(),
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
  console.log('hand scoring end effects applied', draft.gamePlayState.score.mult)

  const computed = computeBlindScoreAndAnte(draft, currentBlind, round)
  if (!computed) return

  const { blindScore, ante, newTotalScore } = computed

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
    draft.gamePlayState.dealtCards = []

    if (draft.gamePlayState.remainingHands > 0) {
      currentBlind.additionalRewards.push(['Remaining Hands', 3])
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
