// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Sheet } from '@/app/dicebound/components/sheet'
import type { SkillId } from '@/app/dicebound/domain/attributes'
import { CONDITION_LABEL, CONDITION_ORDER } from '@/app/dicebound/domain/body'
import { type Campaign, newCampaign } from '@/app/dicebound/domain/campaign'
import {
  RANK_THRESHOLDS,
  type SkillRecord,
  blankAttributes,
} from '@/app/dicebound/domain/character'

afterEach(cleanup)

function campaignWith(skills: Partial<Record<SkillId, SkillRecord>>): Campaign {
  return newCampaign(
    'a fishing town',
    { name: 'Ilda', concept: 'a salvager', reading: '', attributes: blankAttributes(), skills },
    0,
    null
  )
}

describe('Sheet skill progress', () => {
  it('counts toward the first rank before the skill exists', () => {
    render(<Sheet campaign={campaignWith({ balance: { uses: 2, rank: 0 } })} />)

    expect(screen.getByText(`2/${RANK_THRESHOLDS[0]}`)).toBeTruthy()
  })

  it('keeps counting after the first rank lands — +1 is not the ceiling', () => {
    // The bug this protects against: the counter was gated on an unranked skill
    // and pinned to the first threshold, so a +1 skill showed no progress at
    // all. Rank 2 is eight uses in, and a player five checks into that climb
    // could see nothing to distinguish them from a player who had just earned
    // the rank — which makes the whole progression read as capped at +1.
    render(<Sheet campaign={campaignWith({ balance: { uses: 5, rank: 1 } })} />)

    expect(screen.getByText(`5/${RANK_THRESHOLDS[1]}`)).toBeTruthy()
  })

  it('counts toward the third rank as well, on the real threshold', () => {
    render(<Sheet campaign={campaignWith({ balance: { uses: 10, rank: 2 } })} />)

    expect(screen.getByText(`10/${RANK_THRESHOLDS[2]}`)).toBeTruthy()
  })

  it('shows nothing to chase once the skill is maxed', () => {
    render(<Sheet campaign={campaignWith({ balance: { uses: RANK_THRESHOLDS[2], rank: 3 } })} />)

    expect(screen.queryByText(new RegExp(`^${RANK_THRESHOLDS[2]}/`))).toBeNull()
  })

  it('never offers progress on an innate rank, which cannot be practised', () => {
    // Size is what the character is. A counter under it would promise that
    // enough Size checks eventually make you bigger.
    render(<Sheet campaign={campaignWith({ size: { uses: 4, rank: -2 } })} />)

    expect(screen.getByText('innate')).toBeTruthy()
    expect(screen.queryByText(/^4\//)).toBeNull()
  })
})

describe('Sheet condition', () => {
  it('shows nothing at all on an unhurt character — the system is invisible until it bites', () => {
    // Nothing renders until it exists. A new character shown a damage track,
    // even an empty one, has been told the game is about to hurt them, and that
    // is a promise the first ten minutes should not be making. This is the rule
    // with the least protection anywhere on this screen.
    render(<Sheet campaign={campaignWith({})} />)

    expect(screen.queryByText('Condition')).toBeNull()
    expect(screen.queryByText(/Unhurt/)).toBeNull()
    for (const condition of CONDITION_ORDER) {
      expect(screen.queryByText(CONDITION_LABEL[condition])).toBeNull()
    }
  })

  it('names the rung and says what it feels like, once there is one', () => {
    render(<Sheet campaign={{ ...campaignWith({}), body: { condition: 'bloodied' } }} />)

    expect(screen.getByText('Bloodied')).toBeTruthy()
    // The phrase comes from domain/body.ts so the sheet and the DM's prompt
    // agree word for word. A player reading one thing here and hearing another
    // from the dungeon master is the die card disagreeing with the prose again.
    expect(screen.getByText(/bleeding in a way that is not going to simply stop/i)).toBeTruthy()
  })

  it('announces the condition as a sentence rather than an adjective between two numbers', () => {
    render(<Sheet campaign={{ ...campaignWith({}), body: { condition: 'hurt' } }} />)

    const section = screen.getByRole('region', { name: 'Condition' })
    expect(section.textContent).toContain('Hurt')
  })

  it('carries the last rung in the word, not only in the colour', () => {
    // CLAUDE.md #8. A player at the step before the end must be able to tell
    // without counting, and without seeing colour at all.
    render(<Sheet campaign={{ ...campaignWith({}), body: { condition: 'dying' } }} />)

    expect(screen.getByText('Dying')).toBeTruthy()
    expect(screen.getByText(/on the ground and going/i)).toBeTruthy()
  })

  it('renders no quantity anywhere — a track is not a health bar', () => {
    // Settled in #3769: a number or a meter hands the player something to
    // optimise, which is the whole reason damage is not hit points.
    render(<Sheet campaign={{ ...campaignWith({}), body: { condition: 'broken' } }} />)

    const region = screen.getByRole('region', { name: 'Condition' })
    expect(region.textContent).not.toMatch(/\d/)
  })
})
