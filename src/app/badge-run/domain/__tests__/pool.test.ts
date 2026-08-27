import { UNIT_CATALOG } from '../unit-catalog'
import {
  createPool,
  takeUnit,
  returnUnit,
  getAvailable,
  totalAvailable,
  type Pool,
} from '../draft/pool'

// Known tier examples (verified by BST):
// T1: Bulbasaur  dexId=1  BST=318
// T2: Ivysaur   dexId=2  BST=405
// T3: Venusaur  dexId=3  BST=525
// T4: Gyarados  dexId=130 BST=540
// T5: Dragonite dexId=149 BST=600

describe('createPool', () => {
  let pool: Pool

  beforeEach(() => {
    pool = createPool()
  })

  it('initializes correct copy counts for a T1 unit (Bulbasaur)', () => {
    const entry = pool.get(1)
    expect(entry).toBeDefined()
    expect(entry!.available).toBe(20)
    expect(entry!.total).toBe(20)
  })

  it('initializes correct copy counts for a T2 unit (Ivysaur)', () => {
    const entry = pool.get(2)
    expect(entry).toBeDefined()
    expect(entry!.available).toBe(16)
    expect(entry!.total).toBe(16)
  })

  it('initializes correct copy counts for a T3 unit (Venusaur)', () => {
    const entry = pool.get(3)
    expect(entry).toBeDefined()
    expect(entry!.available).toBe(12)
    expect(entry!.total).toBe(12)
  })

  it('initializes correct copy counts for a T4 unit (Gyarados)', () => {
    const entry = pool.get(130)
    expect(entry).toBeDefined()
    expect(entry!.available).toBe(9)
    expect(entry!.total).toBe(9)
  })

  it('initializes correct copy counts for a T5 unit (Dragonite)', () => {
    const entry = pool.get(149)
    expect(entry).toBeDefined()
    expect(entry!.available).toBe(6)
    expect(entry!.total).toBe(6)
  })

  it('total available on fresh pool equals sum of (tier copies × units of that tier)', () => {
    const TIER_COPIES: Record<string, number> = { T1: 20, T2: 16, T3: 12, T4: 9, T5: 6 }
    const expected = UNIT_CATALOG.reduce((sum, u) => sum + TIER_COPIES[u.tier], 0)
    expect(totalAvailable(pool)).toBe(expected)
  })
})

describe('takeUnit', () => {
  let pool: Pool

  beforeEach(() => {
    pool = createPool()
  })

  it('returns the unit and decrements available', () => {
    const unit = takeUnit(pool, 1)
    expect(unit).not.toBeNull()
    expect(unit!.dexId).toBe(1)
    expect(pool.get(1)!.available).toBe(19)
  })

  it('returns null when copies run out (take all then try one more)', () => {
    // Exhaust all T5 copies of Dragonite (6 total)
    for (let i = 0; i < 6; i++) {
      const result = takeUnit(pool, 149)
      expect(result).not.toBeNull()
    }
    const result = takeUnit(pool, 149)
    expect(result).toBeNull()
  })

  it('cannot double-take the same dexId more than total times', () => {
    const entry = pool.get(130)! // Gyarados, T4 → 9 copies
    const total = entry.total
    let successCount = 0
    for (let i = 0; i < total + 5; i++) {
      if (takeUnit(pool, 130) !== null) successCount++
    }
    expect(successCount).toBe(total)
    expect(pool.get(130)!.available).toBe(0)
  })
})

describe('returnUnit', () => {
  let pool: Pool

  beforeEach(() => {
    pool = createPool()
  })

  it('restores availability after taking', () => {
    takeUnit(pool, 1)
    expect(pool.get(1)!.available).toBe(19)
    returnUnit(pool, 1)
    expect(pool.get(1)!.available).toBe(20)
  })

  it('throws when returning a unit that was never taken (already at full)', () => {
    expect(() => returnUnit(pool, 1)).toThrow()
  })

  it('throws for an unknown dexId', () => {
    expect(() => returnUnit(pool, 99999)).toThrow('Unknown dexId: 99999')
  })
})

describe('getAvailable', () => {
  let pool: Pool

  beforeEach(() => {
    pool = createPool()
  })

  it('with no filter returns all units with available > 0', () => {
    const available = getAvailable(pool)
    expect(available.length).toBe(UNIT_CATALOG.length)
    expect(available.every(e => e.available > 0)).toBe(true)
  })

  it('filtered by tier returns only that tier\'s units', () => {
    const t1 = getAvailable(pool, 'T1')
    expect(t1.every(e => e.unit.tier === 'T1')).toBe(true)
    const t5 = getAvailable(pool, 'T5')
    expect(t5.every(e => e.unit.tier === 'T5')).toBe(true)
  })

  it('excludes exhausted units', () => {
    // Exhaust Dragonite (T5, dexId=149)
    for (let i = 0; i < 6; i++) takeUnit(pool, 149)
    const available = getAvailable(pool)
    expect(available.some(e => e.unit.dexId === 149)).toBe(false)
  })

  it('taking all copies of a unit removes it from getAvailable results', () => {
    // Exhaust all Gyarados copies (T4, 9 copies)
    for (let i = 0; i < 9; i++) takeUnit(pool, 130)
    const t4Available = getAvailable(pool, 'T4')
    expect(t4Available.some(e => e.unit.dexId === 130)).toBe(false)
  })
})
