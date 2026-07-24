export interface SpeckTypeDefinition {
  id: string; name: string
  hp: number; damage: number; speed: number
  attackRange: number; attackCooldown: number
  size: number; productionTime: number
  abilities: string[]
  recipe?: { inputs: Array<{ typeId: string; count: number }>; location: string }
}

export const SPECK_TYPES: Record<string, SpeckTypeDefinition> = {
  basic: {
    id: 'basic', name: 'Speck',
    hp: 1, damage: 1, speed: 80,
    attackRange: 6, attackCooldown: 500,
    size: 3, productionTime: 800,
    abilities: [],
  },
}
