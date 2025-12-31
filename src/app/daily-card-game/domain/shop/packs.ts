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
import { initializeSpectralCard } from '@/app/daily-card-game/domain/spectral/utils'

import {
  getRandomCelestialCards,
  getRandomJokers,
  getRandomPlayingCards,
  getRandomSpectralCards,
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

// Weights for pack rarity selection based on pack type
// Standard (playingCard), Arcana (tarotCard), and Celestial packs share the same weights
// Buffoon (jokerCard) and Spectral packs are rarer
type PackRarityWeights = Record<PackState['rarity'], number>
type ImplementedPackType = PackDefinition['cardType']
// Pack weights matching expected probabilities:
// Standard/Arcana/Celestial: Normal 4 (53.52%), Jumbo 2 (26.76%), Mega 0.5 (6.69%)
// Buffoon: Normal 1.2 (5.35%), Jumbo 0.6 (2.67%), Mega 0.15 (0.66%)
// Spectral: Normal 0.6 (2.67%), Jumbo 0.3 (1.34%), Mega 0.075 (0.31%)
const packRarityWeightsByType: Record<ImplementedPackType, PackRarityWeights> = {
  playingCard: { normal: 4, jumbo: 2, mega: 0.5 }, // Standard
  tarotCard: { normal: 4, jumbo: 2, mega: 0.5 }, // Arcana
  celestialCard: { normal: 4, jumbo: 2, mega: 0.5 }, // Celestial
  jokerCard: { normal: 1.2, jumbo: 0.6, mega: 0.15 }, // Buffoon
  spectralCard: { normal: 0.6, jumbo: 0.3, mega: 0.075 }, // Spectral
}

// Pack type weights (sum of all rarity weights for each type)
// This makes Standard/Arcana/Celestial more common than Buffoon and Spectral
const packTypeWeights: Record<ImplementedPackType, number> = {
  playingCard: 6.5, // 4 + 2 + 0.5
  tarotCard: 6.5, // 4 + 2 + 0.5
  celestialCard: 6.5, // 4 + 2 + 0.5
  jokerCard: 1.95, // 1.2 + 0.6 + 0.15
  spectralCard: 0.975, // 0.6 + 0.3 + 0.075
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
  if (packDefinition.cardType === 'spectralCard') {
    return {
      id,
      rarity,
      remainingCardsToSelect: numberOfCardsToSelect,
      cards: getRandomSpectralCards(game, packDefinition.numberOfCardsPerPack).map(card => ({
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
