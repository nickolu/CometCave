export interface SpeckTypeDefinition {
  id: string; name: string
  hp: number; damage: number; speed: number
  attackRange: number; attackCooldown: number
  size: number; productionTime: number
  supplyCost: number  // supply slots consumed while alive
  abilities: string[]
  recipe?: { inputs: Array<{ typeId: string; count: number }>; location: string }
}

export const SPECK_TYPES: Record<string, SpeckTypeDefinition> = {
  basic: {
    id: 'basic', name: 'Speck',
    hp: 1, damage: 1, speed: 64,
    attackRange: 6, attackCooldown: 500,
    size: 3, productionTime: 800,
    supplyCost: 1,
    abilities: [],
  },
  heavy: {
    id: 'heavy', name: 'Tank',
    hp: 5, damage: 2, speed: 48,
    attackRange: 8, attackCooldown: 700,
    size: 6, productionTime: 1800,
    supplyCost: 3,
    abilities: [],
  },
  scout: {
    id: 'scout', name: 'Dart',
    hp: 1, damage: 0.5, speed: 120,
    attackRange: 4, attackCooldown: 600,
    size: 2, productionTime: 500,
    supplyCost: 0.5,
    abilities: [],
  },
  missile: {
    id: 'missile', name: 'Missile',
    hp: 1, damage: 1, speed: 220,
    attackRange: 6, attackCooldown: 0,
    size: 2, productionTime: 0,
    supplyCost: 0,
    abilities: ['die_on_impact'],
  },
  defender: {
    id: 'defender', name: 'Defender',
    hp: 3, damage: 1.5, speed: 50,
    attackRange: 25, attackCooldown: 900,
    size: 5, productionTime: 0,
    supplyCost: 1,
    abilities: [],
  },
}

/**
 * Type advantage multiplier (rock-paper-scissors):
 * Heavy beats Basic (siege vs unarmored swarm)
 * Scout beats Heavy (agility vs slow armor)
 * Basic beats Scout (swarm overwhelms fragile fast units)
 * All other matchups: 1.0 (no advantage)
 */
export function getTypeAdvantage(attackerTypeId: string, targetTypeId: string): number {
  if (attackerTypeId === 'heavy'  && targetTypeId === 'basic')  return 1.3
  if (attackerTypeId === 'scout'  && targetTypeId === 'heavy')  return 1.35
  if (attackerTypeId === 'basic'  && targetTypeId === 'scout')  return 1.25
  return 1.0
}
