import { ACHIEVEMENTS } from '../config/achievements'

describe('Combat challenge achievements', () => {
  const combatAchievements = ACHIEVEMENTS.filter(a => a.category === 'combat')

  it('has speedrunner achievement', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'combat_speedrunner')
    expect(a).toBeDefined()
    expect(a!.requirement).toBe(1)
  })

  it('has underdog achievement', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'combat_underdog')
    expect(a).toBeDefined()
    expect(a!.requirement).toBe(1)
  })

  it('has flawless victory achievement', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'combat_flawless')
    expect(a).toBeDefined()
    expect(a!.reward).toEqual({ gold: 100, reputation: 10 })
  })

  it('has party leader achievement', () => {
    expect(ACHIEVEMENTS.find(a => a.id === 'combat_party_leader')).toBeDefined()
  })

  it('has boss slayer 10 achievement', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'combat_boss_slayer_10')
    expect(a).toBeDefined()
    expect(a!.requirement).toBe(10)
  })

  it('has battle veteran achievement', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'combat_veteran')
    expect(a).toBeDefined()
    expect(a!.requirement).toBe(100)
  })

  it('has close call achievement', () => {
    expect(ACHIEVEMENTS.find(a => a.id === 'combat_close_call')).toBeDefined()
  })

  it('has war of attrition achievement', () => {
    const a = ACHIEVEMENTS.find(a => a.id === 'combat_endurance')
    expect(a).toBeDefined()
    expect(a!.requirement).toBe(1)
  })

  it('total combat achievements is at least 13', () => {
    expect(combatAchievements.length).toBeGreaterThanOrEqual(13)
  })
})
