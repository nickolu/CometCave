import { produce } from 'immer'

import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import {
  isCelestialCardState,
  isTarotCardState,
} from '@/app/daily-card-game/domain/consumable/utils'
import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { EffectContext, GameEvent } from '@/app/daily-card-game/domain/events/types'
import { findHighestPriorityHand, pokerHands } from '@/app/daily-card-game/domain/hand/hands'
import type { PokerHandDefinition } from '@/app/daily-card-game/domain/hand/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import type { JokerState } from '@/app/daily-card-game/domain/joker/types'
import { isJokerState } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { isPlayingCardState } from '@/app/daily-card-game/domain/playing-card/utils'
import { uuid } from '@/app/daily-card-game/domain/randomness'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import type { BlindState } from '@/app/daily-card-game/domain/round/types'
import { getRandomBuyableCards } from '@/app/daily-card-game/domain/shop/utils'

import { HAND_SIZE, MAX_SELECTED_CARDS } from './constants'
import { handleHandScoringEnd } from './handlers'
import {
  collectEffects,
  getBlindDefinition,
  randomizeDeck,
  useCelestialCard,
  useTarotCard,
} from './utils'

import type { GameState } from './types'

const blindIndices: Record<BlindState['type'], number> = {
  smallBlind: 0,
  bigBlind: 1,
  bossBlind: 2,
}

function removeJoker(draft: GameState, event: GameEvent, selectedJoker: JokerState) {
  console.log('removeJoker reducer', selectedJoker)

  draft.gamePlayState.selectedJokerId = undefined
  const ctx: EffectContext = {
    event,
    game: draft as unknown as GameState,
    score: draft.gamePlayState.score,
    playedCards: [],
    round: draft.rounds[draft.roundIndex],
    bossBlind: draft.rounds[draft.roundIndex].bossBlind,
    jokers: draft.jokers,
  }
  // Collect effects *before* removing the joker so "on sold/removed" effects that live on the
  // removed joker itself still get a chance to run. Then dispatch *after* removal so effects
  // can observe the post-removal game state.
  const effectsBeforeRemoval = collectEffects(ctx.game)
  draft.jokers = draft.jokers.filter(joker => joker.id !== selectedJoker.id)
  ctx.jokers = draft.jokers
  dispatchEffects(event, ctx, effectsBeforeRemoval)
}

export function reduceGame(game: GameState, event: GameEvent): GameState {
  return produce(game, draft => {
    switch (event.type) {
      /*
       * NAVIGATION EVENTS
       */

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
      case 'BACK_TO_MAIN_MENU': {
        draft.gamePhase = 'mainMenu'
        return
      }
      case 'DISPLAY_JOKERS': {
        draft.gamePhase = 'jokers'
        return
      }

      /*
       * BLIND SELECTION EVENTS
       */

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

      /*
       * GAMEPLAY EVENTS
       */

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
        if (gamePlayState.selectedCardIds.length >= MAX_SELECTED_CARDS) return

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

      /*
       * SHOP EVENTS
       */

      case 'SHOP_OPEN': {
        draft.shopState.cardsForSale = getRandomBuyableCards(draft, 3)
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
      case 'SHOP_BUY_CARD': {
        const selectedCard = draft.shopState.cardsForSale.find(
          card => card.card.id === draft.shopState.selectedCardId
        )

        if (!selectedCard) return
        draft.money -= selectedCard.price
        if (isJokerState(selectedCard.card)) {
          draft.jokers.push(selectedCard.card)
        } else if (isPlayingCardState(selectedCard.card)) {
          draft.gamePlayState.dealtCards.push(selectedCard.card)
        } else if (isCelestialCardState(selectedCard.card)) {
          draft.consumables.push(selectedCard.card)
        } else if (isTarotCardState(selectedCard.card)) {
          draft.consumables.push(selectedCard.card)
        } else {
          throw new Error(`Unknown card type: ${selectedCard.card}`)
        }
        draft.shopState.cardsForSale = draft.shopState.cardsForSale.filter(
          card => card.card.id !== selectedCard.card.id
        )
        return
      }
      case 'SHOP_BUY_AND_USE_CARD': {
        const selectedCard = draft.shopState.cardsForSale.find(
          card => card.card.id === draft.shopState.selectedCardId
        )
        if (!selectedCard) return
        draft.money -= selectedCard.price
        if (isTarotCardState(selectedCard.card)) {
          useTarotCard(draft, event)
        } else if (isCelestialCardState(selectedCard.card)) {
          useCelestialCard(draft, event)
        }
        draft.shopState.cardsForSale = draft.shopState.cardsForSale.filter(
          card => card.card.id !== selectedCard.card.id
        )
        return
      }
      case 'SHOP_SELECT_CARD': {
        const id = event.id
        if (draft.shopState.selectedCardId === id) return
        draft.shopState.selectedCardId = id
        return
      }
      case 'SHOP_DESELECT_CARD': {
        const id = event.id
        if (draft.shopState.selectedCardId !== id) return
        draft.shopState.selectedCardId = null
        return
      }

      /*
       * CONSUMABLE EVENTS
       */

      case 'CONSUMABLE_SELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedConsumable?.id === id) return
        gamePlayState.selectedConsumable = draft.consumables.find(
          consumable => consumable.id === id
        )
        return
      }
      case 'CONSUMABLE_DESELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedConsumable?.id !== id) return
        gamePlayState.selectedConsumable = undefined
        return
      }
      case 'CELESTIAL_CARD_USED': {
        useCelestialCard(draft, event)
        return
      }
      case 'TAROT_CARD_USED': {
        useTarotCard(draft, event)
        return
      }
      case 'CONSUMABLE_SOLD': {
        const selectedConsumable = game.gamePlayState.selectedConsumable
        const selectedConsumableDefinition = isCelestialCardState(selectedConsumable)
          ? celestialCards[selectedConsumable.handId]
          : isTarotCardState(selectedConsumable)
            ? tarotCards[selectedConsumable.tarotType]
            : undefined
        if (!selectedConsumableDefinition) return
        draft.consumables = draft.consumables.filter(
          consumable => consumable.id !== selectedConsumable?.id
        )
        draft.money += selectedConsumableDefinition.price
        draft.gamePlayState.selectedConsumable = undefined
        return
      }

      /*
       * JOKER EVENTS
       */
      case 'JOKER_SELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedJokerId === id) return
        gamePlayState.selectedJokerId = id
        return
      }
      case 'JOKER_DESELECTED': {
        const id = event.id
        const gamePlayState = draft.gamePlayState
        if (gamePlayState.selectedJokerId !== id) return
        gamePlayState.selectedJokerId = undefined
        return
      }
      case 'JOKER_SOLD': {
        console.log('JOKER_SOLD EVENT reducer')
        const selectedJoker = draft.jokers.find(
          joker => joker.id === draft.gamePlayState.selectedJokerId
        )
        if (!selectedJoker) return
        draft.money += jokers[selectedJoker.jokerId].price
        removeJoker(draft, event, selectedJoker)
        return
      }

      case 'JOKER_ADDED': {
        return
      }
      case 'JOKER_REMOVED': {
        console.log('JOKER_REMOVED EVENT reducer')
        const selectedJoker = draft.jokers.find(
          joker => joker.id === draft.gamePlayState.selectedJokerId
        )
        if (!selectedJoker) return
        removeJoker(draft, event, selectedJoker)
        return
      }

      /*
       * NO-OP EVENTS
       */

      case 'BLIND_REWARDS_START': {
        return
      }
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
