import { celestialCards } from '@/app/comet-cards/domain/consumable/celestial-cards'
import { implementedTarotCards as tarotCards } from '@/app/comet-cards/domain/consumable/tarot-cards'
import {
  initializeCelestialCard,
  initializeTarotCard,
} from '@/app/comet-cards/domain/consumable/utils'
import { GameState } from '@/app/comet-cards/domain/game/types'
import { initializeJoker, isJokerState } from '@/app/comet-cards/domain/joker/utils'
import { JokerState } from '@/app/comet-cards/domain/joker/types'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'
import { initializePlayingCard } from '@/app/comet-cards/domain/playing-card/utils'
import {
  buildSeedString,
  getRandomWeightedChoiceWithSeed,
  uuid,
} from '@/app/comet-cards/domain/randomness'
import { getInProgressBlind, getNextBlind } from '@/app/comet-cards/domain/round/blinds'
import type { PackDefinition, PackState } from '@/app/comet-cards/domain/shop/types'
import {
  getRandomCelestialCards,
  getRandomJokers,
  getRandomPlayingCards,
  getRandomSpectralCards,
  getRandomTarotCards,
} from '@/app/comet-cards/domain/shop/utils'
import { initializeSpectralCard } from '@/app/comet-cards/domain/spectral/utils'

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

export const initializePackState = (game: GameState, packDefinition: PackDefinition): PackState => {
  const id = uuid()
  const rarity = packDefinition.rarity
  const numberOfCardsToSelect = packDefinition.numberOfCardsToSelect
  const nextBlind = getNextBlind(game)

  const seedStringBuilder = (seedString: string) => {
    return buildSeedString([
      game.gameSeed,
      game.roundIndex.toString(),
      game.shopState.packsForSale.length.toString(),
      nextBlind?.type.toString() ?? '0',
      seedString,
    ])
  }

  if (packDefinition.cardType === 'playingCard') {
    const randomPlayingCardsSeed = seedStringBuilder('playingCards')
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
    const randomTarotCardsSeed = seedStringBuilder('tarotCards')
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
    const randomJokersSeed = seedStringBuilder('jokers')
    const ownedJokerIds = game.jokers.map(j => j.jokerId)
    const shopJokerIds = game.shopState.cardsForSale
      .filter(c => c.type === 'jokerCard' && isJokerState(c.card))
      .map(c => (c.card as JokerState).jokerId)
    const excludeIds = [...ownedJokerIds, ...shopJokerIds]
    return {
      id,
      rarity,
      remainingCardsToSelect: numberOfCardsToSelect,
      cards: getRandomJokers(packDefinition.numberOfCardsPerPack, randomJokersSeed, excludeIds).map(joker => ({
        type: 'jokerCard',
        card: initializeJoker(joker, game),
        price: joker.price,
      })),
    }
  }
  if (packDefinition.cardType === 'celestialCard') {
    const randomCelestialCardsSeed = seedStringBuilder('celestialCards')
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
    const randomSpectralCardsSeed = seedStringBuilder('spectralCards')
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
  const packs = Array.from({ length: numberOfPacks }, (_, index) => getRandomPack(game, index))

  // First shop of the run: guarantee a basic (normal-rarity) joker pack
  if (game.roundIndex === 1 && !packs.some(p => p.cards[0]?.type === 'jokerCard' && p.rarity === 'normal')) {
    packs[0] = initializePackState(game, getPackDefinition('jokerCard', 'normal'))
  }

  return packs
}

export const removeCardFromPack = (pack: PackState, cardId: string): void => {
  pack.cards = pack.cards.filter(card => card.card.id !== cardId)
  pack.remainingCardsToSelect -= 1
}
