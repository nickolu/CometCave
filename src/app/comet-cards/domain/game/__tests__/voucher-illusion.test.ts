import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Illusion voucher', () => {
  it('guarantees enchantments and boosts edition/seal chances for playing cards in shop', () => {
    const game: GameState = structuredClone(defaultGameState)
    const originalEditionChance = game.shopState.playingCard.editionBaseChance
    const originalChipChance = game.shopState.playingCard.chipBaseChance
    game.shopState.voucher = 'illusion'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'illusion' })

    expect(after.shopState.playingCard.enchantmentBaseChance).toBe(1)
    expect(after.shopState.playingCard.editionBaseChance).toBe(originalEditionChance * 4)
    expect(after.shopState.playingCard.chipBaseChance).toBe(originalChipChance * 4)
  })
})
