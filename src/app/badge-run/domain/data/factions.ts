export type FactionName =
  | 'Team Rocket'
  | 'Silph Co.'
  | 'Elite Four'
  | 'Fossils'
  | 'Eeveelutions'
  | 'Safari Zone'
  | 'Legendary Birds'

/** dexIds belonging to each faction */
export const FACTIONS: Record<FactionName, readonly number[]> = {
  'Team Rocket': [19, 20, 23, 24, 41, 42, 52, 53, 88, 89, 109, 110],
  'Silph Co.':   [63, 64, 65, 81, 82, 137],
  'Elite Four':  [79, 80, 87, 90, 91, 93, 94, 106, 107, 124, 130, 131, 148, 149],
  'Fossils':     [138, 139, 140, 141, 142],
  'Eeveelutions':[133, 134, 135, 136],
  'Safari Zone': [29, 30, 31, 32, 33, 34, 46, 47, 48, 49, 102, 103, 111, 112, 113, 115, 123, 128, 147],
  'Legendary Birds': [144, 145, 146],
}

/** Returns the faction a unit belongs to, or null if unaffiliated */
export function getFaction(dexId: number): FactionName | null {
  for (const [name, ids] of Object.entries(FACTIONS) as [FactionName, readonly number[]][]) {
    if ((ids as readonly number[]).includes(dexId)) return name
  }
  return null
}
