/**
 * The run boundary.
 *
 * Every rule here exists because the alternative is a specific, playable bug:
 * a dead character handed a composer, a story that un-ends on reload, or an
 * ending whose timestamp moves every time the save is validated. The last one
 * sounds cosmetic and is not — the ending is the only thing that will ever say
 * *when* a story finished, and everything phase 3 deferred reads it.
 */
import { describe, expect, it } from 'vitest'

import {
  CAMPAIGN_VERSION,
  type Campaign,
  isEnded,
  newCampaign,
  validateCampaign,
} from '@/app/dicebound/domain/campaign'
import { blankAttributes } from '@/app/dicebound/domain/character'
import { applyTurn } from '@/app/dicebound/domain/turn'

function campaign(): Campaign {
  return newCampaign(
    'a lighthouse that has started walking',
    {
      name: 'Pell',
      concept: 'a very small person with a very large hammer',
      reading: '',
      attributes: blankAttributes(),
      skills: {},
    },
    1000,
    null
  )
}

describe('ending a run', () => {
  it('a new story has no ending — nothing renders until it exists', () => {
    expect(campaign().ending).toBeNull()
    expect(isEnded(campaign())).toBe(false)
  })

  it('writes the ending down on the turn that reaches the last rung', () => {
    const after = applyTurn(campaign(), { entries: [], body: { condition: 'dead' } }, 5000)

    expect(after.ending).toEqual({ cause: 'death', condition: 'dead', at: 0, endedAt: 5000 })
    expect(isEnded(after)).toBe(true)
  })

  it('stamps the clock the fiction died on, not the one the save happened at', () => {
    // Story time and wall time answer different questions, and the screen asks
    // the first one: "day four, dusk" is what the player remembers, and it is
    // the only one of the two that survives a campaign being played across a
    // week of evenings.
    const world = { ...campaign().world, clock: { ...campaign().world.clock, elapsed: 4200 } }
    const after = applyTurn(campaign(), { entries: [], body: { condition: 'dead' }, world }, 5000)

    expect(after.ending?.at).toBe(4200)
    expect(after.ending?.endedAt).toBe(5000)
  })

  it('leaves a story that is still going alone', () => {
    const after = applyTurn(campaign(), { entries: [], body: { condition: 'dying' } }, 5000)

    expect(after.ending).toBeNull()
    expect(isEnded(after)).toBe(false)
  })

  it('never revises an ending it has already written', () => {
    // Permanence, as a property of the field rather than of the fiction. It is
    // also what keeps a re-saved campaign from creeping forward in time every
    // time it is touched — an ending that moved would make "how long ago did
    // this story finish" answerable only as "just now".
    const dead = applyTurn(campaign(), { entries: [], body: { condition: 'dead' } }, 5000)
    const again = applyTurn(dead, { entries: [], body: { condition: 'dead' } }, 9000)

    expect(again.ending?.endedAt).toBe(5000)
  })

  it('is over whether or not the record made it — the track is checked too', () => {
    // The state this rules out is the bad one: dead body, no ending, and a game
    // that carries on because the flag it consults was never set.
    const halfway: Campaign = { ...campaign(), body: { condition: 'dead' }, ending: null }
    expect(isEnded(halfway)).toBe(true)
  })
})

describe('an ending on the wire', () => {
  it('survives the round trip', () => {
    const dead = applyTurn(campaign(), { entries: [], body: { condition: 'dead' } }, 5000)
    const read = validateCampaign(JSON.parse(JSON.stringify(dead)))

    expect(read?.ending).toEqual(dead.ending)
  })

  it('reads a story that ended before endings existed as ended', () => {
    // The window this covers is real: the condition track shipped first, so
    // there are saved campaigns sitting on the last rung with no record of
    // having stopped. Version 3 is not bumped for it — the migration is that
    // the ending is stamped from what the campaign already holds.
    const orphan = {
      ...campaign(),
      version: 3,
      body: { condition: 'dead' },
      updatedAt: 7777,
      ending: undefined,
    }
    const read = validateCampaign(JSON.parse(JSON.stringify(orphan)))

    expect(read?.ending).toEqual({ cause: 'death', condition: 'dead', at: 0, endedAt: 7777 })
  })

  it('does not invent an ending for a campaign that is merely old', () => {
    const ancient = { ...campaign(), version: 1, body: undefined, ending: undefined }
    const read = validateCampaign(JSON.parse(JSON.stringify(ancient)))

    expect(read?.version).toBe(CAMPAIGN_VERSION)
    expect(read?.ending).toBeNull()
  })

  it('repairs a garbled ending rather than dropping it — losing it resurrects them', () => {
    // Of the two ways to be wrong about a finished story, showing the ending
    // screen over a wrong day number is recoverable and handing a dead
    // character their turn back is not.
    const mangled = {
      ...campaign(),
      body: { condition: 'dead' },
      updatedAt: 4444,
      ending: { cause: 'nonsense', condition: 'sideways', at: 'later' },
    }
    const read = validateCampaign(JSON.parse(JSON.stringify(mangled)))

    expect(read?.ending).toEqual({ cause: 'death', condition: 'dead', at: 0, endedAt: 4444 })
  })
})
