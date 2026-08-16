// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Sheet } from '@/app/dicebound/components/sheet'
import type { SkillId } from '@/app/dicebound/domain/attributes'
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
