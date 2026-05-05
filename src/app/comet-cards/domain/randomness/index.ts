// Converts a string seed into a number
export function xmur3(str: string) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

// Deterministic RNG that returns numbers in [0, 1)
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function uuid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

export function deterministicUuid(seed: string) {
  const seedFn = xmur3(seed)
  const rng = mulberry32(seedFn())
  return `${rng().toString(36)}-${rng().toString(36).slice(2, 10)}-${rng().toString(36).slice(2, 10)}`
}

export function getRandomNumberWithSeed(seed: string, min: number, max: number) {
  const seedFn = xmur3(seed)
  const rng = mulberry32(seedFn())
  return Math.floor(rng() * (max - min + 1)) + min
}

// Deterministic RNG that returns a float in [0, 1)
export function getRandomFloatWithSeed(seed: string) {
  const seedFn = xmur3(seed)
  const rng = mulberry32(seedFn())
  return rng()
}

export function getRandomNumbersWithSeed({
  seed,
  min,
  max,
  numberOfNumbers,
}: {
  seed: string
  min: number
  max: number
  numberOfNumbers: number
}) {
  const seedFn = xmur3(seed)
  const rng = mulberry32(seedFn())
  return Array.from({ length: numberOfNumbers }, () => Math.floor(rng() * (max - min + 1)) + min)
}

export function getRandomWeightedNumberWithSeed({
  seed,
  weightedOptions,
}: {
  seed: string
  weightedOptions: Record<string, number>
}) {
  const seedFn = xmur3(seed)
  const rng = mulberry32(seedFn())
  return Object.keys(weightedOptions).reduce(
    (acc, key) => {
      acc[key] = rng() * weightedOptions[key]
      return acc
    },
    {} as Record<string, number>
  )
}

export function getRandomWeightedChoiceWithSeed<T extends string>({
  seed,
  weightedOptions,
}: {
  seed: string
  weightedOptions: Record<T, number>
}): T | undefined {
  const entries = Object.entries(weightedOptions) as [T, number][]
  const totalWeight = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0)
  if (totalWeight <= 0) return

  const seedFn = xmur3(seed)
  const rng = mulberry32(seedFn())

  // roll in [0, totalWeight)
  let roll = rng() * totalWeight
  for (const [key, rawWeight] of entries) {
    const weight = Math.max(0, rawWeight)
    if (weight === 0) continue
    if (roll < weight) return key
    roll -= weight
  }

  // Floating point safety fallback
  return entries[entries.length - 1]?.[0]
}

export function getCurrentDayAsSeedString() {
  return new Date().toISOString().split('T')[0]
}

export function buildSeedString(strings: string[]) {
  return strings.join('-')
}

export function getRandomChoiceWithSeed<T extends string>({
  seed,
  choices,
}: {
  seed: string
  choices: T[]
}): T | undefined {
  const seedFn = xmur3(seed)
  const rng = mulberry32(seedFn())
  return choices[Math.floor(rng() * choices.length)]
}
