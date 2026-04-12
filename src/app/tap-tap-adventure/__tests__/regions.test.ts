import { describe, expect, it } from 'vitest'

import {
  REGIONS,
  getRegion,
  getConnectedRegions,
  canEnterRegion,
  CROSSROADS_INTERVAL,
} from '@/app/tap-tap-adventure/config/regions'

describe('Region definitions', () => {
  it('should define all expected regions', () => {
    const expectedIds = [
      'starting_village',
      'green_meadows',
      'dark_forest',
      'crystal_caves',
      'scorched_wastes',
      'frozen_peaks',
      'shadow_realm',
      'sky_citadel',
    ]
    for (const id of expectedIds) {
      expect(REGIONS[id]).toBeDefined()
      expect(REGIONS[id].id).toBe(id)
    }
  })

  it('should have valid connected regions (all connected regions exist)', () => {
    for (const region of Object.values(REGIONS)) {
      for (const connectedId of region.connectedRegions) {
        expect(
          REGIONS[connectedId],
          `Region "${region.id}" references non-existent connected region "${connectedId}"`
        ).toBeDefined()
      }
    }
  })

  it('should have bidirectional connections', () => {
    for (const region of Object.values(REGIONS)) {
      for (const connectedId of region.connectedRegions) {
        const connected = REGIONS[connectedId]
        expect(
          connected.connectedRegions,
          `Region "${connectedId}" should connect back to "${region.id}"`
        ).toContain(region.id)
      }
    }
  })

  it('should have correct difficulty multipliers', () => {
    expect(REGIONS.starting_village.difficultyMultiplier).toBe(0.5)
    expect(REGIONS.green_meadows.difficultyMultiplier).toBe(0.8)
    expect(REGIONS.dark_forest.difficultyMultiplier).toBe(1.0)
    expect(REGIONS.crystal_caves.difficultyMultiplier).toBe(1.0)
    expect(REGIONS.scorched_wastes.difficultyMultiplier).toBe(1.5)
    expect(REGIONS.frozen_peaks.difficultyMultiplier).toBe(1.5)
    expect(REGIONS.shadow_realm.difficultyMultiplier).toBe(2.0)
    expect(REGIONS.sky_citadel.difficultyMultiplier).toBe(2.0)
  })

  it('should have valid difficulty multipliers (positive numbers)', () => {
    for (const region of Object.values(REGIONS)) {
      expect(region.difficultyMultiplier).toBeGreaterThan(0)
    }
  })

  it('should have valid difficulty levels', () => {
    const validDifficulties = ['easy', 'medium', 'hard', 'very_hard']
    for (const region of Object.values(REGIONS)) {
      expect(validDifficulties).toContain(region.difficulty)
    }
  })
})

describe('Min level requirements', () => {
  it('starting areas should have no level requirement', () => {
    expect(REGIONS.starting_village.minLevel).toBe(0)
    expect(REGIONS.green_meadows.minLevel).toBe(0)
    expect(REGIONS.dark_forest.minLevel).toBe(0)
    expect(REGIONS.crystal_caves.minLevel).toBe(0)
  })

  it('hard regions should require level 3', () => {
    expect(REGIONS.scorched_wastes.minLevel).toBe(3)
    expect(REGIONS.frozen_peaks.minLevel).toBe(3)
  })

  it('very hard regions should require higher levels', () => {
    expect(REGIONS.shadow_realm.minLevel).toBe(5)
    expect(REGIONS.sky_citadel.minLevel).toBe(7)
  })

  it('canEnterRegion should respect min level', () => {
    expect(canEnterRegion(REGIONS.green_meadows, 1)).toBe(true)
    expect(canEnterRegion(REGIONS.scorched_wastes, 2)).toBe(false)
    expect(canEnterRegion(REGIONS.scorched_wastes, 3)).toBe(true)
    expect(canEnterRegion(REGIONS.scorched_wastes, 5)).toBe(true)
    expect(canEnterRegion(REGIONS.sky_citadel, 6)).toBe(false)
    expect(canEnterRegion(REGIONS.sky_citadel, 7)).toBe(true)
  })
})

describe('getRegion', () => {
  it('should return the correct region by ID', () => {
    const region = getRegion('dark_forest')
    expect(region.name).toBe('Dark Forest')
    expect(region.element).toBe('shadow')
  })

  it('should fall back to green_meadows for unknown region ID', () => {
    const region = getRegion('nonexistent_place')
    expect(region.id).toBe('green_meadows')
  })
})

describe('getConnectedRegions', () => {
  it('should return connected Region objects', () => {
    const connected = getConnectedRegions('green_meadows')
    const ids = connected.map(r => r.id)
    expect(ids).toContain('starting_village')
    expect(ids).toContain('dark_forest')
    expect(ids).toContain('crystal_caves')
  })

  it('should return correct number of connections', () => {
    expect(getConnectedRegions('starting_village')).toHaveLength(1)
    expect(getConnectedRegions('green_meadows')).toHaveLength(3)
    expect(getConnectedRegions('sky_citadel')).toHaveLength(3)
  })
})

describe('Crossroads generation', () => {
  it('should have a crossroads interval of 75 steps', () => {
    expect(CROSSROADS_INTERVAL).toBe(75)
  })

  it('should generate crossroads options for connected regions', () => {
    const region = getRegion('green_meadows')
    const connected = getConnectedRegions(region.id)
    expect(connected.length).toBeGreaterThan(0)

    // All connected regions should have required fields for crossroads display
    for (const r of connected) {
      expect(r.name).toBeTruthy()
      expect(r.icon).toBeTruthy()
      expect(r.difficulty).toBeTruthy()
      expect(typeof r.minLevel).toBe('number')
    }
  })

  it('each region should have at least one connected region', () => {
    for (const region of Object.values(REGIONS)) {
      expect(
        region.connectedRegions.length,
        `Region "${region.id}" has no connections`
      ).toBeGreaterThanOrEqual(1)
    }
  })
})
