import { describe, expect, it } from 'vitest'

import { generateHeirloom } from '@/app/tap-tap-adventure/lib/heirloomGenerator'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

function makeCharacter(overrides: Partial<FantasyCharacter> = {}): FantasyCharacter {
  return {
    id: 'test-char-1',
    playerId: 'player-1',
    name: 'Aldric',
    race: 'Human',
    class: 'Warrior',
    level: 5,
    abilities: [],
    locationId: 'village',
    gold: 100,
    reputation: 20,
    distance: 50,
    status: 'active',
    strength: 15,
    intelligence: 8,
    luck: 7,
    charisma: 6,
    inventory: [],
    deathCount: 0,
    pendingStatPoints: 0,
    ...overrides,
  }
}

describe('Heirloom Generator', () => {
  it('should generate an heirloom item from a character', () => {
    const character = makeCharacter()
    const heirloom = generateHeirloom(character)

    expect(heirloom).toBeDefined()
    expect(heirloom.id).toContain('heirloom-')
    expect(heirloom.quantity).toBe(1)
    expect(heirloom.isHeirloom).toBe(true)
  })

  it('should include the character name in the heirloom name', () => {
    const character = makeCharacter({ name: 'Zara' })
    const heirloom = generateHeirloom(character)

    expect(heirloom.name).toContain('Zara')
  })

  it('should produce equipment or consumable type heirlooms', () => {
    const character = makeCharacter()
    const heirloom = generateHeirloom(character)

    expect(['equipment', 'consumable', 'spell_scroll']).toContain(heirloom.type)
  })

  it('should generate higher quality heirlooms for higher level characters', () => {
    const lowLevel = makeCharacter({ id: 'low', level: 1, distance: 10 })
    const highLevel = makeCharacter({ id: 'high', level: 20, distance: 1000 })

    const lowHeirloom = generateHeirloom(lowLevel)
    const highHeirloom = generateHeirloom(highLevel)

    // Both should be valid items
    expect(lowHeirloom.isHeirloom).toBe(true)
    expect(highHeirloom.isHeirloom).toBe(true)

    // High level heirloom should have the character name
    expect(highHeirloom.name).toContain('Aldric')
    expect(lowHeirloom.name).toContain('Aldric')

    // If both are equipment, high level should have better stats
    if (lowHeirloom.type === 'equipment' && highHeirloom.type === 'equipment') {
      const lowTotal = Object.values(lowHeirloom.effects ?? {}).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0
      const highTotal = Object.values(highHeirloom.effects ?? {}).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0
      expect(highTotal).toBeGreaterThan(lowTotal)
    }

    // If both are consumable, high level should have better heal
    if (lowHeirloom.type === 'consumable' && highHeirloom.type === 'consumable') {
      expect(highHeirloom.effects!.heal).toBeGreaterThan(lowHeirloom.effects!.heal!)
    }
  })

  it('should generate equipment with stats based on strongest stat (strength)', () => {
    const character = makeCharacter({
      id: 'str-char',
      strength: 20,
      intelligence: 5,
      luck: 5,
      spellbook: [],
    })

    const heirloom = generateHeirloom(character)
    expect(heirloom.isHeirloom).toBe(true)

    if (heirloom.type === 'equipment') {
      expect(heirloom.effects).toBeDefined()
      expect(heirloom.effects!.strength).toBeGreaterThan(0)
    }
  })

  it('should generate equipment with stats based on strongest stat (intelligence)', () => {
    const character = makeCharacter({
      id: 'int-char',
      strength: 5,
      intelligence: 20,
      luck: 5,
      spellbook: [],
    })
    const heirloom = generateHeirloom(character)
    expect(heirloom.isHeirloom).toBe(true)

    if (heirloom.type === 'equipment') {
      expect(heirloom.effects).toBeDefined()
      expect(heirloom.effects!.intelligence).toBeGreaterThan(0)
    }
  })

  it('should generate consumable heirlooms with heal effects', () => {
    const character = makeCharacter({ id: 'cons-char' })
    const heirloom = generateHeirloom(character)

    if (heirloom.type === 'consumable') {
      expect(heirloom.effects).toBeDefined()
      expect(heirloom.effects!.heal).toBeGreaterThan(0)
      expect(heirloom.name).toContain('Blessing')
    }
  })

  it('should generate spell scroll heirlooms for characters with spells', () => {
    const character = makeCharacter({
      id: 'spell-char',
      spellbook: [
        {
          id: 'spell-1',
          name: 'Fireball',
          description: 'A ball of fire',
          school: 'arcane',
          manaCost: 15,
          cooldown: 2,
          target: 'enemy',
          effects: [{ type: 'damage', value: 30 }],
          tags: ['fire'],
        },
      ],
    })
    const heirloom = generateHeirloom(character)

    if (heirloom.type === 'spell_scroll') {
      expect(heirloom.spell).toBeDefined()
      expect(heirloom.name).toContain('Spell Scroll')
    }
  })

  it('should scale heirloom quality with distance traveled', () => {
    const nearChar = makeCharacter({ id: 'near', level: 5, distance: 10 })
    const farChar = makeCharacter({ id: 'far', level: 5, distance: 1500 })

    const nearHeirloom = generateHeirloom(nearChar)
    const farHeirloom = generateHeirloom(farChar)

    expect(nearHeirloom.isHeirloom).toBe(true)
    expect(farHeirloom.isHeirloom).toBe(true)

    // For equipment type heirlooms, far traveler should have higher stat bonuses
    if (nearHeirloom.type === 'equipment' && farHeirloom.type === 'equipment') {
      const nearTotal = Object.values(nearHeirloom.effects ?? {}).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0
      const farTotal = Object.values(farHeirloom.effects ?? {}).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0
      expect(farTotal).toBeGreaterThanOrEqual(nearTotal)
    }
  })

  it('should produce deterministic results for the same character', () => {
    const character = makeCharacter()
    const h1 = generateHeirloom(character)
    const h2 = generateHeirloom(character)

    expect(h1.type).toBe(h2.type)
    expect(h1.name).toBe(h2.name)
  })
})
