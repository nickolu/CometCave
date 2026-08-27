import { UNIT_CATALOG, type CatalogUnit, type Tier } from '../unit-catalog'

const TIER_COPIES: Record<Tier, number> = {
  T1: 20,
  T2: 16,
  T3: 12,
  T4: 9,
  T5: 6,
}

export interface PoolEntry {
  unit: CatalogUnit
  available: number
  total: number
}

export type Pool = Map<number, PoolEntry> // keyed by dexId

export function createPool(): Pool {
  const pool = new Map<number, PoolEntry>()
  for (const unit of UNIT_CATALOG) {
    const total = TIER_COPIES[unit.tier]
    pool.set(unit.dexId, { unit, available: total, total })
  }
  return pool
}

/**
 * Attempt to take one copy of a unit from the pool.
 * Returns the CatalogUnit if successful, null if unavailable.
 */
export function takeUnit(pool: Pool, dexId: number): CatalogUnit | null {
  const entry = pool.get(dexId)
  if (!entry || entry.available <= 0) return null
  entry.available--
  return entry.unit
}

/**
 * Return one copy of a unit back to the pool (e.g. after selling).
 * Throws if returned more than total copies.
 */
export function returnUnit(pool: Pool, dexId: number): void {
  const entry = pool.get(dexId)
  if (!entry) throw new Error(`Unknown dexId: ${dexId}`)
  if (entry.available >= entry.total) throw new Error(`Cannot return more copies than total for dexId: ${dexId}`)
  entry.available++
}

/**
 * Get all pool entries with available copies > 0, optionally filtered by tier.
 */
export function getAvailable(pool: Pool, tier?: Tier): PoolEntry[] {
  const entries = [...pool.values()].filter(e => e.available > 0)
  return tier ? entries.filter(e => e.unit.tier === tier) : entries
}

/**
 * Total copies remaining in the pool across all units.
 */
export function totalAvailable(pool: Pool): number {
  return [...pool.values()].reduce((sum, e) => sum + e.available, 0)
}
