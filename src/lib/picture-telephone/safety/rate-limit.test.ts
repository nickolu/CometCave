import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/firebase/server', () => ({ getFirestoreDb: vi.fn() }))
vi.mock('firebase-admin/firestore', () => ({ Timestamp: { fromMillis: (n: number) => n } }))

import { decideRateLimit } from './rate-limit'

const HOUR = 60 * 60 * 1000

describe('decideRateLimit', () => {
  it('starts a window on first use', () => {
    expect(decideRateLimit(null, 1000, 3, HOUR)).toEqual({ limited: false, remaining: 2, next: { windowStart: 1000, count: 1 } })
  })
  it('counts up inside the window and limits at max', () => {
    let state = decideRateLimit(null, 0, 3, HOUR).next
    for (let i = 0; i < 2; i++) state = decideRateLimit(state, 10, 3, HOUR).next
    expect(state.count).toBe(3)
    const d = decideRateLimit(state, 20, 3, HOUR)
    expect(d.limited).toBe(true)
    expect(d.remaining).toBe(0)
    expect(d.next.count).toBe(3)
  })
  it('resets after the window passes', () => {
    const d = decideRateLimit({ windowStart: 0, count: 3 }, HOUR + 1, 3, HOUR)
    expect(d).toEqual({ limited: false, remaining: 2, next: { windowStart: HOUR + 1, count: 1 } })
  })
  it('defaults to 60 per hour', () => {
    expect(decideRateLimit({ windowStart: 0, count: 59 }, 5).limited).toBe(false)
    expect(decideRateLimit({ windowStart: 0, count: 60 }, 5).limited).toBe(true)
  })
})
