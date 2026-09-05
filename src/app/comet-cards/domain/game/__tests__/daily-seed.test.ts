import { afterEach, describe, expect, it, vi } from 'vitest'

import { createGameStateWithDeck } from '@/app/comet-cards/domain/game/default-game-state'
import { getCurrentDayAsSeedStringPST } from '@/app/comet-cards/domain/randomness'

afterEach(() => {
  vi.useRealTimers()
})

describe('a run is seeded by the day it starts, not the day the tab opened', () => {
  it('picks up the new day after midnight PST', () => {
    const today = createGameStateWithDeck('pokerDeck').gameSeed
    expect(today).toBe(getCurrentDayAsSeedStringPST())

    // A tab left open across midnight. The module-level defaults were built
    // on the old day; a run started now belongs to the new one.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.now() + 36 * 60 * 60 * 1000))

    const tomorrow = createGameStateWithDeck('pokerDeck')
    expect(tomorrow.gameSeed).toBe(getCurrentDayAsSeedStringPST())
    expect(tomorrow.gameSeed).not.toBe(today)
  })

  it('deals the blinds from the day the run started', () => {
    const today = createGameStateWithDeck('pokerDeck')

    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.now() + 36 * 60 * 60 * 1000))
    const tomorrow = createGameStateWithDeck('pokerDeck')

    const bossNames = (rounds: typeof today.rounds) => rounds.map(r => r.bossBlindName).join(',')
    expect(bossNames(tomorrow.rounds)).not.toBe(bossNames(today.rounds))
  })
})
