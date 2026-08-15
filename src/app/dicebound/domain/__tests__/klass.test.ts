import { describe, expect, it } from 'vitest'

import {
  type Character,
  RANK_THRESHOLDS,
  blankAttributes,
  recordSkillUse,
  startingSkills,
} from '@/app/dicebound/domain/character'
import { MAX_LEVEL, emptyKit } from '@/app/dicebound/domain/kit'
import {
  CLASS_AT_LEVEL,
  FALLBACK_CLASSES,
  NARROW_SHARE,
  classShape,
  fallbackClass,
  readClass,
  shouldNameClass,
} from '@/app/dicebound/domain/klass'

function character(overrides: Partial<Character> = {}): Character {
  return {
    name: 'Ilda',
    concept: 'a nervous apprentice locksmith who talks too much',
    reading: '',
    attributes: blankAttributes(),
    skills: {},
    ...overrides,
  }
}

describe('classShape', () => {
  it('the class comes from the skills that were actually used, not the ones on the sheet at creation', () => {
    // Three skills handed over for writing a sentence, and then twenty checks
    // spent on something else entirely. The name has to describe the twenty.
    let sheet = character({ skills: startingSkills(['humor', 'society', 'observation']) })
    for (let i = 0; i < 20; i++) sheet = recordSkillUse(sheet, 'hand-eye').character

    const shape = classShape(sheet)
    expect(shape.skills[0].skill).toBe('hand-eye')
    expect(shape.skills[0].uses).toBe(20)
  })

  it('reads uses rather than ranks, because rank flattens everything above it', () => {
    // Both of these are rank 3. They are not the same character.
    const sheet = character({
      skills: {
        'hand-eye': { uses: 40, rank: 3 },
        balance: { uses: RANK_THRESHOLDS[2], rank: 3 },
      },
    })
    expect(classShape(sheet).skills[0].skill).toBe('hand-eye')
  })

  it('calls concentrated play narrow and ranging play broad', () => {
    const focused = character({
      skills: { 'hand-eye': { uses: 30, rank: 3 }, humor: { uses: 2, rank: 0 } },
    })
    expect(classShape(focused).narrow).toBe(true)

    // Six skills, evenly spread: the top three hold half the use, under the
    // two-thirds line.
    const ranging = character({
      skills: Object.fromEntries(
        ['hand-eye', 'humor', 'balance', 'observation', 'society', 'stomach'].map(skill => [
          skill,
          { uses: 5, rank: 1 },
        ])
      ),
    })
    const shape = classShape(ranging)
    expect(shape.skills.reduce((sum, e) => sum + e.uses, 0) / shape.total).toBeLessThan(
      NARROW_SHARE
    )
    expect(shape.narrow).toBe(false)
  })

  it('ignores skills nobody has touched', () => {
    const sheet = character({
      skills: { 'hand-eye': { uses: 4, rank: 1 }, balance: { uses: 0, rank: 0 } },
    })
    expect(classShape(sheet).skills.map(e => e.skill)).toEqual(['hand-eye'])
  })

  it('is not narrow for a character with no history — they are unwritten, not focused', () => {
    const shape = classShape(character())
    expect(shape.narrow).toBe(false)
    expect(shape.total).toBe(0)
  })
})

describe('fallbackClass', () => {
  it('a failed generation still names the character', () => {
    // Play never blocks on a model call. Being told the cave could not form an
    // opinion about you is worse than being called a Wayfarer.
    let sheet = character()
    for (let i = 0; i < 20; i++) sheet = recordSkillUse(sheet, 'hand-eye').character

    const named = fallbackClass(classShape(sheet))
    expect(named.name).toBeTruthy()
    expect(named.note).toContain('hand')
  })

  it('does not call a generalist by a specialist name', () => {
    // The one way this table could actually be wrong about somebody.
    const ranging = character({
      skills: Object.fromEntries(
        ['hand-eye', 'humor', 'balance', 'observation', 'society', 'stomach'].map(skill => [
          skill,
          { uses: 5, rank: 1 },
        ])
      ),
    })
    const shape = classShape(ranging)
    const table = FALLBACK_CLASSES[shape.attributes[0]]
    expect(fallbackClass(shape).name).toBe(table.broad)
  })

  it('has a name for every attribute, so no character can fall through it', () => {
    for (const entry of Object.values(FALLBACK_CLASSES)) {
      expect(entry.narrow).toBeTruthy()
      expect(entry.broad).toBeTruthy()
    }
  })
})

describe('readClass', () => {
  it('a number in the model response is discarded', () => {
    // Not clamped. Clamping is what you do to a number you wanted; this is one
    // nobody asked for, and keeping a clamped version of it is the first step
    // toward a class that modifies something.
    const named = readClass({
      name: 'Cat Burglar',
      note: 'You go in through the window.',
      bonus: 3,
      attributes: { dexterity: 2 },
    })
    expect(named).toEqual({ name: 'Cat Burglar', note: 'You go in through the window.' })
    expect(named).not.toHaveProperty('bonus')
    expect(named).not.toHaveProperty('attributes')
  })

  it('returns nothing usable rather than an empty name, so the caller falls back', () => {
    expect(readClass({ note: 'You are something.' })).toBeNull()
    expect(readClass({ name: '   ' })).toBeNull()
    expect(readClass(null)).toBeNull()
    expect(readClass('Cat Burglar')).toBeNull()
  })

  it('takes a name without a line, rather than refusing the whole thing', () => {
    expect(readClass({ name: 'Ropewalker' })).toEqual({ name: 'Ropewalker', note: '' })
  })
})

describe('shouldNameClass', () => {
  it('the class is named once and does not change on the next level', () => {
    // Not re-rolled as the character grows. Whether it should ever be revisited
    // is a separate decision, and this must not settle it by accident.
    const unnamed = { ...emptyKit(), className: null }
    expect(shouldNameClass(unnamed, CLASS_AT_LEVEL)).toBe(true)

    const named = { ...emptyKit(), className: 'Cat Burglar' }
    expect(shouldNameClass(named, CLASS_AT_LEVEL)).toBe(false)
    expect(shouldNameClass(named, 7)).toBe(false)
    expect(shouldNameClass(named, MAX_LEVEL)).toBe(false)
  })

  it('says nothing about a character who has not got there yet', () => {
    // Before the level fix this fired at creation, on a histogram holding
    // nothing but the three skills the player was handed for a sentence.
    expect(shouldNameClass({ ...emptyKit(), className: null }, 1)).toBe(false)
  })
})
