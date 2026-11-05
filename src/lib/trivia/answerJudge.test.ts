import { describe, expect, it } from 'vitest'

import { matchesPlainly } from '@/lib/trivia/answerJudge'

describe('matchesPlainly', () => {
  it('ignores case, punctuation, whitespace and a leading article', () => {
    expect(matchesPlainly('  the BEATLES! ', 'Beatles')).toBe(true)
    expect(matchesPlainly('lord of the rings', 'The Lord of the Rings')).toBe(true)
    expect(matchesPlainly("O'Brien", 'OBrien')).toBe(true)
  })

  it('accepts one whole word of a multi-word answer', () => {
    expect(matchesPlainly('Einstein', 'Albert Einstein')).toBe(true)
    expect(matchesPlainly('Al', 'Albert Einstein')).toBe(false) // too short to be a real pick
    expect(matchesPlainly('Ein', 'Albert Einstein')).toBe(false) // not a whole word
  })

  it('does not accept a word of a single-word answer, or a different answer', () => {
    expect(matchesPlainly('Paris', 'Parish')).toBe(false)
    expect(matchesPlainly('Mars', 'Venus')).toBe(false)
    expect(matchesPlainly('1986', '1968')).toBe(false)
  })

  it('refuses empty input and attempts to game the judge', () => {
    expect(matchesPlainly('', 'anything')).toBe(false)
    expect(matchesPlainly('correct', 'correct')).toBe(false)
    expect(matchesPlainly('the answer', 'the answer')).toBe(false)
  })
})
