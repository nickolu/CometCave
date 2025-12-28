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
  getRandomChoiceWithSeed,
  getRandomWeightedChoiceWithSeed,
  uuid,
} from '@/app/daily-card-game/domain/randomness'

import {
  getRandomCelestialCards,
  getRandomJokers,
  getRandomPlayingCards,
  getRandomTarotCards,
} from './utils'

import type { PackDefinition, PackState } from './types'

const numberOfCardsPerRarity: Record<PackState['rarity'], number> = {
  normal: 3,
  jumbo: 5,
  mega: 7,
}

const numberOfCardsToSelectPerRarity: Record<PackState['rarity'], number> = {
  normal: 1,
  jumbo: 1,
  mega: 2,
}

const pricePerRarity: Record<PackState['rarity'], number> = {
  normal: 4,
  jumbo: 6,
  mega: 8,
}

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
    return {
      id,
      rarity,
      remainingCardsToSelect: numberOfCardsToSelect,
      cards: getRandomPlayingCards(game, packDefinition.numberOfCardsPerPack).map(card => ({
        type: 'playingCard',
        card: initializePlayingCard(card, game, true),
        price: playingCards[card.id].baseChips,
      })),
    }
  }
  if (packDefinition.cardType === 'tarotCard') {
    return {
      id,
      rarity,
      remainingCardsToSelect: numberOfCardsToSelect,
      cards: getRandomTarotCards(game, packDefinition.numberOfCardsPerPack).map(card => ({
        type: 'tarotCard',
        card: initializeTarotCard(card),
        price: tarotCards[card.tarotType].price,
      })),
    }
  }
  if (packDefinition.cardType === 'jokerCard') {
    return {
      id,
      rarity,
      remainingCardsToSelect: numberOfCardsToSelect,
      cards: getRandomJokers(game, packDefinition.numberOfCardsPerPack).map(joker => ({
        type: 'jokerCard',
        card: initializeJoker(joker, game),
        price: joker.price,
      })),
    }
  }
  if (packDefinition.cardType === 'celestialCard') {
    return {
      id,
      rarity,
      remainingCardsToSelect: numberOfCardsToSelect,
      cards: getRandomCelestialCards(game, packDefinition.numberOfCardsPerPack).map(card => ({
        type: 'celestialCard',
        card: initializeCelestialCard(card),
        price: celestialCards[card.handId].price,
      })),
    }
  }
  throw new Error(`Invalid pack type: ${packDefinition.cardType}`)
}

const getRandomPackType = (game: GameState, packIndex: number): PackDefinition['cardType'] => {
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
    packIndex.toString(),
    'packType',
  ])

  return (
    getRandomChoiceWithSeed({
      seed,
      choices: ['playingCard', 'tarotCard', 'jokerCard', 'celestialCard'],
    }) ?? 'playingCard'
  )
}

const getRandomPack = (game: GameState, packIndex: number): PackState => {
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
    packIndex.toString(),
    'packRarity',
  ])
  const randomPackType = getRandomPackType(game, packIndex)
  const randomRarity =
    getRandomWeightedChoiceWithSeed({
      seed,
      weightedOptions: {
        normal: 1,
        jumbo: 1,
        mega: 1,
      },
    }) ?? 'normal'

  return initializePackState(game, getPackDefinition(randomPackType, randomRarity))
}

export const getRandomPacks = (game: GameState, numberOfPacks = 2): PackState[] => {
  return Array.from({ length: numberOfPacks }, (_, index) => getRandomPack(game, index))
}
