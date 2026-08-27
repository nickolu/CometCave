import { UNIT_CATALOG } from '../unit-catalog'

/** Copies required to trigger a single-stage evolution (e.g. base → stage 2). */
export const COPIES_TO_EVOLVE = 3

/**
 * Resolve a copy collection, triggering chain evolutions.
 *
 * When copies[dexId] hits 3, consume those 3 and add 1 of the next evolutionary form.
 * This may chain: if the evolved form also hits 3, continue evolving.
 *
 * Items (if any) held by the old unit are transferred to the new form.
 *
 * @param copies  Current copy counts per dexId
 * @param dexId   The dexId of the unit just acquired
 * @param items   Held item per dexId (optional, propagated through evolution)
 * @returns Updated copies map, updated items map, and list of evolutions that triggered
 */
export function addCopy(
  copies: Record<number, number>,
  dexId: number,
  items: Record<number, string> = {},
): {
  copies: Record<number, number>
  items: Record<number, string>
  evolutions: Array<{ from: number; to: number }>
} {
  const newCopies = { ...copies }
  const newItems = { ...items }
  const evolutions: Array<{ from: number; to: number }> = []

  newCopies[dexId] = (newCopies[dexId] ?? 0) + 1

  // Process evolution chain: keep checking if we have 3 copies to evolve
  let currentDexId = dexId
  while ((newCopies[currentDexId] ?? 0) >= COPIES_TO_EVOLVE) {
    const unit = UNIT_CATALOG.find(u => u.dexId === currentDexId)
    if (!unit || unit.evolvesTo === null || unit.evolvesTo === undefined) {
      // Final form or unknown — no further evolution possible
      break
    }

    const evolvedDexId = unit.evolvesTo

    // Consume 3 copies of current form
    newCopies[currentDexId] = (newCopies[currentDexId] ?? 0) - COPIES_TO_EVOLVE

    // Add 1 copy of evolved form
    newCopies[evolvedDexId] = (newCopies[evolvedDexId] ?? 0) + 1

    // Transfer held item to evolved form
    if (newItems[currentDexId]) {
      newItems[evolvedDexId] = newItems[currentDexId]
      delete newItems[currentDexId]
    }

    evolutions.push({ from: currentDexId, to: evolvedDexId })
    currentDexId = evolvedDexId
  }

  return { copies: newCopies, items: newItems, evolutions }
}

/**
 * Find the final form in an evolutionary chain starting from baseDexId.
 * Returns baseDexId itself if it has no evolution.
 */
export function finalForm(baseDexId: number): number {
  let current = UNIT_CATALOG.find(u => u.dexId === baseDexId)
  if (!current) return baseDexId

  while (current.evolvesTo !== null && current.evolvesTo !== undefined) {
    const next = UNIT_CATALOG.find(u => u.dexId === current!.evolvesTo)
    if (!next) break
    current = next
  }

  return current.dexId
}

/**
 * Get all members of an evolutionary chain (base + all evolutions).
 */
export function evolutionChain(baseDexId: number): number[] {
  const chain: number[] = [baseDexId]
  let current = UNIT_CATALOG.find(u => u.dexId === baseDexId)
  if (!current) return chain

  while (current.evolvesTo !== null && current.evolvesTo !== undefined) {
    const next = UNIT_CATALOG.find(u => u.dexId === current!.evolvesTo)
    if (!next) break
    chain.push(next.dexId)
    current = next
  }

  return chain
}
