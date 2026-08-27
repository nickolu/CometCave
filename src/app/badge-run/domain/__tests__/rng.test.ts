import { makePRNG } from '../rng'

describe('makePRNG', () => {
  it('same seed produces same sequence', () => {
    const a = makePRNG(42)
    const b = makePRNG(42)
    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('different seeds produce different sequences', () => {
    const a = makePRNG(1)
    const b = makePRNG(2)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).not.toEqual(seqB)
  })

  it('next() returns values in [0, 1)', () => {
    const rng = makePRNG(99)
    for (let i = 0; i < 100; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('nextInt(n) returns integers in [0, n)', () => {
    const rng = makePRNG(7)
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
    }
  })

  it('sequence is deterministic across re-creation', () => {
    const first = makePRNG(12345)
    const expected = Array.from({ length: 20 }, () => first.next())
    const second = makePRNG(12345)
    const actual = Array.from({ length: 20 }, () => second.next())
    expect(actual).toEqual(expected)
  })
})
