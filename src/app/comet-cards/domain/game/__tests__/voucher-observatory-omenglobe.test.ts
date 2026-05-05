import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Observatory voucher', () => {
  it('activates observatoryActive flag', () => {
    const game: GameState = structuredClone(defaultGameState)
    expect(game.staticRules.observatoryActive).toBe(false)
    game.shopState.voucher = 'observatory'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'observatory' })
    expect(after.staticRules.observatoryActive).toBe(true)
  })
})

describe('Omen Globe voucher', () => {
  it('activates spectralInArcanaPacks flag', () => {
    const game: GameState = structuredClone(defaultGameState)
    expect(game.staticRules.spectralInArcanaPacks).toBe(false)
    game.shopState.voucher = 'omenGlobe'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'omenGlobe' })
    expect(after.staticRules.spectralInArcanaPacks).toBe(true)
  })
})
