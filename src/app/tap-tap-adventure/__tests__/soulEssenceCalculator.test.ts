import { describe, it, expect } from 'vitest'
import { calculateSoulEssence } from '@/app/tap-tap-adventure/lib/soulEssenceCalculator'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

function makeCharacter(overrides: Partial<FantasyCharacter> = {}): FantasyCharacter {
  return {
    id: 'test-id',
    playerId: 'test-player',
    name: 'Test Hero',
    race: 'Human',
    class: 'Warrior',
    level: 1,
    abilities: [],
    locationId: '',
    gold: 0,
    reputation: 0,
    distance: 0,
    status: 'active',
    strength: 5,
    intelligence: 5,
    luck: 5,
    charisma: 6,
    hp: 50,
    maxHp: 50,
    inventory: [],
    equipment: { weapon: null, armor: null, accessory: null },
    deathCount: 0,
    pendingStatPoints: 0,
    mana: 20,
    maxMana: 20,
    spellbook: [],
    activeMount: null,
    difficultyMode: 'normal',
    ...overrides,
  }
}

describe('calculateSoulEssence', () => {
  it('calculates base distance essence (1 per 10 distance)', () => {
    const char = makeCharacter({ distance: 100, level: 1 })
    // 100/10 = 10 base + 1*5 level = 15
    expect(calculateSoulEssence(char)).toBe(15)
  })

  it('calculates level bonus (5 per level)', () => {
    const char = makeCharacter({ distance: 0, level: 5 })
    // 0 base + 5*5 level = 25
    expect(calculateSoulEssence(char)).toBe(25)
  })

  it('applies death count penalty', () => {
    const char = makeCharacter({ distance: 200, level: 3, deathCount: 3 })
    // 200/10 = 20 base + 3*5 = 35
    // death penalty: 1 - 0.3 = 0.7 -> 35 * 0.7 = 24.5 -> 24
    expect(calculateSoulEssence(char)).toBe(24)
  })

  it('caps death penalty at 50%', () => {
    const char = makeCharacter({ distance: 200, level: 3, deathCount: 10 })
    // 35 * 0.5 = 17.5 -> 17
    expect(calculateSoulEssence(char)).toBe(17)
  })

  it('applies casual difficulty multiplier (0.5x)', () => {
    const char = makeCharacter({ distance: 100, level: 1, difficultyMode: 'casual' })
    // 15 * 0.5 = 7.5 -> 7
    expect(calculateSoulEssence(char)).toBe(7)
  })

  it('applies hard difficulty multiplier (1.5x)', () => {
    const char = makeCharacter({ distance: 100, level: 1, difficultyMode: 'hard' })
    // 15 * 1.5 = 22.5 -> 22
    expect(calculateSoulEssence(char)).toBe(22)
  })

  it('applies ironman difficulty multiplier (2.5x)', () => {
    const char = makeCharacter({ distance: 100, level: 1, difficultyMode: 'ironman' })
    // 15 * 2.5 = 37.5 -> 37
    expect(calculateSoulEssence(char)).toBe(37)
  })

  it('returns minimum 1 essence for zero distance', () => {
    const char = makeCharacter({ distance: 0, level: 0 })
    expect(calculateSoulEssence(char)).toBe(1)
  })

  it('returns minimum 1 essence with high death count and low stats', () => {
    const char = makeCharacter({ distance: 5, level: 0, deathCount: 20, difficultyMode: 'casual' })
    // 0 base + 0 level = 0, penalty=0.5, diff=0.5 -> 0 -> max(1, 0) = 1
    expect(calculateSoulEssence(char)).toBe(1)
  })

  it('handles normal difficulty as default', () => {
    const char = makeCharacter({ distance: 100, level: 2 })
    // 10 + 10 = 20, no death penalty, normal=1x
    expect(calculateSoulEssence(char)).toBe(20)
  })

  it('handles undefined difficultyMode as normal', () => {
    const char = makeCharacter({ distance: 100, level: 2, difficultyMode: undefined })
    expect(calculateSoulEssence(char)).toBe(20)
  })
})
