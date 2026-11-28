import { describe, expect, it } from 'vitest'

import { buildSteps, needsHandoff, seatForSentence } from './rotation'

import type { Seat } from './types'

const human = (id: string): Seat => ({ id, kind: 'human', name: id })
const ai = (id: string): Seat => ({ id, kind: 'ai', name: id, personalityId: 'literal-lou' })

describe('buildSteps', () => {
  it.each([
    [4, 2],
    [4, 8],
    [6, 4],
    [10, 3],
    [10, 8],
  ])('has 2N+1 steps for N=%i, S=%i', (n, s) => {
    const steps = buildSteps(n, s)
    expect(steps).toHaveLength(2 * n + 1)
    expect(steps.filter(x => x.kind === 'image')).toHaveLength(n)
    expect(steps.filter(x => x.kind === 'write')).toHaveLength(n + 1)
  })

  it('alternates sentence and image, starting and ending on a sentence', () => {
    const steps = buildSteps(4, 3)
    expect(steps.map(s => s.kind)).toEqual([
      'write', 'image', 'write', 'image', 'write', 'image', 'write', 'image', 'write',
    ])
  })

  it('wraps the seat order when there are fewer seats than sentences', () => {
    const writers = buildSteps(6, 3).filter(s => s.kind === 'write').map(s => (s.kind === 'write' ? s.seatIndex : -1))
    expect(writers).toEqual([0, 1, 2, 0, 1, 2, 0])
  })

  it('leaves later seats unused when there are more seats than sentences', () => {
    const writers = buildSteps(4, 8).filter(s => s.kind === 'write').map(s => (s.kind === 'write' ? s.seatIndex : -1))
    expect(writers).toEqual([0, 1, 2, 3, 4])
  })
})

describe('seatForSentence', () => {
  it('wraps', () => {
    expect(seatForSentence(0, 3)).toBe(0)
    expect(seatForSentence(3, 3)).toBe(0)
    expect(seatForSentence(7, 4)).toBe(3)
  })
})

describe('needsHandoff', () => {
  it('never for a single human', () => {
    expect(needsHandoff(null, human('a'), 1)).toBe(false)
    expect(needsHandoff('a', human('a'), 1)).toBe(false)
  })

  it('not when the same human holds the device again, even after AI turns', () => {
    expect(needsHandoff('a', human('a'), 2)).toBe(false)
  })

  it('when a different human is next', () => {
    expect(needsHandoff('a', human('b'), 2)).toBe(true)
  })

  it('when nobody is known to hold the device and several humans play', () => {
    expect(needsHandoff(null, human('b'), 2)).toBe(true)
  })

  it('never for an AI writer', () => {
    expect(needsHandoff('a', ai('x'), 3)).toBe(false)
  })
})
