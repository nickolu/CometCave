import { describe, expect, it } from 'vitest'

import { detectAnswerLeak } from '@/lib/trivia/generateQuestion'

describe('detectAnswerLeak', () => {
  it('catches verbatim single-word leak (case-insensitive)', () => {
    expect(detectAnswerLeak('What is the Pythagorean theorem?', 'Pythagorean theorem')).toBe(true)
    expect(detectAnswerLeak('what is the PYTHAGOREAN theorem?', 'Pythagorean theorem')).toBe(true)
  })

  it('catches multi-word leak even when one word is missing', () => {
    // keyDetail is "2017 Australian Open" — leak fires if question has the
    // significant phrase "Australian Open" even without the year.
    expect(
      detectAnswerLeak('When did Serena Williams win at the Australian Open?', '2017 Australian Open')
    ).toBe(true)
  })

  it('does not flag when question genuinely avoids the answer', () => {
    expect(
      detectAnswerLeak(
        'At which Grand Slam tournament did Serena Williams win her 23rd and final singles title?',
        '2017 Australian Open'
      )
    ).toBe(false)
  })

  it('does not flag short keyDetails that would false-positive', () => {
    // "1986" is 4 chars but acceptable. Test the < 3 char guard.
    expect(detectAnswerLeak('What number comes after 5?', '6')).toBe(false)
  })

  it('returns false on empty inputs', () => {
    expect(detectAnswerLeak('', 'anything')).toBe(false)
    expect(detectAnswerLeak('a question', '')).toBe(false)
  })
})
