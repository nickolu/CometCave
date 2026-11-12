/**
 * How much of a landmark the player can see from where they stand.
 *
 * One rule for the map, the playbill caption and the server's arrival
 * options, so a place never reads as "unknown" in one and by name in another.
 */
export type DiscoveryTier = 'hidden' | 'distant' | 'unknown' | 'revealed'

export interface DiscoveryFlags {
  explored?: boolean
  /** A secret place: it stays off the map until the player is near or a map names it. */
  hidden?: boolean
  /** A map or chart named this place, so it is known at any distance. */
  mapped?: boolean
}

export function discoveryTier(distance: number, { explored = false, hidden = false, mapped = false }: DiscoveryFlags): DiscoveryTier {
  if (explored || mapped) return 'revealed'
  if (hidden) {
    if (distance > 100) return 'hidden'
    if (distance > 20) return 'unknown'
    return 'revealed'
  }
  if (distance > 100) return 'hidden'
  if (distance > 50) return 'distant'
  if (distance > 20) return 'unknown'
  return 'revealed'
}
