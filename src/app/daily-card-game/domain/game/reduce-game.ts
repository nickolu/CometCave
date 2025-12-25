import { produce } from 'immer'

import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { EffectContext, GameEvent } from '@/app/daily-card-game/domain/events/types'
import { findHighestPriorityHand, pokerHands } from '@/app/daily-card-game/domain/hand/hands'
import type { PokerHandDefinition } from '@/app/daily-card-game/domain/hand/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { uuid } from '@/app/daily-card-game/domain/randomness'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import type { BlindState } from '@/app/daily-card-game/domain/round/types'

import { HAND_SIZE } from './constants'
import { handleHandScoringEnd } from './handlers'
import { collectEffects, getBlindDefinition, randomizeDeck } from './utils'

import type { GameState } from './types'
import { tarotCards } from '../consumable/tarot-cards'
import { celestialCards } from '../consumable/celestial-cards'

const blindIndices: Record<BlindState['type'], number> = {
  smallBlind: 0,
  bigBlind: 1,
  bossBlind: 2,
}

export function reduceGame(game: GameState, event: GameEvent): GameState {
  return produce(game, draft => {
    switch (event.type) {
      case 'GAME_START': {
        draft.gamePhase = 'blindSelection'
        const ctx: EffectContext = {
          event,
          game: draft,
          score: draft.gamePlayState.score,
          playedCards: [],
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
        }
        dispatchEffects(event, ctx, collectEffects(ctx.game))
        return
      }
      case 'SMALL_BLIND_SELECTED': {
        const round = draft.rounds[draft.roundIndex]
        round.smallBlind.status = 'inProgress'
        draft.gamePhase = 'gameplay'
        draft.gamePlayState.remainingDeck = randomizeDeck({
          deck: draft.fullDeck,
          seed: draft.gameSeed,
          iteration: draft.roundIndex + blindIndices['smallBlind'],
        })
        return
      }
      case 'BIG_BLIND_SELECTED': {
        const round = draft.rounds[draft.roundIndex]
        round.bigBlind.status = 'inProgress'
        draft.gamePhase = 'gameplay'
        draft.gamePlayState.remainingDeck = randomizeDeck({
          deck: draft.fullDeck,
          seed: draft.gameSeed,
          iteration: draft.roundIndex + blindIndices['bigBlind'],
        })
        return
      }
      case 'BOSS_BLIND_SELECTED': {
        const round = draft.rounds[draft.roundIndex]
        round.bossBlind.status = 'inProgress'
        draft.gamePhase = 'gameplay'
        draft.gamePlayState.remainingDeck = randomizeDeck({
          deck: draft.fullDeck,
          seed: draft.gameSeed,
          iteration: draft.roundIndex + blindIndices['bossBlind'],
        })
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
        const selectedCards: PlayingCardState[] = gamePlayState.dealtCards.filter(card =>
          selectedCardIds.includes(card.id)
        )
        const selectedHandId = findHighestPriorityHand(selectedCards, draft.staticRules).hand

        gamePlayState.selectedCardIds = selectedCardIds
        gamePlayState.selectedHand = [selectedHandId, selectedCards]
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

        let selectedHand: [PokerHandDefinition['id'], PlayingCardState[]] | undefined = undefined
        if (selectedCards.length > 0) {
          const selectedHandId = findHighestPriorityHand(selectedCards, draft.staticRules).hand
          selectedHand = [selectedHandId, selectedCards]
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
        gamePlayState.cardsToScore = []
        gamePlayState.playedCardIds = []
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
        const { hand: playedHand, handCards: cardsToScore } = findHighestPriorityHand(
          selectedCards,
          draft.staticRules
        )
        gamePlayState.cardsToScore = cardsToScore
        gamePlayState.playedCardIds = selectedCards.map(card => card.id)

        gamePlayState.remainingHands -= 1

        const playedHandLevel = draft.pokerHands[playedHand].level
        const handMult =
          pokerHands[playedHand].baseMult +
          pokerHands[playedHand].multIncreasePerLevel * playedHandLevel
        const handChips =
          pokerHands[playedHand].baseChips +
          pokerHands[playedHand].chipIncreasePerLevel * playedHandLevel

        if (handChips > 0) {
          draft.gamePlayState.scoringEvents.push({
            id: uuid(),
            type: 'chips',
            value: handChips,
            source: 'hand',
          })
        }

        if (handMult > 0) {
          draft.gamePlayState.scoringEvents.push({
            id: uuid(),
            type: 'mult',
            value: handMult,
            source: 'hand',
          })
        }

        gamePlayState.isScoring = true
        gamePlayState.score = { chips: handChips, mult: handMult }
        gamePlayState.selectedHand = [pokerHands[playedHand].id, selectedCards]
        draft.handsPlayed += 1

        const ctx: EffectContext = {
          event,
          game: draft,
          score: gamePlayState.score,
          playedCards: selectedCards,
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
        }
        dispatchEffects(event, ctx, collectEffects(ctx.game))
        return
      }
      case 'CARD_SCORED': {
        const gamePlayState = draft.gamePlayState
        const currentCardToScore = gamePlayState.cardsToScore.shift()
        if (!currentCardToScore) return
        const scoredCardId = currentCardToScore.id

        const additionalRewards: [string, number][] = []

        let cardChips = playingCards[currentCardToScore.playingCardId].baseChips
        let cardMult = 0

        if (currentCardToScore.flags.enchantment === 'bonus') cardChips += 10
        if (currentCardToScore.flags.enchantment === 'mult') cardMult += 5
        if (currentCardToScore.flags.isFoil) cardMult += 5
        if (currentCardToScore.flags.isHolographic) cardMult += 50

        if (cardChips > 0) {
          draft.gamePlayState.scoringEvents.push({
            id: uuid(),
            type: 'chips',
            value: cardChips,
            source: playingCards[currentCardToScore.playingCardId].value,
          })
        }

        if (cardMult > 0) {
          draft.gamePlayState.scoringEvents.push({
            id: uuid(),
            type: 'mult',
            value: cardMult,
            source: playingCards[currentCardToScore.playingCardId].value,
          })
        }

        gamePlayState.score = {
          chips: gamePlayState.score.chips + cardChips,
          mult: gamePlayState.score.mult + cardMult,
        }

        if (currentCardToScore.flags.chip === 'gold') {
          additionalRewards.push(['Gold Chip', 3])
        }

        const currentBlind = getInProgressBlind(draft as unknown as GameState)
        if (!currentBlind) return

        // attach additional rewards to the in-progress blind
        currentBlind.additionalRewards.push(...additionalRewards)

        // remove card from selection & hand UI
        gamePlayState.selectedCardIds = gamePlayState.selectedCardIds.filter(
          id => id !== scoredCardId
        )
        if (gamePlayState.selectedHand) {
          gamePlayState.selectedHand = [
            gamePlayState.selectedHand[0],
            gamePlayState.selectedHand[1].filter(card => card.id !== scoredCardId),
          ]
        }

        // remove scored card from dealt cards
        gamePlayState.dealtCards = gamePlayState.dealtCards.filter(card => card.id !== scoredCardId)

        const playedCards = draft.gamePlayState.selectedHand?.[1]
        const ctx: EffectContext = {
          event,
          game: draft as unknown as GameState,
          score: gamePlayState.score,
          playedCards,
          scoredCards: [currentCardToScore],
          round: draft.rounds[draft.roundIndex],
          bossBlind: draft.rounds[draft.roundIndex].bossBlind,
          jokers: draft.jokers,
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
          getBlindDefinition(currentBlind.type, draft.rounds[draft.roundIndex]).baseReward +
          currentBlind.additionalRewards.reduce((acc, reward) => acc + reward[1], 0)
        draft.money += totalReward
        currentBlind.status = 'completed'
        draft.gamePhase = 'shop'
        draft.gamePlayState.remainingDeck = draft.fullDeck
        draft.gamePlayState.remainingHands = draft.maxHands
        if (currentBlind.type === 'bossBlind') {
          draft.roundIndex += 1
        }
        draft.gamePlayState.scoringEvents = []
        draft.gamePlayState.remainingDiscards = draft.maxDiscards
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
      case 'DISPLAY_JOKERS': {
        draft.gamePhase = 'jokers'
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
      case 'JOKER_ADDED': {
        return
      }
      case 'JOKER_REMOVED': {
        return
      }
      case 'CONSUMABLE_SELECTED': {
        console.log('CONSUMABLE_SELECTED', event)
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedConsumable?.id === id) return
        gamePlayState.selectedConsumable = draft.consumables.find(
          consumable => consumable.id === id
        )
        return
      }
      case 'CONSUMABLE_DESELECTED': {
        console.log('CONSUMABLE_DESELECTED', event)
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedConsumable?.id !== id) return
        gamePlayState.selectedConsumable = undefined
        return
      }
      case 'CELESTIAL_CARD_USED': {
        const celestialCard = draft.gamePlayState.selectedConsumable
        if (!celestialCard) return
        if (celestialCard.consumableType !== 'celestialCard') return
        draft.consumablesUsed.push(celestialCard)
        draft.gamePlayState.selectedConsumable = undefined
        // remove tarot card from consumables
        draft.consumables = draft.consumables.filter(
          consumable => consumable.id !== celestialCard.id
        )
        // remove tarot card from pack
        if (draft.shopState.openPackState) {
          draft.shopState.openPackState.cards = draft.shopState.openPackState.cards.filter(
            card => card.card.id !== celestialCard.id
          )
        }
        dispatchEffects(
          event,
          {
            event,
            game: draft as unknown as GameState,
            score: draft.gamePlayState.score,
            playedCards: [],
            round: draft.rounds[draft.roundIndex],
            bossBlind: draft.rounds[draft.roundIndex].bossBlind,
            jokers: draft.jokers,
          },
          celestialCards[celestialCard.handId].effects
        )
        return
      }
      case 'TAROT_CARD_USED': {
        const tarotCard = draft.gamePlayState.selectedConsumable
        if (!tarotCard) return
        if (tarotCard.consumableType !== 'tarotCard') return
        if (tarotCard.tarotType === 'notImplemented') return
        draft.consumablesUsed.push(tarotCard)
        draft.gamePlayState.selectedConsumable = undefined
        // remove tarot card from consumables
        draft.consumables = draft.consumables.filter(consumable => consumable.id !== tarotCard.id)
        // remove tarot card from pack
        if (draft.shopState.openPackState) {
          draft.shopState.openPackState.cards = draft.shopState.openPackState.cards.filter(
            card => card.card.id !== tarotCard.id
          )
        }

        dispatchEffects(
          event,
          {
            event,
            game: draft as unknown as GameState,
            score: draft.gamePlayState.score,
            playedCards: [],
            round: draft.rounds[draft.roundIndex],
            bossBlind: draft.rounds[draft.roundIndex].bossBlind,
            jokers: draft.jokers,
          },
          tarotCards[tarotCard.tarotType].effects
        )
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
