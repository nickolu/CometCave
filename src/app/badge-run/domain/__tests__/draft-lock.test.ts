import { describe, it, expect } from 'vitest'
import { startBlitz, pickUnit } from '../blitz/run'

describe('B-5.7 — Elite Four draft lock in pickUnit', () => {
  it('throws when attempting to draft at round 25', () => {
    let run = startBlitz(1234)
    // Manually set to round 25 + draft phase
    run = { ...run, round: 25, phase: 'draft' as const }
    expect(() => pickUnit(run, run.offers![0].dexId)).toThrow('Draft is locked')
  })

  it('throws when attempting to draft at round 29', () => {
    let run = startBlitz(1234)
    run = { ...run, round: 29, phase: 'draft' as const }
    expect(() => pickUnit(run, run.offers![0].dexId)).toThrow('Draft is locked')
  })

  it('does not throw for round 24 in draft phase', () => {
    let run = startBlitz(1234)
    run = { ...run, round: 24, phase: 'draft' as const }
    expect(() => pickUnit(run, run.offers![0].dexId)).not.toThrow()
  })

  it('does not throw for round 1 in draft phase', () => {
    const run = startBlitz(1234)
    expect(() => pickUnit(run, run.offers![0].dexId)).not.toThrow()
  })
})
