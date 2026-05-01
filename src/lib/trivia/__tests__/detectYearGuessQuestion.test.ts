import { describe, expect, it } from 'vitest'

import { detectYearGuessQuestion } from '@/lib/trivia/generateQuestion'

describe('detectYearGuessQuestion', () => {
  it('flags "in what year" with year answer', () => {
    expect(detectYearGuessQuestion('In what year was The Gunslinger published?', '1982')).toBe(true)
  })

  it('flags "in which year" with year answer', () => {
    expect(detectYearGuessQuestion('In which year did the Battle of Hastings occur?', '1066')).toBe(true)
  })

  it('flags "what year" anywhere in the question', () => {
    expect(detectYearGuessQuestion('What year was Pulp Fiction released?', '1994')).toBe(true)
  })

  it('flags "when was" with a year answer', () => {
    expect(detectYearGuessQuestion('When was the World Wide Web invented?', '1989')).toBe(true)
  })

  it('does not flag year-mentioning questions where the answer is not a year', () => {
    expect(
      detectYearGuessQuestion(
        'What event in 1066 reshaped England?',
        'Battle of Hastings'
      )
    ).toBe(false)
  })

  it('does not flag non-year questions even if the answer is a number', () => {
    expect(
      detectYearGuessQuestion('How many novels are in the Discworld series?', '41')
    ).toBe(false)
  })

  it('accepts year suffixes (AD/BC/CE/BCE) on the answer', () => {
    expect(detectYearGuessQuestion('In what year did Caesar cross the Rubicon?', '49 BC')).toBe(true)
    expect(detectYearGuessQuestion('In what year was the calendar reform?', '1582 CE')).toBe(true)
  })

  it('does not flag answers that are clearly not years (5+ digit numbers)', () => {
    expect(detectYearGuessQuestion('In what year did X happen?', '12345')).toBe(false)
  })

  it('does not flag questions about non-temporal "year" mentions', () => {
    // "year of the rabbit" doesn't ask FOR a year
    expect(detectYearGuessQuestion('Which animal represents the year 2023 in the Chinese zodiac?', 'Rabbit')).toBe(false)
  })
})
