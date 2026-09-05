import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { BuyableCard } from '@/app/comet-cards/domain/shop/types'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('Wee Joker', () => {
  it('initializes with 0 chips bonus', () => {
    const started = startRunWithJokers([jokers.weeJokerJoker])
    const wj = started.jokers.find(j => j.jokerId === 'weeJokerJoker')
    expect(wj?.metadata?.chipsBonus).toBe(0)
  })

  it('does not add chips on HAND_SCORING_FINALIZE when no 2s scored', () => {
    const started = inGameplay(startRunWithJokers([jokers.weeJokerJoker]))
    const afterScore = reduceGame(started, { type: 'HAND_SCORING_FINALIZE' })
    expect(
      afterScore.jokers.find(j => j.jokerId === 'weeJokerJoker')?.metadata?.chipsBonus
    ).toBe(0)
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Wee Joker'
    )).toBe(false)
  })

  it('does not reset accumulated chipsBonus when another joker is purchased (JOKER_ADDED)', () => {
    const game: GameState = structuredClone(defaultGameState)
    const weeJokerInstance = initializeJoker(jokers.weeJokerJoker, game)
    // Simulate accumulated bonus from scoring 2s
    weeJokerInstance.metadata = { chipsBonus: 24 }
    game.jokers = [weeJokerInstance]

    // Buy a second joker — this triggers JOKER_ADDED which previously wiped the bonus
    const abstractJokerInstance = initializeJoker(jokers.abstractJokerJoker, game)
    const buyable: BuyableCard = {
      type: 'jokerCard',
      card: abstractJokerInstance,
      price: jokers.abstractJokerJoker.price,
    }
    game.money = 999
    game.shopState.cardsForSale = [buyable]
    game.shopState.selectedCardId = abstractJokerInstance.id

    const afterPurchase = reduceGame(game, { type: 'SHOP_BUY_CARD' })
    const wj = afterPurchase.jokers.find(j => j.jokerId === 'weeJokerJoker')
    expect(wj?.metadata?.chipsBonus).toBe(24)
  })
})
