import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'

function makeCard(id: string, playingCardId: string): PlayingCardState {
  return {
    id,
    playingCardId,
    bonusChips: 0,
    isFaceUp: true,
    flags: { edition: 'normal', enchantment: 'none', seal: 'none' },
  }
}

const aceCard = makeCard('card-ace', 'A_hearts')
const twoCard = makeCard('card-two', '2_hearts')
const threeCard = makeCard('card-three', '3_spades')

function makeBaseGame(): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.jokers = [initializeJoker(jokers.superposition, game)]
  game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
  game.gamePhase = 'gameplay'
  game.gameSeed = 'test-seed'
  game.handsPlayed = 0
  game.cards['card-ace'] = aceCard
  game.cards['card-two'] = twoCard
  game.cards['card-three'] = threeCard
  return game
}

describe('Superposition joker', () => {
  it('creates a Tarot card when hand is a Straight with an Ace', () => {
    const game = makeBaseGame()
    const handCards = [aceCard, twoCard]
    const after = reduceGame(
      {
        ...game,
        gamePlayState: {
          ...game.gamePlayState,
          selectedHand: ['straight', handCards],
          score: { chips: 10, mult: 5 },
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
    expect(after.consumables.length).toBe(1)
    expect(after.consumables[0].consumableType).toBe('tarotCard')
  })

  it('creates a Tarot card when hand is a Straight Flush with an Ace', () => {
    const game = makeBaseGame()
    const handCards = [aceCard, twoCard]
    const after = reduceGame(
      {
        ...game,
        gamePlayState: {
          ...game.gamePlayState,
          selectedHand: ['straightFlush', handCards],
          score: { chips: 10, mult: 5 },
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
    expect(after.consumables.length).toBe(1)
    expect(after.consumables[0].consumableType).toBe('tarotCard')
  })

  it('does NOT create a Tarot card when hand is a Straight without an Ace', () => {
    const game = makeBaseGame()
    const handCards = [twoCard, threeCard]
    const before = game.consumables.length
    const after = reduceGame(
      {
        ...game,
        gamePlayState: {
          ...game.gamePlayState,
          selectedHand: ['straight', handCards],
          score: { chips: 10, mult: 5 },
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
    expect(after.consumables.length).toBe(before)
  })

  it('does NOT create a Tarot card when hand is not a Straight', () => {
    const game = makeBaseGame()
    const handCards = [aceCard, twoCard]
    const before = game.consumables.length
    const after = reduceGame(
      {
        ...game,
        gamePlayState: {
          ...game.gamePlayState,
          selectedHand: ['pair', handCards],
          score: { chips: 10, mult: 5 },
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
    expect(after.consumables.length).toBe(before)
  })

  it('does NOT create a Tarot card when consumables are full', () => {
    const game = makeBaseGame()
    game.consumables = Array.from({ length: game.maxConsumables }, (_, i) => ({
      id: `tarot-${i}`,
      consumableType: 'tarotCard' as const,
      name: 'The Fool',
      isFaceUp: true,
      tarotType: 'theFool' as const,
    }))
    const handCards = [aceCard, twoCard]
    const before = game.consumables.length
    const after = reduceGame(
      {
        ...game,
        gamePlayState: {
          ...game.gamePlayState,
          selectedHand: ['straight', handCards],
          score: { chips: 10, mult: 5 },
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
    expect(after.consumables.length).toBe(before)
  })
})
