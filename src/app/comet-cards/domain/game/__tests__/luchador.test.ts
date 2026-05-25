import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Luchador joker', () => {
  it('selling Luchador sets bossBlindDisabled to true', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.luchador, game)]
    const started = reduceGame(game, { type: 'GAME_START' })

    const luchadorInstance = started.jokers.find(j => j.jokerId === 'luchador')
    expect(luchadorInstance).toBeTruthy()

    const selected = {
      ...started,
      gamePlayState: { ...started.gamePlayState, selectedJokerId: luchadorInstance!.id },
    }

    const afterSale = reduceGame(selected, { type: 'JOKER_SOLD' })

    expect(afterSale.jokers.some(j => j.jokerId === 'luchador')).toBe(false)
    expect(afterSale.staticRules.bossBlindDisabled).toBe(true)
  })

  it('bossBlindDisabled disables boss blind effects (like The Hook)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].bossBlindName = 'The Hook'
    game.rounds[game.roundIndex].bossBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    game.staticRules.bossBlindDisabled = true
    game.jokers = []

    const cardIds = ['card1', 'card2', 'card3']
    game.gamePlayState = {
      ...game.gamePlayState,
      handIds: [...cardIds],
    }

    const after = reduceGame(game, { type: 'HAND_SCORING_DONE_CARD_SCORING' })

    // With bossBlindDisabled, The Hook's effect should not fire
    expect(after.gamePlayState.handIds).toEqual(cardIds)
  })

  it('bossBlindDisabled resets to false when small blind is selected', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.staticRules.bossBlindDisabled = true
    game.rounds[game.roundIndex].smallBlind.status = 'notStarted'

    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })

    expect(after.staticRules.bossBlindDisabled).toBe(false)
  })

  it('bossBlindDisabled resets to false when big blind is selected', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.staticRules.bossBlindDisabled = true
    game.rounds[game.roundIndex].bigBlind.status = 'notStarted'

    const after = reduceGame(game, { type: 'BIG_BLIND_SELECTED' })

    expect(after.staticRules.bossBlindDisabled).toBe(false)
  })

  it('bossBlindDisabled resets to false when boss blind is selected', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.staticRules.bossBlindDisabled = true
    game.rounds[game.roundIndex].bossBlind.status = 'notStarted'

    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })

    expect(after.staticRules.bossBlindDisabled).toBe(false)
  })
})
