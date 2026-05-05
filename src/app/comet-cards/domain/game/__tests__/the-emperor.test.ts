import { describe, expect, it } from 'vitest'

import { tarotCards } from '@/app/comet-cards/domain/consumable/tarot-cards'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

function makeGameWithEmperor(overrides: Partial<GameState> = {}): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const emperorCard = {
    id: 'emperor-1',
    consumableType: 'tarotCard' as const,
    tarotType: 'theEmperor' as const,
  }
  game.consumables = [emperorCard]
  game.gamePlayState.selectedConsumable = emperorCard
  return { ...game, ...overrides }
}

describe('The Emperor tarot card', () => {
  it('creates 2 tarot cards when 2+ slots available after use', () => {
    // maxConsumables=5, consumables starts with 1 (the emperor)
    // after use: emperor removed, 2 tarot cards added => 2 total
    const game = makeGameWithEmperor({ maxConsumables: 5 })

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })

    expect(after.consumables.length).toBe(2)
    expect(after.consumables.every(c => c.consumableType === 'tarotCard')).toBe(true)
  })

  it('creates only 1 tarot card when only 1 slot remains after use', () => {
    // maxConsumables=1, consumables starts with 1 (the emperor)
    // after use: emperor removed (0 left), space for 1, adds 1 tarot card
    const game = makeGameWithEmperor({ maxConsumables: 1 })

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })

    expect(after.consumables.length).toBe(1)
    expect(after.consumables[0].consumableType).toBe('tarotCard')
  })

  it('creates no cards when maxConsumables is 0', () => {
    // Effect guards with Math.min(2, maxConsumables - consumables.length)
    // maxConsumables=0 => cardsToCreate=0
    const game = makeGameWithEmperor({ maxConsumables: 0 })

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })

    expect(after.consumables.filter(c => c.consumableType === 'tarotCard').length).toBe(0)
  })

  it('does not create The Emperor itself', () => {
    const game = makeGameWithEmperor({ maxConsumables: 5 })

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })

    const createdCards = after.consumables.filter(c => c.consumableType === 'tarotCard')
    expect(
      createdCards.every(c => c.consumableType === 'tarotCard' && c.tarotType !== 'theEmperor')
    ).toBe(true)
  })

  it('is not playable when consumables are at max capacity', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxConsumables = 2
    game.consumables = [
      { id: 'card-1', consumableType: 'tarotCard', tarotType: 'theFool' },
      { id: 'card-2', consumableType: 'tarotCard', tarotType: 'theFool' },
    ]

    expect(tarotCards.theEmperor.isPlayable(game)).toBe(false)
  })

  it('is playable when there is at least one free consumable slot', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxConsumables = 2
    game.consumables = [{ id: 'card-1', consumableType: 'tarotCard', tarotType: 'theFool' }]

    expect(tarotCards.theEmperor.isPlayable(game)).toBe(true)
  })
})
