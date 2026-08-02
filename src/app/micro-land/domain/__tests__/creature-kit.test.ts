import { describe, expect, it } from 'vitest'

import { MAX_PALETTE, sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import {
  type Draft,
  blankDraft,
  buildRawCreature,
  draftFromBlueprint,
  draftToArt,
  floodFill,
  inkBounds,
  planOf,
  resizeDraft,
  sizeForWidth,
  trimDraft,
} from '@/app/micro-land/domain/creature-kit'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

/** Colour in a rectangle on every frame of a draft. */
function fillRect(
  draft: Draft,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  hex: string
): Draft {
  const frames = draft.frames.map(cells => {
    const out = cells.slice()
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) out[y * draft.w + x] = hex
    }
    return out
  })
  return { ...draft, frames }
}

describe('drafts', () => {
  it('starts empty', () => {
    const draft = blankDraft(8, 8)
    expect(draft.frames).toHaveLength(2)
    expect(inkBounds(draft)).toBeNull()
  })

  it('keeps the drawing centred when the canvas changes', () => {
    const drawn = fillRect(blankDraft(8, 8), 3, 3, 4, 4, '#ff0000')
    const grown = resizeDraft(drawn, 14, 12)

    // 3 columns and 2 rows of new margin on the near side.
    expect(inkBounds(grown)).toEqual({ x0: 6, y0: 5, x1: 7, y1: 6 })
    expect(resizeDraft(grown, 8, 8)).toEqual(drawn)
  })

  it('crops the blank margin away, since sprite size is collision size', () => {
    const drawn = fillRect(blankDraft(28, 24), 10, 8, 15, 13, '#ff0000')
    const trimmed = trimDraft(drawn)
    expect([trimmed.w, trimmed.h]).toEqual([6, 6])
  })

  it('never crops below the minimum the blueprint contract allows', () => {
    const dot = fillRect(blankDraft(14, 12), 6, 6, 6, 6, '#ff0000')
    const trimmed = trimDraft(dot)
    expect(trimmed.w).toBeGreaterThanOrEqual(3)
    expect(trimmed.h).toBeGreaterThanOrEqual(3)
  })

  it('fills a region without leaking through diagonal gaps', () => {
    // A 3x3 ring of wall with a hollow centre, drawn on a 5x5 canvas.
    let draft = fillRect(blankDraft(5, 5), 1, 1, 3, 3, '#000000')
    draft = fillRect(draft, 2, 2, 2, 2, '#ffffff')
    const filled = floodFill(draft.frames[0], 5, 5, 2 * 5 + 2, '#ff0000')

    expect(filled[2 * 5 + 2]).toBe('#ff0000')
    // The outside is still untouched.
    expect(filled[0]).toBeNull()
  })
})

describe('draftToArt', () => {
  it('writes the most-used colour into the first palette slot', () => {
    let draft = fillRect(blankDraft(6, 6), 0, 0, 5, 5, '#112233')
    draft = fillRect(draft, 0, 0, 0, 0, '#445566')
    const art = draftToArt(draft, true)

    expect(art.palette.a).toBe('#112233')
    expect(Object.values(art.palette)).toContain('#445566')
    expect(art.frames[0][0][0]).toBe(art.frames[0][0][0].toLowerCase())
  })

  it('folds a thirteenth colour into its nearest neighbour instead of dropping it', () => {
    let draft = blankDraft(20, 4, 1)
    // Twelve well-used colours, then one rare near-black in the last column.
    for (let i = 0; i < MAX_PALETTE; i++) {
      const hex = `#${(i * 20).toString(16).padStart(2, '0').repeat(3)}`
      draft = fillRect(draft, i, 0, i, 3, hex)
    }
    draft = fillRect(draft, 15, 0, 15, 0, '#010101')

    const art = draftToArt(draft, true)
    expect(Object.keys(art.palette)).toHaveLength(MAX_PALETTE)
    // Folded, not punched out — the rare colour still renders as *something*.
    expect(art.frames[0][0][15]).not.toBe('.')
    expect(art.palette[art.frames[0][0][15]]).toBe('#000000')
  })

  it('round-trips through a blueprint', () => {
    let draft = fillRect(blankDraft(7, 5), 1, 1, 5, 3, '#33dd88')
    draft = fillRect(draft, 5, 1, 5, 1, '#ffffff')

    const bp = sanitizeBlueprint({ name: 'Round Trip', art: draftToArt(draft, true) })
    expect(draftFromBlueprint(bp)).toEqual({ ...draft, frameMs: bp.art.frameMs })
  })
})

describe('sizeForWidth', () => {
  it('follows the same scale the summoning prompt gives the model', () => {
    expect(sizeForWidth(4)).toBe(1)
    expect(sizeForWidth(8)).toBe(2)
    expect(sizeForWidth(10)).toBe(3)
    expect(sizeForWidth(14)).toBe(4)
    expect(sizeForWidth(20)).toBe(5)
    expect(sizeForWidth(28)).toBe(6)
  })
})

