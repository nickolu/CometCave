import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { BuyableCard } from '@/app/comet-cards/domain/shop/types'

import { inGameplay, startRunWithJokers } from './helpers/start-run'

describe('Spare Trousers joker', () => {
  function playHand(state: GameState, hand: 'twoPair' | 'pair'): GameState {
    return reduceGame(
      {
        ...state,
        gamePlayState: {
          ...state.gamePlayState,
          scoringEvents: [],
          selectedHand: [hand, []],
          score: { chips: 10, mult: 5 },
        },
      },
      { type: 'HAND_SCORING_FINALIZE' }
    )
  }

  it('gains +2 Mult and applies it on first Two Pair hand', () => {
    const started = inGameplay(startRunWithJokers([jokers.spareTrousersJoker]))

    // First hand: play a Two Pair - gains +2 and immediately applies it
    const after1 = playHand(started, 'twoPair')
    const st1 = after1.jokers.find(j => j.jokerId === 'spareTrousersJoker')
    expect(st1?.metadata?.multBonus).toBe(2)

    // Spare Trousers scoring event IS present on first hand (bonus incremented first, then applied)
    const spareEvent = after1.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Spare Trousers'
    )
    expect(spareEvent).toBeDefined()
    expect((spareEvent as { value: number }).value).toBe(2)
  })

  it('does not gain when non-Two Pair hand played', () => {
    const started = inGameplay(startRunWithJokers([jokers.spareTrousersJoker]))

    const after = playHand(started, 'pair')
    const st = after.jokers.find(j => j.jokerId === 'spareTrousersJoker')
    expect(st?.metadata?.multBonus).toBe(0)
  })

  it('applies +4 mult on second consecutive Two Pair hand', () => {
    const started = inGameplay(startRunWithJokers([jokers.spareTrousersJoker]))

    // First Two Pair hand: accumulates +2, applies +2
    const after1 = playHand(started, 'twoPair')

    // Second Two Pair hand: accumulates another +2 (total 4), applies +4
    const after2 = playHand(after1, 'twoPair')
    const st2 = after2.jokers.find(j => j.jokerId === 'spareTrousersJoker')
    expect(st2?.metadata?.multBonus).toBe(4)

    const spareEvent = after2.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'Spare Trousers'
    )
    expect(spareEvent).toBeDefined()
    expect((spareEvent as { value: number }).value).toBe(4)
  })

  it('does not reset accumulated multBonus when another joker is purchased (JOKER_ADDED)', () => {
    const game: GameState = structuredClone(defaultGameState)
    const spareTrousersInstance = initializeJoker(jokers.spareTrousersJoker, game)
    // Simulate accumulated bonus from playing Two Pair hands
    spareTrousersInstance.metadata = { multBonus: 6 }
    game.jokers = [spareTrousersInstance]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

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
    const st = afterPurchase.jokers.find(j => j.jokerId === 'spareTrousersJoker')
    expect(st?.metadata?.multBonus).toBe(6)
  })
})
