// mulberry32 — fast, deterministic, good enough for game simulation
export function mulberry32(seed: number) {
  return function(): number {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    z = z + Math.imul(z ^ (z >>> 7), 61 | z) ^ z
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}
