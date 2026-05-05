import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import type { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'

function makeCard(id: string, enchantment: PlayingCardState['flags']['enchantment']): PlayingCardState {
  return {
    id,
    playingCardId: '5_hearts',
    bonusChips: 0,
    isFaceUp: true,
    flags: { edition: 'normal', enchantment, seal: 'none' },
  }
}

describe('Golden Ticket joker', () => {
  function createGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.goldenTicket, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('earns $4 when a Gold card is scored', () => {
    const game = createGame()
    const card = makeCard('card-gold', 'gold')
    game.cards['card-gold'] = card

    const moneyBefore = game.money
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.money).toBe(moneyBefore + 4)
  })

  it('earns nothing when a non-gold card is scored', () => {
    const game = createGame()
    const card = makeCard('card-bonus', 'bonus')
    game.cards['card-bonus'] = card

    const moneyBefore = game.money
    const after = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card] } },
      { type: 'CARD_SCORED' }
    )
    expect(after.money).toBe(moneyBefore)
  })

  it('earns $4 for each gold card scored separately', () => {
    const game = createGame()
    const card1 = makeCard('card-gold-1', 'gold')
    const card2 = makeCard('card-gold-2', 'gold')
    game.cards['card-gold-1'] = card1
    game.cards['card-gold-2'] = card2

    const moneyBefore = game.money

    const afterFirst = reduceGame(
      { ...game, gamePlayState: { ...game.gamePlayState, cardsToScore: [card1] } },
      { type: 'CARD_SCORED' }
    )
    const afterSecond = reduceGame(
      { ...afterFirst, gamePlayState: { ...afterFirst.gamePlayState, cardsToScore: [card2] } },
      { type: 'CARD_SCORED' }
    )
    expect(afterSecond.money).toBe(moneyBefore + 8)
  })
})
