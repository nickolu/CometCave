// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Composer } from '@/app/dicebound/components/composer'

afterEach(cleanup)

const THREE = [
  'I try to lever the chain off with the lantern hook.',
  'I ask Maren who she paid to chain this grate.',
  'I go under, and feel for the drain the water is leaving by.',
]

const field = () => screen.getByRole('textbox') as HTMLTextAreaElement
const chip = (label: string) => screen.getByRole('button', { name: label }) as HTMLButtonElement

describe('Composer suggestions', () => {
  it('fills the field on a tap and does not send', () => {
    // The whole design decision, and the only thing protecting it. Dicebound is
    // a game where the player writes the attempt in their own words; a chip
    // that sent on tap would turn it into a three-option menu, and no test
    // anywhere else would notice.
    const onSend = vi.fn()
    render(<Composer onSend={onSend} disabled={false} suggestions={THREE} />)

    fireEvent.click(chip(THREE[1]))

    expect(field().value).toBe(THREE[1])
    expect(onSend).not.toHaveBeenCalled()
  })

  it('leaves the caret at the end, so the edit is one keystroke away', () => {
    render(<Composer onSend={vi.fn()} disabled={false} suggestions={THREE} />)

    fireEvent.click(chip(THREE[0]))

    expect(document.activeElement).toBe(field())
    expect(field().selectionStart).toBe(THREE[0].length)
  })

  it('renders nothing at all when there is nothing to offer', () => {
    // Invariant 17. An empty rail above the composer advertises a feature the
    // player has not met and turns a quiet moment into a waiting one.
    render(<Composer onSend={vi.fn()} disabled={false} suggestions={[]} />)
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('keeps the last three on screen while the dungeon master answers, untappable', () => {
    // They stay so the composer does not jump: clearing the row mid-turn moves
    // the send button out from under a thumb already reaching for it. Disabled
    // so nobody acts on a scene that has already moved on.
    render(<Composer onSend={vi.fn()} disabled={true} suggestions={THREE} />)

    for (const line of THREE) {
      expect(chip(line).disabled).toBe(true)
    }
  })
})
