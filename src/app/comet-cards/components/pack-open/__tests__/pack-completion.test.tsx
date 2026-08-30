// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { JokerCardOpenBoosterPack } from '@/app/comet-cards/components/pack-open/joker-card-open-booster-pack'
import { createLastAnteRun } from '@/app/comet-cards/domain/daily/create-last-ante-run'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { PACK_CLOSE_DELAY_MS } from '@/app/comet-cards/hooks/usePackCompletion'
import { useCometCardsStore } from '@/app/comet-cards/store'

afterEach(cleanup)

/**
 * A pack whose picks are spent is still on screen for a beat so the player can
 * see what they got. During that beat it must not look like a live choice.
 */
function openJokerPack(): GameState {
  const started = reduceGame(structuredClone(createLastAnteRun('2026-01-15')), {
    type: 'START_LAST_ANTE',
  })
  const jokerPack = started.shopState.packsForSale.find(p => p.cards[0].type === 'jokerCard')!
  return reduceGame(started, { type: 'SHOP_OPEN_PACK', id: jokerPack.id })
}

function show(game: GameState) {
  useCometCardsStore.setState({ game })
  return render(<JokerCardOpenBoosterPack />)
}

function spend(game: GameState): GameState {
  const spent = structuredClone(game)
  spent.shopState.openPackState!.remainingCardsToSelect = 0
  return spent
}

describe('a pack with nothing left to pick', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    })
    window.matchMedia = (() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
  })

  it('still asks for picks while it has them', () => {
    show(openJokerPack())
    expect(screen.getByText(/Select \d+ joker/)).toBeTruthy()
    expect(screen.queryByText('Nothing left to take')).toBeNull()
  })

  it('stops asking the moment the picks run out', () => {
    show(spend(openJokerPack()))
    // Never "Select 0 jokers".
    expect(screen.queryByText(/Select 0/)).toBeNull()
    expect(screen.getByText('Nothing left to take')).toBeTruthy()
  })

  it('reads as spent to a screen reader and dims for everyone else', () => {
    show(spend(openJokerPack()))
    const grid = screen.getByRole('toolbar', { name: 'Joker cards' })
    expect(grid.getAttribute('aria-disabled')).toBe('true')
    expect(grid.style.pointerEvents).toBe('none')
    expect(Number(grid.style.opacity)).toBeLessThan(1)
  })

  it('is live and undimmed while picks remain', () => {
    show(openJokerPack())
    const grid = screen.getByRole('toolbar', { name: 'Joker cards' })
    expect(grid.getAttribute('aria-disabled')).toBe('false')
    expect(grid.style.pointerEvents).toBe('auto')
    expect(Number(grid.style.opacity)).toBe(1)
  })

  it('closes itself promptly rather than lingering', () => {
    vi.useFakeTimers()
    const closed = vi.fn()
    const unsubscribe = eventEmitter.onAny(event => {
      if (event.type === 'SHOP_CLOSE_PACK') closed()
    })

    try {
      show(spend(openJokerPack()))
      expect(closed).not.toHaveBeenCalled()
      vi.advanceTimersByTime(PACK_CLOSE_DELAY_MS)
      expect(closed).toHaveBeenCalled()
      // Short enough that it reads as a beat, not as lag.
      expect(PACK_CLOSE_DELAY_MS).toBeLessThanOrEqual(600)
    } finally {
      unsubscribe()
      vi.useRealTimers()
    }
  })
})
