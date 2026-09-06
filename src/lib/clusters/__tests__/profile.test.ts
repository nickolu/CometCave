import { describe, expect, it } from 'vitest'

import { EMPTY_PROFILE, statsFrom } from '@/app/clusters/models/clusters'
import { type RunOutcome, applyResult, displayedStreak, normalizeProfile } from '@/lib/clusters/profile'

const base = () => normalizeProfile(EMPTY_PROFILE)

function run(over: Partial<RunOutcome> = {}): RunOutcome {
  return {
    date: '2026-09-05',
    mistakes: 0,
    won: true,
    purpleFirst: false,
    countsForStreak: true,
    ...over,
  }
}

describe('applyResult', () => {
  it('buckets a win by the mistakes it cost', () => {
    const p = applyResult(base(), run({ mistakes: 2 }))
    expect(p.played).toBe(1)
    expect(p.mistakeDistribution).toEqual([0, 0, 1, 0, 0])
  })

  it('buckets a loss into index 4', () => {
    const p = applyResult(base(), run({ mistakes: 4, won: false }))
    expect(p.mistakeDistribution).toEqual([0, 0, 0, 0, 1])
  })

  it('counts a purple-first opening', () => {
    const p = applyResult(base(), run({ purpleFirst: true }))
    expect(p.purpleFirst).toBe(1)
  })

  it('never lets the distribution drift from the derived headline numbers', () => {
    let p = base()
    p = applyResult(p, run({ date: '2026-09-01', mistakes: 0 }))
    p = applyResult(p, run({ date: '2026-09-02', mistakes: 3 }))
    p = applyResult(p, run({ date: '2026-09-03', mistakes: 4, won: false }))

    const stats = statsFrom(p)
    expect(stats.played).toBe(3)
    expect(stats.won).toBe(2)
    expect(stats.losses).toBe(1)
    expect(stats.perfect).toBe(1)
    expect(stats.winRate).toBeCloseTo(2 / 3)
    expect(p.mistakeDistribution.reduce((a, b) => a + b, 0)).toBe(p.played)
  })
})

describe('streaks', () => {
  it('starts at one', () => {
    const p = applyResult(base(), run({ date: '2026-09-05' }))
    expect(p.currentStreak).toBe(1)
    expect(p.maxStreak).toBe(1)
  })

  it('extends across consecutive days', () => {
    let p = base()
    p = applyResult(p, run({ date: '2026-09-03' }))
    p = applyResult(p, run({ date: '2026-09-04' }))
    p = applyResult(p, run({ date: '2026-09-05' }))
    expect(p.currentStreak).toBe(3)
    expect(p.maxStreak).toBe(3)
  })

  it('restarts after a skipped day but keeps the best', () => {
    let p = base()
    p = applyResult(p, run({ date: '2026-09-01' }))
    p = applyResult(p, run({ date: '2026-09-02' }))
    p = applyResult(p, run({ date: '2026-09-05' }))
    expect(p.currentStreak).toBe(1)
    expect(p.maxStreak).toBe(2)
  })

  it('is not broken by losing — the streak counts days played', () => {
    let p = base()
    p = applyResult(p, run({ date: '2026-09-03' }))
    p = applyResult(p, run({ date: '2026-09-04', mistakes: 4, won: false }))
    p = applyResult(p, run({ date: '2026-09-05' }))
    expect(p.currentStreak).toBe(3)
  })

  it('crosses a month boundary', () => {
    let p = base()
    p = applyResult(p, run({ date: '2026-08-31' }))
    p = applyResult(p, run({ date: '2026-09-01' }))
    expect(p.currentStreak).toBe(2)
  })

  it('leaves the streak alone for an archive play', () => {
    let p = applyResult(base(), run({ date: '2026-09-05' }))
    p = applyResult(p, run({ date: '2026-07-02', countsForStreak: false }))

    expect(p.currentStreak).toBe(1)
    expect(p.lastStreakDate).toBe('2026-09-05')
    // ...but the run still counts everywhere else.
    expect(p.played).toBe(2)
  })

  it('does not let an archive play move lastPlayedDate backwards', () => {
    let p = applyResult(base(), run({ date: '2026-09-05' }))
    p = applyResult(p, run({ date: '2026-07-02', countsForStreak: false }))
    expect(p.lastPlayedDate).toBe('2026-09-05')
  })
})

describe('displayedStreak', () => {
  const played = (date: string) => applyResult(base(), run({ date }))

  it('shows the streak on the day it was earned', () => {
    expect(displayedStreak(played('2026-09-05'), '2026-09-05')).toBe(1)
  })

  it('still shows it the next day, before today is played', () => {
    expect(displayedStreak(played('2026-09-04'), '2026-09-05')).toBe(1)
  })

  it('shows zero once a day has actually been missed', () => {
    // The stored value is stale by design: missing a day writes nothing.
    const p = played('2026-09-03')
    expect(p.currentStreak).toBe(1)
    expect(displayedStreak(p, '2026-09-05')).toBe(0)
  })

  it('shows zero for a player who has never played', () => {
    expect(displayedStreak(base(), '2026-09-05')).toBe(0)
  })
})

describe('normalizeProfile', () => {
  it('fills a missing document with zeroes', () => {
    const p = normalizeProfile(undefined)
    expect(p.played).toBe(0)
    expect(p.mistakeDistribution).toEqual([0, 0, 0, 0, 0])
  })

  it('repairs a short or ragged distribution rather than trusting it', () => {
    const p = normalizeProfile({ played: 2, mistakeDistribution: [1, 1] })
    expect(p.mistakeDistribution).toEqual([1, 1, 0, 0, 0])
  })
})
