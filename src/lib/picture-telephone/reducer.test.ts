import { describe, expect, it } from 'vitest'

import { defaultSeats, getPersonality } from './personalities'
import { INITIAL_STATE, MAX_AI_REJECTIONS, REJECTED_IMAGE_NOTICE, gameReducer } from './reducer'
import { STARTER_SENTENCES } from './starters'

import type { Action, GameState, Seat, Settings } from './types'

const human = (id: string, name = id): Seat => ({ id, kind: 'human', name })
const ai = (id: string, personalityId = 'literal-lou'): Seat => ({ id, kind: 'ai', name: id, personalityId })

const reduce = (state: GameState, ...actions: Action[]) => actions.reduce(gameReducer, state)

const start = (settings: Settings) => gameReducer(INITIAL_STATE, { type: 'START', settings })
const ok = (text: string): Action => ({ type: 'WORK_OK', result: { text } })
const img = (n: number): Action => ({ type: 'WORK_OK', result: { image: `img-${n}`, mock: true } })
const reject = (code: 'TEXT_REJECTED' | 'IMAGE_REJECTED'): Action => ({
  type: 'WORK_FAIL',
  error: { code, message: 'nope', retryable: false },
})

/** Plays a game to the end, answering jobs deterministically and humans with numbered lines. */
function playOut(state: GameState): { state: GameState; phases: string[] } {
  const phases: string[] = []
  let n = 0
  for (let guard = 0; guard < 200 && state.phase !== 'reveal'; guard++) {
    phases.push(state.phase)
    n++
    if (state.phase === 'handoff') state = gameReducer(state, { type: 'HANDOFF_READY' })
    else if (state.phase === 'turn') state = gameReducer(state, { type: 'SUBMIT_TEXT', text: `human sentence ${n}` })
    else if (state.job?.kind === 'image') state = gameReducer(state, img(n))
    else state = gameReducer(state, ok(`ai sentence number ${n}`))
  }
  return { state, phases }
}

describe('solo game (1 human + 3 AI, 4 pictures)', () => {
  const settings: Settings = { seats: defaultSeats('solo'), chainLength: 4 }

  it('starts on the human turn with no hand-off', () => {
    const s = start(settings)
    expect(s.phase).toBe('turn')
    expect(s.actorId).toBe(settings.seats[0].id)
  })

  it('reaches the reveal with 5 sentences and 4 images in order', () => {
    const { state } = playOut(start(settings))
    expect(state.phase).toBe('reveal')
    expect(state.entries.map(e => e.kind)).toEqual([
      'text', 'image', 'text', 'image', 'text', 'image', 'text', 'image', 'text',
    ])
    const writers = state.entries.filter(e => e.kind === 'text').map(e => (e.kind === 'text' ? e.seatId : ''))
    expect(writers).toEqual(['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-1'])
  })

  it('marks model-written sentences and keeps human ones plain', () => {
    const { state } = playOut(start(settings))
    const viaAi = state.entries.filter(e => e.kind === 'text').map(e => e.kind === 'text' && e.viaAi)
    expect(viaAi).toEqual([false, true, true, true, false])
  })

  it('asks for the image of the sentence just written, and describes the previous image', () => {
    let s = start(settings)
    s = gameReducer(s, { type: 'SUBMIT_TEXT', text: 'a cat on a mat' })
    expect(s.phase).toBe('working')
    expect(s.job).toMatchObject({ kind: 'image', input: 'a cat on a mat' })
    s = gameReducer(s, img(1))
    expect(s.job).toMatchObject({ kind: 'describe', input: 'img-1', seatId: 'seat-2', personalityId: 'literal-lou' })
  })
})

describe('group game (3 humans + 1 AI, 4 pictures)', () => {
  const settings: Settings = {
    seats: [human('a'), human('b'), human('c'), ai('x')],
    chainLength: 4,
  }

  it('shows a hand-off before each different human', () => {
    const { phases, state } = playOut(start(settings))
    expect(state.phase).toBe('reveal')
    // a (no hand-off), image, b (hand-off, turn), image, c (hand-off, turn), image, x, image, a (hand-off, turn)
    expect(phases).toEqual([
      'turn', 'working',
      'handoff', 'turn', 'working',
      'handoff', 'turn', 'working',
      'working', 'working',
      'handoff', 'turn',
    ])
  })

  it('the hand-off screen holds no content and Ready opens the turn', () => {
    let s = start(settings)
    s = reduce(s, { type: 'SUBMIT_TEXT', text: 'a cat on a mat' }, img(1))
    expect(s.phase).toBe('handoff')
    expect(s.actorId).toBe('b')
    expect(s.job).toBeNull()
    s = gameReducer(s, { type: 'HANDOFF_READY' })
    expect(s.phase).toBe('turn')
    expect(s.actorId).toBe('b')
  })
})

