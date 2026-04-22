import { describe, expect, it } from 'vitest'

import { REGIONS } from '@/app/tap-tap-adventure/config/regions'
import {
  WEATHER_TYPES,
  REGION_WEATHER_POOLS,
  rollWeather,
  getWeatherType,
} from '@/app/tap-tap-adventure/config/weather'
import { getWeatherCombatModifiers } from '@/app/tap-tap-adventure/lib/combatEngine'
import { buildStoryContext } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

// Minimal character fixture
const baseChar: FantasyCharacter = {
  id: 'char-1',
  playerId: 'p1',
  name: 'Tundra',
  race: 'Human',
  class: 'Warrior',
  level: 5,
  abilities: [],
  locationId: 'loc1',
  gold: 50,
  reputation: 0,
  distance: 100,
  status: 'active',
  strength: 8,
  intelligence: 5,
  luck: 4,
  charisma: 6,
  inventory: [],
  deathCount: 0,
  pendingStatPoints: 0,
  difficultyMode: 'normal',
  currentRegion: 'frozen_peaks',
  currentWeather: 'clear',
  visitedRegions: ['green_meadows', 'frozen_peaks'],
  factionReputations: {},
}

describe('Weather Config', () => {
  it('WEATHER_TYPES has exactly 7 entries', () => {
    expect(Object.keys(WEATHER_TYPES)).toHaveLength(7)
  })

  it('all weather IDs are correct', () => {
    const expectedIds = ['clear', 'rain', 'storm', 'fog', 'blizzard', 'sandstorm', 'heat_wave']
    expect(Object.keys(WEATHER_TYPES).sort()).toEqual(expectedIds.sort())
  })

  it('all region IDs in REGION_WEATHER_POOLS exist in REGIONS', () => {
    for (const regionId of Object.keys(REGION_WEATHER_POOLS)) {
      expect(REGIONS[regionId]).toBeDefined()
    }
  })
})

describe('rollWeather', () => {
  it('starting_village always returns clear', () => {
    for (let i = 0; i < 100; i++) {
      expect(rollWeather('starting_village')).toBe('clear')
    }
  })

  it('frozen_peaks only returns weather from its pool', () => {
    const validIds = new Set(Object.keys(REGION_WEATHER_POOLS.frozen_peaks))
    for (let i = 0; i < 100; i++) {
      expect(validIds.has(rollWeather('frozen_peaks'))).toBe(true)
    }
  })

  it('unknown region falls back to clear', () => {
    expect(rollWeather('unknown_xyz_region')).toBe('clear')
  })
})

describe('getWeatherType', () => {
  it('returns correct type for known id', () => {
    const w = getWeatherType('blizzard')
    expect(w.id).toBe('blizzard')
    expect(w.name).toBe('Blizzard')
  })

  it('falls back to clear for unknown id', () => {
    const w = getWeatherType('unknown_weather')
    expect(w.id).toBe('clear')
  })
})

describe('getWeatherCombatModifiers', () => {
  it('returns neutral modifiers for clear', () => {
    const mods = getWeatherCombatModifiers('clear')
    expect(mods.accuracyPenalty).toBe(0)
    expect(mods.critBonus).toBe(0)
    expect(mods.fireMultiplier).toBe(1)
    expect(mods.iceMultiplier).toBe(1)
    expect(mods.lightningMultiplier).toBe(1)
  })

  it('returns neutral modifiers for undefined', () => {
    const mods = getWeatherCombatModifiers(undefined)
    expect(mods.accuracyPenalty).toBe(0)
    expect(mods.critBonus).toBe(0)
    expect(mods.fireMultiplier).toBe(1)
    expect(mods.iceMultiplier).toBe(1)
    expect(mods.lightningMultiplier).toBe(1)
  })

  it('blizzard returns positive ice multiplier and negative fire multiplier', () => {
    const mods = getWeatherCombatModifiers('blizzard')
    expect(mods.iceMultiplier).toBeGreaterThan(1)
    expect(mods.fireMultiplier).toBeLessThan(1)
    expect(mods.accuracyPenalty).toBeGreaterThan(0)
  })

  it('fog returns maximum accuracy penalty', () => {
    const mods = getWeatherCombatModifiers('fog')
    expect(mods.accuracyPenalty).toBe(0.15)
  })

  it('storm returns lightning damage boost', () => {
    const mods = getWeatherCombatModifiers('storm')
    expect(mods.lightningMultiplier).toBeGreaterThan(1)
  })

  it('heat_wave returns positive fire and negative ice multiplier', () => {
    const mods = getWeatherCombatModifiers('heat_wave')
    expect(mods.fireMultiplier).toBeGreaterThan(1)
    expect(mods.iceMultiplier).toBeLessThan(1)
  })
})

describe('buildStoryContext weather injection', () => {
  it('includes weather name and description when currentWeather is blizzard', () => {
    const char: FantasyCharacter = { ...baseChar, currentWeather: 'blizzard' }
    const ctx = buildStoryContext(char, [])
    expect(ctx).toContain('Blizzard')
  })

  it('does not include a weather line when currentWeather is clear', () => {
    const char: FantasyCharacter = { ...baseChar, currentWeather: 'clear' }
    const ctx = buildStoryContext(char, [])
    expect(ctx).not.toContain('Weather:')
  })

  it('does not include weather line when currentWeather is undefined (defaults to clear)', () => {
    const char: FantasyCharacter = { ...baseChar, currentWeather: undefined }
    const ctx = buildStoryContext(char, [])
    expect(ctx).not.toContain('Weather:')
  })
})
