import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('Hack joker', () => {
  it('card with value 3 gets retriggered (extra chips added)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.hack, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const threeId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '3'
    )!

    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[threeId]] },
    }, { type: 'CARD_SCORED' })

    const hackEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Hack'
    )
    expect(hackEvents).toHaveLength(1)
    // 3 baseChips = 3
    expect(hackEvents[0].value).toBe(3)
    expect(hackEvents[0].type).toBe('chips')
  })

  it('card with value K does NOT get retriggered', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.hack, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const kingId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'K'
    )!

    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[kingId]] },
    }, { type: 'CARD_SCORED' })

    const hackEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Hack'
    )
    expect(hackEvents).toHaveLength(0)
  })
})
