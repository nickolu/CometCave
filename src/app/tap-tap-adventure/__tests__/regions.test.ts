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
      'sunken_ruins',
      'volcanic_forge',
      'feywild_grove',
      'bone_wastes',
      'dragons_spine',
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
    expect(REGIONS.crystal_caves.difficultyMultiplier).toBe(1.1)
    expect(REGIONS.scorched_wastes.difficultyMultiplier).toBe(1.5)
    expect(REGIONS.frozen_peaks.difficultyMultiplier).toBe(1.5)
    expect(REGIONS.shadow_realm.difficultyMultiplier).toBe(1.9)
    expect(REGIONS.sky_citadel.difficultyMultiplier).toBe(2.2)
    expect(REGIONS.abyssal_depths.difficultyMultiplier).toBe(2.4)
    expect(REGIONS.celestial_throne.difficultyMultiplier).toBe(2.8)
    expect(REGIONS.sunken_ruins.difficultyMultiplier).toBe(1.0)
    expect(REGIONS.volcanic_forge.difficultyMultiplier).toBe(1.7)
    expect(REGIONS.feywild_grove.difficultyMultiplier).toBe(1.2)
    expect(REGIONS.bone_wastes.difficultyMultiplier).toBe(1.3)
    expect(REGIONS.dragons_spine.difficultyMultiplier).toBe(2.0)
  })

  it('should have valid difficulty multipliers (positive numbers)', () => {
    for (const region of Object.values(REGIONS)) {
      expect(region.difficultyMultiplier).toBeGreaterThan(0)
    }
  })

  it('should have valid difficulty levels', () => {
    const validDifficulties = ['easy', 'medium', 'hard', 'very_hard', 'extreme']
    for (const region of Object.values(REGIONS)) {
      expect(validDifficulties).toContain(region.difficulty)
    }
  })
})

describe('Min level requirements', () => {
  it('starting areas should have low level requirements', () => {
    expect(REGIONS.starting_village.minLevel).toBe(0)
    expect(REGIONS.green_meadows.minLevel).toBe(0)
    expect(REGIONS.dark_forest.minLevel).toBe(1)
  })

  it('hard regions should require appropriate levels', () => {
    expect(REGIONS.scorched_wastes.minLevel).toBe(5)
    expect(REGIONS.frozen_peaks.minLevel).toBe(5)
    expect(REGIONS.bone_wastes.minLevel).toBe(4)
  })

  it('very hard regions should require higher levels', () => {
    expect(REGIONS.shadow_realm.minLevel).toBe(6)
    expect(REGIONS.dragons_spine.minLevel).toBe(7)
    expect(REGIONS.sky_citadel.minLevel).toBe(8)
  })

  it('canEnterRegion should respect min level', () => {
    expect(canEnterRegion(REGIONS.green_meadows, 1)).toBe(true)
    expect(canEnterRegion(REGIONS.scorched_wastes, 4)).toBe(false)
    expect(canEnterRegion(REGIONS.scorched_wastes, 5)).toBe(true)
    expect(canEnterRegion(REGIONS.scorched_wastes, 6)).toBe(true)
    expect(canEnterRegion(REGIONS.sky_citadel, 7)).toBe(false)
    expect(canEnterRegion(REGIONS.sky_citadel, 8)).toBe(true)
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
    expect(ids).toContain('sunken_ruins')
  })

  it('should return correct number of connections', () => {
    expect(getConnectedRegions('starting_village')).toHaveLength(1)
    expect(getConnectedRegions('green_meadows')).toHaveLength(3)
    expect(getConnectedRegions('sky_citadel')).toHaveLength(2) // dragons_spine + abyssal_depths
  })
})

describe('New regions', () => {
  const newRegionIds = ['sunken_ruins', 'volcanic_forge', 'feywild_grove', 'bone_wastes', 'dragons_spine']

  it('all 5 new regions should exist in REGIONS', () => {
    for (const id of newRegionIds) {
      expect(REGIONS[id], `Region "${id}" should be defined`).toBeDefined()
      expect(REGIONS[id].id).toBe(id)
    }
  })

  it('new regions should have valid fields', () => {
    const validDifficulties = ['easy', 'medium', 'hard', 'very_hard']
    const validElements = ['fire', 'ice', 'lightning', 'shadow', 'nature', 'arcane', 'none']
    for (const id of newRegionIds) {
      const region = REGIONS[id]
      expect(region.name).toBeTruthy()
      expect(region.description).toBeTruthy()
      expect(validDifficulties).toContain(region.difficulty)
      expect(region.difficultyMultiplier).toBeGreaterThan(0)
      expect(region.theme).toBeTruthy()
      expect(region.enemyTypes.length).toBeGreaterThan(0)
      expect(validElements).toContain(region.element)
      expect(region.connectedRegions.length).toBeGreaterThan(0)
      expect(typeof region.minLevel).toBe('number')
      expect(region.icon).toBeTruthy()
    }
  })

  it('new region connections should be bidirectional', () => {
    for (const id of newRegionIds) {
      const region = REGIONS[id]
      for (const connectedId of region.connectedRegions) {
        const connected = REGIONS[connectedId]
        expect(
          connected,
          `Region "${id}" references non-existent connected region "${connectedId}"`
        ).toBeDefined()
        expect(
          connected.connectedRegions,
          `Region "${connectedId}" should connect back to "${id}"`
        ).toContain(id)
      }
    }
  })

  it('new regions should have correct min levels', () => {
    expect(REGIONS.sunken_ruins.minLevel).toBe(2)
    expect(REGIONS.volcanic_forge.minLevel).toBe(6)
    expect(REGIONS.feywild_grove.minLevel).toBe(3)
    expect(REGIONS.bone_wastes.minLevel).toBe(4)
    expect(REGIONS.dragons_spine.minLevel).toBe(7)
  })

  it('canEnterRegion should work for new regions', () => {
    expect(canEnterRegion(REGIONS.sunken_ruins, 1)).toBe(false)
    expect(canEnterRegion(REGIONS.sunken_ruins, 2)).toBe(true)
    expect(canEnterRegion(REGIONS.volcanic_forge, 5)).toBe(false)
    expect(canEnterRegion(REGIONS.volcanic_forge, 6)).toBe(true)
    expect(canEnterRegion(REGIONS.dragons_spine, 6)).toBe(false)
    expect(canEnterRegion(REGIONS.dragons_spine, 7)).toBe(true)
  })
})

describe('Tree structure fields', () => {
  it('parentRegion references should point to existing regions', () => {
    for (const region of Object.values(REGIONS)) {
      if (region.parentRegion) {
        expect(
          REGIONS[region.parentRegion],
          `Region "${region.id}" references non-existent parent "${region.parentRegion}"`
        ).toBeDefined()
      }
    }
  })

  it('childRegions references should point to existing regions', () => {
    for (const region of Object.values(REGIONS)) {
      if (region.childRegions) {
        for (const childId of region.childRegions) {
          expect(
            REGIONS[childId],
            `Region "${region.id}" references non-existent child "${childId}"`
          ).toBeDefined()
        }
      }
    }
  })

  it('starting_village should be the root (no parent)', () => {
    expect(REGIONS.starting_village.parentRegion).toBeUndefined()
  })

  it('starting_village should have children', () => {
    expect(REGIONS.starting_village.childRegions).toContain('green_meadows')
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
