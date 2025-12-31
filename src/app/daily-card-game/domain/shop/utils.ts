import _ from 'lodash'

import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { implementedTarotCards as tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
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
import {
  buildSeedString,
  getRandomNumbersWithSeed,
  mulberry32,
  xmur3,
} from '@/app/daily-card-game/domain/randomness'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { BlindState } from '@/app/daily-card-game/domain/round/types'
import { spectralCards } from '@/app/daily-card-game/domain/spectral/spectal-cards'
import { SpectralCardDefinition } from '@/app/daily-card-game/domain/spectral/types'
import { isSpectralCardState } from '@/app/daily-card-game/domain/spectral/utils'

import { BuyableCard } from './types'

function initializeBuyableCard(
  cardDefinition:
    | TarotCardDefinition
    | CelestialCardDefinition
    | JokerDefinition
    | PlayingCardDefinition,
  game: GameState
): BuyableCard | undefined {
  if (isJokerDefinition(cardDefinition)) {
    return {
      type: 'jokerCard',
      card: initializeJoker(cardDefinition, game),
      price: cardDefinition.price,
    }
  }
  if (isTarotCardDefinition(cardDefinition)) {
    return {
      type: 'tarotCard',
      card: initializeTarotCard(cardDefinition),
      price: cardDefinition.price,
    }
  }
  if (isCelestialCardDefinition(cardDefinition)) {
    return {
      type: 'celestialCard',
      card: initializeCelestialCard(cardDefinition),
      price: celestialCards[cardDefinition.handId].price,
    }
  }
  if (isPlayingCardDefinition(cardDefinition)) {
    return {
      type: 'playingCard',
      card: initializePlayingCard(cardDefinition, game, true),
      price: playingCards[cardDefinition.id].baseChips,
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

export function getRandomCelestialCards(
  game: GameState,
  numberOfCards: number
): CelestialCardDefinition[] {
  const allCelestialCards = Object.values(celestialCards).filter(
    card => !game.pokerHands[card.handId].isSecret // don't sell celestial cards for secret hands
  )
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
  ])
  const randomCardIndices = getRandomNumbersWithSeed({
    seed,
    min: 0,
    max: allCelestialCards.length - 1,
    numberOfNumbers: numberOfCards,
  })
  return randomCardIndices.map(index => allCelestialCards[index])
}

export function getRandomTarotCards(game: GameState, numberOfCards: number): TarotCardDefinition[] {
  const allTarotCards = Object.values(tarotCards)
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
  ])
  const randomCardIndices = getRandomNumbersWithSeed({
    seed,
    min: 0,
    max: allTarotCards.length - 1,
    numberOfNumbers: numberOfCards,
  })
  return randomCardIndices.map(index => allTarotCards[index])
}

export function getRandomPlayingCards(
  game: GameState,
  numberOfCards: number
): PlayingCardDefinition[] {
  const allPlayingCards = Object.values(playingCards)
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
  ])
  const randomCardIndices = getRandomNumbersWithSeed({
    seed,
    min: 0,
    max: allPlayingCards.length - 1,
    numberOfNumbers: numberOfCards,
  })
  return randomCardIndices.map(index => allPlayingCards[index])
}

export function getRandomJokers(game: GameState, numberOfCards: number): JokerDefinition[] {
  const allJokers = Object.values(jokers)
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
  ])
  const randomCardIndices = getRandomNumbersWithSeed({
    seed,
    min: 0,
    max: allJokers.length - 1,
    numberOfNumbers: numberOfCards,
  })
  return randomCardIndices.map(index => allJokers[index])
}

export function getRandomSpectralCards(
  game: GameState,
  numberOfCards: number
): SpectralCardDefinition[] {
  const allSpectralCards = Object.values(spectralCards)
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
  ])
  const randomCardIndices = getRandomNumbersWithSeed({
    seed,
    min: 0,
    max: allSpectralCards.length - 1,
    numberOfNumbers: numberOfCards,
  })
  return randomCardIndices.map(index => allSpectralCards[index])
}

export function getRandomBuyableCards(game: GameState, numberOfCards: number): BuyableCard[] {
  const allTarotCards = Object.values(tarotCards)
  const allCelestialCards = Object.values(celestialCards).filter(
    card => !game.pokerHands[card.handId].isSecret // don't sell celestial cards for secret hands
  )
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

  _.times(game.shopState.tarotCard.multiplier, () => {
    allBuyableCardDefinitions.push(
      ...allTarotCards.filter(card => card.tarotType !== 'notImplemented')
    )
  })

  _.times(game.shopState.playingCard.multiplier, () => {
    allBuyableCardDefinitions.push(...allPlayingCards)
  })

  const currentBlind = getInProgressBlind(game)

  if (!game.staticRules.allowDuplicateJokersInShop) {
    const ownedJokers = game.jokers.map(joker => joker.jokerId)
    allBuyableCardDefinitions = allBuyableCardDefinitions.filter(card => {
      if (isJokerDefinition(card)) {
        return !ownedJokers.includes(card.id)
      }
      return true
    })
  }

  // Filter out cards already in the shop to prevent duplicates
  const existingCardIds = game.shopState.cardsForSale
    .map(buyableCard => {
      const def = getBuyableCardDefinition(buyableCard)
      if (isJokerDefinition(def)) return def.id
      if (isTarotCardDefinition(def)) return def.tarotType
      if (isCelestialCardDefinition(def)) return def.handId
      if (isPlayingCardDefinition(def)) return def.id
      return null
    })
    .filter((id): id is string => id !== null)

  allBuyableCardDefinitions = allBuyableCardDefinitions.filter(card => {
    if (isJokerDefinition(card)) return !existingCardIds.includes(card.id)
    if (isTarotCardDefinition(card)) return !existingCardIds.includes(card.tarotType)
    if (isCelestialCardDefinition(card)) return !existingCardIds.includes(card.handId)
    if (isPlayingCardDefinition(card)) return !existingCardIds.includes(card.id)
    return true
  })

  const blindIndex = currentBlind?.type ? blindIndices[currentBlind.type] : 0
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    blindIndex.toString(),
    game.shopState.rerollsUsed.toString(),
  ])

  // Shuffle the available cards and take the first N (simpler than deduplication)
  const seedFn = xmur3(seed)
  const rng = mulberry32(seedFn())
  const shuffled = [...allBuyableCardDefinitions].sort(() => rng() - 0.5)
  const selectedCards = shuffled.slice(0, Math.min(numberOfCards, shuffled.length))

  return selectedCards.map(card => {
    const buyableCard = initializeBuyableCard(card, game)
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

export function getIsSpectralCardPlayable(
  selectedCard: BuyableCard | undefined,
  game: GameState
): boolean {
  if (!selectedCard) return false
  if (!isSpectralCardState(selectedCard.card)) return false
  const spectralCardDefinition = spectralCards[selectedCard.card.spectralType]
  if (!spectralCardDefinition) return false
  // If isPlayable is not defined, default to true
  return spectralCardDefinition.isPlayable?.(game) ?? true
}
