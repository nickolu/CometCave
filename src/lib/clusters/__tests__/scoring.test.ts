import { describe, expect, it } from 'vitest'

import type { ClusterGroup, GuessRecord } from '@/app/clusters/models/clusters'
import { evaluateGuess, guessKey, validateGuess } from '@/lib/clusters/scoring'

// The real day-one puzzle (NYT 2023-06-12), so the fixtures are honest.
const GROUPS: ClusterGroup[] = [
  { tier: 'yellow', title: 'WET WEATHER', words: ['HAIL', 'RAIN', 'SLEET', 'SNOW'] },
  { tier: 'green', title: 'NBA TEAMS', words: ['BUCKS', 'HEAT', 'JAZZ', 'NETS'] },
  { tier: 'blue', title: 'KEYBOARD KEYS', words: ['OPTION', 'RETURN', 'SHIFT', 'TAB'] },
  { tier: 'purple', title: 'PALINDROMES', words: ['KAYAK', 'LEVEL', 'MOM', 'RACECAR'] },
]

const LAYOUT = [
  'SNOW', 'LEVEL', 'SHIFT', 'KAYAK',
  'HEAT', 'TAB', 'BUCKS', 'RETURN',
  'JAZZ', 'HAIL', 'OPTION', 'RAIN',
  'SLEET', 'RACECAR', 'MOM', 'NETS',
]

const noHistory: GuessRecord[] = []

describe('validateGuess', () => {
  it('accepts four distinct words that are all on the board', () => {
    expect(validateGuess(LAYOUT, ['HAIL', 'RAIN', 'SLEET', 'SNOW'], [])).toBeNull()
  })

  it('rejects the wrong number of words', () => {
    expect(validateGuess(LAYOUT, ['HAIL', 'RAIN', 'SLEET'], [])).toBe('wrong-size')
    expect(validateGuess(LAYOUT, ['HAIL', 'RAIN', 'SLEET', 'SNOW', 'TAB'], [])).toBe('wrong-size')
  })

  it('rejects the same word sent twice', () => {
    expect(validateGuess(LAYOUT, ['HAIL', 'HAIL', 'SLEET', 'SNOW'], [])).toBe('duplicate-words')
  })

  it('rejects a word that is not on this board', () => {
    expect(validateGuess(LAYOUT, ['HAIL', 'RAIN', 'SLEET', 'BANANA'], [])).toBe('unknown-word')
  })

  it('rejects words from a group already solved', () => {
    const solved = ['HAIL', 'RAIN', 'SLEET', 'SNOW']
    expect(validateGuess(LAYOUT, ['HAIL', 'TAB', 'SHIFT', 'OPTION'], solved)).toBe('already-solved')
  })

  it('is case-insensitive about what is on the board', () => {
    expect(validateGuess(LAYOUT, ['hail', 'rain', 'sleet', 'snow'], [])).toBeNull()
  })
})

describe('evaluateGuess', () => {
  it('names the group on an exact match and charges nothing', () => {
    const out = evaluateGuess(GROUPS, ['BUCKS', 'HEAT', 'JAZZ', 'NETS'], [], noHistory)
    expect(out.result).toBe('correct')
    expect(out.group?.title).toBe('NBA TEAMS')
    expect(out.mistakeDelta).toBe(0)
  })

  it('reports one-away when exactly three share a group', () => {
    const out = evaluateGuess(GROUPS, ['BUCKS', 'HEAT', 'JAZZ', 'SNOW'], [], noHistory)
    expect(out.result).toBe('one-away')
  })

  it('still charges a mistake for one-away', () => {
    const out = evaluateGuess(GROUPS, ['BUCKS', 'HEAT', 'JAZZ', 'SNOW'], [], noHistory)
    expect(out.mistakeDelta).toBe(1)
  })

  it('reports a plain miss when the best overlap is two', () => {
    const out = evaluateGuess(GROUPS, ['BUCKS', 'HEAT', 'KAYAK', 'LEVEL'], [], noHistory)
    expect(out.result).toBe('wrong')
    expect(out.mistakeDelta).toBe(1)
  })

  it('takes the best overlap across all groups, not the first match', () => {
    // Two overlap with WET WEATHER, three with KEYBOARD KEYS. The later
    // group is the one that matters, so a first-match scan would miss it.
    const out = evaluateGuess(GROUPS, ['SNOW', 'RAIN', 'TAB', 'SHIFT'], [], noHistory)
    expect(out.result).toBe('wrong')

    const away = evaluateGuess(GROUPS, ['SNOW', 'TAB', 'SHIFT', 'OPTION'], [], noHistory)
    expect(away.result).toBe('one-away')
  })

  it('ignores groups already solved when measuring overlap', () => {
    // With WET WEATHER solved, three-of-WET-WEATHER can no longer be
    // reached, so this must not report one-away against it.
    const out = evaluateGuess(GROUPS, ['TAB', 'SHIFT', 'OPTION', 'MOM'], ['yellow'], noHistory)
    expect(out.result).toBe('one-away')
  })

  it('rejects a repeat of an earlier guess with no penalty', () => {
    const history: GuessRecord[] = [
      { words: ['BUCKS', 'HEAT', 'JAZZ', 'SNOW'], result: 'one-away', guessId: 'g1' },
    ]
    const out = evaluateGuess(GROUPS, ['SNOW', 'JAZZ', 'HEAT', 'BUCKS'], [], history)
    expect(out.result).toBe('duplicate')
    expect(out.mistakeDelta).toBe(0)
  })

  it('treats a repeat as a repeat regardless of selection order or case', () => {
    const history: GuessRecord[] = [
      { words: ['BUCKS', 'HEAT', 'JAZZ', 'NETS'], result: 'correct', guessId: 'g1' },
    ]
    const out = evaluateGuess(GROUPS, ['nets', 'jazz', 'heat', 'bucks'], [], history)
    expect(out.result).toBe('duplicate')
  })
})

describe('guessKey', () => {
  it('is order- and case-independent', () => {
    expect(guessKey(['b', 'a', 'D', 'c'])).toBe(guessKey(['A', 'B', 'c', 'd']))
  })

  it('separates different sets', () => {
    expect(guessKey(['A', 'B', 'C', 'D'])).not.toBe(guessKey(['A', 'B', 'C', 'E']))
  })
})