describe('AI starts', () => {
  const settings: Settings = { seats: [human('a'), ai('x')], chainLength: 4 }

  it('asks for a starter and then draws it', () => {
    let s = start(settings)
    s = gameReducer(s, { type: 'AI_STARTS' })
    expect(s.phase).toBe('working')
    expect(s.job).toMatchObject({ kind: 'starter', seatId: 'a' })
    s = gameReducer(s, ok('A fox in a yellow raincoat splashes through a puddle.'))
    expect(s.job).toMatchObject({ kind: 'image', input: 'A fox in a yellow raincoat splashes through a puddle.' })
    expect(s.entries[0]).toMatchObject({ kind: 'text', seatId: 'a', viaAi: true })
  })

  it('is only available on the opening turn', () => {
    let s = start(settings)
    s = reduce(s, { type: 'SUBMIT_TEXT', text: 'a cat on a mat' }, img(1), ok('a fine line here'), img(2))
    const before = s
    expect(gameReducer(s, { type: 'AI_STARTS' })).toBe(before)
  })

  it('an AI seat in seat 0 writes the opening itself', () => {
    const s = start({ seats: [ai('x'), human('a')], chainLength: 4 })
    expect(s.phase).toBe('working')
    expect(s.job).toMatchObject({ kind: 'starter', seatId: 'x' })
  })
})

describe('rejections', () => {
  const settings: Settings = { seats: [human('a'), human('b'), ai('x', 'poet-pat')], chainLength: 4 }

  it('a rejected human sentence goes back to the same human with a notice, dropping the entry', () => {
    let s = start(settings)
    s = reduce(s, { type: 'SUBMIT_TEXT', text: 'a cat on a mat' }, img(1), { type: 'HANDOFF_READY' })
    s = gameReducer(s, { type: 'SUBMIT_TEXT', text: 'something unfit to draw' })
    expect(s.job?.kind).toBe('image')
    s = gameReducer(s, reject('IMAGE_REJECTED'))
    expect(s.phase).toBe('turn')
    expect(s.actorId).toBe('b')
    expect(s.notice).toBe(REJECTED_IMAGE_NOTICE)
    expect(s.entries.map(e => e.kind)).toEqual(['text', 'image'])
    // Same human, no hand-off, and the game goes on from there.
    s = gameReducer(s, { type: 'SUBMIT_TEXT', text: 'a nicer thing to draw' })
    expect(s.phase).toBe('working')
    expect(s.notice).toBeNull()
  })

  it('a rejected opening sentence returns to the opening turn', () => {
    let s = start(settings)
    s = reduce(s, { type: 'SUBMIT_TEXT', text: 'bad opener here' }, reject('TEXT_REJECTED'))
    expect(s.phase).toBe('turn')
    expect(s.entries).toEqual([])
    expect(s.stepIndex).toBe(0)
  })

  it('an AI writer that keeps being rejected ends up on its fallback line', () => {
    const fallback = getPersonality('poet-pat').fallbackLines
    let s = start({ seats: [human('a'), ai('x', 'poet-pat')], chainLength: 4 })
    s = reduce(s, { type: 'SUBMIT_TEXT', text: 'a cat on a mat' }, img(1))
    expect(s.job).toMatchObject({ kind: 'describe', seatId: 'x' })
    for (let i = 0; i < MAX_AI_REJECTIONS; i++) {
      s = gameReducer(s, reject('TEXT_REJECTED'))
      expect(s.phase).toBe('working')
      expect(s.job?.kind).toBe('describe')
    }
    s = gameReducer(s, reject('TEXT_REJECTED'))
    const line = s.entries[s.entries.length - 1]
    expect(line).toMatchObject({ kind: 'text', seatId: 'x', viaAi: true, fallback: true })
    expect(fallback).toContain((line as { text: string }).text)
    expect(s.job?.kind).toBe('image')
  })

  it('an AI sentence whose picture is rejected is rewritten, then falls back', () => {
    let s = start({ seats: [human('a'), ai('x', 'poet-pat')], chainLength: 4 })
    s = reduce(s, { type: 'SUBMIT_TEXT', text: 'a cat on a mat' }, img(1), ok('a poetic line here'))
    expect(s.job?.kind).toBe('image')
    for (let i = 0; i < MAX_AI_REJECTIONS; i++) {
      s = gameReducer(s, reject('IMAGE_REJECTED'))
      expect(s.job).toMatchObject({ kind: 'describe', input: 'img-1' })
      s = gameReducer(s, ok('another poetic line'))
      expect(s.job?.kind).toBe('image')
    }
    s = gameReducer(s, reject('IMAGE_REJECTED'))
    expect(s.job).toMatchObject({ kind: 'image' })
    expect(s.entries[s.entries.length - 1]).toMatchObject({ fallback: true })
    // A fallback that still fails is a plain error with Retry, not a loop.
    s = gameReducer(s, reject('IMAGE_REJECTED'))
    expect(s.error).toMatchObject({ retryable: true })
    expect(s.phase).toBe('working')
  })

  it('a rejected AI opening uses a hand-written starter', () => {
    let s = start({ seats: [human('a'), ai('x')], chainLength: 4 })
    s = gameReducer(s, { type: 'AI_STARTS' })
    for (let i = 0; i <= MAX_AI_REJECTIONS; i++) s = gameReducer(s, reject('TEXT_REJECTED'))
    const first = s.entries[0]
    expect(first).toMatchObject({ kind: 'text', fallback: true })
    expect(STARTER_SENTENCES).toContain((first as { text: string }).text)
  })

  it('a model reply that cleans down to nothing counts as a rejection', () => {
    let s = start({ seats: [human('a'), ai('x')], chainLength: 4 })
    s = reduce(s, { type: 'SUBMIT_TEXT', text: 'a cat on a mat' }, img(1), ok('  '))
    expect(s.job?.kind).toBe('describe')
    expect(s.attempts).toBe(1)
  })
})

