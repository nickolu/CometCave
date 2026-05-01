import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'

function makeGameWithOpenPack(base: GameState): GameState {
  return {
    ...base,
    gamePhase: 'packOpening',
    shopState: {
      ...base.shopState,
      openPackState: {
        id: 'test-pack',
        cards: [],
        rarity: 'normal',
        remainingCardsToSelect: 1,
      },
    },
  }
}

describe('Red Card joker', () => {
  it('increases counter by 3 on PACK_OPEN_SKIP', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.redCard, game)]
    const withPack = makeGameWithOpenPack(game)
    const after = reduceGame(withPack, { type: 'PACK_OPEN_SKIP' })
    const rc = after.jokers.find(j => j.jokerId === 'redCard')
    expect(rc?.counter).toBe(3)
  })

  it('accumulates counter across multiple skips', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.redCard, game)]

    const withPack1 = makeGameWithOpenPack(game)
    const after1 = reduceGame(withPack1, { type: 'PACK_OPEN_SKIP' })

    const withPack2 = makeGameWithOpenPack(after1)
    const after2 = reduceGame(withPack2, { type: 'PACK_OPEN_SKIP' })

    const rc = after2.jokers.find(j => j.jokerId === 'redCard')
    expect(rc?.counter).toBe(6)
  })

  it('applies accumulated Mult on HAND_SCORING_FINALIZE', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.redCard, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const started = reduceGame(game, { type: 'GAME_START' })

    // Skip a pack to get counter to 3
    const withPack = makeGameWithOpenPack(started)
    const afterSkip = reduceGame(withPack, { type: 'PACK_OPEN_SKIP' })

    const hand: GameState = {
      ...afterSkip,
      gamePhase: 'gameplay',
      rounds: afterSkip.rounds.map((r, i) =>
        i === afterSkip.roundIndex
          ? { ...r, smallBlind: { ...r.smallBlind, status: 'inProgress' } }
          : r
      ),
      gamePlayState: {
        ...afterSkip.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 5 },
      },
    }

    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Red Card' && 'value' in e && e.value === 3
    )).toBe(true)
  })

  it('does not apply bonus when counter is 0', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.redCard, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })

    const hand: GameState = {
      ...started,
      gamePlayState: {
        ...started.gamePlayState,
        selectedHand: ['pair', []],
        score: { chips: 10, mult: 5 },
      },
    }
    const after = reduceGame(hand, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Red Card'
    )).toBe(false)
  })
})
