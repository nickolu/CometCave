export interface BuildingTypeDefinition {
  id: string; name: string
  maxHp: number; size: number
  spawnTypeId: string | null
  spawnInterval: number; spawnCount: number
  cost?: Array<{ typeId: string; count: number }>
}

export const BUILDING_TYPES: Record<string, BuildingTypeDefinition> = {
  base: {
    id: 'base', name: 'Base',
    maxHp: 100, size: 40,
    spawnTypeId: 'basic',
    spawnInterval: 800, spawnCount: 1,
  },
}
