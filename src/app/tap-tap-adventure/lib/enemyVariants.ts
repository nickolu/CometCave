import { CombatEnemy } from '@/app/tap-tap-adventure/models/combat'
import { seededRandom } from '@/app/tap-tap-adventure/lib/landmarkGenerator'

const VARIANT_PREFIXES = ['Lesser', 'Young', 'Feral', 'Wild', 'Frenzied']

/**
 * Determine how many enemies to spawn based on party size.
 * Boss fights always have 1 enemy.
 */
export function getEnemyCount(partySize: number, isBoss: boolean): number {
  if (isBoss) return 1
  if (partySize === 0) return 1
  if (partySize === 1) return Math.random() < 0.5 ? 1 : 2
  return Math.random() < 0.4 ? 2 : 3
}

/**
 * Generate a weaker variant of the base enemy.
 * Stats are 50-80% of the original, less gold reward.
 */
export function generateEnemyVariant(baseEnemy: CombatEnemy, index: number, seed: string): CombatEnemy {
  const rng = seededRandom(`${seed}-variant-${index}`)
  const variance = 0.5 + rng() * 0.3 // 50-80% of base stats
  const prefixIdx = Math.floor(rng() * VARIANT_PREFIXES.length)
  const prefix = VARIANT_PREFIXES[prefixIdx]

  return {
    id: `${baseEnemy.id}-v${index}`,
    name: `${prefix} ${baseEnemy.name}`,
    description: baseEnemy.description,
    hp: Math.max(5, Math.round(baseEnemy.maxHp * variance)),
    maxHp: Math.max(5, Math.round(baseEnemy.maxHp * variance)),
    attack: Math.max(2, Math.round(baseEnemy.attack * variance)),
    defense: Math.max(1, Math.round(baseEnemy.defense * variance)),
    level: Math.max(1, baseEnemy.level - 1),
    goldReward: Math.round(baseEnemy.goldReward * 0.5),
    range: baseEnemy.range,
    element: baseEnemy.element,
  }
}

/**
 * Scale boss stats based on party size instead of adding more enemies.
 */
export function scaleBossForParty(boss: CombatEnemy, partySize: number): CombatEnemy {
  if (partySize === 0) return boss
  const hpScale = 1 + partySize * 0.25    // +25% HP per party member
  const atkScale = 1 + partySize * 0.1    // +10% attack per party member
  return {
    ...boss,
    hp: Math.round(boss.hp * hpScale),
    maxHp: Math.round(boss.maxHp * hpScale),
    attack: Math.round(boss.attack * atkScale),
  }
}