describe('buildRawCreature', () => {
  const drawn = fillRect(blankDraft(28, 24), 4, 4, 13, 13, '#33dd88')

  function build(overrides: Partial<Parameters<typeof buildRawCreature>[0]> = {}) {
    return sanitizeBlueprint(
      buildRawCreature({
        name: 'Test Thing',
        draft: drawn,
        planId: 'walk',
        dietId: 'plant',
        glows: false,
        fireproof: false,
        seed: null,
        ...overrides,
      })
    )
  }

  it('reads size off the trimmed drawing, not the canvas', () => {
    // Ten columns of ink on the biggest canvas is a cat, not a leviathan.
    expect(build().size).toBe(3)
  })

  it('gives a plant exactly one structural tag and nothing to eat', () => {
    const plant = build({ planId: 'root', dietId: 'meat' })
    expect(plant.tags.filter(t => ['plant', 'meat', 'mineral'].includes(t))).toEqual(['plant'])
    expect(plant.diet.eats).toEqual([])
    expect(plant.move.kind).toBe('root')
  })

  it('turns the toggles into real world behaviour', () => {
    const creature = build({ glows: true, fireproof: true })
    expect(creature.glow).toBeGreaterThan(0)
    expect(creature.tags).toContain('glow')
    expect(creature.body.immuneTo).toContain('lava')
  })

  it('keeps a seed creature tuned as it was when only the pixels changed', () => {
    const seed = sanitizeBlueprint({
      name: 'Cinder Wyrm',
      blurb: 'It swims through lava.',
      size: 5,
      tags: ['meat', 'beast'],
      move: { kind: 'walk', speed: 9.5, jump: 3, restlessness: 0.11 },
      diet: { eats: ['plant'], lifespanSeconds: 777 },
      body: { immuneTo: ['lava'] },
      dig: { through: ['stone'], speed: 2 },
    }) as CreatureBlueprint

    const same = build({ seed, name: 'Cinder Wyrm' })
    expect(same.move.speed).toBe(9.5)
    expect(same.diet.lifespanSeconds).toBe(777)
    expect(same.blurb).toBe('It swims through lava.')
    // Things no canvas can express come along for the ride.
    expect(same.dig.through).toEqual(['stone'])
    // ...but the drawing still decides how big it is.
    expect(same.size).toBe(3)
  })

  it('drops the seed tuning once the player changes how it moves', () => {
    const seed = sanitizeBlueprint({
      name: 'Cinder Wyrm',
      move: { kind: 'walk', speed: 9.5, jump: 3, restlessness: 0.11 },
      tags: ['meat', 'beast'],
      diet: { eats: ['plant'] },
    }) as CreatureBlueprint

    const swimmer = build({ seed, planId: 'swim' })
    expect(swimmer.move.kind).toBe('swim')
    expect(swimmer.move.speed).not.toBe(9.5)
    expect(swimmer.habitat.needs).toEqual(['water'])
  })

  it('never leaves a plant seed carrying a plant tag once it becomes an animal', () => {
    const seed = sanitizeBlueprint({
      name: 'Sunleaf',
      tags: ['plant'],
      move: { kind: 'root' },
      diet: { eats: [] },
    }) as CreatureBlueprint

    const animal = build({ seed, planId: 'walk', dietId: 'meat' })
    expect(animal.tags).toContain('meat')
    expect(animal.tags).not.toContain('plant')
    expect(animal.diet.eats).toEqual(['meat'])
  })

  it('makes the Hopper chip a walker that bounces, and Walker one that does not', () => {
    const hopper = build({ planId: 'hop' }) as { move: CreatureBlueprint['move'] }
    expect(hopper.move.kind).toBe('walk')
    expect(hopper.move.hop).toBeGreaterThan(0)

    const walker = build({ planId: 'walk' }) as { move: CreatureBlueprint['move'] }
    expect(walker.move.hop).toBe(0)
  })
})

describe('planOf', () => {
  it('lights the Hopper chip for a springy walker and Walker for the rest', () => {
    const springy = sanitizeBlueprint({
      name: 'Frog',
      move: { kind: 'walk', hop: 1 },
    }) as CreatureBlueprint
    expect(planOf(springy)).toBe('hop')

    const plodding = sanitizeBlueprint({
      name: 'Ox',
      move: { kind: 'walk' },
    }) as CreatureBlueprint
    expect(planOf(plodding)).toBe('walk')
  })

  it('treats a blueprint written before hopping existed as a plain walker', () => {
    // Worlds and chronicles keep summoned blueprints exactly as they were
    // stored, so one saved before `hop` was a field arrives without it.
    const old = {
      ...(sanitizeBlueprint({ name: 'Old', move: { kind: 'walk' } }) as CreatureBlueprint),
    }
    old.move = { kind: 'walk', speed: 4, jump: 8, restlessness: 0.3 } as CreatureBlueprint['move']
    expect(planOf(old)).toBe('walk')
  })
})
