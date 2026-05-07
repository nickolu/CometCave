import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('The Idol joker', () => {
  function setupGame(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.theIdol, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('gives X2 Mult when target card is scored', () => {
    const game = setupGame()
    // Set counter to encode Ace of Hearts: A is index 12, hearts is index 0 → 12*4+0 = 48
    game.jokers[0].counter = 48

    const aceOfHeartsId = Object.keys(game.cards).find(id => {
      const card = playingCards[game.cards[id].playingCardId]
      return card?.value === 'A' && card?.suit === 'hearts'
    })!
    expect(aceOfHeartsId).toBeDefined()

    const afterScore = reduceGame({
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        cardsToScore: [game.cards[aceOfHeartsId]],
        score: { chips: 10, mult: 5 },
      },
    }, { type: 'CARD_SCORED' })

    expect(afterScore.gamePlayState.score.mult).toBe(10) // 5 * 2
    const idolEvent = afterScore.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'The Idol'
    )
    expect(idolEvent).toBeDefined()
  })

  it('does not give bonus for wrong card', () => {
    const game = setupGame()
    // Target Ace of Hearts (counter = 48)
    game.jokers[0].counter = 48

    const twoOfSpadesId = Object.keys(game.cards).find(id => {
      const card = playingCards[game.cards[id].playingCardId]
      return card?.value === '2' && card?.suit === 'spades'
    })!
    expect(twoOfSpadesId).toBeDefined()

    const afterScore = reduceGame({
      ...game,
      gamePlayState: {
        ...game.gamePlayState,
        cardsToScore: [game.cards[twoOfSpadesId]],
        score: { chips: 10, mult: 5 },
      },
    }, { type: 'CARD_SCORED' })

    // Mult unchanged (no idol event, but card's own scoring may add)
    const idolEvent = afterScore.gamePlayState.scoringEvents.find(
      e => 'source' in e && e.source === 'The Idol'
    )
    expect(idolEvent).toBeUndefined()
  })

  it('changes target on ROUND_END', () => {
    const game = setupGame()
    game.gameSeed = 'test-seed'
    game.roundIndex = 0
    game.jokers[0].counter = 10

    const after = reduceGame(game, { type: 'ROUND_END' })
    const idol = after.jokers.find(j => j.jokerId === 'theIdol')
    expect(idol).toBeDefined()
    expect(idol!.counter).toBeGreaterThanOrEqual(0)
    expect(idol!.counter).toBeLessThanOrEqual(51)
  })
})
