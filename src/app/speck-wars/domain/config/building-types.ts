export interface BuildingTypeDefinition {
  id: string; name: string
  maxHp: number; size: number
  spawnTypeId: string | null
  spawnInterval: number; spawnCount: number
  hpRegen?: number   // HP per second, only when not under attack
  cost?: Array<{ typeId: string; count: number }>
  attackRange?: number          // turret scan radius
  fireInterval?: number         // ms between shots
}

export const BUILDING_TYPES: Record<string, BuildingTypeDefinition> = {
  base: {
    id: 'base', name: 'Base',
    maxHp: 100, size: 40,
    spawnTypeId: 'basic',
    spawnInterval: 3600, spawnCount: 1,
    hpRegen: 0.5,  // 0.5 HP/sec when not under attack — slow recovery rewards defensive play
  },
  outpost: {
    id: 'outpost', name: 'Outpost',
    maxHp: 50, size: 20,
    spawnTypeId: 'heavy',
    spawnInterval: 5400, spawnCount: 1,
    hpRegen: 2,  // 2 HP/sec when not under attack
  },
  turret: {
    id: 'turret', name: 'Turret',
    maxHp: 35, size: 16,
    spawnTypeId: null,
    spawnInterval: 0, spawnCount: 0,
    attackRange: 260,
    fireInterval: 900,
  },
  scoutPost: {
    id: 'scoutPost', name: 'Scout Post',
    maxHp: 22, size: 14,
    spawnTypeId: 'scout',
    spawnInterval: 7000, spawnCount: 1,
  },
  heavyForge: {
    id: 'heavyForge', name: 'Heavy Forge',
    maxHp: 28, size: 16,
    spawnTypeId: 'heavy',
    spawnInterval: 10000, spawnCount: 1,
  },
}
