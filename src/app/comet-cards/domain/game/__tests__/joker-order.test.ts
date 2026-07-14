import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

function setupGame(jokerList: ReturnType<typeof initializeJoker>[]): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.jokers = jokerList
  game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
  game.gamePhase = 'gameplay'
  return game
}

describe('Joker order dependency', () => {
  describe('1. Flat mult joker before vs after X mult joker', () => {
    it('[jokerJoker, cavendish] — flat +4 applied first, then X3: scoring events match joker array order', () => {
      const game = setupGame([
        initializeJoker(jokers.jokerJoker, defaultGameState),
        initializeJoker(jokers.cavendish, defaultGameState),
      ])

      const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
      const events = after.gamePlayState.scoringEvents

      const jokerEventIdx = events.findIndex(
        e => 'source' in e && e.source === 'Joker'
      )
      const cavendishEventIdx = events.findIndex(
        e => 'source' in e && e.source === 'Cavendish'
      )

      expect(jokerEventIdx).toBeGreaterThanOrEqual(0)
      expect(cavendishEventIdx).toBeGreaterThanOrEqual(0)
      // jokerJoker is first in array, so its event should appear before cavendish
      expect(jokerEventIdx).toBeLessThan(cavendishEventIdx)
    })

    it('[cavendish, jokerJoker] — X3 applied first, then flat +4: scoring events match joker array order', () => {
      const game = setupGame([
        initializeJoker(jokers.cavendish, defaultGameState),
        initializeJoker(jokers.jokerJoker, defaultGameState),
      ])

      const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
      const events = after.gamePlayState.scoringEvents

      const cavendishEventIdx = events.findIndex(
        e => 'source' in e && e.source === 'Cavendish'
      )
      const jokerEventIdx = events.findIndex(
        e => 'source' in e && e.source === 'Joker'
      )

      expect(cavendishEventIdx).toBeGreaterThanOrEqual(0)
      expect(jokerEventIdx).toBeGreaterThanOrEqual(0)
      // cavendish is first in array, so its event should appear before jokerJoker
      expect(cavendishEventIdx).toBeLessThan(jokerEventIdx)
    })

    it('[jokerJoker, cavendish] produces different final mult than [cavendish, jokerJoker]', () => {
      const baseMultiplier = 2 // arbitrary non-zero starting mult

      const gameA = setupGame([
        initializeJoker(jokers.jokerJoker, defaultGameState),
        initializeJoker(jokers.cavendish, defaultGameState),
      ])
      gameA.gamePlayState.score = { chips: 0, mult: baseMultiplier }

      const gameB = setupGame([
        initializeJoker(jokers.cavendish, defaultGameState),
        initializeJoker(jokers.jokerJoker, defaultGameState),
      ])
      gameB.gamePlayState.score = { chips: 0, mult: baseMultiplier }

      const afterA = reduceGame(gameA, { type: 'HAND_SCORING_FINALIZE' })
      const afterB = reduceGame(gameB, { type: 'HAND_SCORING_FINALIZE' })

      // score is reset after HAND_SCORING_FINALIZE; read the captured mult from handResults
      const multA = afterA.gamePlayState.handResults.at(-1)?.mult
      const multB = afterB.gamePlayState.handResults.at(-1)?.mult

      // [jokerJoker, cavendish]: (base + 4) * 3 = (2 + 4) * 3 = 18
      expect(multA).toBe((baseMultiplier + 4) * 3)
      // [cavendish, jokerJoker]: base * 3 + 4 = 2 * 3 + 4 = 10
      expect(multB).toBe(baseMultiplier * 3 + 4)
      // The two orders produce different results
      expect(multA).not.toBe(multB)
    })
  })

  describe('2. Blueprint copies right neighbor', () => {
    it('[blueprint, jokerJoker] — blueprint produces a "Joker" source scoring event (copies jokerJoker)', () => {
      const game = setupGame([
        initializeJoker(jokers.blueprint, defaultGameState),
        initializeJoker(jokers.jokerJoker, defaultGameState),
      ])

      const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
      const events = after.gamePlayState.scoringEvents

      // Blueprint at index 0 copies jokerJoker at index 1
      // jokerJoker itself also fires, so we expect at least 2 events from source 'Joker'
      const jokerEvents = events.filter(
        e => 'source' in e && e.source === 'Joker'
      )
      expect(jokerEvents.length).toBeGreaterThanOrEqual(2)
    })

    it('[blueprint, cavendish] — blueprint produces a "Cavendish" source scoring event (copies cavendish)', () => {
      const game = setupGame([
        initializeJoker(jokers.blueprint, defaultGameState),
        initializeJoker(jokers.cavendish, defaultGameState),
      ])

      const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
      const events = after.gamePlayState.scoringEvents

      // Blueprint at index 0 copies cavendish at index 1
      // cavendish itself also fires, so we expect at least 2 X-mult events from 'Cavendish'
      const cavendishXEvents = events.filter(
        e => 'source' in e && e.source === 'Cavendish' && 'operator' in e && e.operator === 'x'
      )
      expect(cavendishXEvents.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('3. Brainstorm copies leftmost joker', () => {
    it('[jokerJoker, brainstorm] — brainstorm copies jokerJoker (index 0), producing two "Joker" events', () => {
      const game = setupGame([
        initializeJoker(jokers.jokerJoker, defaultGameState),
        initializeJoker(jokers.brainstorm, defaultGameState),
      ])

      const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
      const events = after.gamePlayState.scoringEvents

      // jokerJoker fires once for itself; brainstorm copies index 0 (jokerJoker) and fires again
      const jokerEvents = events.filter(
        e => 'source' in e && e.source === 'Joker'
      )
      expect(jokerEvents.length).toBeGreaterThanOrEqual(2)
    })

    it('[cavendish, brainstorm] — brainstorm copies cavendish (index 0), producing two "Cavendish" X-mult events', () => {
      const game = setupGame([
        initializeJoker(jokers.cavendish, defaultGameState),
        initializeJoker(jokers.brainstorm, defaultGameState),
      ])

      const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
      const events = after.gamePlayState.scoringEvents

      // cavendish fires once for itself; brainstorm copies index 0 (cavendish) and fires again
      const cavendishXEvents = events.filter(
        e => 'source' in e && e.source === 'Cavendish' && 'operator' in e && e.operator === 'x'
      )
      expect(cavendishXEvents.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('4. Blueprint at end of array (no right neighbor)', () => {
    it('[jokerJoker, blueprint] — blueprint has no right neighbor, produces no extra scoring events', () => {
      const game = setupGame([
        initializeJoker(jokers.jokerJoker, defaultGameState),
        initializeJoker(jokers.blueprint, defaultGameState),
      ])

      const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
      const events = after.gamePlayState.scoringEvents

      // jokerJoker fires once for itself; blueprint at index 1 has nothing to the right
      // so there should be exactly one "Joker" event (not two)
      const jokerEvents = events.filter(
        e => 'source' in e && e.source === 'Joker'
      )
      expect(jokerEvents.length).toBe(1)

      // No blueprint-sourced events either (blueprint has empty effects[])
      const blueprintEvents = events.filter(
        e => 'source' in e && e.source === 'Blueprint'
      )
      expect(blueprintEvents.length).toBe(0)
    })
  })
})
