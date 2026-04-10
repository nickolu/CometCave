import { describe, expect, it } from 'vitest'

import { getReputationTier } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { calculateEffectiveProbability } from '@/app/tap-tap-adventure/lib/eventResolution'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

describe('getReputationTier', () => {
  it('returns Infamous for reputation below -20', () => {
    expect(getReputationTier(-21)).toBe('Infamous')
    expect(getReputationTier(-100)).toBe('Infamous')
  })

  it('returns Disreputable for reputation -20 to -1', () => {
    expect(getReputationTier(-20)).toBe('Disreputable')
    expect(getReputationTier(-1)).toBe('Disreputable')
  })

  it('returns Unknown for reputation 0 to 19', () => {
    expect(getReputationTier(0)).toBe('Unknown')
    expect(getReputationTier(19)).toBe('Unknown')
  })

  it('returns Respected for reputation 20 to 49', () => {
    expect(getReputationTier(20)).toBe('Respected')
    expect(getReputationTier(49)).toBe('Respected')
  })

  it('returns Renowned for reputation 50 to 99', () => {
    expect(getReputationTier(50)).toBe('Renowned')
    expect(getReputationTier(99)).toBe('Renowned')
  })

  it('returns Legendary for reputation 100+', () => {
    expect(getReputationTier(100)).toBe('Legendary')
    expect(getReputationTier(500)).toBe('Legendary')
  })

  it('handles boundary values correctly', () => {
    expect(getReputationTier(-21)).toBe('Infamous')
    expect(getReputationTier(-20)).toBe('Disreputable')
    expect(getReputationTier(-1)).toBe('Disreputable')
    expect(getReputationTier(0)).toBe('Unknown')
    expect(getReputationTier(19)).toBe('Unknown')
    expect(getReputationTier(20)).toBe('Respected')
    expect(getReputationTier(49)).toBe('Respected')
    expect(getReputationTier(50)).toBe('Renowned')
    expect(getReputationTier(99)).toBe('Renowned')
    expect(getReputationTier(100)).toBe('Legendary')
  })
})

describe('reputation modifier on probability', () => {
  const baseChar: FantasyCharacter = {
    id: 'char-1',
    playerId: 'p1',
    name: 'Tester',
    race: 'Human',
    class: 'Fighter',
    level: 1,
    abilities: [],
    locationId: 'loc1',
    gold: 0,
    reputation: 0,
    distance: 0,
    status: 'active',
    strength: 10,
    intelligence: 10,
    luck: 5,
    inventory: [],
  }

  const optionWithAttrs = {
    id: 'opt-1',
    text: 'Test option',
    successProbability: 0.5,
    relevantAttributes: ['strength'],
    attributeModifiers: { strength: 0.01 },
    successDescription: '',
    successEffects: {},
    failureDescription: '',
    failureEffects: {},
    resultDescription: '',
  }

  it('positive reputation increases effective probability', () => {
    const highRepChar = { ...baseChar, reputation: 100 }
    const probBase = calculateEffectiveProbability(optionWithAttrs, baseChar)
    const probHigh = calculateEffectiveProbability(optionWithAttrs, highRepChar)
    expect(probHigh).toBeGreaterThan(probBase)
  })

  it('negative reputation decreases effective probability', () => {
    const lowRepChar = { ...baseChar, reputation: -100 }
    const probBase = calculateEffectiveProbability(optionWithAttrs, baseChar)
    const probLow = calculateEffectiveProbability(optionWithAttrs, lowRepChar)
    expect(probLow).toBeLessThan(probBase)
  })

  it('reputation modifier is capped at +0.1', () => {
    const extremeRepChar = { ...baseChar, reputation: 500 }
    const prob = calculateEffectiveProbability(optionWithAttrs, extremeRepChar)
    // base 0.5 + strength modifier (10 * 0.01 = 0.1) + rep modifier (capped at 0.1) = 0.7
    expect(prob).toBeCloseTo(0.7, 5)
  })

  it('reputation modifier is capped at -0.1', () => {
    const extremeNegRepChar = { ...baseChar, reputation: -500 }
    const prob = calculateEffectiveProbability(optionWithAttrs, extremeNegRepChar)
    // base 0.5 + strength modifier (10 * 0.01 = 0.1) + rep modifier (capped at -0.1) = 0.5
    expect(prob).toBeCloseTo(0.5, 5)
  })
})
