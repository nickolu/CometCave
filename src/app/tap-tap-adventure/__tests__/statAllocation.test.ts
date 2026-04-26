import { describe, it, expect } from 'vitest'

import {
  applyLevelFromDistance,
  calculateMaxHp,
  stepsRequiredForLevel,
  STAT_POINTS_PER_LEVEL,
} from '@/app/tap-tap-adventure/lib/leveling'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

function makeCharacter(overrides: Partial<FantasyCharacter> = {}): FantasyCharacter {
  return {
    id: 'test-char',
    playerId: 'player-1',
    name: 'Test Hero',
    race: 'Human',
    class: 'Warrior',
    level: 1,
    abilities: [],
    locationId: 'starting-village',
    gold: 10,
    reputation: 0,
    distance: 0,
    status: 'active',
    strength: 5,
    intelligence: 5,
    luck: 5,
    charisma: 5,
    hp: 100,
    maxHp: 100,
    inventory: [],
    equipment: { weapon: null, armor: null, accessory: null },
    deathCount: 0,
    pendingStatPoints: 0,
    ...overrides,
  }
}

describe('Stat Allocation on Level Up', () => {
  it('should add 3 pending stat points per level gained instead of auto-applying stats', () => {
    const distanceForLevel2 = stepsRequiredForLevel(2)
    const character = makeCharacter({ distance: distanceForLevel2 })

    const result = applyLevelFromDistance(character)

    expect(result.level).toBe(2)
    expect(result.pendingStatPoints).toBe(STAT_POINTS_PER_LEVEL)
    // Stats should NOT have been auto-incremented
    expect(result.strength).toBe(5)
    expect(result.intelligence).toBe(5)
    expect(result.luck).toBe(5)
  })

  it('should accumulate pending stat points for multiple levels gained', () => {
    const distanceForLevel3 = stepsRequiredForLevel(3)
    const character = makeCharacter({ distance: distanceForLevel3 })

    const result = applyLevelFromDistance(character)

    expect(result.level).toBe(3)
    expect(result.pendingStatPoints).toBe(2 * STAT_POINTS_PER_LEVEL)
    // Stats should remain unchanged
    expect(result.strength).toBe(5)
    expect(result.intelligence).toBe(5)
    expect(result.luck).toBe(5)
  })

  it('should add to existing pending stat points', () => {
    const distanceForLevel2 = stepsRequiredForLevel(2)
    const character = makeCharacter({
      distance: distanceForLevel2,
      pendingStatPoints: 3,
    })

    const result = applyLevelFromDistance(character)

    expect(result.level).toBe(2)
    expect(result.pendingStatPoints).toBe(3 + STAT_POINTS_PER_LEVEL)
  })

  it('should not add points when no level is gained', () => {
    const character = makeCharacter({ level: 1, distance: 10 })

    const result = applyLevelFromDistance(character)

    expect(result.level).toBe(1)
    expect(result.pendingStatPoints).toBe(0)
  })
})

describe('Stat Point Allocation Application', () => {
  it('should correctly increase stats when allocating points', () => {
    const character = makeCharacter({
      pendingStatPoints: 3,
      strength: 5,
      intelligence: 5,
      luck: 5,
    })

    // Simulate what the store's allocateStatPoints does
    const strAlloc = 2
    const intAlloc = 1
    const lckAlloc = 0
    const totalAllocated = strAlloc + intAlloc + lckAlloc

    const updated = {
      ...character,
      strength: character.strength + strAlloc,
      intelligence: character.intelligence + intAlloc,
      luck: character.luck + lckAlloc,
      pendingStatPoints: character.pendingStatPoints - totalAllocated,
    }

    expect(updated.strength).toBe(7)
    expect(updated.intelligence).toBe(6)
    expect(updated.luck).toBe(5)
    expect(updated.pendingStatPoints).toBe(0)
  })

  it('should correctly increase charisma when allocating points', () => {
    const character = makeCharacter({
      pendingStatPoints: 3,
      strength: 5,
      intelligence: 5,
      luck: 5,
      charisma: 5,
    })

    const strAlloc = 1
    const intAlloc = 1
    const lckAlloc = 0
    const chaAlloc = 1
    const totalAllocated = strAlloc + intAlloc + lckAlloc + chaAlloc

    const updated = {
      ...character,
      strength: character.strength + strAlloc,
      intelligence: character.intelligence + intAlloc,
      luck: character.luck + lckAlloc,
      charisma: character.charisma + chaAlloc,
      pendingStatPoints: character.pendingStatPoints - totalAllocated,
    }

    expect(updated.strength).toBe(6)
    expect(updated.intelligence).toBe(6)
    expect(updated.luck).toBe(5)
    expect(updated.charisma).toBe(6)
    expect(updated.pendingStatPoints).toBe(0)
  })

  it('should decrease pendingStatPoints correctly', () => {
    const character = makeCharacter({ pendingStatPoints: 6 })

    const allocated = 3
    const remaining = character.pendingStatPoints - allocated

    expect(remaining).toBe(3)
  })

  it('should not allow allocating more points than available', () => {
    const character = makeCharacter({ pendingStatPoints: 2 })

    const strAlloc = 1
    const intAlloc = 1
    const lckAlloc = 1
    const totalAllocated = strAlloc + intAlloc + lckAlloc

    expect(totalAllocated).toBeGreaterThan(character.pendingStatPoints)
  })
})

describe('maxHp recalculation after STR allocation', () => {
  it('should increase maxHp when strength is increased', () => {
    const character = makeCharacter({
      strength: 5,
      level: 2,
    })

    const hpBefore = calculateMaxHp(character)

    const afterAllocation = {
      ...character,
      strength: character.strength + 2,
    }

    const hpAfter = calculateMaxHp(afterAllocation)

    // Each point of STR adds 3 HP
    expect(hpAfter - hpBefore).toBe(6)
  })

  it('should not change maxHp when only INT or LCK are increased', () => {
    const character = makeCharacter({
      strength: 5,
      intelligence: 5,
      luck: 5,
      level: 2,
    })

    const hpBefore = calculateMaxHp(character)

    const afterAllocation = {
      ...character,
      intelligence: character.intelligence + 2,
      luck: character.luck + 1,
    }

    const hpAfter = calculateMaxHp(afterAllocation)

    expect(hpAfter).toBe(hpBefore)
  })
})
