import { describe, expect, it } from 'vitest'

import {
  LAUNCH_DATE,
  NOMINAL_OFFSET_DAYS,
  SOURCE_EPOCH,
  addDays,
  daysBetween,
  playDateRange,
  puzzleNumberFor,
  resolvePlayDate,
  resumeAnchor,
} from '@/lib/clusters/dateMap'

describe('the launch anchor', () => {
  it('runs the first NYT puzzle on day one', () => {
    expect(daysBetween(SOURCE_EPOCH, LAUNCH_DATE)).toBe(NOMINAL_OFFSET_DAYS)
    expect(puzzleNumberFor(LAUNCH_DATE)).toBe(1)
  })

  it('puts the nominal offset where the design specified it', () => {
    // 2026-09-05 runs 2023-09-05, before any day is skipped.
    expect(addDays('2026-09-05', -NOMINAL_OFFSET_DAYS)).toBe('2023-09-05')
    expect(addDays('2026-09-06', -NOMINAL_OFFSET_DAYS)).toBe('2023-09-06')
  })
})

describe('day arithmetic survives leap years', () => {
  it('crosses a leap day in the source year', () => {
    // Calendar-year arithmetic would have to invent an answer here.
    expect(addDays('2027-03-01', -NOMINAL_OFFSET_DAYS)).toBe('2024-02-29')
  })

  it('crosses a leap day in the play year', () => {
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('rejects malformed and impossible dates rather than rolling them over', () => {
    expect(() => addDays('2023-02-30', 1)).toThrow()
    expect(() => addDays('2023-13-01', 1)).toThrow()
    expect(() => addDays('not-a-date', 1)).toThrow()
  })
})

describe('resumeAnchor', () => {
  it('starts a fresh bank at the launch anchor', () => {
    expect(resumeAnchor(null)).toEqual({
      nextPlayDate: LAUNCH_DATE,
      nextSourceDate: SOURCE_EPOCH,
    })
  })

  it('continues from the last stored document, not from today', () => {
    expect(resumeAnchor({ date: '2026-09-05', sourceDate: '2023-09-05' })).toEqual({
      nextPlayDate: '2026-09-06',
      nextSourceDate: '2023-09-06',
    })
  })

  it('carries a drifted mapping forward instead of recomputing it', () => {
    // Two source days were skipped, so the gap is no longer 1096. The
    // anchor must respect what was actually stored, or a puzzle somebody
    // already played would move.
    const anchor = resumeAnchor({ date: '2026-09-05', sourceDate: '2023-09-03' })
    expect(anchor).toEqual({ nextPlayDate: '2026-09-06', nextSourceDate: '2023-09-04' })
    expect(daysBetween(anchor.nextSourceDate, anchor.nextPlayDate)).toBe(
      NOMINAL_OFFSET_DAYS + 2
    )
  })

  it('resumes correctly across a leap day on either side', () => {
    expect(resumeAnchor({ date: '2028-02-29', sourceDate: '2025-02-28' })).toEqual({
      nextPlayDate: '2028-03-01',
      nextSourceDate: '2025-03-01',
    })
  })
})

describe('puzzle numbering', () => {
  it('counts days inclusively from launch, regardless of skips', () => {
    expect(puzzleNumberFor('2026-06-13')).toBe(2)
    // 2026-06-12 .. 2026-09-05 inclusive
    expect(puzzleNumberFor('2026-09-05')).toBe(86)
  })
})

describe('resolvePlayDate', () => {
  const today = '2026-09-05'

  it('defaults to today when no date is asked for', () => {
    expect(resolvePlayDate(null, today)).toEqual({ ok: true, date: today })
    expect(resolvePlayDate('', today)).toEqual({ ok: true, date: today })
  })

  it('allows any past day back to launch', () => {
    expect(resolvePlayDate('2026-07-04', today)).toEqual({ ok: true, date: '2026-07-04' })
    expect(resolvePlayDate(LAUNCH_DATE, today)).toEqual({ ok: true, date: LAUNCH_DATE })
  })

  it('never serves a future puzzle', () => {
    const res = resolvePlayDate('2026-09-06', today)
    expect(res.ok).toBe(false)
  })

  it('refuses dates from before the game existed', () => {
    const res = resolvePlayDate('2026-06-11', today)
    expect(res).toEqual({ ok: false, error: `Clusters starts on ${LAUNCH_DATE}.` })
  })

  it('refuses a malformed date instead of throwing', () => {
    expect(resolvePlayDate('06/12/2026', today).ok).toBe(false)
    expect(resolvePlayDate('2026-02-30', today).ok).toBe(false)
  })
})

describe('playDateRange', () => {
  it('is inclusive at both ends', () => {
    expect(playDateRange('2026-06-12', '2026-06-14')).toEqual([
      '2026-06-12',
      '2026-06-13',
      '2026-06-14',
    ])
  })

  it('is empty when the range runs backwards', () => {
    expect(playDateRange('2026-06-14', '2026-06-12')).toEqual([])
  })

  it('spans a leap day without skipping or repeating', () => {
    expect(playDateRange('2028-02-27', '2028-03-02')).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
      '2028-03-02',
    ])
  })
})
