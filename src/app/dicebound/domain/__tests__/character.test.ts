import { describe, expect, it } from 'vitest'

import { ATTRIBUTE_IDS, applicableSkill } from '@/app/dicebound/domain/attributes'
import {
  ATTRIBUTE_BUDGET,
  type Character,
  MAX_ATTRIBUTE,
  MAX_SKILL_RANK,
  MAX_STARTING_SKILLS,
  MIN_ATTRIBUTE,
  RANK_THRESHOLDS,
  WINDOW_MINUTES,
  blankAttributes,
  earnedRanks,
  earnedSkills,
  normalizeAttributes,
  openWindows,
  rankFor,
  recordSkillUse,
  startingSkills,
  usesToNextRank,
} from '@/app/dicebound/domain/character'
import { levelFor } from '@/app/dicebound/domain/kit'

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

describe('startingSkills', () => {
  it('seeds at the first threshold, so the stored rank is one rankFor already agrees with', () => {
    // Seeded at uses 0 the record would claim rank 1 while rankFor(0) says 0,
    // and the first time the skill came up it would silently correct itself
    // downward — the player would watch a skill they started with get worse.
    const skills = startingSkills(['hand-eye'])
    expect(skills['hand-eye']).toEqual({ uses: RANK_THRESHOLDS[0], rank: 1, seeded: true })
    expect(rankFor(skills['hand-eye']!.uses)).toBe(1)
  })

  it('carries on from the head start rather than restarting the climb', () => {
    // The next rank arrives at RANK_THRESHOLDS[1] total uses, not at
    // RANK_THRESHOLDS[1] uses beyond the head start.
    let sheet = character({ skills: startingSkills(['hand-eye']) })
    const needed = RANK_THRESHOLDS[1] - RANK_THRESHOLDS[0]

    for (let i = 0; i < needed; i++) {
      sheet = recordSkillUse(sheet, 'hand-eye').character
    }
    expect(sheet.skills['hand-eye']).toEqual({
      uses: RANK_THRESHOLDS[1],
      rank: 2,
      seeded: true,
    })
  })

  it('keeps the seeded marker through a use — a head start does not become an achievement', () => {
    // recordSkillUse used to rebuild the record from `{ uses, rank }`, which
    // would clear the marker on the first check and hand the player a level for
    // touching a skill they were given.
    const sheet = recordSkillUse(character({ skills: startingSkills(['hand-eye']) }), 'hand-eye')
    expect(sheet.character.skills['hand-eye']?.seeded).toBe(true)
  })

  it('grants three when a model proposes six — the model proposes, code decides how many', () => {
    const skills = startingSkills([
      'hand-eye',
      'humor',
      'observation',
      'balance',
      'stealth',
      'engineering',
    ])
    expect(Object.keys(skills)).toHaveLength(MAX_STARTING_SKILLS)
  })

  it('drops a skill the game does not have rather than storing it', () => {
    const skills = startingSkills(['telekinesis', 'hand-eye'])
    expect(Object.keys(skills)).toEqual(['hand-eye'])
  })

  it('refuses innate skills — they are what you are, not what you have practised', () => {
    // Spending a starting slot on Size would also mean a character described as
    // very small got fewer things they are good at for being described.
    const skills = startingSkills(['size', 'looks', 'hand-eye'])
    expect(Object.keys(skills)).toEqual(['hand-eye'])
  })

  it('does not let a repeated skill eat two of the three slots', () => {
    const skills = startingSkills(['humor', 'humor', 'hand-eye', 'observation'])
    expect(Object.keys(skills).sort()).toEqual(['hand-eye', 'humor', 'observation'])
  })

  it('returns nothing for a model that sent nothing usable, rather than throwing', () => {
    expect(startingSkills(undefined)).toEqual({})
    expect(startingSkills('hand-eye')).toEqual({})
    expect(startingSkills([null, 42, {}])).toEqual({})
  })
})

