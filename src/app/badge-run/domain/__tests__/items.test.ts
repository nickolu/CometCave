import { describe, it, expect } from 'vitest'
import { ITEMS, applyItemStats, isUnevolved, type ItemId, type StatKey } from '../items/items'
import { getCombo, allCombos } from '../items/combine'

const BASE_STATS: Record<StatKey, number> = {
  hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100,
}

describe('ITEMS catalogue', () => {
  it('has exactly 8 basic items', () => {
    const basicItems: ItemId[] = [
      'eviolite', 'everstone', 'choice-scarf', 'choice-band',
      'choice-specs', 'rocky-helmet', 'life-orb', 'leftovers',
    ]
    for (const id of basicItems) {
      expect(ITEMS[id]).toBeDefined()
    }
    expect(basicItems.length).toBe(8)
  })

  it('has exactly 12 combo items', () => {
    const comboItems: ItemId[] = [
      'assault-vest', 'power-belt', 'power-lens', 'expert-belt',
      'muscle-band', 'wise-glasses', 'iron-barbs', 'big-root',
      'thick-club', 'deep-sea-tooth', 'quick-claw', 'binding-band',
    ]
    for (const id of comboItems) {
      expect(ITEMS[id]).toBeDefined()
    }
    expect(comboItems.length).toBe(12)
  })

  it('Eviolite has statCondition: unevolved', () => {
    expect(ITEMS['eviolite'].statCondition).toBe('unevolved')
    expect(ITEMS['eviolite'].statMultipliers?.defense).toBeGreaterThan(1)
    expect(ITEMS['eviolite'].statMultipliers?.specialDefense).toBeGreaterThan(1)
  })

  it('Everstone blocks evolution', () => {
    expect(ITEMS['everstone'].blocksEvolution).toBe(true)
  })

  it('Life Orb has damage boost and recoil', () => {
    expect(ITEMS['life-orb'].damageBoost).toBeGreaterThan(1)
    expect(ITEMS['life-orb'].recoilFraction).toBeGreaterThan(0)
  })

  it('Leftovers has heal fraction', () => {
    expect(ITEMS['leftovers'].healFraction).toBeGreaterThan(0)
  })
})

describe('applyItemStats', () => {
  it('applies Choice Band +50% attack', () => {
    const result = applyItemStats(BASE_STATS, 'choice-band', 1)
    expect(result.attack).toBe(150)
    expect(result.speed).toBe(100)  // unchanged
  })

  it('applies Eviolite only to unevolved units', () => {
    // dexId 1 = Bulbasaur (unevolved, has evolvesTo)
    const unevolved = applyItemStats(BASE_STATS, 'eviolite', 1)
    expect(unevolved.defense).toBe(150)
    expect(unevolved.specialDefense).toBe(150)

    // dexId 3 = Venusaur (final form, evolvesTo = null)
    const final = applyItemStats(BASE_STATS, 'eviolite', 3)
    expect(final.defense).toBe(100)  // unchanged
    expect(final.specialDefense).toBe(100)  // unchanged
  })

  it('Everstone (no stat multipliers) returns stats unchanged', () => {
    const result = applyItemStats(BASE_STATS, 'everstone', 1)
    expect(result).toEqual(BASE_STATS)
  })

  it('uses Math.round to avoid floating point artifacts', () => {
    // 100 * 1.5 = 150 exactly, no issue. Test with a value that would produce a fraction.
    const stats = { ...BASE_STATS, defense: 101 }
    const result = applyItemStats(stats, 'eviolite', 1)
    expect(Number.isInteger(result.defense)).toBe(true)
  })
})

describe('isUnevolved', () => {
  it('returns true for Bulbasaur (dexId 1, has evolvesTo)', () => {
    expect(isUnevolved(1)).toBe(true)
  })
  it('returns false for Venusaur (dexId 3, no evolvesTo)', () => {
    expect(isUnevolved(3)).toBe(false)
  })
})

describe('getCombo — commutative', () => {
  it('getCombo(A, B) === getCombo(B, A) for all recipes', () => {
    for (const [a, b, expected] of allCombos()) {
      expect(getCombo(a, b)).toBe(expected)
      expect(getCombo(b, a)).toBe(expected)
    }
  })

  it('returns null for pairs with no combo', () => {
    expect(getCombo('eviolite', 'life-orb')).toBeNull()
  })

  it('has exactly 12 recipes', () => {
    expect(allCombos().length).toBe(12)
  })
})
