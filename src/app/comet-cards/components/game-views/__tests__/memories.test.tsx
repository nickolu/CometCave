// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { MemoriesView } from '@/app/comet-cards/components/game-views/memories'
import { createLastAnteRun } from '@/app/comet-cards/domain/daily/create-last-ante-run'
import { reduceGame } from '@/app/comet-cards/domain/game/reduce-game'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'
import { useCometCardsStore } from '@/app/comet-cards/store'

afterEach(cleanup)

function atMemoryPhase(jokerIds: string[] = []): GameState {
  const drafted = structuredClone(createLastAnteRun('2026-01-15'))
  drafted.jokers = jokerIds.map(id => initializeJoker(jokers[id], drafted))
  return reduceGame(drafted, { type: 'SHOP_SELECT_BLIND' })
}

function show(game: GameState) {
  useCometCardsStore.setState({ game })
  return render(<MemoriesView />)
}

describe('the memory phase', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    })
    window.matchMedia = (() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
  })

  it('names the boss the player is about to face', () => {
    const game = atMemoryPhase()
    show(game)
    expect(screen.getAllByText(game.rounds[0].bossBlindName).length).toBeGreaterThan(0)
  })

  it('offers the hands this deck can make, and not the ones it cannot', () => {
    show(atMemoryPhase())
    expect(screen.getByText('Full House')).toBeTruthy()
    expect(screen.queryByText('Flush Five')).toBeNull()
  })

  it('shows the budget', () => {
    const game = atMemoryPhase()
    show(game)
    expect(screen.getByText(`0 / ${game.lastAnte!.memoryBudget}`)).toBeTruthy()
  })

  it('shows what a drafted joker will remember', () => {
    const game = structuredClone(atMemoryPhase(['greenJoker']))
    game.lastAnte!.allocation = { pair: 7 }
    show(game)
    expect(screen.getByText('Green Joker')).toBeTruthy()
    // Reported in the units a player reads, not the joker's private counter.
    expect(screen.getByText('+7 Mult')).toBeTruthy()
  })

  it('marks a drafted joker that does not accumulate', () => {
    const game = structuredClone(atMemoryPhase(['jollyJoker']))
    game.lastAnte!.allocation = { pair: 7 }
    show(game)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('says so when there is nothing to remember', () => {
    show(atMemoryPhase())
    expect(screen.getByText(/You drafted no jokers/)).toBeTruthy()
  })
})
