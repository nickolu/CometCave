import { describe, expect, it } from 'vitest'

import { initializeCelestialCard } from '@/app/daily-card-game/domain/consumable/utils'
import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

describe('Constellation joker', () => {
  function createGameWithConstellation(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.constellation, game)]
    return game
  }

  function addCelestialCard(game: GameState): GameState {
    const celestialCard = initializeCelestialCard(celestialCards.pair)
    return {
      ...game,
      consumables: [...game.consumables, celestialCard],
      gamePlayState: {
        ...game.gamePlayState,
        selectedConsumable: celestialCard,
      },
    }
  }

  it('increases counter by 1 on CELESTIAL_CARD_USED (lazy init from 0 to 10, then +1)', () => {
    const game = addCelestialCard(createGameWithConstellation())

    const after = reduceGame(game, { type: 'CELESTIAL_CARD_USED' })
    const c = after.jokers.find(j => j.jokerId === 'constellation')
    // starts at 0, lazy init sets to 10, then +1 = 11
    expect(c?.counter).toBe(11)
  })

  it('accumulates counter across multiple planet card uses', () => {
    const game = createGameWithConstellation()

    const after1 = reduceGame(addCelestialCard(game), { type: 'CELESTIAL_CARD_USED' })
    // counter = 11 after first use (10 + 1)

    const after2 = reduceGame(addCelestialCard(after1), { type: 'CELESTIAL_CARD_USED' })
    const c = after2.jokers.find(j => j.jokerId === 'constellation')
    // counter = 12 after second use
    expect(c?.counter).toBe(12)
  })

  it('applies X Mult scoring event on HAND_SCORING_FINALIZE when counter > 10', () => {
    const game = createGameWithConstellation()

    // Use one celestial card to set counter to 11 (X1.1)
    const afterCelestial = reduceGame(addCelestialCard(game), { type: 'CELESTIAL_CARD_USED' })

    const hand: GameState = {
      ...afterCelestial,
      gamePhase: 'gameplay',
      rounds: afterCelestial.rounds.map((r, i) =>
        i === afterCelestial.roundIndex
          ? { ...r, smallBlind: { ...r.smallBlind, status: 'inProgress' } }
          : r
      ),
      gamePlayState: {
        ...afterCelestial.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 10 },
      },
    }

    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    const scoringEvent = after.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Constellation'
    )
    expect(scoringEvent).toBeDefined()
    // counter = 11, xMult = 11/10 = 1.1
    expect('value' in scoringEvent! && scoringEvent.value).toBe(1.1)
  })

  it('does not apply X Mult scoring event when counter is 10 (no planet cards used)', () => {
    const game = createGameWithConstellation()

    const hand: GameState = {
      ...game,
      gamePhase: 'gameplay',
      rounds: game.rounds.map((r, i) =>
        i === game.roundIndex
          ? { ...r, smallBlind: { ...r.smallBlind, status: 'inProgress' } }
          : r
      ),
      gamePlayState: {
        ...game.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 4, mult: 4 },
      },
    }

    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    const scoringEvent = after.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Constellation'
    )
    expect(scoringEvent).toBeUndefined()
  })
})
