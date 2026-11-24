import { describe, expect, it } from 'vitest'

import { CARDS } from '@/app/postmortem/data/cards'
import { incidents } from '@/app/postmortem/data/incidents'

import {
  HAND_SIZE,
  MAX_ELIMINATIONS,
  buildHand,
  canClose,
  classifyHand,
  cluesRevealedFor,
  createRng,
  eliminateCard,
  eliminationCandidates,
  isFullySolved,
  isNewHighScore,
  multiplierFor,
  newRound,
  pickIncidents,
  playCard,
  roundMultiplier,
  scoreIncident,
  shuffle,
  summarizeRun,
  toResult,
} from './rules'

import type { Incident } from '@/app/postmortem/data/incidents'
import type { Round } from './rules'

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
  it('starts at x3 and drops one step per elimination, never below x1', () => {
    expect(multiplierFor(0)).toBe(3)
    expect(multiplierFor(1)).toBe(2)
    expect(multiplierFor(2)).toBe(1)
    expect(multiplierFor(3)).toBe(1)
    expect(multiplierFor(-1)).toBe(3)
  })
})

describe('cluesRevealedFor', () => {
  it('shows clue 1 at the start; the 1st play reveals clue 2 and the 2nd reveals clue 3', () => {
    expect(cluesRevealedFor(0)).toBe(1)
    expect(cluesRevealedFor(1)).toBe(2)
    expect(cluesRevealedFor(2)).toBe(3)
    expect(cluesRevealedFor(3)).toBe(3)
    expect(cluesRevealedFor(8)).toBe(3)
  })
})

const [f1, f2, f3] = inc.factors
const [d1, d2] = inc.decoys.map(d => d.id)
const fill = hand.find(id => !inc.factors.includes(id) && !inc.decoys.some(d => d.id === id)) as string

function mustPlay(round: Round, id: string): Round {
  const r = playCard(round, id)
  if (!r.ok) throw new Error(`could not play ${id}: ${r.reason}`)
  return r.round
}
function mustEliminate(round: Round, seed: string): { round: Round; removed: string } {
  const r = eliminateCard(inc, round, createRng(seed))
  if (!r.ok) throw new Error(`could not eliminate: ${r.reason}`)
  return r
}

describe('playCard', () => {
  it('plays in order, and each play reveals the next clue', () => {
    let round = newRound(hand)
    expect(cluesRevealedFor(round.played.length)).toBe(1)
    round = mustPlay(round, f2)
    expect(round.played).toEqual([f2])
    expect(cluesRevealedFor(round.played.length)).toBe(2)
    round = mustPlay(round, d1)
    expect(round.played).toEqual([f2, d1])
    expect(cluesRevealedFor(round.played.length)).toBe(3)
    round = mustPlay(round, f1)
    expect(round.played).toEqual([f2, d1, f1])
    expect(cluesRevealedFor(round.played.length)).toBe(3)
  })

  it('does not mutate the round and does not change the multiplier', () => {
    const start = newRound(hand)
    const after = mustPlay(start, f1)
    expect(start.played).toEqual([])
    expect(roundMultiplier(after)).toBe(3)
  })

  it('refuses an already played card', () => {
    const round = mustPlay(newRound(hand), f1)
    expect(playCard(round, f1)).toEqual({ ok: false, reason: 'already-played' })
  })

  it('refuses an eliminated card', () => {
    const { round, removed } = mustEliminate(newRound(hand), 'a')
    expect(playCard(round, removed)).toEqual({ ok: false, reason: 'eliminated' })
  })

  it('refuses a card that is not in the hand', () => {
    expect(playCard(newRound(hand), 'CF-9999')).toEqual({ ok: false, reason: 'not-in-hand' })
  })
})

describe('canClose', () => {
  it('needs at least one played card', () => {
    expect(canClose(newRound(hand))).toBe(false)
    expect(canClose(mustPlay(newRound(hand), fill))).toBe(true)
  })

  it('is not unlocked by eliminating', () => {
    expect(canClose(mustEliminate(newRound(hand), 'a').round)).toBe(false)
  })
})

describe('eliminateCard', () => {
  it('never removes a factor or a played card, across many seeds and orders', () => {
    for (let n = 0; n < 200; n++) {
      let round = newRound(hand)
      if (n % 2 === 0) round = mustPlay(round, d1)
      if (n % 3 === 0) round = mustPlay(round, fill)
      const first = mustEliminate(round, `seed-${n}`)
      const second = mustEliminate(first.round, `other-${n}`)
      for (const removed of [first.removed, second.removed]) {
        expect(inc.factors).not.toContain(removed)
        expect(round.played).not.toContain(removed)
        expect(hand).toContain(removed)
      }
      expect(second.removed).not.toBe(first.removed)
    }
  })

  it('costs one multiplier step each time and stops at x1 (max 2 uses)', () => {
    expect(MAX_ELIMINATIONS).toBe(2)
    const one = mustEliminate(newRound(hand), 'a')
    expect(roundMultiplier(one.round)).toBe(2)
    const two = mustEliminate(one.round, 'b')
    expect(roundMultiplier(two.round)).toBe(1)
    expect(eliminateCard(inc, two.round, createRng('c'))).toEqual({ ok: false, reason: 'min-multiplier' })
    expect(two.round.eliminated).toHaveLength(2)
  })

  it('is deterministic with a seeded rng and uses the injected rng', () => {
    const a = eliminateCard(inc, newRound(hand), createRng('same'))
    const b = eliminateCard(inc, newRound(hand), createRng('same'))
    expect(a).toEqual(b)
    const candidates = eliminationCandidates(inc, newRound(hand))
    const low = eliminateCard(inc, newRound(hand), () => 0)
    const high = eliminateCard(inc, newRound(hand), () => 0.999999)
    expect(low.ok && low.removed).toBe(candidates[0])
    expect(high.ok && high.removed).toBe(candidates[candidates.length - 1])
  })

  it('offers only decoys and filler as candidates', () => {
    const candidates = eliminationCandidates(inc, newRound(hand))
    expect(candidates).toHaveLength(HAND_SIZE - inc.factors.length)
    for (const f of inc.factors) expect(candidates).not.toContain(f)
  })

  it('fails without cost when no safe card is left', () => {
    let round = newRound(hand)
    for (const id of eliminationCandidates(inc, round)) round = mustPlay(round, id)
    expect(eliminateCard(inc, round, createRng('x'))).toEqual({ ok: false, reason: 'no-candidates' })
    expect(roundMultiplier(round)).toBe(3)
  })

  it('does not mutate the input round', () => {
    const start = newRound(hand)
    mustEliminate(start, 'a')
    expect(start.eliminated).toEqual([])
  })
})

