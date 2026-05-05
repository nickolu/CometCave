import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Rough Gem joker', () => {
  it('earns $1 when a Diamond card is scored', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.roughGemJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    // Find a diamond card
    const diamondId = Object.keys(game.cards).find(id => {
      const card = game.cards[id]
      return playingCards[card.playingCardId]?.suit === 'diamonds'
    })!

    const initialMoney = game.money
    const afterScore = reduceGame({
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        cardsToScore: [game.cards[diamondId]],
      },
    }, { type: 'CARD_SCORED' })
    expect(afterScore.money).toBe(initialMoney + 1)
  })

  it('does not earn money for non-Diamond cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.roughGemJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    // Find a hearts card
    const heartsId = Object.keys(game.cards).find(id => {
      const card = game.cards[id]
      return playingCards[card.playingCardId]?.suit === 'hearts'
    })!

    const initialMoney = game.money
    const afterScore = reduceGame({
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        cardsToScore: [game.cards[heartsId]],
      },
    }, { type: 'CARD_SCORED' })
    expect(afterScore.money).toBe(initialMoney)
  })
})
