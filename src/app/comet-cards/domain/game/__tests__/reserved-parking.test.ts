import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'

// With gameSeed='test-seed', roundIndex=1 (default), handsPlayed=0:
// card-1 produces roll=1 (success), card-0 produces roll=2 (failure)
const GAME_SEED = 'test-seed'

function makeFaceCard(id: string, faceValue: 'J' | 'Q' | 'K'): PlayingCardState {
  return {
    id,
    playingCardId: `${faceValue}_hearts`,
    bonusChips: 0,
    isFaceUp: true,
    flags: { edition: 'normal', enchantment: 'none', seal: 'none' },
  }
}

function makeNonFaceCard(id: string): PlayingCardState {
  return {
    id,
    playingCardId: '9_hearts',
    bonusChips: 0,
    isFaceUp: true,
    flags: { edition: 'normal', enchantment: 'none', seal: 'none' },
  }
}

function createGame(): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.jokers = [initializeJoker(jokers.reservedParking, game)]
  game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
  game.gamePhase = 'gameplay'
  game.gameSeed = GAME_SEED
  return game
}

describe('Reserved Parking joker', () => {
  it('earns $1 for a face card held in hand when roll succeeds (roll=1)', () => {
    const game = createGame()
    // card-1 produces roll=1 with test-seed, roundIndex=1, handsPlayed=0
    const jackCard = makeFaceCard('card-1', 'J')
    game.cards['card-1'] = jackCard
    game.gamePlayState.handIds = ['card-1']
    game.gamePlayState.playedCardIds = []

    const moneyBefore = game.money
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.money).toBe(moneyBefore + 1)
  })

  it('does not earn money for a face card held in hand when roll fails (roll=2)', () => {
    const game = createGame()
    // card-0 produces roll=2 with test-seed, roundIndex=1, handsPlayed=0
    const kingCard = makeFaceCard('card-0', 'K')
    game.cards['card-0'] = kingCard
    game.gamePlayState.handIds = ['card-0']
    game.gamePlayState.playedCardIds = []

    const moneyBefore = game.money
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.money).toBe(moneyBefore)
  })

  it('does not earn money for non-face cards held in hand', () => {
    const game = createGame()
    // card-1 produces roll=1 but card is a 9 (non-face), so no money
    const nineCard = makeNonFaceCard('card-1')
    game.cards['card-1'] = nineCard
    game.gamePlayState.handIds = ['card-1']
    game.gamePlayState.playedCardIds = []

    const moneyBefore = game.money
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.money).toBe(moneyBefore)
  })

  it('does not earn money for face cards that were played (not held)', () => {
    const game = createGame()
    // card-1 would succeed if held, but it is in playedCardIds
    const queenCard = makeFaceCard('card-1', 'Q')
    game.cards['card-1'] = queenCard
    game.gamePlayState.handIds = ['card-1']
    game.gamePlayState.playedCardIds = ['card-1']

    const moneyBefore = game.money
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.money).toBe(moneyBefore)
  })

  it('earns $1 per face card held when multiple face cards succeed', () => {
    const game = createGame()
    // card-1, card-3 produce roll=1; card-0, card-2 produce roll=2
    const jack = makeFaceCard('card-1', 'J')
    const queen = makeFaceCard('card-3', 'Q')
    game.cards['card-1'] = jack
    game.cards['card-3'] = queen
    game.gamePlayState.handIds = ['card-1', 'card-3']
    game.gamePlayState.playedCardIds = []

    const moneyBefore = game.money
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.money).toBe(moneyBefore + 2)
  })
})
