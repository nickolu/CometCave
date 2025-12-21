import { produce } from 'immer'

import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { Effect, EffectContext, GameEvent } from '@/app/daily-card-game/domain/events/types'
import { findHighestPriorityHand, hands } from '@/app/daily-card-game/domain/hand/hands'
import type { PokerHand } from '@/app/daily-card-game/domain/hand/types'
import type { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import type { BossBlindDefinition, RoundDefinition } from '@/app/daily-card-game/domain/round/types'

import type { GamePlayState, GameState } from './types'
import type { Draft } from 'immer'

const HAND_SIZE = 7

function collectEffects(game: GameState): Effect[] {
  const effects: Effect[] = []

  const blind = getInProgressBlind(game)
  if (blind && blind.type === 'bossBlind') {
    effects.push(...blind.effects)
  }

  effects.push(...game.gamePlayState.jokers.flatMap(j => j.effects || []))

  return effects
}

type HandEndOutcome = 'gameOver' | 'blindRewards' | 'continue'

function computeBlindScoreAndAnte(
  draft: Draft<GameState>,
  currentBlind: ReturnType<typeof getInProgressBlind>
) {
  if (!currentBlind) return null

  const round = draft.rounds[draft.roundIndex]
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
    jokers: draft.gamePlayState.jokers,
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
  gamePlayState.score = { chips: 0, mult: 0 }
}

function handleHandScoringEnd(draft: Draft<GameState>, event: GameEvent) {
  const currentBlind = getInProgressBlind(draft)
  if (!currentBlind) return

  const computed = computeBlindScoreAndAnte(draft, currentBlind)
  if (!computed) return

  const { round, blindScore, ante, newTotalScore } = computed

  // Effects (boss blinds / jokers) react BEFORE cleanup/phase transitions
  applyHandScoringEndEffects(draft, event, round)

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

export function reduceGame(game: GameState, event: GameEvent): GameState {
  return produce(game, draft => {
    switch (event.type) {
      case 'ROUND_START': {
        draft.gamePhase = 'blindSelection'
        return
      }
      case 'SMALL_BLIND_SELECTED': {
        const round = draft.rounds[draft.roundIndex]
        round.smallBlind.status = 'inProgress'
        draft.gamePhase = 'gameplay'
        return
      }
      case 'BIG_BLIND_SELECTED': {
        const round = draft.rounds[draft.roundIndex]
        round.bigBlind.status = 'inProgress'
        draft.gamePhase = 'gameplay'
        return
      }
      case 'BOSS_BLIND_SELECTED': {
        const round = draft.rounds[draft.roundIndex]
        round.bossBlind.status = 'inProgress'
        draft.gamePhase = 'gameplay'
        return
      }
      case 'HAND_DEALT': {
        if (draft.gamePlayState.dealtCards.length) return
        draft.gamePlayState.dealtCards = draft.gamePlayState.remainingDeck.slice(0, HAND_SIZE)
        draft.gamePlayState.remainingDeck = draft.gamePlayState.remainingDeck.slice(HAND_SIZE)
        return
      }
      case 'CARD_SELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedCardIds.includes(id)) return

        const selectedCardIds = [...gamePlayState.selectedCardIds, id]
        const selectedCards = gamePlayState.dealtCards.filter(card =>
          selectedCardIds.includes(card.id)
        )
        const selectedHandId = findHighestPriorityHand(selectedCards).hand
        const selectedHand = hands[selectedHandId]

        gamePlayState.selectedCardIds = selectedCardIds
        gamePlayState.selectedHand = [selectedHand, selectedCards]
        return
      }
      case 'CARD_DESELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (!gamePlayState.selectedCardIds.includes(id)) return

        const selectedCardIds = gamePlayState.selectedCardIds.filter(cardId => cardId !== id)
        const selectedCards = gamePlayState.dealtCards.filter(card =>
          selectedCardIds.includes(card.id)
        )

        let selectedHand: [PokerHand, PlayingCard[]] | undefined = undefined
        if (selectedCards.length > 0) {
          const selectedHandId = findHighestPriorityHand(selectedCards).hand
          selectedHand = [hands[selectedHandId], selectedCards]
        }

        gamePlayState.selectedCardIds = selectedCardIds
        gamePlayState.selectedHand = selectedHand
        return
      }
      case 'DISCARD_SELECTED_CARDS': {
        const gamePlayState = draft.gamePlayState

        const cardsToKeep = gamePlayState.dealtCards.filter(
          card => !gamePlayState.selectedCardIds.includes(card.id)
        )

        draft.discardsPlayed += 1
        gamePlayState.selectedCardIds = []
        gamePlayState.selectedHand = undefined
        gamePlayState.dealtCards = cardsToKeep
        gamePlayState.remainingDiscards -= 1

        // refill immediately (this was previously orchestrated in useGameEvents)
        const cardsToRefill = gamePlayState.remainingDeck.slice(
          0,
          HAND_SIZE - gamePlayState.dealtCards.length
        )
        gamePlayState.dealtCards = gamePlayState.dealtCards.concat(cardsToRefill)
        gamePlayState.remainingDeck = gamePlayState.remainingDeck.slice(cardsToRefill.length)

        return
      }
      case 'HAND_SCORING_START': {
        const gamePlayState = draft.gamePlayState
        const selectedCards = gamePlayState.dealtCards.filter(card =>
          gamePlayState.selectedCardIds.includes(card.id)
        )
        const playedHand = findHighestPriorityHand(selectedCards).hand

        gamePlayState.remainingHands -= 1

        const playedHandLevel = draft.pokerHands[playedHand].level
        const handMult = hands[playedHand].baseMult * playedHandLevel
        const handChips = hands[playedHand].baseChips * playedHandLevel

        gamePlayState.isScoring = true
        gamePlayState.score = { chips: handChips, mult: handMult }
        gamePlayState.selectedHand = [hands[playedHand], selectedCards]
        draft.handsPlayed += 1

        const ctx: EffectContext = {
          event,
          game: draft as unknown as GameState,
          score: gamePlayState.score,
          playedCards: selectedCards,
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: gamePlayState.jokers,
        }
        dispatchEffects(event, ctx, collectEffects(ctx.game))
        return
      }
      case 'CARD_SCORED': {
        const gamePlayState = draft.gamePlayState
        const currentCardToScore = gamePlayState.dealtCards.find(card => card.id === event.id)
        if (!currentCardToScore) return

        const additionalRewards: [string, number][] = []

        let cardChips = currentCardToScore.baseChips
        let cardMult = 1
        if (currentCardToScore.modifier === 'bonus') cardChips += 10
        if (currentCardToScore.modifier === 'mult') cardMult += 5
        if (currentCardToScore.isFoil) cardMult += 5
        if (currentCardToScore.isHolographic) cardMult += 50

        gamePlayState.score = {
          chips: gamePlayState.score.chips + cardChips,
          mult: gamePlayState.score.mult + cardMult,
        }

        if (currentCardToScore.chip === 'gold') {
          additionalRewards.push(['Gold Chip', 3])
        }

        const currentBlind = getInProgressBlind(draft as unknown as GameState)
        if (!currentBlind) return

        // attach additional rewards to the in-progress blind
        currentBlind.additionalRewards.push(...additionalRewards)

        // remove card from selection & hand UI
        gamePlayState.selectedCardIds = gamePlayState.selectedCardIds.filter(id => id !== event.id)
        if (gamePlayState.selectedHand) {
          gamePlayState.selectedHand = [
            gamePlayState.selectedHand[0],
            gamePlayState.selectedHand[1].filter(card => card.id !== event.id),
          ]
        }

        // remove scored card from dealt cards
        gamePlayState.dealtCards = gamePlayState.dealtCards.filter(card => card.id !== event.id)

        const playedCards = draft.gamePlayState.selectedHand?.[1]
        const ctx: EffectContext = {
          event,
          game: draft as unknown as GameState,
          score: gamePlayState.score,
          playedCards,
          scoredCards: [currentCardToScore],
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: gamePlayState.jokers,
        }
        dispatchEffects(event, ctx, collectEffects(ctx.game))
        return
      }
      case 'HAND_SCORING_END': {
        handleHandScoringEnd(draft, event)
        return
      }
      case 'BLIND_REWARDS_END': {
        const currentBlind = getInProgressBlind(draft)
        if (!currentBlind) return
        const totalReward =
          currentBlind.baseReward +
          currentBlind.additionalRewards.reduce((acc, reward) => acc + reward[1], 0)
        draft.money += totalReward
        currentBlind.status = 'completed'
        draft.gamePhase = 'shop'
        draft.gamePlayState.remainingDeck = draft.fullDeck
        draft.gamePlayState.remainingHands = draft.defaultNumberOfHands
        if (currentBlind.type === 'bossBlind') {
          draft.roundIndex += 1
        }
        return
      }
      case 'SHOP_SELECT_BLIND': {
        draft.gamePhase = 'blindSelection'
        return
      }
      case 'SHOP_OPEN_PACK': {
        draft.gamePhase = 'packOpening'
        return
      }
      case 'PACK_OPEN_BACK_TO_SHOP': {
        draft.gamePhase = 'shop'
        return
      }
      case 'BLIND_SELECTION_BACK_TO_MENU': {
        draft.gamePhase = 'mainMenu'
        return
      }

      // no-ops for now
      case 'BLIND_REWARDS_START': {
        return
      }
      case 'ROUND_END': {
        return
      }
      case 'BIG_BLIND_SKIPPED': {
        const round = draft.rounds[draft.roundIndex]
        round.bigBlind.status = 'skipped'
        return
      }
      case 'SMALL_BLIND_SKIPPED': {
        const round = draft.rounds[draft.roundIndex]
        round.smallBlind.status = 'skipped'
        return
      }
      default: {
        // Exhaustiveness guard in case GameEvent grows
        const _exhaustive: never = event
        return _exhaustive
      }
    }
  })
}
