import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Lucky Cat joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.luckyCat, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('gains counter when Lucky card triggers', () => {
    const game = setupGame()
    const cardId = Object.keys(game.cards)[0]
    game.cards[cardId].flags.enchantment = 'lucky'

    // Simulate a Lucky trigger by adding a Lucky scoring event
    game.gamePlayState.scoringEvents.push({
      id: 'test-lucky',
      type: 'mult',
      value: 20,
      source: 'Lucky',
    })

    const after = reduceGame(
      {
        ...game,
        gamePlayState: {
          ...game.gamePlayState,
          cardsToScore: [game.cards[cardId]],
        },
      },
      { type: 'CARD_SCORED' },
    )

    const lc = after.jokers.find(j => j.jokerId === 'luckyCat')
    // Counter should be 5: initialized to 4 (X1.0) + 1 for the Lucky trigger
    expect(lc?.counter).toBe(5)
  })

  it('does not gain counter on non-Lucky cards', () => {
    const game = setupGame()
    const cardId = Object.keys(game.cards).find(
      id => playingCards[game.cards[id].playingCardId]?.value === '3',
    )!

    const after = reduceGame(
      {
        ...game,
        gamePlayState: {
          ...game.gamePlayState,
          cardsToScore: [game.cards[cardId]],
        },
      },
      { type: 'CARD_SCORED' },
    )

    const lc = after.jokers.find(j => j.jokerId === 'luckyCat')
    // Counter initialized to 4 but unchanged (no Lucky card)
    expect(lc?.counter).toBe(4)
  })

  it('applies X Mult during HAND_SCORING_FINALIZE when counter > 4', () => {
    const game = setupGame()
    // Manually set counter to 6 (X1.5 Mult)
    const lc = game.jokers.find(j => j.jokerId === 'luckyCat')!
    lc.counter = 6

    game.gamePlayState.remainingHands = 5
    game.gamePlayState.score = { chips: 10, mult: 10 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(
      after.gamePlayState.scoringEvents.some(
        e => 'source' in e && e.source === 'Lucky Cat',
      ),
    ).toBe(true)
  })

  it('does not apply X Mult when counter is at base (4)', () => {
    const game = setupGame()
    const lc = game.jokers.find(j => j.jokerId === 'luckyCat')!
    lc.counter = 4

    game.gamePlayState.remainingHands = 5
    game.gamePlayState.score = { chips: 10, mult: 10 }

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(
      after.gamePlayState.scoringEvents.some(
        e => 'source' in e && e.source === 'Lucky Cat',
      ),
    ).toBe(false)
  })
})
