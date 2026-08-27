import { describe, it, expect } from 'vitest'
import { getDailySeed } from '../../store'

describe('getDailySeed', () => {
  it('returns a positive integer', () => {
    const seed = getDailySeed()
    expect(seed).toBeGreaterThan(0)
    expect(Number.isInteger(seed)).toBe(true)
  })

  it('looks like a YYYYMMDD date integer', () => {
    const seed = getDailySeed()
    const str = String(seed)
    expect(str).toHaveLength(8)
    expect(str.startsWith('2')).toBe(true) // 21st century
  })

  it('is the same when called twice on the same day', () => {
    expect(getDailySeed()).toBe(getDailySeed())
  })
})
