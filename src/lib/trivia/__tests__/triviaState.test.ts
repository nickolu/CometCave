import { describe, expect, it } from 'vitest'

import {
  CURRENT_MIGRATION_VERSION,
  canonicalCategoryKey,
} from '@/lib/trivia/triviaState'

describe('triviaState constants', () => {
  it('exposes a numeric migration version that increases monotonically', () => {
    // Sentinel guard: bumping CURRENT_MIGRATION_VERSION is the trigger
    // that re-pulls every user's seenQuestions onto the state doc on
    // their next /next call. If you're touching the migration logic in
    // ensureMigratedTriviaState, bump this number too.
    expect(typeof CURRENT_MIGRATION_VERSION).toBe('number')
    expect(CURRENT_MIGRATION_VERSION).toBeGreaterThanOrEqual(2)
  })
})

describe('canonicalCategoryKey', () => {
  it('treats undefined and empty array as the all-categories key', () => {
    expect(canonicalCategoryKey(undefined)).toBe('')
    expect(canonicalCategoryKey([])).toBe('')
  })

  it('produces order-independent keys for the same filter set', () => {
    expect(canonicalCategoryKey([3, 1, 2])).toBe(canonicalCategoryKey([1, 2, 3]))
  })

  it('differentiates distinct filter sets', () => {
    expect(canonicalCategoryKey([9])).not.toBe(canonicalCategoryKey([9, 10]))
    expect(canonicalCategoryKey([9])).not.toBe(canonicalCategoryKey([10]))
  })
})
