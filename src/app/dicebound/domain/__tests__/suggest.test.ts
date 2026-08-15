import { describe, expect, it } from 'vitest'

import { MAX_SUGGESTION, SUGGESTION_COUNT, cleanSuggestions } from '@/app/dicebound/domain/suggest'

describe('cleanSuggestions', () => {
  it('keeps three plain lines as they were written', () => {
    const lines = [
      'I try to lever the chain off with the lantern hook.',
      'I ask Maren who she paid to chain this grate.',
      'I go under, and feel for the drain the water is leaving by.',
    ]
    expect(cleanSuggestions(lines)).toEqual(lines)
  })

  it('never offers the same move twice, whatever case it arrives in', () => {
    // The one failure this feature must not have. Three chips that all say the
    // obvious thing is worse than no chips at all — it tells the player the
    // scene has a single exit, which is exactly the narrowing that suggestions
    // are supposed to be worth risking.
    expect(
      cleanSuggestions(['I go for the latch.', 'I GO FOR THE LATCH.', 'I ask her about the book.'])
    ).toEqual(['I go for the latch.', 'I ask her about the book.'])
  })

  it('strips the list furniture a model adds when it thinks it is writing a list', () => {
    expect(
      cleanSuggestions(['- I run for the door.', '2. I shout for Maren.', '"I wait."'])
    ).toEqual(['I run for the door.', 'I shout for Maren.', 'I wait.'])
  })

  it('offers at most three, however many came back', () => {
    const many = ['I one.', 'I two.', 'I three.', 'I four.', 'I five.']
    expect(cleanSuggestions(many)).toHaveLength(SUGGESTION_COUNT)
  })

  it('drops anything that is not a usable string rather than rendering a hole', () => {
    expect(cleanSuggestions(['I run.', '', '   ', null, 42, { text: 'I hide.' }])).toEqual([
      'I run.',
    ])
  })

  it('is empty for anything that is not a list at all', () => {
    expect(cleanSuggestions(undefined)).toEqual([])
    expect(cleanSuggestions('I try to leave.')).toEqual([])
    expect(cleanSuggestions({ actions: ['I try to leave.'] })).toEqual([])
  })

  it('cuts an over-long line back to a word boundary, never mid-word', () => {
    // The cap is a guard against a model that answers with a paragraph, and on
    // a phone that paragraph would push the composer off the screen. But this
    // string is about to be dropped into a field the player edits, and half a
    // word is a worse starting point than a shorter sentence.
    const long = `I try to ${'wander '.repeat(40)}away`
    const [cut] = cleanSuggestions([long])

    expect(cut.length).toBeLessThanOrEqual(MAX_SUGGESTION)
    expect(cut).toMatch(/wander$/)
  })
})
