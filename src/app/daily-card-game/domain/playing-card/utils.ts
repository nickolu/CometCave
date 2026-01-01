import { GameState } from '@/app/daily-card-game/domain/game/types'
import {
  buildSeedString,
  getRandomFloatWithSeed,
  getRandomNumbersWithSeed,
  getRandomWeightedChoiceWithSeed,
  uuid,
} from '@/app/daily-card-game/domain/randomness'

import { playingCards } from './playing-cards'
import { CardValue, PlayingCardDefinition, PlayingCardState } from './types'

export function isPlayingCardState(card: unknown): card is PlayingCardState {
  return typeof card === 'object' && card !== null && 'playingCardId' in card
}

export function isPlayingCardDefinition(card: unknown): card is PlayingCardDefinition {
  return typeof card === 'object' && card !== null && 'id' in card
}

function getRandomEdition(
  game: GameState,
  playingCardId: string
): 'holographic' | 'foil' | 'polychrome' | 'normal' {
  const baseSeed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
    playingCardId,
    'edition',
  ])

  const gateSeed = buildSeedString([baseSeed, 'gate'])
  const doesCardHaveEdition =
    getRandomFloatWithSeed(gateSeed) <
    Math.min(1, Math.max(0, game.shopState.playingCard.editionBaseChance))

  if (!doesCardHaveEdition) {
    return 'normal'
  }

  const pickSeed = buildSeedString([baseSeed, 'pick'])
  return (
    getRandomWeightedChoiceWithSeed({
      seed: pickSeed,
      weightedOptions: game.shopState.playingCard.editionWeights,
    }) ?? 'normal'
  )
}

export function getRandomEnchantment(
  game: GameState,
  playingCardId: string,
  ensureEnchantment: boolean = false
): 'bonus' | 'mult' | 'gold' | 'glass' | 'lucky' | 'none' {
  const baseSeed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
    playingCardId,
    'enchantment',
  ])

  const gateSeed = buildSeedString([baseSeed, 'gate'])
  const doesCardHaveEnchantment =
    getRandomFloatWithSeed(gateSeed) <
    Math.min(1, Math.max(0, game.shopState.playingCard.enchantmentBaseChance))

  if (!doesCardHaveEnchantment && !ensureEnchantment) {
    return 'none'
  }

  const pickSeed = buildSeedString([baseSeed, 'pick'])
  return (
    getRandomWeightedChoiceWithSeed({
      seed: pickSeed,
      weightedOptions: {
        bonus: 1,
        mult: 1,
        gold: 1,
        glass: 1,
        lucky: 1,
      },
    }) ?? 'none'
  )
}

function getRandomChip(
  game: GameState,
  playingCardId: string
): 'blue' | 'purple' | 'gold' | 'red' | 'none' {
  const baseSeed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
    playingCardId,
    'chip',
  ])

  const gateSeed = buildSeedString([baseSeed, 'gate'])
  const doesCardHaveChip =
    getRandomFloatWithSeed(gateSeed) <
    Math.min(1, Math.max(0, game.shopState.playingCard.chipBaseChance))

  if (!doesCardHaveChip) {
    return 'none'
  }

  const pickSeed = buildSeedString([baseSeed, 'pick'])
  return (
    getRandomWeightedChoiceWithSeed({
      seed: pickSeed,
      weightedOptions: {
        blue: 1,
        purple: 1,
        gold: 1,
        red: 1,
      },
    }) ?? 'none'
  )
}

export function getRandomPlayingCardsWithFilters({
  game,
  numberOfCards,
  values,
  suits,
}: {
  game: GameState
  numberOfCards: number
  values?: CardValue[]
  suits?: ('hearts' | 'diamonds' | 'clubs' | 'spades')[]
}): PlayingCardDefinition[] {
  let allPlayingCards = Object.values(playingCards)
  if (values) {
    allPlayingCards = allPlayingCards.filter(card => values.includes(card.value))
  }
  if (suits) {
    allPlayingCards = allPlayingCards.filter(card => suits.includes(card.suit))
  }
  const seed = buildSeedString([game.gameSeed, game.roundIndex.toString()])
  const randomCardIndices = getRandomNumbersWithSeed({
    seed,
    min: 0,
    max: allPlayingCards.length - 1,
    numberOfNumbers: numberOfCards,
  })
  return randomCardIndices.map(index => allPlayingCards[index])
}

export function initializePlayingCard(
  card: PlayingCardDefinition,
  game?: GameState,
  allowSpecial: boolean = false
): PlayingCardState {
  const edition = allowSpecial && game ? getRandomEdition(game, card.id) : 'normal'
  const enchantment = allowSpecial && game ? getRandomEnchantment(game, card.id) : 'none'
  const seal = allowSpecial && game ? getRandomChip(game, card.id) : 'none'
  return {
    id: uuid(),
    playingCardId: card.id,
    bonusChips: 0,
    flags: {
      edition,
      enchantment,
      seal,
    },
    isFaceUp: true,
  }
}
