import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

// With gameSeed='test-seed', roundIndex=1 (default):
//   handsPlayed=1 => roll=1 (success)
//   handsPlayed=0 => roll=4 (failure)
const GAME_SEED = 'test-seed'

describe('Space Joker', () => {
  it('upgrades hand level when roll succeeds (roll=1)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.spaceJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED
    game.handsPlayed = 1
    game.gamePlayState.selectedHand = ['pair', []]

    const levelBefore = game.pokerHands.pair.level

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.pokerHands.pair.level).toBe(levelBefore + 1)
  })

  it('does not upgrade hand level when roll fails (roll!=1)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.spaceJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.gameSeed = GAME_SEED
    game.handsPlayed = 0
    game.gamePlayState.selectedHand = ['pair', []]

    const levelBefore = game.pokerHands.pair.level

    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    expect(after.pokerHands.pair.level).toBe(levelBefore)
  })
})
