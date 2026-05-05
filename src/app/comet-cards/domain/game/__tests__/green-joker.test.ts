import { describe, expect, it } from 'vitest'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

describe('Green Joker', () => {
  function makeGameWithGreenJoker(): GameState {
    const game: GameState = structuredClone(defaultGameState)
    game.jokers = [initializeJoker(jokers.greenJoker, game)]
    game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
    game.gamePhase = 'gameplay'
    return game
  }

  it('counter increases by 1 on HAND_SCORING_FINALIZE and applies mult', () => {
    const game = makeGameWithGreenJoker()
    const after = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const gj = after.jokers.find(j => j.jokerId === 'greenJoker')
    expect(gj?.counter).toBe(1)
    expect(after.gamePlayState.scoringEvents.some(
      e => 'source' in e && e.source === 'Green Joker' && e.value === 1
    )).toBe(true)
  })

  it('accumulates mult across multiple hands', () => {
    const game = makeGameWithGreenJoker()
    const after1 = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const after2 = reduceGame(after1, { type: 'HAND_SCORING_FINALIZE' })
    const gj = after2.jokers.find(j => j.jokerId === 'greenJoker')
    expect(gj?.counter).toBe(2)
    // second HAND_SCORING_FINALIZE should add +2 Mult
    const events = after2.gamePlayState.scoringEvents.filter(
      e => 'source' in e && e.source === 'Green Joker'
    )
    expect(events.some(e => 'value' in e && e.value === 2)).toBe(true)
  })

  it('counter decreases by 1 on DISCARD_SELECTED_CARDS', () => {
    const game = makeGameWithGreenJoker()
    // Build counter to 2 first
    const after1 = reduceGame(game, { type: 'HAND_SCORING_FINALIZE' })
    const after2 = reduceGame(after1, { type: 'HAND_SCORING_FINALIZE' })
    const gj2 = after2.jokers.find(j => j.jokerId === 'greenJoker')
    expect(gj2?.counter).toBe(2)
    // Discard should reduce counter
    const afterDiscard = reduceGame(after2, { type: 'DISCARD_SELECTED_CARDS' })
    const gjAfterDiscard = afterDiscard.jokers.find(j => j.jokerId === 'greenJoker')
    expect(gjAfterDiscard?.counter).toBe(1)
  })

  it('counter does not go below 0 on DISCARD_SELECTED_CARDS', () => {
    const game = makeGameWithGreenJoker()
    // Counter starts at 0, discard should not make it negative
    const afterDiscard = reduceGame(game, { type: 'DISCARD_SELECTED_CARDS' })
    const gj = afterDiscard.jokers.find(j => j.jokerId === 'greenJoker')
    expect(gj?.counter).toBe(0)
  })
})
