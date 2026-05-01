import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/daily-card-game/domain/game/default-game-state'
import { reduceGame } from '@/app/daily-card-game/domain/game/reduce-game'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'

describe('Hanging Chad joker', () => {
  it('first scored card gets 2 extra chip scoring events', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.hangingChad, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const aceId = Object.keys(game.cards).find(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )!

    const after = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[aceId]] },
    }, { type: 'CARD_SCORED' })

    const hangingChadEvents = after.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Hanging Chad'
    )
    expect(hangingChadEvents).toHaveLength(2)
    // Ace baseChips = 11
    expect(hangingChadEvents[0].value).toBe(11)
    expect(hangingChadEvents[1].value).toBe(11)
  })

  it('second scored card does NOT get extra triggers', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.hangingChad, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const aceIds = Object.keys(game.cards).filter(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )
    const [firstId, secondId] = aceIds

    // Score first card
    const afterFirst = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[firstId]] },
    }, { type: 'CARD_SCORED' })

    // Score second card
    const afterSecond = reduceGame({
      ...afterFirst,
      gamePlayState: { ...afterFirst.gamePlayState, cardsToScore: [afterFirst.cards[secondId]] },
    }, { type: 'CARD_SCORED' })

    const hangingChadEvents = afterSecond.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Hanging Chad'
    )
    // Only 2 events (from the first card), not 4
    expect(hangingChadEvents).toHaveLength(2)
  })

  it('counter resets on HAND_SCORING_START for new hand', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.hangingChad, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const aceIds = Object.keys(game.cards).filter(id =>
      playingCards[game.cards[id].playingCardId]?.value === 'A'
    )
    const [firstId, secondId] = aceIds

    // Score first card to trigger hanging chad (counter becomes 1)
    const afterFirst = reduceGame({
      ...game,
      gamePlayState: { ...game.gamePlayState, cardsToScore: [game.cards[firstId]] },
    }, { type: 'CARD_SCORED' })

    // Verify counter is 1
    const hcAfterFirst = afterFirst.jokers.find(j => j.jokerId === 'hangingChad')
    expect(hcAfterFirst?.counter).toBe(1)

    // Reset via HAND_SCORING_START
    const afterReset = reduceGame(afterFirst, { type: 'HAND_SCORING_START' })
    const hcAfterReset = afterReset.jokers.find(j => j.jokerId === 'hangingChad')
    expect(hcAfterReset?.counter).toBe(0)

    // Score another card - should trigger again since counter was reset
    const afterSecond = reduceGame({
      ...afterReset,
      gamePlayState: { ...afterReset.gamePlayState, cardsToScore: [afterReset.cards[secondId]] },
    }, { type: 'CARD_SCORED' })

    const hangingChadEvents = afterSecond.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Hanging Chad'
    )
    // Should have 2 new events after reset
    expect(hangingChadEvents.length).toBeGreaterThanOrEqual(2)
  })
})
