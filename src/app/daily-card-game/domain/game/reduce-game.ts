import { produce } from 'immer'

import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { Effect, EffectContext, GameEvent } from '@/app/daily-card-game/domain/events/types'
import { findHighestPriorityHand, hands } from '@/app/daily-card-game/domain/hand/hands'
import type { PokerHand } from '@/app/daily-card-game/domain/hand/types'
import type { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'

import type { GameState } from './types'

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

        const playedHandLevel = draft.pokerHands[playedHand].level
        const handMult = hands[playedHand].baseMult * playedHandLevel
        const handChips = hands[playedHand].baseChips * playedHandLevel

        gamePlayState.isScoring = true
        gamePlayState.score = { chips: handChips, mult: handMult }
        gamePlayState.selectedHand = [hands[playedHand], selectedCards]

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

        if (currentCardToScore.stamp === 'gold') {
          additionalRewards.push(['goldStamp', 3])
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
        const gamePlayState = draft.gamePlayState
        const currentBlind = getInProgressBlind(draft as unknown as GameState)
        if (!currentBlind) return

        const currentRoundIndex = draft.roundIndex
        const currentRound = draft.rounds[currentRoundIndex]

        const blindScore = currentBlind.score + gamePlayState.score.chips * gamePlayState.score.mult
        const newTotalScore = draft.totalScore + blindScore

        // Update the blind score
        currentRound[currentBlind.type].score = blindScore

        // Allow effects (boss blinds / jokers) to react BEFORE we do cleanup/phase transitions
        const ctx: EffectContext = {
          event,
          game: draft as unknown as GameState,
          score: gamePlayState.score,
          playedCards: gamePlayState.selectedHand?.[1],
          round: currentRound,
          bossBlind: currentRound.bossBlind,
          jokers: gamePlayState.jokers,
        }
        dispatchEffects(event, ctx, collectEffects(ctx.game))

        const currentAnte = currentBlind.anteMultiplier * currentRound.baseAnte

        // Player is out of hands and didn't beat the ante => game over
        if (blindScore < currentAnte && gamePlayState.remainingHands === 0) {
          gamePlayState.isScoring = false
          draft.gamePhase = 'gameOver'
          draft.totalScore = newTotalScore
          return
        }

        // Player beat the ante => go to rewards and reset for next blind
        if (blindScore >= currentAnte) {
          draft.totalScore = newTotalScore
          draft.gamePhase = 'blindRewards'
          gamePlayState.isScoring = false
          gamePlayState.remainingHands = gamePlayState.remainingHands - 1
          gamePlayState.dealtCards = []
          gamePlayState.remainingDeck = draft.fullDeck
          gamePlayState.score = { chips: 0, mult: 0 }
          return
        }

        // Didn't beat ante but still has hands left => refill and continue
        const cardsToRefill = gamePlayState.remainingDeck.slice(
          0,
          HAND_SIZE - gamePlayState.dealtCards.length
        )

        draft.totalScore = newTotalScore
        draft.gamePhase = 'gameplay'
        gamePlayState.isScoring = false
        gamePlayState.remainingHands = gamePlayState.remainingHands - 1
        gamePlayState.dealtCards = gamePlayState.dealtCards.concat(cardsToRefill)
        gamePlayState.remainingDeck = gamePlayState.remainingDeck.slice(cardsToRefill.length)
        gamePlayState.score = { chips: 0, mult: 0 }
        return
      }
      case 'BLIND_REWARDS_END': {
        const currentBlind = getInProgressBlind(draft as unknown as GameState)
        if (!currentBlind) return
        currentBlind.status = 'completed'
        draft.gamePhase = 'shop'
        return
      }

      // no-ops for now
      case 'BLIND_REWARDS_START':
      case 'ROUND_END': {
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
