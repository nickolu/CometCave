import { describe, expect, it } from 'vitest'

import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Cloud 9 joker', () => {
  it('earns $1 per 9 in deck at ROUND_END', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.cloud9Joker, game)]
    const started = reduceGame(game, { type: 'GAME_START' })

    // Count 9s in the default deck
    const nineCount = started.ownedCardIds.filter(id => {
      const card = started.cards[id]
      return card && playingCards[card.playingCardId]?.value === '9'
    }).length

    expect(nineCount).toBe(4) // standard deck has 4 nines

    const initialMoney = started.money
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney + 4)
  })

  it('earns nothing if no 9s in deck', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.cloud9Joker, game)]
    const started = reduceGame(game, { type: 'GAME_START' })

    // Remove all 9s from owned cards
    const nineIds = started.ownedCardIds.filter(id => {
      const card = started.cards[id]
      return card && playingCards[card.playingCardId]?.value === '9'
    })

    const noNines: GameState = {
      ...started,
      ownedCardIds: started.ownedCardIds.filter(id => !nineIds.includes(id)),
    }

    const initialMoney = noNines.money
    const afterRound = reduceGame(noNines, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney)
  })
})
