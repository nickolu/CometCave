import { describe, expect, it } from 'vitest'

import { CARDS } from '@/app/postmortem/data/cards'
import { incidents } from '@/app/postmortem/data/incidents'

import {
  HAND_SIZE,
  buildHand,
  classifyHand,
  createRng,
  isFullySolved,
  isNewHighScore,
  multiplierFor,
  pickIncidents,
  scoreIncident,
  shuffle,
  summarizeRun,
  toResult,
} from './rules'

import type { Incident } from '@/app/postmortem/data/incidents'

const inc = incidents.find(i => i.id === 'friday-flag') as Incident // factors 0001, 0010, 0021; decoys 0002, 0011, 0015
const hand = buildHand(inc, createRng('fixed'))

describe('shuffle / rng', () => {
  it('is deterministic for a seed and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const a = shuffle(input, createRng('x'))
    const b = shuffle(input, createRng('x'))
    expect(a).toEqual(b)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...a].sort()).toEqual(input)
  })

  it('accepts any injected rng', () => {
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1])
  })
})

describe('pickIncidents', () => {
  it('picks 10 distinct incidents', () => {
    const picked = pickIncidents(incidents, createRng('run'))
    expect(picked).toHaveLength(10)
    expect(new Set(picked.map(i => i.id)).size).toBe(10)
  })
})

describe('buildHand', () => {
  const seeds = ['a', 'b', 'c', 'seed-4', 'postmortem', '12345']
  it.each(incidents.map(i => [i.id, i] as const))('%s: all factors and decoys, 8 cards, no duplicates', (_id, incident) => {
    for (const seed of seeds) {
      const h = buildHand(incident, createRng(seed))
      expect(h).toHaveLength(HAND_SIZE)
      expect(new Set(h).size).toBe(HAND_SIZE)
      for (const f of incident.factors) expect(h).toContain(f)
      for (const d of incident.decoys) expect(h).toContain(d.id)
      for (const id of h) expect(CARDS.some(c => c.id === id)).toBe(true)
    }
  })

  it('is deterministic for a seed and varies across seeds', () => {
    expect(buildHand(inc, createRng('s'))).toEqual(buildHand(inc, createRng('s')))
    const orders = new Set(seeds.map(s => buildHand(inc, createRng(s)).join()))
    expect(orders.size).toBeGreaterThan(1)
  })
})

describe('multiplierFor', () => {
  it('is x3 after clue 1, x2 after clue 2, x1 after clue 3', () => {
    expect(multiplierFor(1)).toBe(3)
    expect(multiplierFor(2)).toBe(2)
    expect(multiplierFor(3)).toBe(1)
  })
})

describe('scoreIncident', () => {
  const [f1, f2, f3] = inc.factors
  const [d1, d2] = inc.decoys.map(d => d.id)
  const fill = hand.find(id => !inc.factors.includes(id) && !inc.decoys.some(d => d.id === id)) as string

  const run = (selected: string[], clues: number) => {
    const r = scoreIncident(inc, hand, selected, clues)
    if (!r.ok) throw new Error('expected ok')
    return r.score
  }

  it('scores +10 per correct card at x3, x2 and x1', () => {
    expect(run([f1, f2], 1).points).toBe(60)
    expect(run([f1, f2], 2).points).toBe(40)
    expect(run([f1, f2], 3).points).toBe(20)
  })

  it('takes -5 per wrong card, never multiplied', () => {
    expect(run([d1], 1).points).toBe(-5)
    expect(run([d1, d2], 1).points).toBe(-10)
    expect(run([d1, d2], 3).points).toBe(-10)
    expect(run([fill], 2).points).toBe(-5)
  })

  it('applies the multiplier to correct cards only', () => {
    expect(run([f1, f2, d1], 1).points).toBe(2 * 10 * 3 - 5)
    expect(run([f1, f2, d1], 2).points).toBe(2 * 10 * 2 - 5)
    expect(run([f1, f2, d1], 3).points).toBe(2 * 10 * 1 - 5)
  })

  it('scores missed cards as 0 and lists them', () => {
    const s = run([f1], 1)
    expect(s.points).toBe(30)
    expect(s.missed).toEqual([f2, f3])
    expect(s.correct).toEqual([f1])
    expect(s.wrong).toEqual([])
  })

  it('rejects an empty commit', () => {
    expect(scoreIncident(inc, hand, [], 1)).toEqual({ ok: false, reason: 'empty' })
  })

  it('ignores cards that are not in the hand and duplicate picks', () => {
    expect(scoreIncident(inc, hand, ['CF-9999'], 1).ok).toBe(false)
    expect(run([f1, f1], 1).points).toBe(30)
  })

  it('detects a fully solved incident', () => {
    expect(run([f1, f2, f3], 1).solved).toBe(true)
    expect(run([f1, f2, f3, d1], 1).solved).toBe(false) // wrong card
    expect(run([f1, f2], 1).solved).toBe(false) // missed card
    expect(isFullySolved({ wrong: [], missed: [] })).toBe(true)
    expect(isFullySolved({ wrong: [d1], missed: [] })).toBe(false)
    expect(isFullySolved({ wrong: [], missed: [f1] })).toBe(false)
  })
})

