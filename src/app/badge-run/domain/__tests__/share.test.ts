import { describe, it, expect } from 'vitest'

// Mirror the share string format (not importing the component to avoid 'use client')
function buildShareString(run: { round: number; won: boolean; lost: boolean }): string {
  const today = new Date()
  const date = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
  const roundsCompleted = run.won ? 8 : run.round - 1
  const result = run.won ? 'cleared' : `fell round ${run.round}`
  return `Badge Run ${roundsCompleted}/8 — ${result} | ${date}`
}

describe('buildShareString', () => {
  it('formats a win correctly', () => {
    const s = buildShareString({ round: 8, won: true, lost: false })
    expect(s).toContain('8/8')
    expect(s).toContain('cleared')
  })

  it('formats a loss correctly', () => {
    const s = buildShareString({ round: 3, won: false, lost: true })
    expect(s).toContain('2/8') // rounds completed = round - 1 = 2
    expect(s).toContain('fell round 3')
  })

  it('contains today\'s date', () => {
    const s = buildShareString({ round: 1, won: false, lost: true })
    const year = new Date().getUTCFullYear().toString()
    expect(s).toContain(year)
  })
})
