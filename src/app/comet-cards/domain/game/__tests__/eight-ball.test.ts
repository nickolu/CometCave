import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

// With gameSeed='test-seed', roundIndex=1 (default game state starts at roundIndex 1):
// card id 'card-4' produces roll=1 (success)
// card id 'card-0' produces roll=2 (failure)
const GAME_SEED = 'test-seed'

function makeEightCard(id: string): PlayingCardState {
  return {
    id,
    playingCardId: '8_hearts',
    bonusChips: 0,
    isFaceUp: true,
    flags: { edition: 'normal', enchantment: 'none', seal: 'none' },
  }
}

describe('8 Ball joker', () => {
  it('does not trigger on non-8 cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.eightBall, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    const nineId = Object.keys(game.cards).find(
      id => playingCards[game.cards[id].playingCardId]?.value === '9'
    )!

    const before = game.consumables.length
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[nineId]] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.consumables.length).toBe(before)
  })

  it('creates a Tarot card when roll succeeds (roll=1)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.eightBall, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    // card-4 with gameSeed=test-seed, roundIndex=0 produces roll=1
    const card = makeEightCard('card-4')
    game.cards['card-4'] = card

    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.consumables.length).toBe(1)
    expect(after.consumables[0].consumableType).toBe('tarotCard')
  })

  it('does not create a Tarot card when roll fails (roll!=1)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.eightBall, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    // card-0 with gameSeed=test-seed, roundIndex=0 produces roll=3 (failure)
    const card = makeEightCard('card-0')
    game.cards['card-0'] = card

    const before = game.consumables.length
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.consumables.length).toBe(before)
  })

  it('does not create a Tarot card when consumables are full', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.eightBall, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    // Fill consumables to capacity
    game.consumables = Array.from({ length: game.maxConsumables }, (_, i) => ({
      id: `tarot-${i}`,
      consumableType: 'tarotCard' as const,
      name: 'The Fool',
      isFaceUp: true,
      tarotType: 'theFool' as const,
    }))

    // card-4 would succeed, but consumables are full
    const card = makeEightCard('card-4')
    game.cards['card-4'] = card

    const before = game.consumables.length
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.consumables.length).toBe(before)
  })
})
