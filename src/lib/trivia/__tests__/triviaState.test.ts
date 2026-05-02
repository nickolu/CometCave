import { describe, expect, it } from 'vitest'

import { CURRENT_MIGRATION_VERSION } from '@/lib/trivia/triviaState'

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
