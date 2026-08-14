import { describe, expect, it } from 'vitest'

import { ATTRIBUTE_IDS, applicableSkill } from '@/app/dicebound/domain/attributes'
import {
  ATTRIBUTE_BUDGET,
  type Character,
  MAX_ATTRIBUTE,
  MIN_ATTRIBUTE,
  RANK_THRESHOLDS,
  blankAttributes,
  earnedSkills,
  normalizeAttributes,
  rankFor,
  recordSkillUse,
  usesToNextRank,
} from '@/app/dicebound/domain/character'

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

function total(attributes: Record<string, number>): number {
  return Object.values(attributes).reduce((sum, n) => sum + n, 0)
}

describe('applicableSkill', () => {
  it('accepts a skill that sits under the attribute being tested', () => {
    expect(applicableSkill('dexterity', 'balance')).toBe('balance')
  })

  it('drops a skill borrowed from another attribute', () => {
    // Engineering must not help you jump a fence, however the DM labelled it.
    expect(applicableSkill('strength', 'engineering')).toBeNull()
  })

  it('drops anything that is not a skill at all', () => {
    expect(applicableSkill('charm', 'persuasion')).toBeNull()
    expect(applicableSkill('charm', null)).toBeNull()
    expect(applicableSkill('charm', undefined)).toBeNull()
  })
})

describe('normalizeAttributes', () => {
  it('clamps each attribute into range', () => {
    const out = normalizeAttributes({ strength: 99, charm: -99 })
    expect(out.strength).toBe(MAX_ATTRIBUTE)
    expect(out.charm).toBe(MIN_ATTRIBUTE)
  })

  it('fills anything missing with zero', () => {
    const out = normalizeAttributes({})
    for (const id of ATTRIBUTE_IDS) expect(out[id]).toBe(0)
  })

  it('ignores non-numbers rather than producing NaN', () => {
    const out = normalizeAttributes({ wisdom: 'lots' as unknown as number })
    expect(out.wisdom).toBe(0)
  })

  it('enforces the budget on an overspent sheet', () => {
    // A model handing out a character who is great at everything.
    const out = normalizeAttributes(Object.fromEntries(ATTRIBUTE_IDS.map(id => [id, 3])))
    expect(total(out)).toBe(ATTRIBUTE_BUDGET)
  })

  it('shaves the highest first, so the best thing stays the best thing', () => {
    const out = normalizeAttributes({ dexterity: 3, charm: 3, power: 1, wisdom: 1 })
    expect(total(out)).toBe(ATTRIBUTE_BUDGET)
    expect(out.dexterity).toBeGreaterThanOrEqual(out.power)
    expect(out.charm).toBeGreaterThanOrEqual(out.wisdom)
  })

  it('leaves an underspent sheet alone — a weak character is allowed', () => {
    const out = normalizeAttributes({ dexterity: 1, power: -2 })
    expect(total(out)).toBe(-1)
  })
})

describe('rankFor', () => {
  it('advances at the thresholds and stops at the cap', () => {
    expect(rankFor(0)).toBe(0)
    expect(rankFor(RANK_THRESHOLDS[0] - 1)).toBe(0)
    expect(rankFor(RANK_THRESHOLDS[0])).toBe(1)
    expect(rankFor(RANK_THRESHOLDS[1])).toBe(2)
    expect(rankFor(RANK_THRESHOLDS[2])).toBe(3)
    expect(rankFor(9999)).toBe(3)
  })
})

describe('usesToNextRank', () => {
  it('counts down to the next threshold', () => {
    expect(usesToNextRank(0)).toBe(RANK_THRESHOLDS[0])
    expect(usesToNextRank(RANK_THRESHOLDS[0])).toBe(RANK_THRESHOLDS[1] - RANK_THRESHOLDS[0])
  })

  it('returns null once the skill is maxed', () => {
    expect(usesToNextRank(RANK_THRESHOLDS[2])).toBeNull()
  })
})

describe('recordSkillUse', () => {
  it('counts a use without granting a rank yet', () => {
    const { character: next, earned } = recordSkillUse(character(), 'balance')
    expect(next.skills.balance).toEqual({ uses: 1, rank: 0 })
    expect(earned).toBeNull()
  })

  it('grants the rank exactly once, on the threshold use', () => {
    let subject = character()
    let grants = 0
    for (let i = 0; i < RANK_THRESHOLDS[1]; i++) {
      const result = recordSkillUse(subject, 'balance')
      subject = result.character
      if (result.earned) grants += 1
    }
    expect(subject.skills.balance?.rank).toBe(2)
    expect(grants).toBe(2)
  })

  it('advances on use, not on success — failing still teaches', () => {
    // recordSkillUse is never told the outcome. That is the design: the
    // character who keeps falling off the log is learning to balance.
    let subject = character()
    for (let i = 0; i < RANK_THRESHOLDS[0]; i++) {
      subject = recordSkillUse(subject, 'balance').character
    }
    expect(subject.skills.balance?.rank).toBe(1)
  })

  it('never advances an innate skill, however often it comes up', () => {
    let subject = character({ skills: { size: { uses: 0, rank: 2 } } })
    for (let i = 0; i < 50; i++) {
      const result = recordSkillUse(subject, 'size')
      subject = result.character
      expect(result.earned).toBeNull()
    }
    expect(subject.skills.size?.rank).toBe(2)
    expect(subject.skills.size?.uses).toBe(50)
  })

  it('does not mutate the character it was given', () => {
    const before = character()
    recordSkillUse(before, 'balance')
    expect(before.skills.balance).toBeUndefined()
  })

  it('ignores a skill id it does not know', () => {
    const before = character()
    const { character: after, earned } = recordSkillUse(
      before,
      'telekinesis' as unknown as 'balance'
    )
    expect(after).toBe(before)
    expect(earned).toBeNull()
  })
})

describe('earnedSkills', () => {
  it('includes a negative innate rank — it is live on every check of that skill', () => {
    // "a very small person" produces Size −2, which is subtracted from every
    // Size check. If this filtered on `> 0`, the DM would never be told the
    // character was small while the die card kept applying the penalty.
    const subject = character({ skills: { size: { uses: 0, rank: -2 } } })
    expect(earnedSkills(subject).map(entry => entry.skill)).toEqual(['size'])
  })

  it('lists only skills that actually reached a rank, best first', () => {
    const subject = character({
      skills: {
        balance: { uses: 9, rank: 2 },
        humor: { uses: 4, rank: 1 },
        jumping: { uses: 2, rank: 0 },
      },
    })
    expect(earnedSkills(subject).map(entry => entry.skill)).toEqual(['balance', 'humor'])
  })
})
