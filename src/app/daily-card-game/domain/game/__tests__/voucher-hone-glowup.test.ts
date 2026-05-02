import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

describe('Hone and Glow Up vouchers', () => {
  it('Hone doubles edition weights and playing card edition chance', () => {
    const game: GameState = structuredClone(defaultGameState)
    const origHolo = game.shopState.joker.editionWeights.holographic
    const origFoil = game.shopState.joker.editionWeights.foil
    const origPoly = game.shopState.joker.editionWeights.polychrome
    const origEditionChance = game.shopState.playingCard.editionBaseChance
    game.shopState.voucher = 'hone'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'hone' })
    expect(after.shopState.joker.editionWeights.holographic).toBe(origHolo * 2)
    expect(after.shopState.joker.editionWeights.foil).toBe(origFoil * 2)
    expect(after.shopState.joker.editionWeights.polychrome).toBe(origPoly * 2)
    expect(after.shopState.playingCard.editionBaseChance).toBe(origEditionChance * 2)
  })

  it('Glow Up doubles again for cumulative 4x', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.shopState.joker.editionWeights.holographic *= 2
    game.shopState.joker.editionWeights.foil *= 2
    game.shopState.joker.editionWeights.polychrome *= 2
    game.shopState.playingCard.editionBaseChance *= 2
    const afterHoneHolo = game.shopState.joker.editionWeights.holographic
    game.shopState.voucher = 'glowUp'

    const after = reduceGame(game, { type: 'SHOP_BUY_VOUCHER', id: 'glowUp' })
    expect(after.shopState.joker.editionWeights.holographic).toBe(afterHoneHolo * 2)
  })
})
