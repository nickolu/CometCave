import { describe, expect, it } from 'vitest'

import { tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

function makeGameWithHighPriestess(overrides: Partial<GameState> = {}): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const highPriestessCard = {
    id: 'high-priestess-1',
    consumableType: 'tarotCard' as const,
    tarotType: 'theHighPriestess' as const,
  }
  game.consumables = [highPriestessCard]
  game.gamePlayState.selectedConsumable = highPriestessCard
  return { ...game, ...overrides }
}

describe('The High Priestess tarot card', () => {
  it('creates 2 celestial cards when 2+ slots available after use', () => {
    // maxConsumables=5, consumables starts with 1 (high priestess)
    // after use: high priestess removed, 2 celestial cards added => 2 total
    const game = makeGameWithHighPriestess({ maxConsumables: 5 })

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })

    expect(after.consumables.length).toBe(2)
    expect(after.consumables.every(c => c.consumableType === 'celestialCard')).toBe(true)
  })

  it('creates only 1 celestial card when only 1 slot remains after use', () => {
    // maxConsumables=1, consumables starts with 1 (high priestess)
    // after use: high priestess removed (0 left), space for 1, adds 1 celestial card
    const game = makeGameWithHighPriestess({ maxConsumables: 1 })

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })

    expect(after.consumables.length).toBe(1)
    expect(after.consumables[0].consumableType).toBe('celestialCard')
  })

  it('creates no cards when maxConsumables is 0', () => {
    // Effect guards with Math.min(2, maxConsumables - consumables.length)
    // maxConsumables=0 => cardsToCreate=0
    const game = makeGameWithHighPriestess({ maxConsumables: 0 })

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })

    expect(after.consumables.filter(c => c.consumableType === 'celestialCard').length).toBe(0)
  })

  it('is not playable when consumables are at max capacity', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxConsumables = 2
    game.consumables = [
      { id: 'card-1', consumableType: 'tarotCard', tarotType: 'theFool' },
      { id: 'card-2', consumableType: 'tarotCard', tarotType: 'theFool' },
    ]

    expect(tarotCards.theHighPriestess.isPlayable(game)).toBe(false)
  })

  it('is playable when there is at least one free consumable slot', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.maxConsumables = 2
    game.consumables = [{ id: 'card-1', consumableType: 'tarotCard', tarotType: 'theFool' }]

    expect(tarotCards.theHighPriestess.isPlayable(game)).toBe(true)
  })
})
