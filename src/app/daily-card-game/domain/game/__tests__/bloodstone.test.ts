import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

// With gameSeed='test-seed', roundIndex=1 (default):
// 'card-1' produces roll=1 (success)
// 'card-0' produces roll=2 (failure)
const GAME_SEED = 'test-seed'

function makeCard(id: string, playingCardId: string): PlayingCardState {
  return {
    id,
    playingCardId,
    bonusChips: 0,
    isFaceUp: true,
    flags: { edition: 'normal', enchantment: 'none', seal: 'none' },
  }
}

describe('Bloodstone joker', () => {
  it('gives X1.5 Mult when a Hearts card is scored and roll succeeds (roll=1)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.bloodstone, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    // card-1 produces roll=1 (success)
    const card = makeCard('card-1', 'A_hearts')
    game.cards['card-1'] = card

    const multBefore = game.gamePlayState.score.mult
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Bloodstone' && 'operator' in e && e.operator === 'x' && e.value === 1.5
    )).toBe(true)
    expect(after.gamePlayState.score.mult).toBe(multBefore * 1.5)
  })

  it('gives no bonus when a Hearts card is scored and roll fails (roll=2)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.bloodstone, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    // card-0 produces roll=2 (failure)
    const card = makeCard('card-0', 'A_hearts')
    game.cards['card-0'] = card

    const multBefore = game.gamePlayState.score.mult
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Bloodstone'
    )).toBe(false)
    expect(after.gamePlayState.score.mult).toBe(multBefore)
  })

  it('gives no bonus for non-Hearts cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.bloodstone, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED

    const spadesId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.suit === 'spades'
    )!

    const multBefore = game.gamePlayState.score.mult
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[spadesId]] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Bloodstone'
    )).toBe(false)
    expect(after.gamePlayState.score.mult).toBe(multBefore)
  })
})
