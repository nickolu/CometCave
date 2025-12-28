import type { EffectContext } from '@/app/daily-card-game/domain/events/types'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import type { PokerHandDefinition } from '@/app/daily-card-game/domain/hand/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import {
  buildSeedString,
  getRandomWeightedChoiceWithSeed,
  uuid,
} from '@/app/daily-card-game/domain/randomness'

import { JokerDefinition, JokerState } from './types'

export const bonusOnCardScored = ({
  ctx,
  suit,
  type,
  value,
  source,
}: {
  ctx: EffectContext
  suit: 'hearts' | 'diamonds' | 'spades' | 'clubs'
  type: 'mult' | 'chips'
  value: number
  source: string
}) => {
  const scoredCard = ctx.scoredCards?.[0]
  if (scoredCard && playingCards[scoredCard.playingCardId].suit === suit) {
    ctx.game.gamePlayState.scoringEvents.push({
      id: uuid(),
      type,
      value,
      source,
    })
    ctx.game.gamePlayState.score[type] += value
  }
}

export const bonusOnHandPlayed = ({
  ctx,
  hand,
  type,
  value,
  source,
}: {
  ctx: EffectContext
  hand: PokerHandDefinition
  type: 'mult' | 'chips'
  value: number
  source: string
}) => {
  const scoredHandId = ctx.game.gamePlayState.selectedHand?.[0]

  if (scoredHandId === hand.id) {
    ctx.game.gamePlayState.scoringEvents.push({
      id: uuid(),
      type,
      value,
      source,
    })
    ctx.game.gamePlayState.score[type] += value
  }
}

export const isJokerState = (card: unknown): card is JokerState => {
  return typeof card === 'object' && card !== null && 'jokerId' in card
}

export const isJokerDefinition = (card: unknown): card is JokerDefinition => {
  return typeof card === 'object' && card !== null && 'id' in card
}

function getRandomJokerEdition(game: GameState): JokerState['edition'] {
  const baseSeed = buildSeedString([
    game.gameSeed,
    game.roundIndex.toString(),
    game.shopState.rerollsUsed.toString(),
    'edition',
  ])

  const pickSeed = buildSeedString([baseSeed, 'pick'])
  return (
    getRandomWeightedChoiceWithSeed({
      seed: pickSeed,
      weightedOptions: game.shopState.joker.editionWeights,
    }) ?? 'normal'
  )
}

const getRandomFlag = (
  possibleFlags: ('isRentable' | 'isPerishable' | 'isEternal')[],
  game: GameState
): ('isRentable' | 'isPerishable' | 'isEternal') | undefined => {
  if (possibleFlags.length === 0) {
    return undefined
  }
  return getRandomWeightedChoiceWithSeed({
    seed: buildSeedString([
      game.gameSeed,
      game.roundIndex.toString(),
      game.shopState.rerollsUsed.toString(),
      'flag',
    ]),
    weightedOptions: possibleFlags.reduce(
      (acc, flag) => {
        acc[flag] = 1
        return acc
      },
      {} as Record<'isRentable' | 'isPerishable' | 'isEternal', number>
    ),
  })
}

export const initializeJoker = (joker: JokerDefinition, game: GameState): JokerState => {
  const edition = getRandomJokerEdition(game)
  const allowedFlags = game.allowedJokerFlags
  const flag = getRandomFlag(allowedFlags, game)
  return {
    id: uuid(),
    jokerId: joker.id,
    edition,
    isFaceUp: true,
    flags: {
      isRentable: flag === 'isRentable',
      isPerishable: flag === 'isPerishable',
      isEternal: flag === 'isEternal',
    },
  }
}
