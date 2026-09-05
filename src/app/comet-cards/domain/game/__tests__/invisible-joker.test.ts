import { describe, expect, it } from 'vitest'

import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'

import { startRunWithJokers } from './helpers/start-run'

describe('Invisible Joker', () => {
  function setupGame(): GameState {
    return startRunWithJokers([jokers.jokerJoker, jokers.invisibleJoker])
  }

  it('counter starts at 0 and increments by 1 on each ROUND_END', () => {
    const started = setupGame()
    expect(started.jokers.find(j => j.jokerId === 'invisibleJoker')!.counter).toBe(0)

    const after1 = reduceGame(started, { type: 'ROUND_END' })
    const ij1 = after1.jokers.find(j => j.jokerId === 'invisibleJoker')!
    expect(ij1.counter).toBe(1)

    const after2 = reduceGame(after1, { type: 'ROUND_END' })
    const ij2 = after2.jokers.find(j => j.jokerId === 'invisibleJoker')!
    expect(ij2.counter).toBe(2)
  })

  it('counter caps at 2 and does not go beyond', () => {
    const started = setupGame()

    let state = reduceGame(started, { type: 'ROUND_END' })
    state = reduceGame(state, { type: 'ROUND_END' })
    state = reduceGame(state, { type: 'ROUND_END' })

    const ij = state.jokers.find(j => j.jokerId === 'invisibleJoker')!
    expect(ij.counter).toBe(2)
  })

  it('selling after 2 rounds duplicates a random joker (joker count stays the same)', () => {
    const started = setupGame()
    let state = reduceGame(started, { type: 'ROUND_END' })
    state = reduceGame(state, { type: 'ROUND_END' })

    const ij = state.jokers.find(j => j.jokerId === 'invisibleJoker')!
    expect(ij.counter).toBe(2)

    const withSelected = { ...state, gamePlayState: { ...state.gamePlayState, selectedJokerId: ij.id } }
    const afterSell = reduceGame(withSelected, { type: 'JOKER_SOLD' })

    // invisibleJoker was removed, but a joker was duplicated — count stays the same
    expect(afterSell.jokers.some(j => j.jokerId === 'invisibleJoker')).toBe(false)
    expect(afterSell.jokers.length).toBe(2)
  })

  it('selling before 2 rounds does NOT duplicate (joker count decreases by 1)', () => {
    const started = setupGame()

    const ij = started.jokers.find(j => j.jokerId === 'invisibleJoker')!
    expect(ij.counter).toBe(0)

    const withSelected = { ...started, gamePlayState: { ...started.gamePlayState, selectedJokerId: ij.id } }
    const afterSell = reduceGame(withSelected, { type: 'JOKER_SOLD' })

    // invisibleJoker was removed, no duplication — count decreases by 1
    expect(afterSell.jokers.some(j => j.jokerId === 'invisibleJoker')).toBe(false)
    expect(afterSell.jokers.length).toBe(1)

    // Control: the same sale with the counter at 2 does duplicate, so the
    // missing copy above is the threshold, not a joker that does nothing.
    let ripe = reduceGame(started, { type: 'ROUND_END' })
    ripe = reduceGame(ripe, { type: 'ROUND_END' })
    const ripeIj = ripe.jokers.find(j => j.jokerId === 'invisibleJoker')!
    const afterRipeSell = reduceGame(
      { ...ripe, gamePlayState: { ...ripe.gamePlayState, selectedJokerId: ripeIj.id } },
      { type: 'JOKER_SOLD' }
    )
    expect(afterRipeSell.jokers.length).toBe(2)
  })

  it('selling after 1 round does NOT duplicate (joker count decreases by 1)', () => {
    const started = setupGame()
    const state = reduceGame(started, { type: 'ROUND_END' })

    const ij = state.jokers.find(j => j.jokerId === 'invisibleJoker')!
    expect(ij.counter).toBe(1)

    const withSelected = { ...state, gamePlayState: { ...state.gamePlayState, selectedJokerId: ij.id } }
    const afterSell = reduceGame(withSelected, { type: 'JOKER_SOLD' })

    // invisibleJoker was removed, no duplication — count decreases by 1
    expect(afterSell.jokers.some(j => j.jokerId === 'invisibleJoker')).toBe(false)
    expect(afterSell.jokers.length).toBe(1)
  })
})
