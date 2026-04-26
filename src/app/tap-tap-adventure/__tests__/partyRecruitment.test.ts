import { createPartyMember, getTavernRecruits } from '@/app/tap-tap-adventure/lib/partyRecruitment'

describe('createPartyMember', () => {
  it('returns a valid PartyMember with generatedClass populated', () => {
    const member = createPartyMember({
      id: 'test-1',
      name: 'Rowan',
      level: 3,
      dailyCost: 2,
    })
    expect(member.id).toBe('test-1')
    expect(member.name).toBe('Rowan')
    expect(member.level).toBe(3)
    expect(member.dailyCost).toBe(2)
    expect(member.generatedClass).toBeDefined()
    expect(member.hp).toBeGreaterThan(0)
    expect(member.maxHp).toBeGreaterThan(0)
    expect(member.stats).toBeDefined()
    expect(typeof member.stats.strength).toBe('number')
    expect(typeof member.stats.intelligence).toBe('number')
    expect(typeof member.stats.luck).toBe('number')
    expect(typeof member.stats.charisma).toBe('number')
  })

  it('className matches generatedClass.name (shared class generation)', () => {
    const member = createPartyMember({
      id: 'test-2',
      name: 'Kael',
      level: 5,
      dailyCost: 3,
    })
    expect(member.className).toBe(member.generatedClass?.name)
  })

  it('uses provided icon when given', () => {
    const member = createPartyMember({
      id: 'test-3',
      name: 'Lyra',
      icon: '🧙',
      level: 1,
      dailyCost: 1,
    })
    expect(member.icon).toBe('🧙')
  })

  it('falls back to default icon when not provided', () => {
    const member = createPartyMember({
      id: 'test-4',
      name: 'Thorne',
      level: 1,
      dailyCost: 1,
    })
    expect(member.icon).toBe('⚔️')
  })

  it('defaults rarity to common', () => {
    const member = createPartyMember({
      id: 'test-5',
      name: 'Mira',
      level: 1,
      dailyCost: 1,
    })
    expect(member.rarity).toBe('common')
  })

  it('uses provided rarity', () => {
    const member = createPartyMember({
      id: 'test-6',
      name: 'Dax',
      level: 1,
      dailyCost: 2,
      rarity: 'rare',
    })
    expect(member.rarity).toBe('rare')
  })

  it('defaults role to combatant', () => {
    const member = createPartyMember({
      id: 'test-7',
      name: 'Selene',
      level: 1,
      dailyCost: 1,
    })
    expect(member.role).toBe('combatant')
  })

  it('has equipment slots initialized to null', () => {
    const member = createPartyMember({
      id: 'test-8',
      name: 'Flint',
      level: 1,
      dailyCost: 1,
    })
    expect(member.equipment.weapon).toBeNull()
    expect(member.equipment.armor).toBeNull()
    expect(member.equipment.accessory).toBeNull()
  })

  it('recruitCost defaults to 0', () => {
    const member = createPartyMember({
      id: 'test-9',
      name: 'Ivy',
      level: 1,
      dailyCost: 1,
    })
    expect(member.recruitCost).toBe(0)
  })
})

describe('getTavernRecruits', () => {
  it('returns exactly 2 recruits', () => {
    const recruits = getTavernRecruits(5, 'green_meadows', 1)
    expect(recruits).toHaveLength(2)
  })

  it('is deterministic — same args always produce the same recruits', () => {
    const recruits1 = getTavernRecruits(5, 'green_meadows', 1)
    const recruits2 = getTavernRecruits(5, 'green_meadows', 1)
    expect(recruits1[0].id).toBe(recruits2[0].id)
    expect(recruits1[0].name).toBe(recruits2[0].name)
    expect(recruits1[1].id).toBe(recruits2[1].id)
    expect(recruits1[1].name).toBe(recruits2[1].name)
  })

  it('varies by region', () => {
    const recruitsA = getTavernRecruits(5, 'green_meadows', 1)
    const recruitsB = getTavernRecruits(5, 'dark_forest', 1)
    // At least one recruit should differ between regions
    const sameFirst = recruitsA[0].name === recruitsB[0].name && recruitsA[0].rarity === recruitsB[0].rarity
    const sameSecond = recruitsA[1].name === recruitsB[1].name && recruitsA[1].rarity === recruitsB[1].rarity
    expect(sameFirst && sameSecond).toBe(false)
  })

  it('varies by day', () => {
    const recruitsDay1 = getTavernRecruits(5, 'green_meadows', 1)
    const recruitsDay2 = getTavernRecruits(5, 'green_meadows', 2)
    // At least one recruit should differ between days
    const sameFirst = recruitsDay1[0].name === recruitsDay2[0].name && recruitsDay1[0].rarity === recruitsDay2[0].rarity
    const sameSecond = recruitsDay1[1].name === recruitsDay2[1].name && recruitsDay1[1].rarity === recruitsDay2[1].rarity
    expect(sameFirst && sameSecond).toBe(false)
  })

  it('recruits have recruitCost > 0', () => {
    const recruits = getTavernRecruits(5, 'green_meadows', 1)
    for (const recruit of recruits) {
      expect(recruit.recruitCost).toBeGreaterThan(0)
    }
  })

  it('recruits have dailyCost > 0', () => {
    const recruits = getTavernRecruits(5, 'green_meadows', 1)
    for (const recruit of recruits) {
      expect(recruit.dailyCost).toBeGreaterThan(0)
    }
  })

  it('all recruits have role combatant', () => {
    const recruits = getTavernRecruits(5, 'green_meadows', 1)
    for (const recruit of recruits) {
      expect(recruit.role).toBe('combatant')
    }
  })

  it('recruits have valid rarity values', () => {
    const validRarities = ['common', 'uncommon', 'rare', 'legendary']
    const recruits = getTavernRecruits(10, 'green_meadows', 1)
    for (const recruit of recruits) {
      expect(validRarities).toContain(recruit.rarity)
    }
  })

  it('recruits have generatedClass populated', () => {
    const recruits = getTavernRecruits(5, 'green_meadows', 1)
    for (const recruit of recruits) {
      expect(recruit.generatedClass).toBeDefined()
      expect(recruit.className).toBe(recruit.generatedClass?.name)
    }
  })
})
