import { getClassForNPC, deriveNPCCombatStats } from '@/app/tap-tap-adventure/lib/classGenerator'
import { FALLBACK_CLASSES } from '@/app/tap-tap-adventure/config/fallbackClasses'

describe('getClassForNPC', () => {
  it('is deterministic — same name always returns the same class', () => {
    const result1 = getClassForNPC('Aldric the Bold')
    const result2 = getClassForNPC('Aldric the Bold')
    expect(result1.id).toBe(result2.id)
    expect(result1.name).toBe(result2.name)
  })

  it('returns different classes for different names', () => {
    const names = ['Morgana', 'Theron', 'Sylvara', 'Borin']
    const classes = names.map(n => getClassForNPC(n).id)
    // At least 2 distinct class IDs among the 4 names
    const unique = new Set(classes)
    expect(unique.size).toBeGreaterThanOrEqual(2)
  })

  it('returned class is a valid GeneratedClass with required fields', () => {
    const cls = getClassForNPC('TestNPC')
    expect(typeof cls.id).toBe('string')
    expect(cls.id.length).toBeGreaterThan(0)
    expect(typeof cls.name).toBe('string')
    expect(cls.name.length).toBeGreaterThan(0)
    expect(typeof cls.description).toBe('string')
    expect(cls.statDistribution).toBeDefined()
    expect(typeof cls.statDistribution.strength).toBe('number')
    expect(typeof cls.statDistribution.intelligence).toBe('number')
    expect(typeof cls.statDistribution.luck).toBe('number')
    expect(typeof cls.statDistribution.charisma).toBe('number')
    expect(cls.startingAbility).toBeDefined()
    expect(typeof cls.favoredSchool).toBe('string')
  })

  it('always returns one of the FALLBACK_CLASSES entries', () => {
    const fallbackIds = new Set(FALLBACK_CLASSES.map(c => c.id))
    const testNames = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']
    for (const name of testNames) {
      const cls = getClassForNPC(name)
      expect(fallbackIds.has(cls.id)).toBe(true)
    }
  })
})

describe('deriveNPCCombatStats', () => {
  it('produces positive HP values', () => {
    const cls = getClassForNPC('TestNPC')
    const stats = deriveNPCCombatStats(cls, 1)
    expect(stats.hp).toBeGreaterThan(0)
    expect(stats.maxHp).toBeGreaterThan(0)
  })

  it('hp equals maxHp on fresh creation', () => {
    const cls = getClassForNPC('TestNPC')
    const stats = deriveNPCCombatStats(cls, 1)
    expect(stats.hp).toBe(stats.maxHp)
  })

  it('stats match the class statDistribution', () => {
    const cls = getClassForNPC('TestNPC')
    const combatStats = deriveNPCCombatStats(cls, 1)
    expect(combatStats.stats.strength).toBe(cls.statDistribution.strength)
    expect(combatStats.stats.intelligence).toBe(cls.statDistribution.intelligence)
    expect(combatStats.stats.luck).toBe(cls.statDistribution.luck)
    expect(combatStats.stats.charisma).toBe(cls.statDistribution.charisma)
  })

  it('scales HP with level', () => {
    const cls = getClassForNPC('ScalingTest')
    const statsLevel1 = deriveNPCCombatStats(cls, 1)
    const statsLevel10 = deriveNPCCombatStats(cls, 10)
    expect(statsLevel10.maxHp).toBeGreaterThan(statsLevel1.maxHp)
  })

  it('level 10 HP is 45 more than level 1 HP (5 per level)', () => {
    const cls = getClassForNPC('ScalingTest')
    const statsLevel1 = deriveNPCCombatStats(cls, 1)
    const statsLevel10 = deriveNPCCombatStats(cls, 10)
    expect(statsLevel10.maxHp - statsLevel1.maxHp).toBe(45) // (10 - 1) * 5
  })
})