describe('multiplier', () => {
  it('changes only through Eliminate', () => {
    let round = newRound(hand)
    expect(roundMultiplier(round)).toBe(3)
    for (const id of [f1, d1, f2, d2, f3]) {
      round = mustPlay(round, id)
      expect(roundMultiplier(round)).toBe(3)
    }
    expect(roundMultiplier(mustEliminate(newRound(hand), 'a').round)).toBe(2)
  })
})

describe('scoreIncident', () => {
  const run = (played: string[], multiplier: 1 | 2 | 3) => {
    const r = scoreIncident(inc, hand, played, multiplier)
    if (!r.ok) throw new Error('expected ok')
    return r.score
  }

  it('scores +10 per correct card at x3, x2 and x1', () => {
    expect(run([f1, f2], 3).points).toBe(60)
    expect(run([f1, f2], 2).points).toBe(40)
    expect(run([f1, f2], 1).points).toBe(20)
    expect(run([f1, f2], 1).multiplier).toBe(1)
  })

  it('takes -5 per wrong card, never multiplied', () => {
    expect(run([d1], 3).points).toBe(-5)
    expect(run([d1, d2], 3).points).toBe(-10)
    expect(run([d1, d2], 1).points).toBe(-10)
    expect(run([fill], 2).points).toBe(-5)
  })

  it('applies the multiplier to correct cards only', () => {
    expect(run([f1, f2, d1], 3).points).toBe(2 * 10 * 3 - 5)
    expect(run([f1, f2, d1], 2).points).toBe(2 * 10 * 2 - 5)
    expect(run([f1, f2, d1], 1).points).toBe(2 * 10 * 1 - 5)
  })

  it('scores missed cards as 0 and lists them', () => {
    const s = run([f1], 3)
    expect(s.points).toBe(30)
    expect(s.missed).toEqual([f2, f3])
    expect(s.correct).toEqual([f1])
    expect(s.wrong).toEqual([])
  })

  it('scores a mixed round: correct, wrong and missed together', () => {
    const s = run([f1, d1, fill], 2)
    expect(s.correct).toEqual([f1])
    expect(s.wrong).toEqual([d1, fill])
    expect(s.missed).toEqual([f2, f3])
    expect(s.points).toBe(10 * 2 - 2 * 5)
  })

  it('rejects an empty close', () => {
    expect(scoreIncident(inc, hand, [], 3)).toEqual({ ok: false, reason: 'empty' })
  })

  it('ignores cards that are not in the hand and duplicate plays', () => {
    expect(scoreIncident(inc, hand, ['CF-9999'], 3).ok).toBe(false)
    expect(run([f1, f1], 3).points).toBe(30)
  })

  it('detects a fully solved incident', () => {
    expect(run([f1, f2, f3], 3).solved).toBe(true)
    expect(run([f1, f2, f3, d1], 3).solved).toBe(false) // wrong card
    expect(run([f1, f2], 3).solved).toBe(false) // missed card
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
  const mk = (i: number, picks: string[], multiplier: 1 | 2 | 3) => {
    const incident = incidents[i]
    const h = buildHand(incident, createRng(`s${i}`))
    const r = scoreIncident(incident, h, picks, multiplier)
    if (!r.ok) throw new Error('empty')
    return toResult(incident, r.score)
  }

  it('totals score, counts fully solved and ranks missed cards', () => {
    const a = mk(0, incidents[0].factors, 3) // solved, 90
    const b = mk(1, [incidents[1].factors[0]], 2) // misses two, 20
    const c = mk(2, [incidents[2].factors[0], incidents[2].decoys[0].id], 1) // 10 - 5, misses two
    const s = summarizeRun([a, b, c])
    expect(s.totalScore).toBe(90 + 20 + 5)
    expect(s.incidentsPlayed).toBe(3)
    expect(s.fullySolved).toBe(1)
    expect(s.mostMissed.length).toBeLessThanOrEqual(5)
    expect(s.mostMissed.map(m => m.id)).toContain(incidents[2].decoys[0].id)
    expect(s.mostMissed.map(m => m.id)).not.toContain(incidents[0].factors[0])
  })

  it('ranks the most frequent cards first and caps at 5', () => {
    const base = mk(0, [incidents[0].decoys[0].id], 3)
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
