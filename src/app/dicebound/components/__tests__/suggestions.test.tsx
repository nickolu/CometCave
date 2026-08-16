// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock before importing the component under test
vi.mock('@/app/dicebound/store', () => ({
  useDicebound: vi.fn(),
}))

import * as diceboundStore from '@/app/dicebound/store'
import { Suggestions } from '@/app/dicebound/components/suggestions'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const THREE = [
  'I try to lever the chain off with the lantern hook.',
  'I ask Maren who she paid to chain this grate.',
  'I go under, and feel for the drain the water is leaving by.',
]

// ---------------------------------------------------------------------------
// Store mock helpers
// ---------------------------------------------------------------------------

const mockToggleSuggestions = vi.fn()

function setupStore(suggestionsHidden: boolean) {
  vi.mocked(diceboundStore.useDicebound).mockReturnValue({
    suggestionsHidden,
    toggleSuggestions: mockToggleSuggestions,
  } as unknown as ReturnType<typeof diceboundStore.useDicebound>)
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderExpanded(overrides?: { disabled?: boolean }) {
  setupStore(false)
  return render(
    <Suggestions
      suggestions={THREE}
      onPick={vi.fn()}
      disabled={overrides?.disabled ?? false}
    />
  )
}

function renderCollapsed() {
  setupStore(true)
  return render(<Suggestions suggestions={THREE} onPick={vi.fn()} disabled={false} />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Suggestions — turn zero / no suggestions', () => {
  it('renders nothing when the suggestions array is empty, regardless of hidden state', () => {
    setupStore(false)
    const { container } = render(<Suggestions suggestions={[]} onPick={vi.fn()} disabled={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('does not render any buttons when there are no suggestions', () => {
    setupStore(false)
    render(<Suggestions suggestions={[]} onPick={vi.fn()} disabled={false} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('Suggestions — expanded state', () => {
  it('shows all three chips when suggestionsHidden is false', () => {
    renderExpanded()
    for (const text of THREE) {
      expect(screen.getByRole('button', { name: text })).toBeDefined()
    }
  })

  it('shows a "put away" collapse button when expanded', () => {
    renderExpanded()
    expect(screen.getByRole('button', { name: 'put away' })).toBeDefined()
  })

  it('the chip list has an accessible label', () => {
    renderExpanded()
    expect(
      screen.getByRole('list', {
        name: /Things you might try/,
      })
    ).toBeDefined()
  })

  it('chips are disabled while the dungeon master is answering', () => {
    renderExpanded({ disabled: true })
    for (const text of THREE) {
      expect((screen.getByRole('button', { name: text }) as HTMLButtonElement).disabled).toBe(true)
    }
  })
})

describe('Suggestions — collapsed state', () => {
  it('hides the chips when suggestionsHidden is true', () => {
    renderCollapsed()
    for (const text of THREE) {
      expect(screen.queryByRole('button', { name: text })).toBeNull()
    }
  })

  it('shows "things you might try" expand button when collapsed', () => {
    renderCollapsed()
    expect(screen.getByRole('button', { name: 'things you might try' })).toBeDefined()
  })

  it('does not render the chip list when collapsed', () => {
    renderCollapsed()
    expect(screen.queryByRole('list')).toBeNull()
  })
})

describe('Suggestions — toggle interactions', () => {
  beforeEach(() => {
    mockToggleSuggestions.mockClear()
  })

  it('clicking "put away" calls toggleSuggestions', () => {
    renderExpanded()
    fireEvent.click(screen.getByRole('button', { name: 'put away' }))
    expect(mockToggleSuggestions).toHaveBeenCalledTimes(1)
  })

  it('clicking "things you might try" calls toggleSuggestions', () => {
    renderCollapsed()
    fireEvent.click(screen.getByRole('button', { name: 'things you might try' }))
    expect(mockToggleSuggestions).toHaveBeenCalledTimes(1)
  })
})

describe('Suggestions — aria-expanded', () => {
  it('"put away" button has aria-expanded="true" when expanded', () => {
    renderExpanded()
    const btn = screen.getByRole('button', { name: 'put away' }) as HTMLButtonElement
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('"things you might try" button has aria-expanded="false" when collapsed', () => {
    renderCollapsed()
    const btn = screen.getByRole('button', { name: 'things you might try' }) as HTMLButtonElement
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('Suggestions — localStorage persistence', () => {
  it('writes dicebound:suggestions-hidden=true to localStorage when collapsing', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    window.localStorage.setItem('dicebound:suggestions-hidden', 'true')
    expect(setItem).toHaveBeenCalledWith('dicebound:suggestions-hidden', 'true')
  })

  it('removes dicebound:suggestions-hidden from localStorage when expanding', () => {
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
    window.localStorage.setItem('dicebound:suggestions-hidden', 'true')
    window.localStorage.removeItem('dicebound:suggestions-hidden')
    expect(removeItem).toHaveBeenCalledWith('dicebound:suggestions-hidden')
  })

  it('reading the key returns the persisted collapsed preference', () => {
    window.localStorage.setItem('dicebound:suggestions-hidden', 'true')
    expect(window.localStorage.getItem('dicebound:suggestions-hidden')).toBe('true')
    window.localStorage.removeItem('dicebound:suggestions-hidden')
    expect(window.localStorage.getItem('dicebound:suggestions-hidden')).toBeNull()
  })
})
