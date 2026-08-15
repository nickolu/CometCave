import { describe, expect, it } from 'vitest'

import { MAX_TRAIT } from '@/app/dicebound/domain/kit'
import {
  PROVENANCES,
  PROVENANCE_TABLES,
  QUALITY_BANDS,
  type Provenance,
  type QualityBand,
  describeQuality,
  rollQuality,
  traitsFor,
  worthOf,
} from '@/app/dicebound/domain/loot'

// A simple deterministic counter-based rng for seeded tests.
function counterRng(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

// A minimal lcg rng seeded with a fixed value.
function lcgRng(seed = 1): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0x100000000
  }
}

describe('PROVENANCES', () => {
  it('contains all five provenance keys', () => {
    expect(PROVENANCES).toEqual(['underfoot', 'given', 'bought', 'taken', 'hoard'])
  })

  it('matches the keys of PROVENANCE_TABLES', () => {
    const tableKeys = Object.keys(PROVENANCE_TABLES).sort()
    const arrayValues = [...PROVENANCES].sort()
    expect(arrayValues).toEqual(tableKeys)
  })
})

describe('PROVENANCE_TABLES', () => {
  const provenances = Object.keys(PROVENANCE_TABLES) as Provenance[]

  it('every table sums to 1.0', () => {
    for (const provenance of provenances) {
      const sum = PROVENANCE_TABLES[provenance].reduce((acc, entry) => acc + entry.weight, 0)
      expect(sum, `${provenance} table sum`).toBeCloseTo(1.0, 9)
    }
  })

  it('plain is the majority outcome for underfoot (weight 0.55 > all others)', () => {
    const table = PROVENANCE_TABLES.underfoot
    const plain = table.find(e => e.band === 'plain')!
    const others = table.filter(e => e.band !== 'plain')
    expect(plain.weight).toBe(0.55)
    for (const other of others) {
      expect(plain.weight).toBeGreaterThan(other.weight)
    }
  })

  it('plain has weight 0.10 for taken (not impossible, but not the majority)', () => {
    const table = PROVENANCE_TABLES.taken
    const plain = table.find(e => e.band === 'plain')!
    expect(plain.weight).toBe(0.10)
    // fine is the majority for taken
    const fine = table.find(e => e.band === 'fine')!
    expect(fine.weight).toBeGreaterThan(plain.weight)
  })
})

describe('QUALITY_BANDS', () => {
  const bands = Object.keys(QUALITY_BANDS) as QualityBand[]

  it('no band produces a trait above MAX_TRAIT', () => {
    for (const band of bands) {
      for (const bonus of QUALITY_BANDS[band].bonuses) {
        expect(Math.abs(bonus), `${band} bonus`).toBeLessThanOrEqual(MAX_TRAIT)
      }
    }
  })

  it("no band's bonuses sum above 2", () => {
    for (const band of bands) {
      const sum = QUALITY_BANDS[band].bonuses.reduce((acc, b) => acc + b, 0)
      expect(sum, `${band} bonus sum`).toBeLessThanOrEqual(2)
    }
  })
})

describe('traitsFor', () => {
  it('returns 1 trait for fine when given 3 labels (extra labels are dropped)', () => {
    const labels = [
      { label: 'edge is sharp', applies: {} },
      { label: 'well-balanced', applies: {} },
      { label: 'extra', applies: {} },
    ]
    const traits = traitsFor('fine', labels)
    expect(traits).toHaveLength(1)
    expect(traits[0].label).toBe('edge is sharp')
    expect(traits[0].bonus).toBe(1)
  })

  it('returns 0 traits for storied when given 0 labels (code does not invent prose)', () => {
    const traits = traitsFor('storied', [])
    expect(traits).toHaveLength(0)
  })

  it('returns 0 traits for plain (plain has no traits)', () => {
    const traits = traitsFor('plain', [{ label: 'you have rope', applies: {} }])
    expect(traits).toHaveLength(0)
  })

  it('assigns the right bonuses for rare — [1, 0]', () => {
    const labels = [
      { label: 'first', applies: {} },
      { label: 'second', applies: {} },
    ]
    const traits = traitsFor('rare', labels)
    expect(traits).toHaveLength(2)
    expect(traits[0].bonus).toBe(1)
    expect(traits[1].bonus).toBe(0)
  })
})

