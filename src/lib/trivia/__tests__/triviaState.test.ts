import { describe, expect, it } from 'vitest'

import { MAX_RECENT_SEEN, computeTrim } from '@/lib/trivia/triviaState'

describe('computeTrim', () => {
  it('returns null when the array is at or below the cap', () => {
    expect(computeTrim([])).toBeNull()
    expect(computeTrim(['a', 'b', 'c'])).toBeNull()
    expect(computeTrim(Array.from({ length: MAX_RECENT_SEEN }, (_, i) => `q${i}`))).toBeNull()
  })

  it('returns null while within the slack window', () => {
    // MAX_RECENT_SEEN + 1 should not yet trigger a trim — the slack
    // window is what amortizes trim writes.
    const arr = Array.from({ length: MAX_RECENT_SEEN + 1 }, (_, i) => `q${i}`)
    expect(computeTrim(arr)).toBeNull()
  })

  it('returns the eviction list once the array exceeds slack', () => {
    // Push well past the slack window and verify the oldest entries are
    // returned for eviction, leaving exactly MAX_RECENT_SEEN behind.
    const overflow = 75 // > MAX_RECENT_SEEN + slack(50)
    const arr = Array.from({ length: MAX_RECENT_SEEN + overflow }, (_, i) => `q${i}`)
    const evict = computeTrim(arr)
    expect(evict).not.toBeNull()
    expect(evict).toHaveLength(overflow)
    expect(evict?.[0]).toBe('q0')
    expect(evict?.[evict.length - 1]).toBe(`q${overflow - 1}`)
  })
})
