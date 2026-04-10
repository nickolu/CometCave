import { describe, expect, it } from 'vitest'

import {
  calculateStartingStats,
  CLASSES,
  RACES,
} from '@/app/tap-tap-adventure/config/characterOptions'

const getRace = (name: string) => RACES.find(r => r.name === name)!
const getClass = (name: string) => CLASSES.find(c => c.name === name)!

describe('calculateStartingStats', () => {
  it('Human Warrior gets STR 9, INT 6, LCK 6', () => {
    const stats = calculateStartingStats(getRace('Human'), getClass('Warrior'))
    expect(stats.strength).toBe(9)
    expect(stats.intelligence).toBe(6)
    expect(stats.luck).toBe(6)
  })

  it('Elf Mage gets STR 5, INT 10, LCK 6', () => {
    const stats = calculateStartingStats(getRace('Elf'), getClass('Mage'))
    expect(stats.strength).toBe(5)
    expect(stats.intelligence).toBe(10)
    expect(stats.luck).toBe(6)
  })

  it('Dwarf Rogue gets STR 8, INT 6, LCK 7', () => {
    const stats = calculateStartingStats(getRace('Dwarf'), getClass('Rogue'))
    expect(stats.strength).toBe(8)
    expect(stats.intelligence).toBe(6)
    expect(stats.luck).toBe(7)
  })

  it('Halfling Ranger gets STR 6, INT 7, LCK 8', () => {
    const stats = calculateStartingStats(getRace('Halfling'), getClass('Ranger'))
    expect(stats.strength).toBe(6)
    expect(stats.intelligence).toBe(7)
    expect(stats.luck).toBe(8)
  })

  it('calculates correctly for all race/class combinations', () => {
    for (const race of RACES) {
      for (const cls of CLASSES) {
        const stats = calculateStartingStats(race, cls)
        expect(stats.strength).toBe(5 + race.modifiers.strength + cls.modifiers.strength)
        expect(stats.intelligence).toBe(
          5 + race.modifiers.intelligence + cls.modifiers.intelligence
        )
        expect(stats.luck).toBe(5 + race.modifiers.luck + cls.modifiers.luck)
      }
    }
  })

  it('never produces a stat below the base minimum of 5', () => {
    for (const race of RACES) {
      for (const cls of CLASSES) {
        const stats = calculateStartingStats(race, cls)
        expect(stats.strength).toBeGreaterThanOrEqual(5)
        expect(stats.intelligence).toBeGreaterThanOrEqual(5)
        expect(stats.luck).toBeGreaterThanOrEqual(5)
      }
    }
  })

  it('never produces a stat above the maximum of 10', () => {
    for (const race of RACES) {
      for (const cls of CLASSES) {
        const stats = calculateStartingStats(race, cls)
        expect(stats.strength).toBeLessThanOrEqual(10)
        expect(stats.intelligence).toBeLessThanOrEqual(10)
        expect(stats.luck).toBeLessThanOrEqual(10)
      }
    }
  })
})