describe('earnedRanks', () => {
  it('a character who has only written a sentence is level 1', () => {
    // The bug this function exists for: three seeded ranks made levelFor
    // return 2 before the first die, which made a tier 1 power grantable on
    // turn 1 and fired class discovery on a histogram of skills nobody used.
    const sheet = character({ skills: startingSkills(['hand-eye', 'humor', 'observation']) })
    expect(earnedRanks(sheet)).toBe(0)
    expect(levelFor(earnedRanks(sheet))).toBe(1)
  })

  it('a seeded skill that reaches rank 2 in play has earned one rank', () => {
    let sheet = character({ skills: startingSkills(['hand-eye']) })
    for (let i = 0; i < RANK_THRESHOLDS[1] - RANK_THRESHOLDS[0]; i++) {
      sheet = recordSkillUse(sheet, 'hand-eye').character
    }
    expect(sheet.skills['hand-eye']?.rank).toBe(2)
    expect(earnedRanks(sheet)).toBe(1)
  })

  it('counts a rank nobody handed over in full', () => {
    // Rank 1 on a skill the player ground out is worth the same as rank 2 on a
    // skill they were given — the head start is subtracted once, not taxed.
    const granted = character({ skills: startingSkills(['hand-eye']) })
    const ground = character({ skills: { balance: { uses: RANK_THRESHOLDS[0], rank: 1 } } })
    expect(earnedRanks(ground) - earnedRanks(granted)).toBe(1)
  })

  it('an innate −2 is not a rank and does not move the level', () => {
    // Size is something the character is. It is subtracted from every Size
    // check and it must not also slow their levelling for being described.
    const sheet = character({ skills: { size: { uses: 0, rank: -2 } } })
    expect(earnedRanks(sheet)).toBe(0)
    expect(levelFor(earnedRanks(sheet))).toBe(1)
  })

  it('a character saved before the marker existed keeps the level they had', () => {
    // Deliberately generous to live campaigns. An unmarked rank reads as
    // earned, so nobody drops a level on deploy.
    const legacy = character({
      skills: {
        'hand-eye': { uses: RANK_THRESHOLDS[0], rank: 1 },
        humor: { uses: RANK_THRESHOLDS[0], rank: 1 },
        observation: { uses: RANK_THRESHOLDS[0], rank: 1 },
      },
    })
    expect(earnedRanks(legacy)).toBe(3)
    expect(levelFor(earnedRanks(legacy))).toBe(2)
  })
})

describe('openWindows', () => {
  /** Use a skill until it tops out, at the given clock minute. */
  function mastered(at: number): Character {
    let sheet = character()
    for (let i = 0; i < RANK_THRESHOLDS[2]; i++) {
      sheet = recordSkillUse(sheet, 'balance', at).character
    }
    return sheet
  }

  it('a skill reaching rank 3 opens a window', () => {
    const sheet = mastered(1000)
    expect(sheet.skills.balance?.rank).toBe(MAX_SKILL_RANK)
    expect(openWindows(sheet, 1000).map(w => w.skill)).toEqual(['balance'])
  })

  it('a skill short of the top rank opens nothing', () => {
    let sheet = character()
    for (let i = 0; i < RANK_THRESHOLDS[1]; i++) {
      sheet = recordSkillUse(sheet, 'balance', 1000).character
    }
    expect(sheet.skills.balance?.rank).toBe(2)
    expect(openWindows(sheet, 1000)).toEqual([])
  })

  it('a window opened long enough ago is closed and does not reopen', () => {
    // A window that never closes is a standing instruction, and a standing
    // instruction gets obeyed eventually just to make it stop.
    const sheet = mastered(1000)
    expect(openWindows(sheet, 1000 + WINDOW_MINUTES)).toHaveLength(1)
    expect(openWindows(sheet, 1000 + WINDOW_MINUTES + 1)).toEqual([])
  })

  it('using the skill again does not reopen a closed window', () => {
    // maturedAt is stamped once, on the crossing use. Re-stamping would make
    // the window reopen every time the skill came up.
    let sheet = mastered(1000)
    sheet = recordSkillUse(sheet, 'balance', 99_000).character
    expect(sheet.skills.balance?.maturedAt).toBe(1000)
    expect(openWindows(sheet, 99_000)).toEqual([])
  })

  it('an innate skill never opens one, however often it comes up', () => {
    // Innate ranks never advance, so nothing ever crosses the threshold.
    let sheet = character({ skills: { size: { uses: 0, rank: -2 } } })
    for (let i = 0; i < 40; i++) sheet = recordSkillUse(sheet, 'size', 500).character
    expect(openWindows(sheet, 500)).toEqual([])
  })

  it('a matured skill is not by itself a source — it names a skill, never an entity', () => {
    // Twenty turns of throwing burning things is not provenance. The window
    // says what matured; canGrantPower still demands an entity the world holds,
    // and this returns nothing that could be mistaken for one.
    const window = openWindows(mastered(1000), 1000)[0]
    expect(Object.keys(window).sort()).toEqual(['since', 'skill'])
    expect(window.skill).toBe('balance')
  })
})
