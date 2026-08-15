// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DieCard } from '@/app/dicebound/components/die-card'
import type { CheckEntry } from '@/app/dicebound/domain/campaign'

afterEach(cleanup)

/**
 * jsdom has no `matchMedia`, and the card reads it to decide whether to
 * animate. Stubbing it as "reduce" is the honest default rather than a
 * convenience: the reduced-motion card is the one that has to be legible
 * without help, and it is also what a transcript scrolled back through shows.
 */
function stubReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function check(overrides: Partial<CheckEntry> = {}): CheckEntry {
  return {
    kind: 'check',
    attempt: 'vault the counter',
    attribute: 'dexterity',
    skill: 'balance',
    dc: 12,
    dcLabel: 'kinda hard',
    roll: 17,
    modifiers: [{ label: 'Dexterity', value: 2 }],
    modifier: 2,
    total: 19,
    margin: 7,
    band: 'strong-success',
    ...overrides,
  }
}

describe('DieCard', () => {
  it('shows one die and no advantage line on an ordinary check', () => {
    stubReducedMotion(true)
    render(<DieCard entry={check()} />)

    expect(screen.getByText('17')).toBeDefined()
    expect(screen.queryByText(/Advantage/)).toBeNull()
    expect(screen.queryByText(/Disadvantage/)).toBeNull()
  })

  it('shows the discarded die and why it was thrown, under reduced motion', () => {
    // The two-dice layout must not depend on the roll animation to make sense —
    // a transcript scrolled back through never animates, and neither does a
    // card for a player who asked for less motion.
    stubReducedMotion(true)
    render(
      <DieCard
        entry={check({
          twice: { direction: 'advantage', reason: 'the torch is lit', discarded: 4 },
        })}
        fresh
      />
    )

    expect(screen.getByText('17')).toBeDefined()
    expect(screen.getByText('4')).toBeDefined()
    // Twice over: once on the visible label, once in the announcement. Both are
    // supposed to say it, so matching exactly one would mean one of them lost it.
    expect(screen.getAllByText(/the torch is lit/)).toHaveLength(2)
  })

  it('says the discarded die out loud, because the struck-through one is aria-hidden', () => {
    // Otherwise the spoken card says less than the printed one: a screen reader
    // user hears the 17 and never learns a 4 was thrown away.
    stubReducedMotion(true)
    render(
      <DieCard
        entry={check({
          twice: { direction: 'advantage', reason: 'the torch is lit', discarded: 4 },
        })}
      />
    )

    expect(screen.getByText(/Rolled twice with advantage.*discarding 4/)).toBeDefined()
  })
})
