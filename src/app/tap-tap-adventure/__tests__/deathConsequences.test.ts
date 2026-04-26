import { describe, expect, it } from 'vitest'

import { applyDeathPenalty } from '@/app/tap-tap-adventure/lib/deathPenalty'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

function makeCharacter(overrides: Partial<FantasyCharacter> = {}): FantasyCharacter {
  return {
    id: 'test-char',
    playerId: 'player-1',
    name: 'Test Hero',
    race: 'Human',
    class: 'Warrior',
    level: 5,
    abilities: [],
    locationId: 'village',
    gold: 100,
    reputation: 20,
    distance: 10,
    status: 'active',
    strength: 10,
    intelligence: 8,
    luck: 7,
    charisma: 6,
    inventory: [],
    deathCount: 0,
    ...overrides,
  }
}

describe('Death Consequences - applyDeathPenalty', () => {
  it('should deduct 25% of gold', () => {
    const character = makeCharacter({ gold: 200 })
    const { updatedCharacter, penalty } = applyDeathPenalty(character)

    expect(penalty.goldLost).toBe(50)
    expect(updatedCharacter.gold).toBe(150)
  })

  it('should floor the gold loss calculation', () => {
    const character = makeCharacter({ gold: 33 })
    const { updatedCharacter, penalty } = applyDeathPenalty(character)

    expect(penalty.goldLost).toBe(8) // Math.floor(33 * 0.25) = 8
    expect(updatedCharacter.gold).toBe(25)
  })

  it('should handle zero gold', () => {
    const character = makeCharacter({ gold: 0 })
    const { updatedCharacter, penalty } = applyDeathPenalty(character)

    expect(penalty.goldLost).toBe(0)
    expect(updatedCharacter.gold).toBe(0)
  })

  it('should clear all inventory items', () => {
    const character = makeCharacter({
      inventory: [
        { id: 'item-1', name: 'Potion', description: 'Heals', quantity: 3 },
        { id: 'item-2', name: 'Scroll', description: 'Magic', quantity: 1 },
      ],
    })
    const { updatedCharacter, penalty } = applyDeathPenalty(character)

    expect(updatedCharacter.inventory).toEqual([])
    expect(penalty.itemsLost).toBe(2)
  })

  it('should not count deleted items as lost', () => {
    const character = makeCharacter({
      inventory: [
        { id: 'item-1', name: 'Potion', description: 'Heals', quantity: 1 },
        { id: 'item-2', name: 'Old Scroll', description: 'Faded', quantity: 1, status: 'deleted' },
      ],
    })
    const { penalty } = applyDeathPenalty(character)

    expect(penalty.itemsLost).toBe(1)
  })

  it('should reduce reputation by 5', () => {
    const character = makeCharacter({ reputation: 20 })
    const { updatedCharacter, penalty } = applyDeathPenalty(character)

    expect(penalty.reputationLost).toBe(5)
    expect(updatedCharacter.reputation).toBe(15)
  })

  it('should allow reputation to go negative', () => {
    const character = makeCharacter({ reputation: 2 })
    const { updatedCharacter } = applyDeathPenalty(character)

    expect(updatedCharacter.reputation).toBe(-3)
  })

  it('should increment death count', () => {
    const character = makeCharacter({ deathCount: 0 })
    const { updatedCharacter, penalty } = applyDeathPenalty(character)

    expect(penalty.newDeathCount).toBe(1)
    expect(updatedCharacter.deathCount).toBe(1)
  })

  it('should increment death count from existing value', () => {
    const character = makeCharacter({ deathCount: 3 })
    const { updatedCharacter, penalty } = applyDeathPenalty(character)

    expect(penalty.newDeathCount).toBe(4)
    expect(updatedCharacter.deathCount).toBe(4)
  })

  it('should handle undefined deathCount (migration case)', () => {
    const character = makeCharacter()
    // Simulate a character that hasn't been migrated yet
    delete (character as Record<string, unknown>).deathCount
    const { updatedCharacter, penalty } = applyDeathPenalty(character)

    expect(penalty.newDeathCount).toBe(1)
    expect(updatedCharacter.deathCount).toBe(1)
  })

  it('should keep character status as active (not permadeath)', () => {
    const character = makeCharacter({ status: 'active' })
    const { updatedCharacter } = applyDeathPenalty(character)

    expect(updatedCharacter.status).toBe('active')
  })

  it('should apply all penalties together correctly', () => {
    const character = makeCharacter({
      gold: 400,
      reputation: 50,
      deathCount: 2,
      inventory: [
        { id: 'item-1', name: 'Gem', description: 'Shiny', quantity: 1 },
        { id: 'item-2', name: 'Ring', description: 'Gold', quantity: 1 },
        { id: 'item-3', name: 'Potion', description: 'Red', quantity: 5 },
      ],
    })
    const { updatedCharacter, penalty } = applyDeathPenalty(character)

    expect(updatedCharacter.gold).toBe(300)
    expect(updatedCharacter.reputation).toBe(45)
    expect(updatedCharacter.deathCount).toBe(3)
    expect(updatedCharacter.inventory).toEqual([])
    expect(penalty.goldLost).toBe(100)
    expect(penalty.itemsLost).toBe(3)
    expect(penalty.reputationLost).toBe(5)
    expect(penalty.newDeathCount).toBe(3)
  })
})
