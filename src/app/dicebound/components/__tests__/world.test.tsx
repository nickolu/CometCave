// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { WorldPanel } from '@/app/dicebound/components/world'
import { type Campaign, newCampaign } from '@/app/dicebound/domain/campaign'
import { blankAttributes } from '@/app/dicebound/domain/character'
import type { Entity, World } from '@/app/dicebound/domain/world'

afterEach(cleanup)

function campaignWith(world: Partial<World>): Campaign {
  const base = newCampaign(
    'a fishing town',
    { name: 'Ilda', concept: 'a salvager', reading: '', attributes: blankAttributes(), skills: {} },
    0,
    null
  )
  return { ...base, world: { ...base.world, ...world } }
}

const person = (over: Partial<Entity> = {}): Entity =>
  ({
    id: 'maren',
    kind: 'actor',
    name: 'Maren the harbourmaster',
    note: '',
    state: '',
    status: 'active',
    disposition: 0,
    scale: 'person',
    firstSeen: 0,
    lastSeen: 0,
    ...over,
  }) as Entity

describe('WorldPanel', () => {
  it('renders nothing at all for a character who has just been made', () => {
    // The stated rule: a new player must not be able to tell these systems are
    // there. An empty "People you know" heading advertises a feature they have
    // not met and turns the sheet into a form to fill in.
    const { container } = render(<WorldPanel campaign={campaignWith({})} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows where you are and what time it is once the story has a place', () => {
    render(
      <WorldPanel
        campaign={campaignWith({
          clock: { elapsed: 1450, startHour: 9 },
          entities: {
            quay: {
              id: 'quay',
              kind: 'place',
              name: 'Saltmarket Quay',
              region: 'the coast',
              note: '',
              state: 'tar and rain',
              status: 'active',
              firstSeen: 0,
              lastSeen: 0,
            },
            you: person({ id: 'you', name: 'Ilda' }),
          },
          edges: [{ from: 'you', to: 'quay', kind: 'at', note: '', since: 10 }],
        })}
      />
    )
    expect(screen.getByText('Saltmarket Quay')).toBeDefined()
    expect(screen.getByText('tar and rain')).toBeDefined()
    expect(screen.getByText(/Day 2/)).toBeDefined()
  })

  it('describes how someone stands toward you in words, never as a number', () => {
    // A visible +2 turns a person into a stat to farm.
    render(
      <WorldPanel campaign={campaignWith({ entities: { maren: person({ disposition: 2 }) } })} />
    )
    expect(screen.getByText(/on your side/)).toBeDefined()
    expect(screen.queryByText(/\+2/)).toBeNull()
  })

  it('says nothing beside someone the story has no opinion about yet', () => {
    render(
      <WorldPanel campaign={campaignWith({ entities: { maren: person({ disposition: 0 }) } })} />
    )
    expect(screen.getByText('Maren the harbourmaster')).toBeDefined()
    expect(screen.queryByText(/neutral/i)).toBeNull()
  })

  it('lists loose ends with their pressure — the reason to come back', () => {
    render(
      <WorldPanel
        campaign={campaignWith({
          entities: {
            debt: {
              id: 'debt',
              kind: 'thread',
              name: 'What you owe for the Cormorant',
              threadKind: 'debt',
              resolution: 'open',
              due: 900,
              pressure: 'urgent',
              firings: 0,
              note: '',
              state: '',
              status: 'active',
              firstSeen: 0,
              lastSeen: 0,
            },
          },
        })}
      />
    )
    expect(screen.getByText('What you owe for the Cormorant')).toBeDefined()
    expect(screen.getByText('urgent')).toBeDefined()
  })

  it('leaves a settled thread off the list', () => {
    // Loose ends are what is unfinished. A kept promise sitting in the list
    // makes the list a log rather than a reason to open the tab.
    render(
      <WorldPanel
        campaign={campaignWith({
          entities: {
            debt: {
              id: 'debt',
              kind: 'thread',
              name: 'A promise already kept',
              threadKind: 'promise',
              resolution: 'kept',
              due: null,
              pressure: 'patient',
              firings: 0,
              note: '',
              state: '',
              status: 'active',
              firstSeen: 0,
              lastSeen: 0,
            },
          },
        })}
      />
    )
    expect(screen.queryByText('A promise already kept')).toBeNull()
  })
})
