import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'

describe('Steel Enchantment', () => {
  it('applies X1.5 Mult for a Steel card held in hand (not played)', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    // Pick one card to be steel and hold it in hand (not played)
    const steelCardId = game.ownedCardIds[0]
    game.cards[steelCardId].flags.enchantment = 'steel'

    game.gamePlayState.handIds = [steelCardId]
    game.gamePlayState.playedCardIds = []
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const afterScore = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })

    // A scoring event for Steel should exist with operator 'x' and value 1.5
    expect(
      afterScore.gamePlayState.scoringEvents.some(
        e => 'source' in e && e.source === 'Steel' && 'operator' in e && e.operator === 'x' && e.value === 1.5
      )
    ).toBe(true)
  })

  it('does not apply mult for a Steel card that was played', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    const steelCardId = game.ownedCardIds[0]
    game.cards[steelCardId].flags.enchantment = 'steel'

    // Card is in playedCardIds — it was played, so Steel should NOT fire
    game.gamePlayState.handIds = [steelCardId]
    game.gamePlayState.playedCardIds = [steelCardId]
    game.gamePlayState.score = { chips: 10, mult: 5 }

    const afterScore = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })

    expect(
      afterScore.gamePlayState.scoringEvents.some(
        e => 'source' in e && e.source === 'Steel'
      )
    ).toBe(false)
  })

  it('applies one scoring event per Steel card held in hand', () => {
    const game: GameState = structuredClone(defaultGameState)
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'

    // Two steel cards held, one non-steel
    const [id1, id2, id3] = game.ownedCardIds.slice(0, 3)
    game.cards[id1].flags.enchantment = 'steel'
    game.cards[id2].flags.enchantment = 'steel'

    game.gamePlayState.handIds = [id1, id2, id3]
    game.gamePlayState.playedCardIds = []
    game.gamePlayState.score = { chips: 10, mult: 4 }

    const afterScore = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })

    const steelEvents = afterScore.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Steel'
    )
    expect(steelEvents).toHaveLength(2)
  })
})
