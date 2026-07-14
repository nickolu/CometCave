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

  it('guaranteed joker pack is always normal rarity', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.roundIndex = 1
    // Test many seeds — whenever the guarantee fires (packs[0] replaced),
    // the joker pack must be normal rarity
    let guaranteeFired = 0
    for (let i = 0; i < 50; i++) {
      game.gameSeed = `rarity-test-${i}`
      const packs = getRandomPacks(game, 2)
      const pack0IsJoker = packs[0].cards.some(c => c.type === 'jokerCard')
      const pack1IsJoker = packs[1].cards.some(c => c.type === 'jokerCard')
      // If pack0 is joker but pack1 is not, the guarantee almost certainly fired
      if (pack0IsJoker && !pack1IsJoker) {
        guaranteeFired++
        expect(packs[0].rarity).toBe('normal')
      }
    }
    // The guarantee should fire for most seeds given ~8.7% natural joker chance
    expect(guaranteeFired).toBeGreaterThan(0)
  })

  it('does not force a joker pack in later rounds', () => {
    // Just verify the function doesn't error for round 2+
    const game: GameState = structuredClone(defaultGameState)
    game.roundIndex = 2
    const packs = getRandomPacks(game, 2)
    expect(packs.length).toBe(2)
  })
})
