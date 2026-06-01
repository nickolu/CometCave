import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

const fakeCards = {
  c1: { id: 'c1', playingCardId: '2_hearts', isFaceUp: true } as any,
  c2: { id: 'c2', playingCardId: '5_clubs', isFaceUp: true } as any,
  c3: { id: 'c3', playingCardId: '9_spades', isFaceUp: true } as any,
}

function setupGame(bossBlindName: string): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.rounds[game.roundIndex].bossBlindName = bossBlindName
  game.cards = structuredClone(fakeCards)
  return game
}

describe('face-down boss blind cleanup', () => {
  describe('The Mark', () => {
    it('restores all cards to face up after BLIND_REWARDS_END', () => {
      const game = setupGame('The Mark')

      const afterSelect = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
      const afterClear = reduceGame(afterSelect, { type: 'BLIND_REWARDS_END' })

      for (const cardId of Object.keys(afterClear.cards)) {
        expect(afterClear.cards[cardId].isFaceUp).toBe(true)
      }
    })
  })

  describe('The Wheel', () => {
    it('restores all cards to face up after BLIND_REWARDS_END', () => {
      const game = setupGame('The Wheel')

      const afterSelect = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
      const afterClear = reduceGame(afterSelect, { type: 'BLIND_REWARDS_END' })

      for (const cardId of Object.keys(afterClear.cards)) {
        expect(afterClear.cards[cardId].isFaceUp).toBe(true)
      }
    })
  })

  describe('The House', () => {
    it('restores all cards to face up after BLIND_REWARDS_END', () => {
      const game = setupGame('The House')

      const afterSelect = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
      // All cards should be face-down after blind is selected
      for (const cardId of Object.keys(afterSelect.cards)) {
        expect(afterSelect.cards[cardId].isFaceUp).toBe(false)
      }

      const afterClear = reduceGame(afterSelect, { type: 'BLIND_REWARDS_END' })
      for (const cardId of Object.keys(afterClear.cards)) {
        expect(afterClear.cards[cardId].isFaceUp).toBe(true)
      }
    })
  })

  describe('The Fish', () => {
    it('restores all cards to face up after BLIND_REWARDS_END', () => {
      const game = setupGame('The Fish')

      // Manually flip some cards face-down as The Fish would during gameplay
      game.cards['c1'].isFaceUp = false
      game.cards['c2'].isFaceUp = false

      // Set blind status to in-progress via BOSS_BLIND_SELECTED
      const afterSelect = reduceGame(game, { type: 'BOSS_BLIND_SELECTED' })
      const afterClear = reduceGame(afterSelect, { type: 'BLIND_REWARDS_END' })

      for (const cardId of Object.keys(afterClear.cards)) {
        expect(afterClear.cards[cardId].isFaceUp).toBe(true)
      }
    })
  })
})
