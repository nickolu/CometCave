import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Yorick', () => {
  function makeGameWithYorick(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.yorick, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('initializes counter to 23 and xMult to 100 on first discard', () => {
    const game = makeGameWithYorick()
    game.gamePlayState.selectedCardIds = ['card1', 'card2', 'card3']
    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const y = after.jokers.find(j => j.jokerId === 'yorick')
    expect(y?.counter).toBe(20) // 23 - 3 = 20
    expect(y?.metadata?.xMult).toBe(100) // no threshold crossed yet
  })

  it('gains X1 Mult after 23 cards discarded', () => {
    const game = makeGameWithYorick()
    // Discard 23 cards in one go
    game.gamePlayState.selectedCardIds = Array.from({ length: 23 }, (_, i) => `card${i}`)
    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const y = after.jokers.find(j => j.jokerId === 'yorick')
    expect(y?.metadata?.xMult).toBe(200) // gained X1, so now X2
    expect(y?.counter).toBe(23) // reset to 23
  })

  it('applies X Mult on HAND_SCORING_FINALIZE after gaining mult', () => {
    const game = makeGameWithYorick()
    // Discard 23 cards to gain X1 (now X2 total)
    game.gamePlayState.selectedCardIds = Array.from({ length: 23 }, (_, i) => `card${i}`)
    const afterDiscard = structuredClone(reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' }))
    // Verify Yorick state
    const y = afterDiscard.jokers.find(j => j.jokerId === 'yorick')
    expect(y?.metadata?.xMult).toBe(200) // X2
    // Set score and finalize
    afterDiscard.gamePlayState.score = { chips: 10, mult: 5 }
    const afterScore = reduceGame(afterDiscard, { type: 'HAND_SCORING_FINALIZE' })
    // Yorick should emit an X2 scoring event
    const yorickEvent = afterScore.gamePlayState.scoringEvents.find(
      (e: any) => e.source === 'Yorick'
    )
    expect(yorickEvent).toBeDefined()
    expect(yorickEvent).toMatchObject({ operator: 'x', value: 2, source: 'Yorick' })
  })

  it('does not apply mult when only X1 (no discards yet)', () => {
    const game = makeGameWithYorick()
    game.gamePlayState.score = { chips: 10, mult: 5 }
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    // Yorick should not emit a scoring event when xMult is still X1
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Yorick'
    )).toBe(false)
  })

  it('accumulates mult gains from multiple discard sets', () => {
    const game = makeGameWithYorick()
    // Discard 46 cards (2x threshold) in one go
    game.gamePlayState.selectedCardIds = Array.from({ length: 46 }, (_, i) => `card${i}`)
    const after = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const y = after.jokers.find(j => j.jokerId === 'yorick')
    expect(y?.metadata?.xMult).toBe(300) // X3
  })
})
