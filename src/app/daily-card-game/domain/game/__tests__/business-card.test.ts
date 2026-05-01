import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

// With gameSeed='test-seed', roundIndex=1 (default game state starts at roundIndex 1):
// card id 'card-1' produces roll=1 (success)
// card id 'card-0' produces roll=2 (failure)
const GAME_SEED = 'test-seed'

function makeFaceCard(id: string, playingCardId: string = 'J_hearts'): PlayingCardState {
  return {
    id,
    playingCardId,
    bonusChips: 0,
    isFaceUp: true,
    flags: { edition: 'normal', enchantment: 'none', seal: 'none' },
  }
}

describe('Business Card joker', () => {
  it('does not trigger on non-face cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.businessCard, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    const eightId = Object.keys(game.cards).find(
      id => playingCards[game.cards[id].playingCardId]?.value === '8'
    )!

    const moneyBefore = game.money
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[eightId]] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.money).toBe(moneyBefore)
  })

  it('does not trigger on Ace', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.businessCard, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    const aceId = Object.keys(game.cards).find(
      id => playingCards[game.cards[id].playingCardId]?.value === 'A'
    )!

    const moneyBefore = game.money
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[aceId]] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.money).toBe(moneyBefore)
  })

  it('gives $2 when a face card is scored and roll succeeds (roll=1)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.businessCard, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    // card-1 with gameSeed=test-seed, roundIndex=1 produces roll=1 (success)
    const card = makeFaceCard('card-1', 'J_hearts')
    game.cards['card-1'] = card

    const moneyBefore = game.money
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.money).toBe(moneyBefore + 2)
  })

  it('does not give money when roll fails (roll!=1)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.businessCard, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    // card-0 with gameSeed=test-seed, roundIndex=1 produces roll=2 (failure)
    const card = makeFaceCard('card-0', 'Q_spades')
    game.cards['card-0'] = card

    const moneyBefore = game.money
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.money).toBe(moneyBefore)
  })

  it('triggers on K (King) cards when roll succeeds', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.businessCard, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    // card-1 with gameSeed=test-seed, roundIndex=1 produces roll=1 (success)
    const card = makeFaceCard('card-1', 'K_clubs')
    game.cards['card-1'] = card

    const moneyBefore = game.money
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.money).toBe(moneyBefore + 2)
  })
})
