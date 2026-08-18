/**
 * Version 1 → 2, and the wire in general.
 *
 * The stakes here are higher than they look: `validateCampaign` used to refuse
 * any version it did not recognise, so bumping the constant without this would
 * have shown every existing player an empty game and no way back.
 */
import { describe, expect, it } from 'vitest'

import { undamagedBody } from '@/app/dicebound/domain/body'
import {
  CAMPAIGN_VERSION,
  emptyStats,
  validateCampaign,
  validateChapter,
} from '@/app/dicebound/domain/campaign'
import { emptyKit } from '@/app/dicebound/domain/kit'
import { emptyWorld } from '@/app/dicebound/domain/world'

function v1(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    premise: 'a lighthouse that has started walking',
    title: 'The Long Walk Out',
    character: {
      name: 'Pell',
      concept: 'a very small person with a very large hammer',
      reading: '',
      attributes: { dexterity: 2, strength: -1 },
      skills: { size: { uses: 0, rank: -2 }, balance: { uses: 4, rank: 1 } },
    },
    transcript: [{ kind: 'narration', text: 'The stairs have started moving again.' }],
    synopsis: '',
    stats: emptyStats(),
    lastPlayedDay: '2026-08-12',
    currentStreak: 3,
    longestStreak: 3,
    startedAt: 1,
    updatedAt: 2,
    ...overrides,
  }
}

describe('version 1 campaigns', () => {
  it('are read, not refused', () => {
    const campaign = validateCampaign(v1())
    expect(campaign).not.toBeNull()
    expect(campaign?.version).toBe(CAMPAIGN_VERSION)
  })

  it('keep everything the player actually had', () => {
    const campaign = validateCampaign(v1())
    expect(campaign?.title).toBe('The Long Walk Out')
    expect(campaign?.character.name).toBe('Pell')
    expect(campaign?.transcript).toHaveLength(1)
    expect(campaign?.currentStreak).toBe(3)
  })

  it('arrive with an empty world and a clock at zero', () => {
    // Nothing is lost, because there was never anything in these fields to
    // lose. Reconciliation fills the graph in from the transcript.
    const campaign = validateCampaign(v1())
    expect(campaign?.world).toEqual(emptyWorld())
    expect(campaign?.kit).toEqual(emptyKit())
    expect(campaign?.chapters).toBe(0)
  })

  it('arrive with an undamaged body, because injury did not exist when they were saved', () => {
    expect(validateCampaign(v1())?.body).toEqual(undamagedBody())
  })

  it('ignore any version 2 fields that somehow came along', () => {
    const campaign = validateCampaign(v1({ kit: { className: 'Cat Burglar' }, chapters: 4 }))
    expect(campaign?.kit.className).toBeNull()
  })
})

describe('version 2 campaigns', () => {
  it('round-trip the world graph', () => {
    const campaign = validateCampaign({
      ...v1(),
      version: 2,
      chapters: 2,
      world: {
        clock: { elapsed: 480, startHour: 9 },
        entities: { kell: { id: 'kell', name: 'Bosun Kell', kind: 'actor', disposition: 2 } },
        edges: [],
      },
      kit: { className: 'Cat Burglar', items: [], powers: [], species: null },
    })

    expect(campaign?.world.clock.elapsed).toBe(480)
    expect(campaign?.world.entities.kell?.name).toBe('Bosun Kell')
    expect(campaign?.kit.className).toBe('Cat Burglar')
    expect(campaign?.chapters).toBe(2)
  })

  it('load with an undamaged body — the whole of the version 2 to 3 migration', () => {
    // The stakes here are a step above the last bump. Refusing a version 2
    // campaign would delete every story in existence; repairing its missing body
    // toward the middle of the track would kill characters over an absent field.
    const campaign = validateCampaign({ ...v1(), version: 2 })
    expect(campaign?.body).toEqual(undamagedBody())
    expect(campaign?.version).toBe(CAMPAIGN_VERSION)
  })
})

describe('version 3 campaigns', () => {
  it('keep the rung the character was actually on', () => {
    const campaign = validateCampaign({ ...v1(), version: 3, body: { condition: 'bloodied' } })
    expect(campaign?.body.condition).toBe('bloodied')
  })

  it('read a body full of garbage from the wire as undamaged rather than throwing', () => {
    // A body is the one field where a parse failure could cost the player a
    // character rather than an index, so it repairs in the survivable direction.
    expect(validateCampaign({ ...v1(), version: 3, body: 'dead' })?.body).toEqual(undamagedBody())
    expect(
      validateCampaign({ ...v1(), version: 3, body: { condition: 'exploded' } })?.body
    ).toEqual(undamagedBody())
  })
})

describe('what is still refused', () => {
  it('a version from the future', () => {
    expect(validateCampaign({ ...v1(), version: 99 })).toBeNull()
  })

  it('a campaign with no character', () => {
    expect(validateCampaign({ ...v1(), character: null })).toBeNull()
  })

  it('anything that is not an object at all', () => {
    expect(validateCampaign('my story')).toBeNull()
    expect(validateCampaign(null)).toBeNull()
  })
})

describe('skill ranks over the wire', () => {
  it('survives a negative innate rank', () => {
    // Regression. This clamped the floor to 0, which quietly repealed the
    // negative-innate-rank fix on the first round-trip: a character described
    // as very small kept being described that way, and rolled as average.
    const campaign = validateCampaign(v1())
    expect(campaign?.character.skills.size?.rank).toBe(-2)
  })

  it('still refuses a rank nobody could have earned', () => {
    const campaign = validateCampaign(
      v1({
        character: {
          ...v1().character,
          skills: { balance: { uses: 4, rank: 99 } },
        },
      })
    )
    expect(campaign?.character.skills.balance?.rank).toBe(3)
  })
})

describe('validateChapter', () => {
  it('reads an archived chapter back', () => {
    const chapter = validateChapter({
      index: 0,
      entries: [{ kind: 'narration', text: 'The tide came in early.' }],
      synopsis: 'Kell was owed for the boat.',
      archivedAt: 900,
    })
    expect(chapter?.entries).toHaveLength(1)
    expect(chapter?.archivedAt).toBe(900)
  })

  it('refuses a chapter with nothing in it', () => {
    expect(validateChapter({ index: 0, entries: [] })).toBeNull()
    expect(validateChapter(null)).toBeNull()
  })
})
