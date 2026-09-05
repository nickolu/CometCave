import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

import { startRunWithJokers } from './helpers/start-run'

describe('Cloud 9 joker', () => {
  function nineIds(game: GameState): string[] {
    return game.ownedCardIds.filter(id => {
      const card = game.cards[id]
      return card && playingCards[card.playingCardId]?.value === '9'
    })
  }

  it('earns $1 per 9 in deck at ROUND_END', () => {
    const started = startRunWithJokers([jokers.cloud9Joker])

    expect(nineIds(started)).toHaveLength(4) // standard deck has 4 nines

    const initialMoney = started.money
    const afterRound = reduceGame(started, { type: 'ROUND_END' })
    expect(afterRound.money).toBe(initialMoney + 4)
  })

  it('earns nothing if no 9s in deck', () => {
    const started = startRunWithJokers([jokers.cloud9Joker])

    // Remove all 9s from owned cards
    const nines = nineIds(started)
    const noNines: GameState = {
      ...started,
      ownedCardIds: started.ownedCardIds.filter(id => !nines.includes(id)),
    }

    const initialMoney = noNines.money
    const afterRound = reduceGame(noNines, { type: 'ROUND_END' })
    expect(afterRound.jokers.some(j => j.jokerId === 'cloud9Joker')).toBe(true)
    expect(afterRound.money).toBe(initialMoney)
  })
})
