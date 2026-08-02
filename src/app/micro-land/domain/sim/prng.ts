/** Deterministic RNG + value noise. Same seed, same world, every time. */

/** mulberry32 — small, fast, good enough for terrain and wandering. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = () => number

export function randRange(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo)
}

export function randInt(rng: Rng, lo: number, hi: number): number {
  return Math.floor(randRange(rng, lo, hi + 1))
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]
}

/**
 * 2D value noise with a hashed lattice. Cheaper than Perlin and plenty for
 * cave blobs and hill lines at this resolution.
 */
export function makeNoise2D(seed: number): (x: number, y: number) => number {
  const s = seed >>> 0

  function hash(ix: number, iy: number): number {
    let h = (ix * 374761393 + iy * 668265263 + s * 1274126177) | 0
    h = (h ^ (h >>> 13)) | 0
    h = Math.imul(h, 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }

  const smooth = (t: number) => t * t * (3 - 2 * t)

  return function noise(x: number, y: number): number {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = smooth(x - x0)
    const fy = smooth(y - y0)
    const n00 = hash(x0, y0)
    const n10 = hash(x0 + 1, y0)
    const n01 = hash(x0, y0 + 1)
    const n11 = hash(x0 + 1, y0 + 1)
    const a = n00 + (n10 - n00) * fx
    const b = n01 + (n11 - n01) * fx
    return a + (b - a) * fy
  }
}

/** Layered noise — a few octaves of `makeNoise2D` summed. */
export function fbm(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves = 4
): number {
  let value = 0
  let amp = 0.5
  let freq = 1
  let total = 0
  for (let i = 0; i < octaves; i++) {
    value += noise(x * freq, y * freq) * amp
    total += amp
    amp *= 0.5
    freq *= 2
  }
  return value / total
}
