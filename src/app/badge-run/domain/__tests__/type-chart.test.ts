import { effectiveness } from '../type-chart'

describe('effectiveness', () => {
  it('returns 1 for neutral matchup', () => {
    expect(effectiveness('Normal', ['Normal'])).toBe(1)
  })
  it('returns 2 for super effective', () => {
    expect(effectiveness('Fire', ['Grass'])).toBe(2)
  })
  it('returns 0.5 for not very effective', () => {
    expect(effectiveness('Fire', ['Water'])).toBe(0.5)
  })
  it('returns 0 for immune', () => {
    expect(effectiveness('Normal', ['Ghost'])).toBe(0)
  })
  it('returns 4 for 2x stacking on dual type', () => {
    // Fire vs Grass/Bug → 2 * 2 = 4
    expect(effectiveness('Fire', ['Grass', 'Bug'])).toBe(4)
  })
  it('returns 0.25 for 0.5x stacking on dual type', () => {
    // Fire vs Fire/Dragon → 0.5 * 0.5 = 0.25
    expect(effectiveness('Fire', ['Fire', 'Dragon'])).toBe(0.25)
  })
  it('returns 0 when one defending type is immune even if other is weak', () => {
    // Normal vs Ghost/Normal → 0 * 1 = 0
    expect(effectiveness('Normal', ['Ghost', 'Normal'])).toBe(0)
  })
})
