import { getEnemyCount, generateEnemyVariant, scaleBossForParty } from '../lib/enemyVariants'
import { CombatEnemy } from '../models/combat'

const baseEnemy: CombatEnemy = {
  id: 'goblin-1',
  name: 'Goblin',
  description: 'A sneaky goblin.',
  hp: 100,
  maxHp: 100,
  attack: 20,
  defense: 10,
  level: 5,
  goldReward: 50,
}

describe('getEnemyCount', () => {
  it('returns 1 for solo player (no party)', () => {
    expect(getEnemyCount(0, false)).toBe(1)
  })

  it('returns 1 for boss regardless of party size', () => {
    expect(getEnemyCount(0, true)).toBe(1)
    expect(getEnemyCount(2, true)).toBe(1)
    expect(getEnemyCount(5, true)).toBe(1)
  })

  it('returns 1 or 2 for party size 1', () => {
    // Run many times to cover both branches
    const results = new Set<number>()
    for (let i = 0; i < 100; i++) {
      results.add(getEnemyCount(1, false))
    }
    // Should only contain 1 and/or 2
    for (const r of results) {
      expect([1, 2]).toContain(r)
    }
  })

  it('returns 2 or 3 for party size 2+', () => {
    const results = new Set<number>()
    for (let i = 0; i < 100; i++) {
      results.add(getEnemyCount(2, false))
    }
    for (const r of results) {
      expect([2, 3]).toContain(r)
    }
  })
})

describe('generateEnemyVariant', () => {
  it('creates enemy with 50-80% of base stats', () => {
    const variant = generateEnemyVariant(baseEnemy, 0, 'test-seed')
    expect(variant.hp).toBeGreaterThanOrEqual(Math.round(baseEnemy.maxHp * 0.5))
    expect(variant.hp).toBeLessThanOrEqual(Math.round(baseEnemy.maxHp * 0.8) + 1) // +1 for rounding
    expect(variant.attack).toBeGreaterThanOrEqual(Math.round(baseEnemy.attack * 0.5))
    expect(variant.attack).toBeLessThanOrEqual(Math.round(baseEnemy.attack * 0.8) + 1)
    expect(variant.defense).toBeGreaterThanOrEqual(Math.round(baseEnemy.defense * 0.5))
    expect(variant.defense).toBeLessThanOrEqual(Math.round(baseEnemy.defense * 0.8) + 1)
  })

  it('gives a different name from base enemy', () => {
    const variant = generateEnemyVariant(baseEnemy, 0, 'test-seed')
    expect(variant.name).not.toBe(baseEnemy.name)
    expect(variant.name).toContain(baseEnemy.name)
  })

  it('generates a unique id from base enemy', () => {
    const variant = generateEnemyVariant(baseEnemy, 0, 'test-seed')
    expect(variant.id).not.toBe(baseEnemy.id)
    expect(variant.id).toContain(baseEnemy.id)
  })

  it('reduces gold reward by 50%', () => {
    const variant = generateEnemyVariant(baseEnemy, 0, 'test-seed')
    expect(variant.goldReward).toBe(Math.round(baseEnemy.goldReward * 0.5))
  })

  it('is deterministic for same seed', () => {
    const v1 = generateEnemyVariant(baseEnemy, 0, 'my-seed')
    const v2 = generateEnemyVariant(baseEnemy, 0, 'my-seed')
    expect(v1.hp).toBe(v2.hp)
    expect(v1.attack).toBe(v2.attack)
    expect(v1.name).toBe(v2.name)
  })
})

describe('scaleBossForParty', () => {
  it('is identity for partySize=0', () => {
    const scaled = scaleBossForParty(baseEnemy, 0)
    expect(scaled).toEqual(baseEnemy)
  })

  it('scales HP by 25% per party member', () => {
    const scaled = scaleBossForParty(baseEnemy, 2)
    expect(scaled.hp).toBe(Math.round(baseEnemy.hp * 1.5))
    expect(scaled.maxHp).toBe(Math.round(baseEnemy.maxHp * 1.5))
  })

  it('scales attack by 10% per party member', () => {
    const scaled = scaleBossForParty(baseEnemy, 3)
    expect(scaled.attack).toBe(Math.round(baseEnemy.attack * 1.3))
  })

  it('preserves other fields', () => {
    const scaled = scaleBossForParty(baseEnemy, 1)
    expect(scaled.id).toBe(baseEnemy.id)
    expect(scaled.name).toBe(baseEnemy.name)
    expect(scaled.defense).toBe(baseEnemy.defense)
    expect(scaled.level).toBe(baseEnemy.level)
    expect(scaled.goldReward).toBe(baseEnemy.goldReward)
  })
})
