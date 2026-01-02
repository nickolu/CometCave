import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { implementedTarotCards as tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import {
  initializeCelestialCard,
  initializeTarotCard,
} from '@/app/daily-card-game/domain/consumable/utils'
import { GameState } from '@/app/daily-card-game/domain/game/types'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { initializePlayingCard } from '@/app/daily-card-game/domain/playing-card/utils'
import {
  buildSeedString,
  getRandomWeightedChoiceWithSeed,
  uuid,
} from '@/app/daily-card-game/domain/randomness'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import type { PackDefinition, PackState } from '@/app/daily-card-game/domain/shop/types'
import {
  getRandomCelestialCards,
  getRandomJokers,
  getRandomPlayingCards,
  getRandomSpectralCards,
  getRandomTarotCards,
} from '@/app/daily-card-game/domain/shop/utils'
import { initializeSpectralCard } from '@/app/daily-card-game/domain/spectral/utils'

import {
  numberOfCardsPerRarity,
  numberOfCardsToSelectPerRarity,
  packRarityWeightsByType,
  packTypeWeights,
  pricePerRarity,
} from './booster-packs'
import { ImplementedPackType } from './types'

export const getPackDefinition = (
  cardType: PackDefinition['cardType'],
  rarity: PackState['rarity']
): PackDefinition => {
  return {
    cardType,
    rarity: rarity,
    price: pricePerRarity[rarity],
    numberOfCardsPerPack: numberOfCardsPerRarity[rarity],
    numberOfCardsToSelect: numberOfCardsToSelectPerRarity[rarity],
  }
}

const initializePackState = (game: GameState, packDefinition: PackDefinition): PackState => {
  const id = uuid()
  const rarity = packDefinition.rarity
  const numberOfCardsToSelect = packDefinition.numberOfCardsToSelect

  if (packDefinition.cardType === 'playingCard') {
    const randomPlayingCardsSeed = buildSeedString([
      game.gameSeed,
      game.roundIndex.toString(),
      game.shopState.rerollsUsed.toString(),
      game.shopState.packsForSale.length.toString(),
      'playingCards',
    ])
    return {
      id,
      rarity,
      remainingCardsToSelect: numberOfCardsToSelect,
      cards: getRandomPlayingCards(packDefinition.numberOfCardsPerPack, randomPlayingCardsSeed).map(
        card => ({
          type: 'playingCard',
          card: initializePlayingCard(card, game, true),
          price: playingCards[card.id].baseChips,
        })
      ),
    }
  }
  if (packDefinition.cardType === 'tarotCard') {
    const randomTarotCardsSeed = buildSeedString([
      game.gameSeed,
      game.roundIndex.toString(),
      game.shopState.rerollsUsed.toString(),
      game.shopState.packsForSale.length.toString(),
      'tarotCards',
    ])
    return {
      id,
      rarity,
      remainingCardsToSelect: numberOfCardsToSelect,
      cards: getRandomTarotCards(packDefinition.numberOfCardsPerPack, randomTarotCardsSeed).map(
        card => ({
          type: 'tarotCard',
          card: initializeTarotCard(card),
          price: tarotCards[card.tarotType].price,
        })
      ),
    }
  }
  if (packDefinition.cardType === 'jokerCard') {
    const randomJokersSeed = buildSeedString([
      game.gameSeed,
      game.roundIndex.toString(),
      game.shopState.rerollsUsed.toString(),
      game.shopState.packsForSale.length.toString(),
      'jokers',
    ])
    return {
      id,
      rarity,
      remainingCardsToSelect: numberOfCardsToSelect,
      cards: getRandomJokers(packDefinition.numberOfCardsPerPack, randomJokersSeed).map(joker => ({
        type: 'jokerCard',
        card: initializeJoker(joker, game),
        price: joker.price,
      })),
    }
  }
  if (packDefinition.cardType === 'celestialCard') {
    const randomCelestialCardsSeed = buildSeedString([
      game.gameSeed,
      game.roundIndex.toString(),
      game.shopState.rerollsUsed.toString(),
      game.shopState.packsForSale.length.toString(),
      'celestialCards',
    ])
    return {
      id,
      rarity,
      remainingCardsToSelect: numberOfCardsToSelect,
      cards: getRandomCelestialCards(
        game,
        packDefinition.numberOfCardsPerPack,
        randomCelestialCardsSeed
      ).map(card => ({
        type: 'celestialCard',
        card: initializeCelestialCard(card),
        price: celestialCards[card.handId].price,
      })),
    }
  }
  if (packDefinition.cardType === 'spectralCard') {
    const randomSpectralCardsSeed = buildSeedString([
      game.gameSeed,
      game.roundIndex.toString(),
      game.shopState.rerollsUsed.toString(),
      game.shopState.packsForSale.length.toString(),
      'spectralCards',
    ])
    return {
      id,
      rarity,
      remainingCardsToSelect: numberOfCardsToSelect,
      cards: getRandomSpectralCards(
        packDefinition.numberOfCardsPerPack,
        randomSpectralCardsSeed
      ).map(card => ({
        type: 'spectralCard',
        card: initializeSpectralCard(card),
        price: 0, // Spectral cards have no price - only obtained from packs
      })),
    }
  }
  throw new Error(`Invalid pack type: ${packDefinition.cardType}`)
}

const getRandomPackType = (game: GameState, packIndex: number): ImplementedPackType => {
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
    packIndex.toString(),
    'packType',
  ])

  return (
    getRandomWeightedChoiceWithSeed({
      seed,
      weightedOptions: packTypeWeights,
    }) ?? 'playingCard'
  )
}

const getRandomPack = (game: GameState, packIndex: number): PackState => {
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
    getInProgressBlind(game)?.type.toString() ?? '0',
    packIndex.toString(),
    'packRarity',
  ])
  const randomPackType = getRandomPackType(game, packIndex)

  // Use the correct rarity weights based on pack type
  const rarityWeights = packRarityWeightsByType[randomPackType]
  const randomRarity =
    getRandomWeightedChoiceWithSeed({
      seed,
      weightedOptions: rarityWeights,
    }) ?? 'normal'

  return initializePackState(game, getPackDefinition(randomPackType, randomRarity))
}

export const getRandomPacks = (game: GameState, numberOfPacks = 2): PackState[] => {
  return Array.from({ length: numberOfPacks }, (_, index) => getRandomPack(game, index))
}

export const removeCardFromPack = (pack: PackState, cardId: string): void => {
  pack.cards = pack.cards.filter(card => card.card.id !== cardId)
  pack.remainingCardsToSelect -= 1
}
