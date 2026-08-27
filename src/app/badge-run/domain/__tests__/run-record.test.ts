import { describe, it, expect } from 'vitest'
import {
  validateRunRecord,
  runDateKey,
  runDocId,
  type RunRecord,
} from '../run-record'

// ---------------------------------------------------------------------------
// runDateKey
// ---------------------------------------------------------------------------

describe('runDateKey', () => {
  it('formats UTC date as YYYY-MM-DD', () => {
    const date = new Date('2026-08-27T15:30:00Z')
    expect(runDateKey(date)).toBe('2026-08-27')
  })

  it('uses UTC not local time', () => {
    // 11pm PST is next day UTC
    const date = new Date('2026-08-28T06:00:00Z')  // UTC next day
    expect(runDateKey(date)).toBe('2026-08-28')
  })
})

// ---------------------------------------------------------------------------
// runDocId
// ---------------------------------------------------------------------------

describe('runDocId', () => {
  it('combines date and uid without dashes', () => {
    expect(runDocId('2026-08-27', 'abc123')).toBe('20260827_abc123')
  })

  it('removes all dashes from date', () => {
    expect(runDocId('2026-01-01', 'uid')).toBe('20260101_uid')
  })
})

// ---------------------------------------------------------------------------
// validateRunRecord
// ---------------------------------------------------------------------------

const VALID_RECORD: RunRecord = {
  id: '20260827_trainer1',
  uid: 'trainer1',
  date: '2026-08-27',
  seed: 20260827,
  outcome: 'won',
  badgesEarned: 8,
  finalRound: 8,
  teamDexIds: [1, 4, 7, 25, 131, 143],
  boardLevels: { '1': 8, '4': 6 },
  draftSequence: [
    { round: 1, pick: 1, offers: [1, 4, 7] },
    { round: 2, pick: 25, offers: [25, 39, 52] },
  ],
  timestamp: 1724774400000,
}

describe('validateRunRecord', () => {
  it('returns a valid record unchanged', () => {
    const result = validateRunRecord(VALID_RECORD)
    expect(result).not.toBeNull()
    expect(result!.uid).toBe('trainer1')
    expect(result!.badgesEarned).toBe(8)
    expect(result!.draftSequence).toHaveLength(2)
  })

  it('returns null for non-object input', () => {
    expect(validateRunRecord(null)).toBeNull()
    expect(validateRunRecord(42)).toBeNull()
    expect(validateRunRecord('string')).toBeNull()
  })

  it('returns null when uid is missing', () => {
    const { uid: _uid, ...rest } = VALID_RECORD
    expect(validateRunRecord(rest)).toBeNull()
  })

  it('returns null when outcome is invalid', () => {
    expect(validateRunRecord({ ...VALID_RECORD, outcome: 'draw' })).toBeNull()
  })

  it('accepts all valid outcomes', () => {
    for (const outcome of ['won', 'lost', 'eliminated'] as const) {
      expect(validateRunRecord({ ...VALID_RECORD, outcome })).not.toBeNull()
    }
  })

  it('returns null when teamDexIds is not an array', () => {
    expect(validateRunRecord({ ...VALID_RECORD, teamDexIds: 'nope' })).toBeNull()
  })

  it('filters non-numbers out of teamDexIds', () => {
    const result = validateRunRecord({ ...VALID_RECORD, teamDexIds: [1, 'x', 4] })
    expect(result!.teamDexIds).toEqual([1, 4])
  })

  it('filters malformed draft picks from draftSequence', () => {
    const result = validateRunRecord({
      ...VALID_RECORD,
      draftSequence: [
        { round: 1, pick: 1, offers: [1, 4, 7] },  // valid
        { round: 'bad' },  // invalid — missing pick and offers
      ],
    })
    expect(result!.draftSequence).toHaveLength(1)
  })

  it('defaults boardLevels to {} when missing', () => {
    const { boardLevels: _bl, ...rest } = VALID_RECORD
    const result = validateRunRecord(rest)
    expect(result!.boardLevels).toEqual({})
  })

  it('derives id from date and uid when id field is absent', () => {
    const { id: _id, ...rest } = VALID_RECORD
    const result = validateRunRecord(rest)
    expect(result!.id).toBe('20260827_trainer1')
  })
})
