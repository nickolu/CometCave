import { describe, expect, it } from 'vitest'

import { defaultSeats } from './personalities'
import { SENTENCE_MAX, cleanName, cleanSentence, validateSettings } from './settings'

import type { Settings } from './types'

const solo = (): Settings => ({ seats: defaultSeats('solo'), chainLength: 6 })

describe('validateSettings', () => {
  it('accepts the default solo and group setups', () => {
    expect(validateSettings(solo()).ok).toBe(true)
    expect(validateSettings({ seats: defaultSeats('group'), chainLength: 6 }).ok).toBe(true)
  })

  it('needs 2 to 8 seats', () => {
    const one = { ...solo(), seats: solo().seats.slice(0, 1) }
    expect(validateSettings(one).ok).toBe(false)
    const nine = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, kind: 'human' as const, name: `P${i}` }))
    expect(validateSettings({ seats: nine, chainLength: 6 }).ok).toBe(false)
    expect(validateSettings({ seats: nine.slice(0, 8), chainLength: 6 }).ok).toBe(true)
  })

  it('needs at least one human', () => {
    const seats = solo().seats.map(s => ({ ...s, kind: 'ai' as const }))
    expect(validateSettings({ seats, chainLength: 6 }).ok).toBe(false)
  })

  it('bounds the chain at 4 to 10 whole pictures', () => {
    expect(validateSettings({ ...solo(), chainLength: 3 }).ok).toBe(false)
    expect(validateSettings({ ...solo(), chainLength: 4 }).ok).toBe(true)
    expect(validateSettings({ ...solo(), chainLength: 10 }).ok).toBe(true)
    expect(validateSettings({ ...solo(), chainLength: 11 }).ok).toBe(false)
    expect(validateSettings({ ...solo(), chainLength: 5.5 }).ok).toBe(false)
  })

  it('rejects blank names and duplicate seat ids', () => {
    const seats = solo().seats
    expect(validateSettings({ seats: [{ ...seats[0], name: '   ' }, ...seats.slice(1)], chainLength: 6 }).ok).toBe(false)
    expect(validateSettings({ seats: [seats[0], { ...seats[1], id: seats[0].id }], chainLength: 6 }).ok).toBe(false)
  })
})

describe('cleanSentence', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanSentence('  a   cat \n on\ta mat  ')).toBe('a cat on a mat')
  })

  it('strips control characters', () => {
    expect(cleanSentence('a\u0000 big\u0007 dog')).toBe('a big dog')
  })

  it('caps the length', () => {
    const out = cleanSentence('word '.repeat(100))
    expect(out).not.toBeNull()
    expect(out!.length).toBeLessThanOrEqual(SENTENCE_MAX)
  })

  it('is null when too short', () => {
    expect(cleanSentence('  ')).toBeNull()
    expect(cleanSentence('hi')).toBeNull()
    expect(cleanSentence('cat')).toBe('cat')
  })
})

describe('cleanName', () => {
  it('trims and caps', () => {
    expect(cleanName('  Sam  ')).toBe('Sam')
    expect(cleanName('x'.repeat(40)).length).toBe(16)
  })
})
