import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('Dusk joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.dusk, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('retriggered scored card adds baseChips when remainingHands is 0 (final hand)', () => {
    const game = setupGame()
    game.gamePlayState.remainingHands = 0

    const aceId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )!

    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[aceId]] },
    }, { type: 'CARD_SCORED' })

    const duskEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Dusk'
    )
    expect(duskEvents).toHaveLength(1)
    // Ace baseChips = 11
    expect(duskEvents[0].value).toBe(11)
    expect(duskEvents[0].type).toBe('chips')
  })

  it('does NOT retrigger when remainingHands is 1 (not final hand)', () => {
    const game = setupGame()
    game.gamePlayState.remainingHands = 1

    const aceId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )!

    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[aceId]] },
    }, { type: 'CARD_SCORED' })

    const duskEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Dusk'
    )
    expect(duskEvents).toHaveLength(0)
  })

  it('does NOT retrigger when remainingHands is 3 (early hand)', () => {
    const game = setupGame()
    game.gamePlayState.remainingHands = 3

    const threeId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '3'
    )!

    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[threeId]] },
    }, { type: 'CARD_SCORED' })

    const duskEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Dusk'
    )
    expect(duskEvents).toHaveLength(0)
  })
})
