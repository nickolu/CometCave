import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'

describe('Scholar joker', () => {
  it('gives +20 Chips and +4 Mult on Aces', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.scholarJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const aceId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )!
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[aceId]] },
    }, { type: 'CARD_SCORED' })
    const events = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Scholar'
    )
    expect(events.length).toBe(2)
  })

  it('no effect on non-Ace cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.scholarJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const twoId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '2'
    )!
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[twoId]] },
    }, { type: 'CARD_SCORED' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Scholar'
    )).toBe(false)
  })
})
