/**
 * Status afflictions.
 *
 * Each test is a sentence about the rule it is protecting. The rules are
 * small enough to each hold one invariant, and the important failures are
 * quiet ones — a duration that should have been clamped that wasn't, two
 * statuses that should have been one, a bad entry that should have been
 * dropped but wasn't.
 */
import { describe, expect, it } from 'vitest'

import {
  MAX_STATUS_DURATION,
  MAX_STATUSES,
  applyStatus,
  expire,
  validateStatuses,
} from '@/app/dicebound/domain/status'

// ------------------------------------------------------------ applyStatus

describe('applyStatus', () => {
  it('two names that slug the same refresh one status rather than making two', () => {
    // "Toad Venom Sickness" and "toad-venom-sickness" must not produce two
    // entries — the id is the slug, and slugging twice is idempotent.
    const base = applyStatus([], 'Toad Venom Sickness', 'you feel sick', 60, 0)
    expect(base).toHaveLength(1)
    expect(base[0].id).toBe('toad-venom-sickness')

    const refreshed = applyStatus(base, 'toad-venom-sickness', 'you feel sick', 120, 10)
    expect(refreshed).toHaveLength(1)
    expect(refreshed[0].id).toBe('toad-venom-sickness')
    // until should be refreshed to now + duration
    expect(refreshed[0].until).toBe(10 + 120)
  })

  it('a refresh preserves the name and effect of the existing entry, updating only until', () => {
    const base = applyStatus([], 'Fever', 'you sweat', 60, 0)
    const refreshed = applyStatus(base, 'fever', 'changed effect', 90, 20)
    // The original name and effect are preserved; only until changes.
    expect(refreshed[0].name).toBe('Fever')
    expect(refreshed[0].effect).toBe('you sweat')
    expect(refreshed[0].until).toBe(20 + 90)
  })

  it('a status whose name slugs to nothing is dropped', () => {
    // A name that is all punctuation, spaces, or otherwise produces an empty
    // slug cannot be stored — there is no id to key it under.
    const after = applyStatus([], '---', 'some effect', 60, 0)
    expect(after).toHaveLength(0)

    const after2 = applyStatus([], '!!!', 'some effect', 60, 0)
    expect(after2).toHaveLength(0)

    const after3 = applyStatus([], '', 'some effect', 60, 0)
    expect(after3).toHaveLength(0)
  })

  it('a duration past the clamp is clamped, not honoured', () => {
    const way_too_long = MAX_STATUS_DURATION + 10000
    const after = applyStatus([], 'Cursed', 'the curse lingers', way_too_long, 0)
    expect(after[0].until).toBe(MAX_STATUS_DURATION)
  })

  it('until is now plus the (clamped) duration', () => {
    const now = 500
    const duration = 120
    const after = applyStatus([], 'Poisoned', 'sluggish veins', duration, now)
    expect(after[0].until).toBe(now + duration)
  })

  it('applying past the cap drops the one expiring soonest', () => {
    // The soonest-expiring status is the least valuable — it is almost gone
    // anyway. Dropping it is less disruptive than refusing the new affliction.
    const now = 1000

    // Fill to the cap with statuses that expire at ascending times.
    let statuses: readonly import('@/app/dicebound/domain/status').Status[] = []
    for (let i = 0; i < MAX_STATUSES; i++) {
      statuses = applyStatus(statuses, `affliction-${i}`, 'hurts', (i + 1) * 10, now)
    }
    expect(statuses).toHaveLength(MAX_STATUSES)

    // The soonest-expiring is affliction-0 (until = now + 10).
    const soonestId = 'affliction-0'
    expect(statuses.some(s => s.id === soonestId)).toBe(true)

    // Adding one more should drop affliction-0.
    const after = applyStatus(statuses, 'new-affliction', 'fresh pain', 100, now)
    expect(after).toHaveLength(MAX_STATUSES)
    expect(after.some(s => s.id === soonestId)).toBe(false)
    expect(after.some(s => s.id === 'new-affliction')).toBe(true)
  })

  it('a zero-duration status expires immediately (until === now)', () => {
    // Edge: duration 0 means until = now, and expire(…, now) will drop it.
    const now = 100
    const after = applyStatus([], 'Flash', 'blink', 0, now)
    expect(after[0].until).toBe(now)
    expect(expire(after, now)).toHaveLength(0)
  })
})

// ------------------------------------------------------------- expire

