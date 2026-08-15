/**
 * Quality bands and provenance-weighted rolling for items.
 *
 * The spec says "the model proposes a quality band; code assigns the numbers."
 * That wording was revised with Nick: the model does not propose a band. It
 * names the thing and says where it came from; code rolls the band from a table
 * weighted by that provenance. There is no field for requesting a better item.
 */
import type { Applicability, Item, Trait } from './kit'

export type Rng = () => number

export type Provenance = 'underfoot' | 'given' | 'bought' | 'taken' | 'hoard'
export type QualityBand = 'plain' | 'good' | 'fine' | 'rare' | 'storied'

export const QUALITY_BANDS: Record<QualityBand, { traits: number; bonuses: number[] }> = {
  plain:   { traits: 0, bonuses: [] },
  good:    { traits: 1, bonuses: [0] },
  fine:    { traits: 1, bonuses: [1] },
  rare:    { traits: 2, bonuses: [1, 0] },
  storied: { traits: 2, bonuses: [2, 0] },
}

// Five provenances, weights ported from tap-tap-adventure's RARITY_TABLES.
// All tables must sum to exactly 1.0.
export const PROVENANCE_TABLES: Record<Provenance, { band: QualityBand; weight: number }[]> = {
  underfoot: [
    { band: 'plain',   weight: 0.55 },
    { band: 'good',    weight: 0.28 },
    { band: 'fine',    weight: 0.12 },
    { band: 'rare',    weight: 0.04 },
    { band: 'storied', weight: 0.01 },
  ],
  given: [
    { band: 'plain',   weight: 0.40 },
    { band: 'good',    weight: 0.35 },
    { band: 'fine',    weight: 0.20 },
    { band: 'rare',    weight: 0.04 },
    { band: 'storied', weight: 0.01 },
  ],
  bought: [
    { band: 'plain',   weight: 0.45 },
    { band: 'good',    weight: 0.35 },
    { band: 'fine',    weight: 0.15 },
    { band: 'rare',    weight: 0.04 },
    { band: 'storied', weight: 0.01 },
  ],
  taken: [
    { band: 'plain',   weight: 0.10 },
    { band: 'good',    weight: 0.30 },
    { band: 'fine',    weight: 0.40 },
    { band: 'rare',    weight: 0.15 },
    { band: 'storied', weight: 0.05 },
  ],
  hoard: [
    { band: 'plain',   weight: 0.20 },
    { band: 'good',    weight: 0.35 },
    { band: 'fine',    weight: 0.30 },
    { band: 'rare',    weight: 0.12 },
    { band: 'storied', weight: 0.03 },
  ],
}

/** Roll the quality band. rng is passed in — domain/ may not call Math.random. */
export function rollQuality(provenance: Provenance, rng: Rng): QualityBand {
  const table = PROVENANCE_TABLES[provenance]
  const roll = rng()
  let cumulative = 0
  for (const entry of table) {
    cumulative += entry.weight
    if (roll < cumulative) return entry.band
  }
  // Floating-point guard: return the last entry if we overshot.
  return table[table.length - 1].band
}

/**
 * Assign bonuses from the band to the labels the model wrote.
 *
 * Extra labels are dropped — the band decides how many traits survive, not the
 * model's list length. Missing labels are not invented — code does not write
 * prose, so a band with 2 traits and 0 labels returns 0 traits.
 */
export function traitsFor(
  band: QualityBand,
  labels: { label: string; applies: Applicability }[]
): Trait[] {
  const { traits: count, bonuses } = QUALITY_BANDS[band]
  return labels.slice(0, count).map((l, i) => ({
    label: l.label,
    bonus: bonuses[i] ?? 0,
    applies: l.applies,
  }))
}

/** Total modifier this item contributes to the die. */
export function worthOf(item: Item): number {
  return item.traits.reduce((sum, t) => sum + t.bonus, 0)
}

/**
 * One line for the DM to quote back when describing the item.
 *
 * A plain rope is "+0 on the die — it makes climbing attemptable, not easier."
 * A storied blade is "+2 and +0 on the die — two reasons it matters."
 * The number is the thing the DM is not allowed to decide.
 */
export function describeQuality(band: QualityBand, worth: number): string {
  const { bonuses } = QUALITY_BANDS[band]
  if (bonuses.length === 0) return `plain — no bonus on the die; it makes things possible, not easier`
  const bonusStr = bonuses.map(b => (b >= 0 ? `+${b}` : `${b}`)).join(' and ')
  const worthStr = worth >= 0 ? `+${worth}` : `${worth}`
  const suffix = worth === 0
    ? 'a named reason for the DM to allow a roll'
    : `${worthStr} on the die total`
  return `${band} — ${bonusStr} on the die; ${suffix}`
}
