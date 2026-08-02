import { describe, expect, it } from 'vitest'

import { MOVE_WORDS } from '@/app/micro-land/domain/blueprint'
import { BUILTIN_CREATURES } from '@/app/micro-land/domain/config/creatures'
import {
  type CreatureFilter,
  EMPTY_FILTER,
  MOVE_ORDER,
  SIZE_BANDS,
  activeConditionCount,
  describeFilter,
  filterOptions,
  isFilterActive,
  isGlowing,
  isLavaProof,
  matchesFilter,
  sizeBand,
} from '@/app/micro-land/domain/creature-filter'
import type { CreatureBlueprint, LocomotionKind } from '@/app/micro-land/domain/types'

/**
 * A blueprint stub carrying only the fields the filter reads.
 *
 * Deliberately not run through `sanitizeBlueprint`: these tests are about the
 * predicate, and building thirty full literals with valid pixel art to assert a
 * size comparison would bury the thing being tested. The real roster is asserted
 * against separately, below.
 */
function bp(over: {
  id: string
  size?: number
  kind?: LocomotionKind
  glow?: number
  immuneTo?: string[]
}): CreatureBlueprint {
  return {
    id: over.id,
    name: over.id,
    blurb: '',
    size: over.size ?? 2,
    tags: [],
    art: { palette: {}, frames: [['.']], frameMs: 200, faceMotion: false },
    body: {
      mass: 1,
      bounce: 0,
      drag: 0.3,
      buoyancy: 0.8,
      immuneTo: (over.immuneTo ?? []) as CreatureBlueprint['body']['immuneTo'],
    },
    move: { kind: over.kind ?? 'walk', speed: 3, jump: 0, hop: 0, restlessness: 0.2 },
    diet: {
      eats: [],
      fears: [],
      hungerRate: 0,
      starveSeconds: 60,
      breedAt: 0.7,
      lifespanSeconds: 100,
    },
    senses: { sight: 8 },
    habitat: { needs: null, drowns: true },
    dig: { through: [], speed: 1 },
    death: { becomes: null, particleColor: '#ffffff', particleCount: 0 },
    aura: null,
    glow: over.glow ?? 0,
  }
}

const filter = (over: Partial<CreatureFilter>): CreatureFilter => ({ ...EMPTY_FILTER, ...over })

describe('predicates', () => {
  it('counts any light at all as glowing', () => {
    expect(isGlowing(bp({ id: 'a', glow: 0.05 }))).toBe(true)
    expect(isGlowing(bp({ id: 'b', glow: 0 }))).toBe(false)
  })

  it('asks for lava by name rather than trusting a non-empty immunity list', () => {
    expect(isLavaProof(bp({ id: 'a', immuneTo: ['lava'] }))).toBe(true)
    expect(isLavaProof(bp({ id: 'b', immuneTo: ['lava', 'stone'] }))).toBe(true)
    // Immune to something, but not to the thing the chip promises.
    expect(isLavaProof(bp({ id: 'c', immuneTo: ['acid'] }))).toBe(false)
    expect(isLavaProof(bp({ id: 'd' }))).toBe(false)
  })

  it('bands cover every size the schema allows, with no gaps or overlaps', () => {
    for (let size = 1; size <= 6; size++) {
      const bands = SIZE_BANDS.filter(b => size >= b.min && size <= b.max)
      expect(bands).toHaveLength(1)
    }
    expect(sizeBand(bp({ id: 'a', size: 1 }))).toBe('tiny')
    expect(sizeBand(bp({ id: 'b', size: 4 }))).toBe('medium')
    expect(sizeBand(bp({ id: 'c', size: 6 }))).toBe('huge')
  })
})

describe('matchesFilter', () => {
  it('keeps everything while empty', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
    for (const creature of BUILTIN_CREATURES)
      expect(matchesFilter(creature, EMPTY_FILTER)).toBe(true)
  })

  it('ORs within an axis', () => {
    const f = filter({ moves: ['fly', 'swim'] })
    expect(matchesFilter(bp({ id: 'a', kind: 'fly' }), f)).toBe(true)
    expect(matchesFilter(bp({ id: 'b', kind: 'swim' }), f)).toBe(true)
    expect(matchesFilter(bp({ id: 'c', kind: 'walk' }), f)).toBe(false)
  })

  it('ANDs across axes', () => {
    const f = filter({ moves: ['fly'], sizes: ['huge'], glows: true, lavaProof: true })
    const match = bp({ id: 'match', kind: 'fly', size: 6, glow: 0.5, immuneTo: ['lava'] })
    expect(matchesFilter(match, f)).toBe(true)
    // Failing any single axis is enough to drop it.
    expect(matchesFilter({ ...match, move: { ...match.move, kind: 'walk' } }, f)).toBe(false)
    expect(matchesFilter({ ...match, size: 2 }, f)).toBe(false)
    expect(matchesFilter({ ...match, glow: 0 }, f)).toBe(false)
    expect(matchesFilter({ ...match, body: { ...match.body, immuneTo: [] } }, f)).toBe(false)
  })

  it('counts conditions rather than axes', () => {
    expect(activeConditionCount(EMPTY_FILTER)).toBe(0)
    expect(activeConditionCount(filter({ moves: ['fly', 'swim'], glows: true }))).toBe(3)
  })
})

describe('filterOptions', () => {
  it('only offers what the roster can actually answer', () => {
    const options = filterOptions([
      bp({ id: 'a', kind: 'walk', size: 1 }),
      bp({ id: 'b', kind: 'walk', size: 2 }),
    ])
    expect(options.moves).toEqual(['walk'])
    expect(options.sizes).toEqual(['tiny'])
    expect(options.glows).toBe(false)
    expect(options.lavaProof).toBe(false)
  })

  it('offers every axis the built-in roster spans', () => {
    const options = filterOptions([...BUILTIN_CREATURES])
    // The roster is meant to cover all six ways of moving; if a rewrite drops
    // one, the chip quietly disappears and this is the only thing that notices.
    expect(options.moves).toEqual(MOVE_ORDER)
    expect(options.sizes).toEqual(['tiny', 'medium', 'huge'])
    expect(options.glows).toBe(true)
    expect(options.lavaProof).toBe(true)
  })

  it('keeps chips in a stable order regardless of roster order', () => {
    const forwards = filterOptions([bp({ id: 'a', kind: 'root' }), bp({ id: 'b', kind: 'walk' })])
    const backwards = filterOptions([bp({ id: 'b', kind: 'walk' }), bp({ id: 'a', kind: 'root' })])
    expect(forwards.moves).toEqual(backwards.moves)
    expect(forwards.moves).toEqual(['walk', 'root'])
  })

  it('every option a chip can show has a word to show', () => {
    for (const kind of MOVE_ORDER) expect(MOVE_WORDS[kind]).toBeTruthy()
  })
})

describe('describeFilter', () => {
  it('says what was asked for, in the words the chips used', () => {
    expect(describeFilter(filter({ moves: ['fly'] }))).toBe('flies')
    expect(describeFilter(filter({ moves: ['fly', 'swim'] }))).toBe('flies or swims')
    expect(describeFilter(filter({ sizes: ['huge'], lavaProof: true }))).toBe('huge · lava-proof')
    expect(describeFilter(EMPTY_FILTER)).toBe('')
  })

  it('lists size bands in band order, not tap order', () => {
    expect(describeFilter(filter({ sizes: ['huge', 'tiny'] }))).toBe('tiny or huge')
  })
})
