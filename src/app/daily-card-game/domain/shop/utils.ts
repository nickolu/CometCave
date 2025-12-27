import _ from 'lodash'

import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import {
  CelestialCardDefinition,
  TarotCardDefinition,
} from '@/app/daily-card-game/domain/consumable/types'
import {
  initializeCelestialCard,
  initializeTarotCard,
  isCelestialCardDefinition,
  isCelestialCardState,
  isTarotCardDefinition,
  isTarotCardState,
} from '@/app/daily-card-game/domain/consumable/utils'
import { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { JokerDefinition } from '@/app/daily-card-game/domain/joker/types'
import {
  initializeJoker,
  isJokerDefinition,
  isJokerState,
} from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardDefinition } from '@/app/daily-card-game/domain/playing-card/types'
import {
  initializePlayingCard,
  isPlayingCardDefinition,
  isPlayingCardState,
} from '@/app/daily-card-game/domain/playing-card/utils'
import { getRandomNumbersWithSeed } from '@/app/daily-card-game/domain/randomness'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { BlindState } from '@/app/daily-card-game/domain/round/types'

import { BuyableCard } from './types'

function initializeBuyableCard(
  card: TarotCardDefinition | CelestialCardDefinition | JokerDefinition | PlayingCardDefinition
): BuyableCard | undefined {
  if (isJokerDefinition(card)) {
    return {
      type: 'jokerCard',
      card: initializeJoker(card),
      price: card.price,
    }
  }
  if (isTarotCardDefinition(card)) {
    return {
      type: 'tarotCard',
      card: initializeTarotCard(card),
      price: card.price,
    }
  }
  if (isCelestialCardDefinition(card)) {
    return {
      type: 'celestialCard',
      card: initializeCelestialCard(card),
      price: celestialCards[card.handId].price,
    }
  }
  if (isPlayingCardDefinition(card)) {
    return {
      type: 'playingCard',
      card: initializePlayingCard(card),
      price: playingCards[card.id].baseChips,
    }
  }
  return
}

export function getBuyableCardDefinition(
  buyableCard: BuyableCard
):
  | TarotCardDefinition
  | CelestialCardDefinition
  | JokerDefinition
  | PlayingCardDefinition
  | undefined {
  const card = buyableCard.card
  if (isCelestialCardState(card)) {
    return celestialCards[card.handId]
  }
  if (isTarotCardState(card)) {
    return tarotCards[card.tarotType]
  }
  if (isJokerState(card)) {
    return jokers[card.jokerId]
  }
  if (isPlayingCardState(card)) {
    return playingCards[card.playingCardId]
  }
  throw new Error('Invalid card type: ' + buyableCard.type)
}

const blindIndices: Record<BlindState['type'], number> = {
  smallBlind: 0,
  bigBlind: 1,
  bossBlind: 2,
}

export function getRandomBuyableCards(game: GameState, numberOfCards: number): BuyableCard[] {
  const allTarotCards = Object.values(tarotCards)
  const allCelestialCards = Object.values(celestialCards)
  const allJokers = Object.values(jokers)
  const allPlayingCards = Object.values(playingCards)

  let allBuyableCardDefinitions: (
    | TarotCardDefinition
    | CelestialCardDefinition
    | JokerDefinition
    | PlayingCardDefinition
  )[] = [...allJokers] // jokers never increase in availability so we can initialize them first

  _.times(game.shopState.celestialMultiplier, () => {
    allBuyableCardDefinitions.push(...allCelestialCards)
  })

  _.times(game.shopState.tarotCardMultiplier, () => {
    allBuyableCardDefinitions.push(
      ...allTarotCards.filter(card => card.tarotType !== 'notImplemented')
    )
  })

  _.times(game.shopState.playingCardMultiplier, () => {
    allBuyableCardDefinitions.push(...allPlayingCards)
  })

  const currentBlind = getInProgressBlind(game)

  const seed =
    game.gameSeed +
    game.roundIndex.toString() +
    (currentBlind?.type ? blindIndices[currentBlind.type] : 0).toString() +
    game.shopState.rerollsUsed.toString()

  if (!game.staticRules.allowDuplicateJokersInShop) {
    const ownedJokers = game.jokers.map(joker => joker.jokerId)
    allBuyableCardDefinitions = allBuyableCardDefinitions.filter(card => {
      if (isJokerDefinition(card)) {
        return !ownedJokers.includes(card.id)
      }
      return true
    })
  }

  const randomCardIndices = getRandomNumbersWithSeed({
    seed,
    min: 0,
    max: allBuyableCardDefinitions.length - 1,
    numberOfNumbers: numberOfCards,
  })

  return randomCardIndices.map(index => {
    const card = allBuyableCardDefinitions[index]
    const buyableCard = initializeBuyableCard(card)
    if (!buyableCard) throw new Error('Failed to get card for shop: ' + JSON.stringify(card))
    return buyableCard
  })
}

export function getIsSelectedCardPlayable(
  selectedCard: BuyableCard | undefined,
  game: GameState
): boolean {
  const selectedCardDefinition = selectedCard ? getBuyableCardDefinition(selectedCard) : undefined
  if (!selectedCardDefinition) return false
  if (
    isJokerDefinition(selectedCardDefinition) ||
    isPlayingCardDefinition(selectedCardDefinition)
  ) {
    return false
  }
  return selectedCardDefinition.isPlayable(game)
}

export function getIsRoomForSelectedCard(
  selectedCard: BuyableCard | undefined,
  game: GameState
): boolean {
  const selectedCardDefinition = selectedCard ? getBuyableCardDefinition(selectedCard) : undefined
  if (!selectedCardDefinition) return false
  if (isJokerDefinition(selectedCardDefinition)) {
    return game.jokers.length < game.maxJokers
  }
  if (
    isCelestialCardDefinition(selectedCardDefinition) ||
    isTarotCardDefinition(selectedCardDefinition)
  ) {
    return game.consumables.length < game.maxConsumables
  }

  return isPlayingCardDefinition(selectedCardDefinition)
}

export function canAffordToBuy(price: number = 0, game: GameState): boolean {
  return game.money - price >= game.minimumMoney
}
