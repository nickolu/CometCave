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

/**
 * The same lattice in three dimensions.
 *
 * Exists for one reason: terrain has to meet itself at the seam. A world that
 * wraps but whose hills do not is worse than one that does not wrap at all —
 * the cliff at column zero is the one thing that tells the player the loop is a
 * trick. The fix is to stop sampling the noise along a *line* across the world
 * and start sampling it around a *circle*, which closes on itself by
 * construction (see `ringXY` in `config/themes.ts`).
 *
 * A circle eats two of the two dimensions, so anything that also varies with
 * depth — caves, ore seams, cloud banks — needs a third for `y`. Hence this.
 */
export function makeNoise3D(seed: number): (x: number, y: number, z: number) => number {
  const s = seed >>> 0

  function hash(ix: number, iy: number, iz: number): number {
    let h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + s * 1274126177) | 0
    h = (h ^ (h >>> 13)) | 0
    h = Math.imul(h, 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }

  const smooth = (t: number) => t * t * (3 - 2 * t)

  return function noise(x: number, y: number, z: number): number {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const z0 = Math.floor(z)
    const fx = smooth(x - x0)
    const fy = smooth(y - y0)
    const fz = smooth(z - z0)

    // Trilinear blend of the eight lattice corners.
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const c00 = lerp(hash(x0, y0, z0), hash(x0 + 1, y0, z0), fx)
    const c10 = lerp(hash(x0, y0 + 1, z0), hash(x0 + 1, y0 + 1, z0), fx)
    const c01 = lerp(hash(x0, y0, z0 + 1), hash(x0 + 1, y0, z0 + 1), fx)
    const c11 = lerp(hash(x0, y0 + 1, z0 + 1), hash(x0 + 1, y0 + 1, z0 + 1), fx)
    return lerp(lerp(c00, c10, fy), lerp(c01, c11, fy), fz)
  }
}

/** Layered `makeNoise3D`, matching `fbm`'s octave shape exactly. */
export function fbm3(
  noise: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  z: number,
  octaves = 4
): number {
  let value = 0
  let amp = 0.5
  let freq = 1
  let total = 0
  for (let i = 0; i < octaves; i++) {
    value += noise(x * freq, y * freq, z * freq) * amp
    total += amp
    amp *= 0.5
    freq *= 2
  }
  return value / total
}
