import { describe, expect, it } from 'vitest'

import { BLOCKLIST, joinSpaced, matchesBlocklist, normalize, squeeze } from './blocklist'

const LIST = ['sex', 'kill myself', 'cocaine', 'ass']

describe('normalize', () => {
  it('lowercases, strips accents, maps leetspeak and flattens punctuation', () => {
    expect(normalize('  CoCaïne!! ')).toBe('cocaine')
    expect(normalize('c0c41n3')).toBe('cocaine')
    expect(normalize('$3x')).toBe('sex')
    expect(normalize('k.i.l.l')).toBe('k i l l')
  })
  it('squeezes repeats and joins spaced letters', () => {
    expect(squeeze('fuuuuck')).toBe('fuck')
    expect(joinSpaced('s e x party')).toBe('sex party')
    expect(joinSpaced('a b')).toBe('a b')
  })
})

describe('matchesBlocklist', () => {
  it('matches case, leetspeak and spacing variants', () => {
    expect(matchesBlocklist('SEX', LIST)).toBe('sex')
    expect(matchesBlocklist('s3x', LIST)).toBe('sex')
    expect(matchesBlocklist('s.e.x', LIST)).toBe('sex')
    expect(matchesBlocklist('s e x', LIST)).toBe('sex')
    expect(matchesBlocklist('seeeex', LIST)).toBe('sex')
    expect(matchesBlocklist('c0caine', LIST)).toBe('cocaine')
  })
  it('matches multi-word phrases', () => {
    expect(matchesBlocklist('I will kill  myself', LIST)).toBe('kill myself')
    expect(matchesBlocklist('KILL-MYSELF', LIST)).toBe('kill myself')
  })
  it('matches simple endings', () => {
    expect(matchesBlocklist('some sexes', LIST)).toBe('sex')
  })
  it('does not match inside other words', () => {
    expect(matchesBlocklist('Essex is a county', LIST)).toBeNull()
    expect(matchesBlocklist('a classic glass of grass', LIST)).toBeNull()
    expect(matchesBlocklist('the assistant passed', LIST)).toBeNull()
    expect(matchesBlocklist('as a rule', LIST)).toBeNull()
  })
  it('does not squeeze short terms into common words', () => {
    // "ass" squeezed would be "as"
    expect(matchesBlocklist('as it was', LIST)).toBeNull()
    expect(matchesBlocklist('aaass', LIST)).toBeNull()
  })
  it('does not turn ordinary words into blocked ones by squeezing', () => {
    expect(matchesBlocklist('a tiny submarine bobs past a sleepy whale')).toBeNull()
    expect(matchesBlocklist('a bus full of cats going to school')).toBeNull()
  })
  it('lets ordinary kid sentences through the real list', () => {
    for (const s of [
      'A fox in a yellow raincoat splashes through a puddle.',
      'Three ducks ride a wooden boat across a calm pond.',
      'A snowman on a skateboard waves at 5 penguins.',
      'A class of cats studies the moon in a glass house.',
    ]) {
      expect(matchesBlocklist(s)).toBeNull()
    }
  })
  it('catches obvious terms in the real list', () => {
    expect(matchesBlocklist('a naked man')).not.toBeNull()
    expect(matchesBlocklist('how to make a b0mb')).not.toBeNull()
    expect(matchesBlocklist('build a bomb')).not.toBeNull()
  })
  it('has no empty entries', () => {
    expect(BLOCKLIST.every(t => normalize(t).length > 1)).toBe(true)
  })
})
