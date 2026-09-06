import { TIERS, type Tier } from '@/app/clusters/models/clusters'

/** Tier fills live in globals.css so the whole app shares one definition. */
export const TIER_VAR: Record<Tier, string> = {
  yellow: 'var(--cl-yellow)',
  green: 'var(--cl-green)',
  blue: 'var(--cl-blue)',
  purple: 'var(--cl-purple)',
}

export const TIER_EMOJI: Record<Tier, string> = {
  yellow: '🟨',
  green: '🟩',
  blue: '🟦',
  purple: '🟪',
}

export function tierIndex(tier: Tier): number {
  return TIERS.indexOf(tier)
}

/** Tier order, easiest first — the order a finished board is revealed in. */
export function byTier<T extends { tier: Tier }>(items: T[]): T[] {
  return [...items].sort((a, b) => tierIndex(a.tier) - tierIndex(b.tier))
}
