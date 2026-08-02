import { describe, expect, it } from 'vitest'

import { CHRONICLE_VERSION, emptyChronicle } from '@/app/micro-land/chronicle/types'
import type { ChronicleData, SpeciesRecord } from '@/app/micro-land/chronicle/types'
import {
  MAX_CHRONICLE_BYTES,
  chronicleBytes,
  decodeChronicle,
  fitChronicle,
  validateChronicle,
} from '@/app/micro-land/chronicle/wire'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

/**
 * A species record carrying `padding` bytes of pretend pixel art.
 *
 * Size is what every test below is about, so it is the one thing worth being
 * able to dial precisely; the rest is cast, as in the chronicle tests.
 */
function species(id: string, lastSeen: number, summoned: boolean, padding = 0): SpeciesRecord {
  return {
    blueprint: { id, name: id, summoned, blurb: 'x'.repeat(padding) } as CreatureBlueprint,
    firstSeen: 0,
    lastSeen,
    longestLife: 0,
  }
}

describe('validateChronicle', () => {
  it('accepts a well-formed chronicle', () => {
    expect(validateChronicle(emptyChronicle())).toEqual(emptyChronicle())
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'chronicle'],
    ['a number', 7],
  ])('refuses %s', (_label, value) => {
    expect(validateChronicle(value)).toBeNull()
  })

  it('refuses a version it does not know, rather than misreading it', () => {
    expect(validateChronicle({ ...emptyChronicle(), version: CHRONICLE_VERSION + 1 })).toBeNull()
  })

  it.each(['lands', 'species', 'milestones'])('refuses a missing %s', key => {
    const payload: Record<string, unknown> = { ...emptyChronicle() }
    delete payload[key]
    expect(validateChronicle(payload)).toBeNull()
  })

  it('refuses an array where a record is expected', () => {
    expect(validateChronicle({ ...emptyChronicle(), species: [] })).toBeNull()
  })

  it('drops unknown top-level keys instead of storing them', () => {
    const result = validateChronicle({ ...emptyChronicle(), sneaky: 'payload' })
    expect(result).not.toBeNull()
    expect(Object.keys(result as ChronicleData).sort()).toEqual([
      'lands',
      'milestones',
      'species',
      'version',
    ])
  })
})

describe('decodeChronicle', () => {
  it('round-trips a chronicle through a string', () => {
    const data = emptyChronicle()
    data.milestones['first-elder'] = 42
    expect(decodeChronicle(JSON.stringify(data))).toEqual(data)
  })

  it('returns null for unparseable text rather than throwing', () => {
    expect(decodeChronicle('{not json')).toBeNull()
  })

  it('returns null for a missing document field', () => {
    expect(decodeChronicle(undefined)).toBeNull()
  })

  it('returns null for valid JSON that is not a chronicle', () => {
    expect(decodeChronicle('{"hello":"world"}')).toBeNull()
  })
})

describe('chronicleBytes', () => {
  it('counts bytes rather than characters, so accents are not undercounted', () => {
    const plain = emptyChronicle()
    plain.milestones.aaaa = 1
    const accented = emptyChronicle()
    accented.milestones['ääää'] = 1
    expect(chronicleBytes(accented)).toBeGreaterThan(chronicleBytes(plain))
  })
})

describe('fitChronicle', () => {
  it('leaves a chronicle that already fits completely alone', () => {
    const data = emptyChronicle()
    data.species.crab = species('crab', 10, true)
    expect(fitChronicle(data)).toBe(data)
  })

  it('drops archived species until it fits', () => {
    const data = emptyChronicle()
    // Four creatures, each a quarter of the budget — one has to go.
    const chunk = Math.ceil(MAX_CHRONICLE_BYTES / 4)
    for (let i = 0; i < 4; i++) data.species[`s${i}`] = species(`s${i}`, i, true, chunk)

    const fitted = fitChronicle(data)
    expect(chronicleBytes(fitted)).toBeLessThanOrEqual(MAX_CHRONICLE_BYTES)
    expect(Object.keys(fitted.species).length).toBeLessThan(4)
  })

  it('sheds the least recently seen creature first', () => {
    const data = emptyChronicle()
    const chunk = Math.ceil(MAX_CHRONICLE_BYTES / 3)
    data.species.oldest = species('oldest', 1, true, chunk)
    data.species.middle = species('middle', 500, true, chunk)
    data.species.newest = species('newest', 900, true, chunk)

    const kept = Object.keys(fitChronicle(data).species)
    expect(kept).not.toContain('oldest')
    expect(kept).toContain('newest')
  })

  it('sacrifices a built-in before a summoned creature, whatever their ages', () => {
    const data = emptyChronicle()
    const chunk = Math.ceil(MAX_CHRONICLE_BYTES / 2)
    // The built-in is the more recent sighting, and still goes first: it can be
    // recovered by playing, and the drawn one cannot.
    data.species.builtin = species('builtin', 999, false, chunk)
    data.species.drawn = species('drawn', 1, true, chunk)

    const kept = Object.keys(fitChronicle(data).species)
    expect(kept).toEqual(['drawn'])
  })

  it('never sheds land records or milestones to make room', () => {
    const data = emptyChronicle()
    data.lands.tidepool = {
      elder: null,
      steadySeconds: 900,
      generations: 4,
      generationsBlueprintId: 'crab',
      generationsSpeciesName: 'Crab',
    }
    data.milestones['first-elder'] = 123
    const chunk = Math.ceil(MAX_CHRONICLE_BYTES / 2)
    for (let i = 0; i < 3; i++) data.species[`s${i}`] = species(`s${i}`, i, true, chunk)

    const fitted = fitChronicle(data)
    expect(fitted.lands.tidepool.steadySeconds).toBe(900)
    expect(fitted.milestones['first-elder']).toBe(123)
  })

  it('does not mutate the chronicle it was given', () => {
    const data = emptyChronicle()
    const chunk = Math.ceil(MAX_CHRONICLE_BYTES / 2)
    for (let i = 0; i < 3; i++) data.species[`s${i}`] = species(`s${i}`, i, true, chunk)

    fitChronicle(data)
    // The live in-memory chronicle must survive a flush unchanged — trimming for
    // transport is not the same as pruning the archive.
    expect(Object.keys(data.species)).toHaveLength(3)
  })
})
