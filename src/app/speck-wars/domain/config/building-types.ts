export interface BuildingTypeDefinition {
  id: string; name: string
  maxHp: number; size: number
  spawnTypeId: string | null
  spawnInterval: number; spawnCount: number
  hpRegen?: number   // HP per second, only when not under attack
  cost?: Array<{ typeId: string; count: number }>
  sacrificeCost?: number        // basic specks required to build
  attackRange?: number          // turret scan radius
  fireInterval?: number         // ms between shots
}

export const BUILDING_TYPES: Record<string, BuildingTypeDefinition> = {
  base: {
    id: 'base', name: 'Base',
    maxHp: 100, size: 40,
    spawnTypeId: 'basic',
    spawnInterval: 1800, spawnCount: 1,
    hpRegen: 0.5,  // 0.5 HP/sec when not under attack — slow recovery rewards defensive play
  },
  outpost: {
    id: 'outpost', name: 'Outpost',
    maxHp: 50, size: 20,
    spawnTypeId: 'heavy',
    spawnInterval: 2700, spawnCount: 1,
    hpRegen: 2,  // 2 HP/sec when not under attack
  },
  turret: {
    id: 'turret', name: 'Turret',
    maxHp: 50, size: 18,
    spawnTypeId: null,
    spawnInterval: 0, spawnCount: 0,
    sacrificeCost: 20,        // 20 specks to build
    attackRange: 220,
    fireInterval: 1200,
  },
}
