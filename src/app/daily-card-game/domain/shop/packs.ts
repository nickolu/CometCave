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
} from '@/app/daily-card-game/domain/randomness'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'

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

const getPackDefinition = (
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
  if (packDefinition.cardType === 'playingCard') {
    return {
      cards: getRandomPlayingCards(game, packDefinition.numberOfCardsPerPack).map(card => ({
        type: 'playingCard',
        card: initializePlayingCard(card, game, true),
        price: playingCards[card.id].baseChips,
      })),
      rarity: packDefinition.rarity,
    }
  }
  if (packDefinition.cardType === 'tarotCard') {
    return {
      cards: getRandomTarotCards(game, packDefinition.numberOfCardsPerPack).map(card => ({
        type: 'tarotCard',
        card: initializeTarotCard(card),
        price: tarotCards[card.tarotType].price,
      })),
      rarity: packDefinition.rarity,
    }
  }
  if (packDefinition.cardType === 'jokerCard') {
    return {
      cards: getRandomJokers(game, packDefinition.numberOfCardsPerPack).map(joker => ({
        type: 'jokerCard',
        card: initializeJoker(joker, game),
        price: joker.price,
      })),
      rarity: packDefinition.rarity,
    }
  }
  if (packDefinition.cardType === 'celestialCard') {
    return {
      cards: getRandomCelestialCards(game, packDefinition.numberOfCardsPerPack).map(card => ({
        type: 'celestialCard',
        card: initializeCelestialCard(card),
        price: celestialCards[card.handId].price,
      })),
      rarity: packDefinition.rarity,
    }
  }
  throw new Error(`Invalid pack type: ${packDefinition.cardType}`)
}

const getRandomPackType = (game: GameState): PackDefinition['cardType'] => {
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    getInProgressBlind(game)?.type ?? '',
  ])

  return (
    getRandomChoiceWithSeed({
      seed,
      choices: ['playingCard', 'tarotCard', 'jokerCard', 'celestialCard'],
    }) ?? 'playingCard'
  )
}

const getRandomPack = (game: GameState): PackState => {
  const seed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
  ])
  const randomPackType = getRandomPackType(game)
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
  return Array.from({ length: numberOfPacks }, () => getRandomPack(game))
}
