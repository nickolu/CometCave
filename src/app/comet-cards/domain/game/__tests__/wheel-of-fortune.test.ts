import { describe, expect, it } from 'vitest'

import { tarotCards } from '@/app/comet-cards/domain/consumable/tarot-cards'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

// With gameSeed='success-seed', roundIndex=1:
//   roll=1 (success), edition='foil'
// With gameSeed='fail-seed', roundIndex=1:
//   roll=4 (failure)

function makeGame(overrides: Partial<GameState> = {}): GameState {
  const game: GameState = structuredClone(defaultGameState)
  const wheelOfFortuneCard = {
    id: 'wheel-of-fortune-1',
    consumableType: 'tarotCard' as const,
    name: 'Wheel of Fortune',
    isFaceUp: true,
    tarotType: 'wheelOfFortune' as const,
  }
  game.consumables = [wheelOfFortuneCard]
  game.gamePlayState.selectedConsumable = wheelOfFortuneCard
  return { ...game, ...overrides }
}

describe('Wheel of Fortune tarot card', () => {
  it('adds an edition to a normal joker when roll succeeds', () => {
    // gameSeed='success-seed', roundIndex=1 -> roll=1 (success), edition='foil'
    const game = makeGame({ gameSeed: 'success-seed' })
    game.jokers = [initializeJoker(jokers.jokerJoker, game)]
    expect(game.jokers[0].edition).toBe('normal')

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.jokers[0].edition).not.toBe('normal')
    expect(['foil', 'holographic', 'polychrome']).toContain(after.jokers[0].edition)
  })

  it('does not change joker edition when roll fails', () => {
    // gameSeed='fail-seed', roundIndex=1 -> roll=4 (failure)
    const game = makeGame({ gameSeed: 'fail-seed' })
    game.jokers = [initializeJoker(jokers.jokerJoker, game)]
    expect(game.jokers[0].edition).toBe('normal')

    const after = reduceGame(game, { type: 'TAROT_CARD_USED' })
    expect(after.jokers[0].edition).toBe('normal')
  })

  it('is not playable when there are no normal-edition jokers', () => {
    const game = makeGame()
    game.jokers = [{ ...initializeJoker(jokers.jokerJoker, game), edition: 'foil' }]

    expect(tarotCards.wheelOfFortune.isPlayable(game)).toBe(false)
  })

  it('is playable when there is at least one normal-edition joker', () => {
    const game = makeGame()
    game.jokers = [initializeJoker(jokers.jokerJoker, game)]

    expect(tarotCards.wheelOfFortune.isPlayable(game)).toBe(true)
  })
})
