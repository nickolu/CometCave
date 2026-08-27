/**
 * Seeded deterministic PRNG (Mulberry32).
 * Pure — no Date.now(), no Math.random().
 *
 * Usage:
 *   const rng = makePRNG(42)
 *   rng.next()      // 0–1 float
 *   rng.nextInt(6)  // 0–5 integer
 */
export interface PRNG {
  /** Returns a float in [0, 1) */
  next(): number
  /** Returns an integer in [0, n) */
  nextInt(n: number): number
  /** Returns a float in [min, max) */
  nextFloat(min: number, max: number): number
}

export function makePRNG(seed: number): PRNG {
  let s = seed >>> 0

  function next(): number {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    nextInt(n: number): number {
      return Math.floor(next() * n)
    },
    nextFloat(min: number, max: number): number {
      return min + next() * (max - min)
    },
  }
}
