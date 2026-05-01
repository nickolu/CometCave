import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('Walkie Talkie joker', () => {
  it('gives +10 Chips and +4 Mult on 10s and 4s', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.walkieTalkieJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const tenId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === '10'
    )!
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[tenId]] },
    }, { type: 'CARD_SCORED' })
    const wtEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Walkie Talkie'
    )
    expect(wtEvents.length).toBe(2) // chips + mult
  })

  it('no effect on other cards', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.walkieTalkieJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    const kingId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'K'
    )!
    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[kingId]] },
    }, { type: 'CARD_SCORED' })
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Walkie Talkie'
    )).toBe(false)
  })
})
