import rawChart from './data/type-chart.json'

export type Type = keyof typeof rawChart

// type-chart.json stores only non-1 values; missing = 1.0
export function effectiveness(attacking: Type, defending: Type[]): number {
  const row = rawChart[attacking] as Record<string, number> | undefined
  return defending.reduce((acc, def) => {
    const val = row?.[def] ?? 1
    return acc * val
  }, 1)
}
