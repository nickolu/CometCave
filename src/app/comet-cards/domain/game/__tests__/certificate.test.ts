import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

function setupGame(): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.jokers = [initializeJoker(jokers.certificate, game)]
  game.gamePhase = 'blindSelection'
  return game
}

describe('Certificate joker', () => {
  it('adds a card with a seal to hand on small blind selection', () => {
    const game = setupGame()
    const initialHandCount = game.gamePlayState.handIds.length
    const after = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    expect(after.gamePlayState.handIds.length).toBe(initialHandCount + 1)
    const newCardId = after.gamePlayState.handIds[after.gamePlayState.handIds.length - 1]
    const newCard = after.cards[newCardId]
    expect(newCard).toBeDefined()
    expect(newCard.flags.seal).not.toBe('none')
  })

  it('works on big blind selection', () => {
    const game = setupGame()
    const initialHandCount = game.gamePlayState.handIds.length
    const after = reduceGame(game, { type: 'BIG_BLIND_SELECTED' })
    expect(after.gamePlayState.handIds.length).toBe(initialHandCount + 1)
    const newCardId = after.gamePlayState.handIds[after.gamePlayState.handIds.length - 1]
    const newCard = after.cards[newCardId]
    expect(newCard).toBeDefined()
    expect(newCard.flags.seal).not.toBe('none')
  })

  it('works on boss blind selection', () => {
    const game = setupGame()
    const initialHandCount = game.gamePlayState.handIds.length
    const after = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
    expect(after.gamePlayState.handIds.length).toBe(initialHandCount + 1)
    const newCardId = after.gamePlayState.handIds[after.gamePlayState.handIds.length - 1]
    const newCard = after.cards[newCardId]
    expect(newCard).toBeDefined()
    expect(newCard.flags.seal).not.toBe('none')
  })

  it('Certificate card coexists with dealt hand after HAND_DEALT', () => {
    const game = setupGame()
    const afterBlind = reduceGame(game, { type: 'SMALL_BLIND_SELECTED' })
    // Certificate should have added 1 card
    expect(afterBlind.gamePlayState.handIds.length).toBe(1)
    // After dealing, hand should have dealt cards + certificate card
    const afterDeal = reduceGame(afterBlind, { type: 'HAND_DEALT' })
    expect(afterDeal.gamePlayState.handIds.length).toBeGreaterThan(1)
  })
})
