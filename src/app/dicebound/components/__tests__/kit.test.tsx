// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Powers, Standing } from '@/app/dicebound/components/kit'
import { type Campaign, newCampaign } from '@/app/dicebound/domain/campaign'
import { RANK_THRESHOLDS, blankAttributes } from '@/app/dicebound/domain/character'
import type { Power } from '@/app/dicebound/domain/kit'
import type { Entity } from '@/app/dicebound/domain/world'

afterEach(cleanup)

function campaignWith(over: Partial<Campaign> = {}): Campaign {
  const base = newCampaign(
    'a forge town',
    { name: 'Ilda', concept: 'a smith', reading: '', attributes: blankAttributes(), skills: {} },
    0,
    null
  )
  return { ...base, ...over }
}

/** Three ranks earned in play, which is exactly level 2. */
const LEVEL_2_SKILLS = {
  engineering: { uses: RANK_THRESHOLDS[1], rank: 2 },
  observation: { uses: RANK_THRESHOLDS[0], rank: 1 },
}

const imra: Entity = {
  id: 'keeper-imra',
  kind: 'actor',
  name: 'Keeper Imra',
  note: '',
  state: '',
  status: 'active',
  disposition: 2,
  scale: 'person',
  firstSeen: 0,
  lastSeen: 0,
}

const power = (over: Partial<Power> = {}): Power => ({
  id: 'ember-word',
  name: 'Ember Word',
  note: 'You say the word and the fire leans toward you.',
  tier: 1,
  shape: 'permits',
  permits: 'ask a fire to move',
  applies: {},
  charges: { now: 3, max: 3 },
  refresh: 'rest',
  cost: '',
  source: 'keeper-imra',
  gainedAt: 60,
  ...over,
})

describe('Standing', () => {
  it('renders nothing for a character who has just been made', () => {
    // Invariant 17. Level 1 is where everyone starts, so printing it says
    // nothing about this character and everything about there being a ladder.
    const { container } = render(<Standing campaign={campaignWith()} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the level only once it means something', () => {
    render(
      <Standing
        campaign={campaignWith({
          character: { ...campaignWith().character, skills: LEVEL_2_SKILLS },
        })}
      />
    )
    expect(screen.getByText('Level 2')).toBeDefined()
  })

  it('shows a class once the story has discovered one, and not before', () => {
    const before = render(<Standing campaign={campaignWith()} />)
    expect(before.container.innerHTML).toBe('')
    cleanup()

    render(
      <Standing
        campaign={campaignWith({
          kit: { ...campaignWith().kit, className: 'Ember-Keeper' },
        })}
      />
    )
    expect(screen.getByText('Ember-Keeper')).toBeDefined()
  })
})

describe('Powers', () => {
  it('renders nothing at all for a character who has never been granted one', () => {
    // No greyed-out slots and no heading hinting at what unlocks them. This is
    // the rule with almost no protection other than this test.
    const { container } = render(<Powers campaign={campaignWith()} />)
    expect(container.innerHTML).toBe('')
  })

  it('names the power, what it looks like, and where it came from', () => {
    render(
      <Powers
        campaign={campaignWith({
          kit: { ...campaignWith().kit, powers: [power()] },
          world: { ...campaignWith().world, entities: { 'keeper-imra': imra } },
        })}
      />
    )
    expect(screen.getByText('Ember Word')).toBeDefined()
    expect(screen.getByText(/the fire leans toward you/)).toBeDefined()
    // Provenance is the part that makes it feel like something that happened.
    expect(screen.getByText('From Keeper Imra')).toBeDefined()
  })

  it('drops the provenance line rather than printing a slug the player never agreed to read', () => {
    // The source has aged out of the graph. A missing sentence beats
    // "keeper-imra" on the sheet.
    render(
      <Powers campaign={campaignWith({ kit: { ...campaignWith().kit, powers: [power()] } })} />
    )
    expect(screen.queryByText(/keeper-imra/)).toBeNull()
    expect(screen.getByText('Ember Word')).toBeDefined()
  })

  it('says the charges in words as well as pips, so they are not carried by shape alone', () => {
    render(
      <Powers
        campaign={campaignWith({
          kit: { ...campaignWith().kit, powers: [power({ charges: { now: 1, max: 3 } })] },
        })}
      />
    )
    expect(screen.getByText('1/3')).toBeDefined()
    expect(screen.getByText('1 of 3 charges left')).toBeDefined()
  })

  it('a spent power still reads as a power, not as a disabled row', () => {
    // Zero of three is a fact about tonight, not about the character.
    render(
      <Powers
        campaign={campaignWith({
          kit: { ...campaignWith().kit, powers: [power({ charges: { now: 0, max: 3 } })] },
        })}
      />
    )
    expect(screen.getByText('Ember Word')).toBeDefined()
    expect(screen.getByText('no charges left')).toBeDefined()
    expect(screen.getByText('Back after you rest')).toBeDefined()
  })
})