describe('expire', () => {
  it('a status expires when the clock passes it, including when one turn skips the whole span', () => {
    // Statuses whose until <= now are removed. This handles both the normal
    // case (clock ticks past it one minute at a time) and the long-rest case
    // (the clock jumps a whole day in one turn).
    const statuses = [
      { id: 'a', name: 'A', effect: 'hurts', until: 50 },
      { id: 'b', name: 'B', effect: 'hurts', until: 100 },
      { id: 'c', name: 'C', effect: 'hurts', until: 200 },
    ] as const

    // At exactly the minute the status expires, it is gone.
    expect(expire(statuses, 50)).toHaveLength(2)
    expect(expire(statuses, 50).some(s => s.id === 'a')).toBe(false)

    // At now = 100, b also expires.
    const after100 = expire(statuses, 100)
    expect(after100).toHaveLength(1)
    expect(after100[0].id).toBe('c')

    // A single long turn that jumps from 0 to 300 clears everything.
    expect(expire(statuses, 300)).toHaveLength(0)
  })

  it('a status that has not reached its until survives the clock', () => {
    const statuses = [{ id: 'x', name: 'X', effect: 'lingers', until: 200 }]
    expect(expire(statuses, 199)).toHaveLength(1)
  })

  it('an empty list stays empty regardless of the clock', () => {
    expect(expire([], 99999)).toHaveLength(0)
  })
})

// ------------------------------------------------------------- validateStatuses

describe('validateStatuses', () => {
  it('garbage from the wire loads as an empty list', () => {
    // An unreadable status list is an empty one — never throws, always returns
    // something the renderer can draw.
    expect(validateStatuses(undefined)).toEqual([])
    expect(validateStatuses(null)).toEqual([])
    expect(validateStatuses('poisoned')).toEqual([])
    expect(validateStatuses(42)).toEqual([])
    expect(validateStatuses({})).toEqual([])
  })

  it('a non-array is an empty list', () => {
    expect(validateStatuses({ 0: { id: 'x', name: 'X', effect: 'e', until: 1 } })).toEqual([])
  })

  it('non-object entries in the array are dropped individually', () => {
    const value = [
      null,
      'string',
      42,
      { id: 'valid', name: 'Valid', effect: 'hurts', until: 100 },
    ]
    const result = validateStatuses(value)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('valid')
  })

  it('an entry with no derivable id is dropped', () => {
    // id = slug(element.id ?? element.name, 60). If both are absent or slug
    // to nothing, the entry is dropped.
    const value = [
      { name: '!!!', effect: 'something', until: 10 },
      { id: '---', name: 'also bad', effect: 'something', until: 10 },
    ]
    // '!!!' slugs to '' — dropped. '---' also slugs to '' — dropped.
    // But 'also bad' slugs to 'also-bad' — wait, id is tried first.
    // id = slug('---') = '' → try name = 'also bad' → slug('also bad') = 'also-bad' — kept.
    // Actually per spec: id = slug(element.id ?? element.name, 60).
    // So if element.id is '---', we slug that, not element.name.
    // '---' slugs to '' → dropped.
    const result = validateStatuses(value)
    expect(result).toHaveLength(0)
  })

  it('an entry whose name slugs to something is kept even if id field is missing', () => {
    const value = [{ name: 'Arrow wound', effect: 'your side burns', until: 50 }]
    const result = validateStatuses(value)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('arrow-wound')
  })

  it('the validated list is capped at MAX_STATUSES even if the wire sends more', () => {
    const value = Array.from({ length: MAX_STATUSES + 5 }, (_, i) => ({
      name: `status-${i}`,
      effect: 'hurts',
      until: i * 10,
    }))
    const result = validateStatuses(value)
    expect(result).toHaveLength(MAX_STATUSES)
  })

  it('numeric fields are coerced: a string until becomes 0 (int fallback)', () => {
    const value = [{ name: 'Hex', effect: 'bad luck', until: 'never' }]
    const result = validateStatuses(value)
    expect(result).toHaveLength(1)
    expect(result[0].until).toBe(0)
  })

  it('string fields are truncated to their declared max lengths', () => {
    const longName = 'a'.repeat(200)
    const longEffect = 'b'.repeat(800)
    const value = [{ name: longName, effect: longEffect, until: 0 }]
    const result = validateStatuses(value)
    expect(result[0].name.length).toBeLessThanOrEqual(120)
    expect(result[0].effect.length).toBeLessThanOrEqual(600)
  })

  it('a well-formed entry round-trips without loss', () => {
    const entry = { id: 'fever', name: 'Fever', effect: 'sweating and weak', until: 300 }
    const result = validateStatuses([entry])
    expect(result[0]).toEqual({
      id: 'fever',
      name: 'Fever',
      effect: 'sweating and weak',
      until: 300,
    })
  })
})
