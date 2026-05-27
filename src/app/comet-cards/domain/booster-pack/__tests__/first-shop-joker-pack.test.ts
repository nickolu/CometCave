import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { getRandomPacks } from '@/app/comet-cards/domain/booster-pack/utils'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('first shop joker pack guarantee', () => {
  it('guarantees at least one joker pack in the first round', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.roundIndex = 1
    const packs = getRandomPacks(game, 2)
    const hasJokerPack = packs.some(p => p.cards.some(c => c.type === 'jokerCard'))
    expect(hasJokerPack).toBe(true)
  })

  it('does not force a joker pack in later rounds', () => {
    // Just verify the function doesn't error for round 2+
    const game: GameState = structuredClone(defaultGameState)
    game.roundIndex = 2
    const packs = getRandomPacks(game, 2)
    expect(packs.length).toBe(2)
  })
})