describe('classifyHand', () => {
  it('marks correct, wrong, missed and neutral', () => {
    const [f1, f2, f3] = inc.factors
    const d1 = inc.decoys[0].id
    const marks = classifyHand(inc, hand, [f1, f2, d1])
    expect(marks[f1]).toBe('correct')
    expect(marks[f3]).toBe('missed')
    expect(marks[d1]).toBe('wrong')
    const untouched = hand.find(id => ![f1, f2, f3, d1].includes(id))!
    expect(marks[untouched]).toBe('neutral')
  })
})

describe('summarizeRun', () => {
  const mk = (i: number, picks: string[], clues: number) => {
    const incident = incidents[i]
    const h = buildHand(incident, createRng(`s${i}`))
    const r = scoreIncident(incident, h, picks, clues)
    if (!r.ok) throw new Error('empty')
    return toResult(incident, r.score)
  }

  it('totals score, counts fully solved and ranks missed cards', () => {
    const a = mk(0, incidents[0].factors, 1) // solved, 90
    const b = mk(1, [incidents[1].factors[0]], 2) // misses two, 20
    const c = mk(2, [incidents[2].factors[0], incidents[2].decoys[0].id], 3) // 10 - 5, misses two
    const s = summarizeRun([a, b, c])
    expect(s.totalScore).toBe(90 + 20 + 5)
    expect(s.incidentsPlayed).toBe(3)
    expect(s.fullySolved).toBe(1)
    expect(s.mostMissed.length).toBeLessThanOrEqual(5)
    expect(s.mostMissed.map(m => m.id)).toContain(incidents[2].decoys[0].id)
    expect(s.mostMissed.map(m => m.id)).not.toContain(incidents[0].factors[0])
  })

  it('ranks the most frequent cards first and caps at 5', () => {
    const base = mk(0, [incidents[0].decoys[0].id], 1)
    const results = [base, { ...base }, { ...base, wrong: [], missed: ['CF-0001', 'CF-0002', 'CF-0003', 'CF-0004', 'CF-0005'] }]
    const s = summarizeRun(results)
    expect(s.mostMissed).toHaveLength(5)
    expect(s.mostMissed[0].count).toBeGreaterThanOrEqual(s.mostMissed[4].count)
  })

  it('handles an empty run', () => {
    expect(summarizeRun([])).toEqual({ totalScore: 0, incidentsPlayed: 0, fullySolved: 0, mostMissed: [] })
  })
})

describe('isNewHighScore', () => {
  it('needs a score that beats the saved best', () => {
    expect(isNewHighScore(100, 90)).toBe(true)
    expect(isNewHighScore(90, 90)).toBe(false)
    expect(isNewHighScore(80, 90)).toBe(false)
  })
  it('counts the first positive score, but not zero or negative', () => {
    expect(isNewHighScore(10, null)).toBe(true)
    expect(isNewHighScore(0, null)).toBe(false)
    expect(isNewHighScore(-5, null)).toBe(false)
  })
})
