/**
 * The sanitizer is what stands in for authentication on this route: the write
 * endpoint is open, so what keeps it safe is that almost nothing can be stored
 * through it. These tests pin that down.
 */
import { describe, expect, it } from 'vitest'

import { ITEM_IDS } from '@/lib/voice-journey/curriculum'
import { sanitizeProgress } from '@/lib/voice-journey/progress-store'

const realItem = [...ITEM_IDS][0]

function dayOffsetFromToday(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('sanitizeProgress', () => {
  it('keeps ticks against real curriculum items', () => {
    expect(sanitizeProgress({ completed: { [realItem]: true }, log: [] }).completed).toEqual({
      [realItem]: true,
    })
  })

  it('drops item ids the course does not define', () => {
    const { completed } = sanitizeProgress({
      completed: { [realItem]: true, notAnItem: true, '../../etc/passwd': true },
      log: [],
    })
    expect(completed).toEqual({ [realItem]: true })
  })

  it('stores only ticks, never explicit falses', () => {
    expect(sanitizeProgress({ completed: { [realItem]: false }, log: [] }).completed).toEqual({})
  })

  it('ignores a prototype-polluting key', () => {
    const { completed } = sanitizeProgress({ completed: { __proto__: true }, log: [] })
    expect(Object.keys(completed)).toEqual([])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('rejects dates that are not real days', () => {
    const { log } = sanitizeProgress({
      completed: {},
      log: ['2026-02-31', '2026-2-1', 'today', ''],
    })
    expect(log).toEqual([])
  })

  it('rejects days before the course existed and beyond tomorrow', () => {
    const { log } = sanitizeProgress({
      completed: {},
      log: ['1999-01-01', '2099-12-31', dayOffsetFromToday(10)],
    })
    expect(log).toEqual([])
  })

  it('accepts a day just ahead, for a device whose clock runs fast', () => {
    const tomorrow = dayOffsetFromToday(1)
    expect(sanitizeProgress({ completed: {}, log: [tomorrow] }).log).toEqual([tomorrow])
  })

  it('dedupes and sorts practice days', () => {
    const { log } = sanitizeProgress({
      completed: {},
      log: ['2026-03-02', '2026-03-01', '2026-03-02'],
    })
    expect(log).toEqual(['2026-03-01', '2026-03-02'])
  })

  it('caps the log, keeping the most recent days', () => {
    const days: string[] = []
    const d = new Date('2024-01-01T00:00:00Z')
    for (let i = 0; i < 900; i++) {
      days.push(d.toISOString().slice(0, 10))
      d.setUTCDate(d.getUTCDate() + 1)
    }
    // Every day here is in the past, so only the cap trims them.
    const { log } = sanitizeProgress({ completed: {}, log: days })
    expect(log.length).toBeLessThanOrEqual(730)
    expect(log[log.length - 1]).toBe(days[days.length - 1])
  })

  it('drops unknown top-level fields rather than storing them', () => {
    const result = sanitizeProgress({ completed: {}, log: [], note: 'x'.repeat(10_000) })
    expect(Object.keys(result).sort()).toEqual(['completed', 'log'])
  })

  it('survives junk in place of the whole payload', () => {
    for (const junk of [null, undefined, 'hello', 42, [1, 2, 3]]) {
      expect(sanitizeProgress(junk)).toEqual({ completed: {}, log: [] })
    }
  })

  it('survives junk in place of each field', () => {
    expect(sanitizeProgress({ completed: 'nope', log: 'nope' })).toEqual({ completed: {}, log: [] })
  })
})
