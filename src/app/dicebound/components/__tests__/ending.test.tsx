// @vitest-environment jsdom
/**
 * The last screen.
 *
 * Two of these protect rules with no other guard. Starting again must not be a
 * single unguarded tap while the shelf that would keep the finished story does
 * not exist yet (#3780) — and the tally must not print things that did not
 * happen, which is the same rule as the empty inventory grid.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Ending } from '@/app/dicebound/components/ending'
import { shareText } from '@/app/dicebound/components/share'
import { type Campaign, newCampaign } from '@/app/dicebound/domain/campaign'
import { blankAttributes } from '@/app/dicebound/domain/character'

afterEach(cleanup)

function ended(over: Partial<Campaign> = {}): Campaign {
  const base = newCampaign(
    'a lighthouse that has started walking',
    { name: 'Pell', concept: 'a salvager', reading: '', attributes: blankAttributes(), skills: {} },
    1000,
    null
  )
  return {
    ...base,
    title: 'The Lamp That Walked',
    body: { condition: 'dead' },
    ending: { cause: 'death', condition: 'dead', at: 4200, endedAt: 5000 },
    stats: { turns: 41, checks: 17, successes: 9, naturalTwenties: 2, naturalOnes: 0 },
    ...over,
  }
}

describe('the ending screen', () => {
  it('names the character and what the story cost them', () => {
    render(<Ending campaign={ended()} onBegin={() => {}} invite={false} />)

    expect(screen.getByText(/Here the telling stops/)).toBeTruthy()
    expect(screen.getByText(/Pell came as far as/)).toBeTruthy()
    expect(screen.getByText(/41 turns · 17 rolls of the die · 2 natural twenties/)).toBeTruthy()
  })

  it('leaves out what did not happen — no "0 natural ones" on the tally', () => {
    // Same rule as the empty inventory grid (CLAUDE.md #17). A record of a
    // finished story should contain the things that occurred in it, and a
    // player who never rolled a 1 does not need to be told the count.
    render(<Ending campaign={ended()} onBegin={() => {}} invite={false} />)

    expect(screen.queryByText(/natural ones/)).toBeNull()
  })

  it('reads the rung off the record, not off a live body that could still move', () => {
    render(<Ending campaign={ended()} onBegin={() => {}} invite={false} />)

    expect(screen.getByText('Dead')).toBeTruthy()
  })
})

describe('beginning again', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('asks before it lets the finished story go', () => {
    // Not paperwork. The campaign is kept when it ends — that is the whole
    // reason the ending is a record — but there is one story per player, so
    // starting another is the thing that actually releases this one. Until the
    // shelf exists (#3780) the player is told that in the sentence rather than
    // finding out afterwards.
    const onBegin = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<Ending campaign={ended()} onBegin={onBegin} invite={false} />)
    fireEvent.click(screen.getByText('Begin a new story'))

    expect(window.confirm).toHaveBeenCalled()
    expect(onBegin).not.toHaveBeenCalled()
  })

  it('goes through once the player has said so', () => {
    const onBegin = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<Ending campaign={ended()} onBegin={onBegin} invite={false} />)
    fireEvent.click(screen.getByText('Begin a new story'))

    expect(onBegin).toHaveBeenCalledTimes(1)
  })
})

describe('what a finished story shares', () => {
  it('shares the whole run rather than the last roll it happened to end on', () => {
    // A finished story is the only genuinely shareable artifact this game has
    // ever had, and it outranks the die card: a good roll is a moment out of a
    // story, and the story is the thing worth sending someone.
    const text = shareText(ended())

    expect(text).toContain('Pell died')
    expect(text).toContain('The Lamp That Walked')
    expect(text).toContain('41 turns')
  })
})