describe('rollQuality', () => {
  it('is deterministic under a seeded rng', () => {
    const rng1 = lcgRng(42)
    const rng2 = lcgRng(42)
    for (let i = 0; i < 20; i++) {
      expect(rollQuality('underfoot', rng1)).toBe(rollQuality('underfoot', rng2))
    }
  })

  it('a roll of 0 always returns plain for underfoot (first band, weight 0.55)', () => {
    const rng = counterRng([0])
    expect(rollQuality('underfoot', rng)).toBe('plain')
  })

  it('a roll just below the cumulative weight boundary picks the right band', () => {
    // underfoot: plain=0.55, good=0.28 → cumulative at good boundary = 0.83
    // roll of 0.829 should land in good
    const rng = counterRng([0.829])
    expect(rollQuality('underfoot', rng)).toBe('good')
  })

  it('a roll of 0.999 returns storied for underfoot (floating-point guard path)', () => {
    const rng = counterRng([0.999])
    expect(rollQuality('underfoot', rng)).toBe('storied')
  })

  it('10,000 seeded rolls land within a few percent of declared weights for each provenance', () => {
    const provenances = Object.keys(PROVENANCE_TABLES) as Provenance[]
    const N = 10_000
    const tolerance = 0.03 // 3 percentage points

    for (const provenance of provenances) {
      const rng = lcgRng(1337)
      const counts: Partial<Record<QualityBand, number>> = {}
      for (let i = 0; i < N; i++) {
        const band = rollQuality(provenance, rng)
        counts[band] = (counts[band] ?? 0) + 1
      }
      for (const entry of PROVENANCE_TABLES[provenance]) {
        const actual = (counts[entry.band] ?? 0) / N
        expect(
          Math.abs(actual - entry.weight),
          `${provenance}/${entry.band}: got ${actual.toFixed(4)}, expected ${entry.weight}`
        ).toBeLessThan(tolerance)
      }
    }
  })
})

describe('worthOf', () => {
  it('sums trait bonuses for an item', () => {
    const item = {
      id: 'sword',
      name: 'Sword',
      note: '',
      traits: [
        { label: 'edge is sharp', bonus: 1, applies: {} },
        { label: 'well-balanced', bonus: 0, applies: {} },
      ],
      consumable: false,
      origin: null,
      gainedAt: 0,
    }
    expect(worthOf(item)).toBe(1)
  })

  it('returns 0 for an item with no traits', () => {
    const item = {
      id: 'rope',
      name: 'Rope',
      note: '',
      traits: [],
      consumable: false,
      origin: null,
      gainedAt: 0,
    }
    expect(worthOf(item)).toBe(0)
  })
})

describe('describeQuality', () => {
  it('plain returns the no-bonus description', () => {
    const desc = describeQuality('plain', 0)
    expect(desc).toContain('plain')
    expect(desc).toContain('no bonus')
  })

  it('good with worth 0 calls it a named reason for the DM', () => {
    const desc = describeQuality('good', 0)
    expect(desc).toContain('good')
    expect(desc).toContain('+0')
    expect(desc).toContain('named reason')
  })

  it('storied with worth 2 reports the total on the die', () => {
    const desc = describeQuality('storied', 2)
    expect(desc).toContain('storied')
    expect(desc).toContain('+2')
    expect(desc).toContain('+0')
    expect(desc).toContain('+2 on the die total')
  })

  it('fine with worth 1 reports the total', () => {
    const desc = describeQuality('fine', 1)
    expect(desc).toContain('fine')
    expect(desc).toContain('+1 on the die total')
  })
})
