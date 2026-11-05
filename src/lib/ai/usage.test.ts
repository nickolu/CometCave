import { describe, expect, it } from 'vitest'

import { DAILY_CREDITS } from '@/lib/ai/limits'
import { decideSpend, nextResetIso } from '@/lib/ai/usage'

describe('decideSpend', () => {
  it('allows a first call and reports what is left', () => {
    expect(decideSpend(0, 1, 10)).toEqual({ allowed: true, remaining: 9, spent: 1 })
  })

  it('allows spending exactly to the budget', () => {
    expect(decideSpend(8, 2, 10)).toEqual({ allowed: true, remaining: 0, spent: 10 })
  })

  it('refuses a call that would cross the budget without charging for it', () => {
    expect(decideSpend(9, 2, 10)).toEqual({ allowed: false, remaining: 1, spent: 9 })
  })

  it('refuses once the budget is gone', () => {
    expect(decideSpend(10, 1, 10)).toEqual({ allowed: false, remaining: 0, spent: 10 })
  })

  it('treats a corrupt negative counter as zero', () => {
    expect(decideSpend(-5, 1, 10)).toEqual({ allowed: true, remaining: 9, spent: 1 })
  })

  it('uses the shared daily budget by default', () => {
    expect(decideSpend(0, 1).remaining).toBe(DAILY_CREDITS - 1)
  })
})

describe('nextResetIso', () => {
  it('is midnight Pacific on the following day', () => {
    // 2026-07-01 is PDT (UTC-7): midnight on the 2nd is 07:00Z.
    expect(nextResetIso('2026-07-01')).toBe('2026-07-02T07:00:00.000Z')
    // 2026-01-15 is PST (UTC-8): midnight on the 16th is 08:00Z.
    expect(nextResetIso('2026-01-15')).toBe('2026-01-16T08:00:00.000Z')
  })

  it('rolls over month and year boundaries', () => {
    expect(nextResetIso('2026-12-31')).toBe('2027-01-01T08:00:00.000Z')
  })
})