describe('errors and retry', () => {
  const settings: Settings = { seats: [human('a'), ai('x')], chainLength: 4 }

  it('keeps the working phase with an error, and Retry runs a fresh job', () => {
    let s = start(settings)
    s = gameReducer(s, { type: 'SUBMIT_TEXT', text: 'a cat on a mat' })
    const job = s.job
    s = gameReducer(s, { type: 'WORK_FAIL', error: { code: 'UPSTREAM', message: 'down', retryable: true } })
    expect(s.phase).toBe('working')
    expect(s.error?.message).toBe('down')
    s = gameReducer(s, { type: 'RETRY' })
    expect(s.error).toBeNull()
    expect(s.phase).toBe('working')
    expect(s.job).toEqual(job)
    expect(s.job).not.toBe(job)
  })

  it('Retry without an error does nothing', () => {
    const s = reduce(start(settings), { type: 'SUBMIT_TEXT', text: 'a cat on a mat' })
    expect(gameReducer(s, { type: 'RETRY' })).toBe(s)
  })
})

describe('guards', () => {
  const settings: Settings = { seats: [human('a'), human('b')], chainLength: 4 }

  it('ignores invalid settings', () => {
    expect(gameReducer(INITIAL_STATE, { type: 'START', settings: { seats: [human('a')], chainLength: 4 } })).toBe(INITIAL_STATE)
  })

  it('ignores actions in the wrong phase', () => {
    const setup = INITIAL_STATE
    expect(gameReducer(setup, { type: 'SUBMIT_TEXT', text: 'a cat on a mat' })).toBe(setup)
    expect(gameReducer(setup, { type: 'HANDOFF_READY' })).toBe(setup)
    expect(gameReducer(setup, { type: 'AI_STARTS' })).toBe(setup)
    expect(gameReducer(setup, ok('hello there'))).toBe(setup)

    const working = reduce(start(settings), { type: 'SUBMIT_TEXT', text: 'a cat on a mat' })
    expect(working.phase).toBe('working')
    expect(gameReducer(working, { type: 'SUBMIT_TEXT', text: 'sneaky second line' })).toBe(working)
    expect(gameReducer(working, { type: 'HANDOFF_READY' })).toBe(working)
    // A text result for an image job is not accepted.
    expect(gameReducer(working, ok('wrong kind of result'))).toBe(working)
  })

  it('ignores a sentence that is too short', () => {
    const s = start(settings)
    expect(gameReducer(s, { type: 'SUBMIT_TEXT', text: ' a ' })).toBe(s)
  })

  it('RESET returns to setup', () => {
    const s = reduce(start(settings), { type: 'SUBMIT_TEXT', text: 'a cat on a mat' }, { type: 'RESET' })
    expect(s).toEqual(INITIAL_STATE)
  })

  it('Play again is a fresh START with the same settings', () => {
    const { state } = playOut(start(settings))
    const again = gameReducer(state, { type: 'START', settings: state.settings! })
    expect(again.phase).toBe('turn')
    expect(again.entries).toEqual([])
  })
})
