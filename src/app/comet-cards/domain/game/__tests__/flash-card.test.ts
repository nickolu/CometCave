import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { BuyableCard } from '@/app/comet-cards/domain/shop/types'

describe('Flash Card joker', () => {
  it('gains +2 Mult on SHOP_REROLL', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.flashCardJoker, game)]
    game.gamePhase = 'shop'
    game.shopState.isOpen = true
    const started = reduceGame(game, { type: 'GAME_START' })
    const afterReroll = reduceGame({ ...started, gamePhase: 'shop', shopState: { ...started.shopState, isOpen: true } }, { type: 'SHOP_REROLL' })
    const fc = afterReroll.jokers.find(j => j.jokerId === 'flashCardJoker')
    expect(fc?.metadata?.multBonus).toBe(2)
  })

  it('does not add Mult on HAND_SCORING_FINALIZE when no rerolls', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.flashCardJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const started = reduceGame(game, { type: 'GAME_START' })
    const afterScore = reduceGame(started, { type: 'HAND_SCORING_FINALIZE' })
    expect(afterScore.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Flash Card'
    )).toBe(false)
  })

  it('does not reset accumulated multBonus when another joker is purchased (JOKER_ADDED)', () => {
    const game: GameState = structuredClone(defaultGameState)
    const flashCardInstance = initializeJoker(jokers.flashCardJoker, game)
    // Simulate accumulated bonus from shop rerolls
    flashCardInstance.metadata = { multBonus: 10 }
    game.jokers = [flashCardInstance]

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
    const fc = afterPurchase.jokers.find(j => j.jokerId === 'flashCardJoker')
    expect(fc?.metadata?.multBonus).toBe(10)
  })
})
