import { describe, expect, it } from 'vitest'

import {
  MAX_TOP_RUNS,
  STORAGE_KEY,
  accuracy,
  addIncidentToStats,
  emptyData,
  highScore,
  parseData,
  readData,
  recordRun,
  serializeData,
  writeData,
} from './storage'

import type { IncidentResult } from './rules'

const result = (over: Partial<IncidentResult> = {}): IncidentResult => ({
  incidentId: 'x',
  factors: ['CF-0001', 'CF-0002'],
  correct: ['CF-0001'],
  wrong: ['CF-0003'],
  missed: ['CF-0002'],
  points: 25,
  multiplier: 3,
  solved: false,
  ...over,
})

describe('parse / serialize', () => {
  it('round-trips', () => {
    const data = recordRun(emptyData(), [result()], 25, '2026-11-23T10:00:00.000Z')
    expect(parseData(serializeData(data))).toEqual(data)
  })

  it('falls back to defaults for missing, corrupt or wrong-shape data', () => {
    expect(parseData(null)).toEqual(emptyData())
    expect(parseData('')).toEqual(emptyData())
    expect(parseData('{not json')).toEqual(emptyData())
    expect(parseData('[]')).toEqual(emptyData())
    expect(parseData('42')).toEqual(emptyData())
    expect(parseData(JSON.stringify({ version: 999, cardStats: {}, topRuns: [] }))).toEqual(emptyData())
  })

  it('drops malformed entries but keeps good ones', () => {
    const raw = JSON.stringify({
      version: 1,
      cardStats: {
        'CF-0001': { factor: 2, correct: 1, wrong: 0, missed: 1 },
        'CF-0002': { factor: 'lots' },
        'CF-0003': null,
      },
      topRuns: [{ score: 50, date: '2026-01-01T00:00:00.000Z', solved: 2 }, { score: 'x' }, 7],
    })
    const data = parseData(raw)
    expect(Object.keys(data.cardStats)).toEqual(['CF-0001'])
    expect(data.topRuns).toHaveLength(1)
  })
})

describe('stats accumulation', () => {
  it('counts factor, correct, wrong and missed per card', () => {
    const once = addIncidentToStats({}, result())
    expect(once['CF-0001']).toEqual({ factor: 1, correct: 1, wrong: 0, missed: 0 })
    expect(once['CF-0002']).toEqual({ factor: 1, correct: 0, wrong: 0, missed: 1 })
    expect(once['CF-0003']).toEqual({ factor: 0, correct: 0, wrong: 1, missed: 0 })

    const twice = addIncidentToStats(once, result())
    expect(twice['CF-0001']).toEqual({ factor: 2, correct: 2, wrong: 0, missed: 0 })
    expect(twice['CF-0003'].wrong).toBe(2)
  })

  it('does not mutate the previous stats', () => {
    const before = addIncidentToStats({}, result())
    const snapshot = JSON.stringify(before)
    addIncidentToStats(before, result())
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('computes lifetime accuracy', () => {
    expect(accuracy(undefined)).toBeNull()
    expect(accuracy({ factor: 0, correct: 0, wrong: 2, missed: 0 })).toBeNull()
    expect(accuracy({ factor: 4, correct: 3, wrong: 0, missed: 1 })).toBe(0.75)
  })

  it('accumulates across runs via recordRun', () => {
    let data = emptyData()
    data = recordRun(data, [result(), result()], 50, '2026-01-01T00:00:00.000Z')
    data = recordRun(data, [result()], 25, '2026-01-02T00:00:00.000Z')
    expect(data.cardStats['CF-0001'].factor).toBe(3)
    expect(data.cardStats['CF-0001'].correct).toBe(3)
  })
})

describe('top runs', () => {
  it('keeps only the best 5, highest first, with dates', () => {
    let data = emptyData()
    ;[40, 10, 90, 70, 20, 60, 30].forEach((score, i) => {
      data = recordRun(data, [], score, `2026-01-0${i + 1}T00:00:00.000Z`)
    })
    expect(data.topRuns).toHaveLength(MAX_TOP_RUNS)
    expect(data.topRuns.map(r => r.score)).toEqual([90, 70, 60, 40, 30])
    expect(data.topRuns[0].date).toBe('2026-01-03T00:00:00.000Z')
    expect(highScore(data)).toBe(90)
  })

  it('has no high score before any run', () => {
    expect(highScore(emptyData())).toBeNull()
  })

  it('counts fully solved incidents for the saved run', () => {
    const data = recordRun(emptyData(), [result({ solved: true }), result(), result({ solved: true })], 10, '2026-01-01T00:00:00.000Z')
    expect(data.topRuns[0].solved).toBe(2)
  })
})

describe('storage access', () => {
  it('reads and writes through a storage object', () => {
    const mem: Record<string, string> = {}
    const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => void (mem[k] = v) }
    const data = recordRun(emptyData(), [result()], 25, '2026-01-01T00:00:00.000Z')
    expect(writeData(data, store)).toBe(true)
    expect(Object.keys(mem)).toEqual([STORAGE_KEY])
    expect(readData(store)).toEqual(data)
  })

  it('survives storage that throws on read and write', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(readData(broken)).toEqual(emptyData())
    expect(writeData(emptyData(), broken)).toBe(false)
  })

  it('returns defaults when there is no storage', () => {
    expect(readData(undefined)).toEqual(emptyData())
  })
})
