import { getSpellLevel, getXpForNextLevel, getSpellLevelMultiplier, MAX_SPELL_LEVEL } from '../lib/spellProgression'

describe('Spell progression', () => {
  it('level 1 at 0 XP', () => {
    expect(getSpellLevel(0)).toBe(1)
  })

  it('level 2 at 3 XP', () => {
    expect(getSpellLevel(3)).toBe(2)
  })

  it('level 3 at 8 XP', () => {
    expect(getSpellLevel(8)).toBe(3)
  })

  it('level 4 at 15 XP', () => {
    expect(getSpellLevel(15)).toBe(4)
  })

  it('level 5 at 25 XP', () => {
    expect(getSpellLevel(25)).toBe(5)
  })

  it('stays at level 5 above 25 XP', () => {
    expect(getSpellLevel(100)).toBe(5)
  })

  it('XP for next level at level 1 is 3', () => {
    expect(getXpForNextLevel(1)).toBe(3)
  })

  it('XP for next level at max level is 0', () => {
    expect(getXpForNextLevel(5)).toBe(0)
  })

  it('multiplier is 1.0 at level 1', () => {
    expect(getSpellLevelMultiplier(1)).toBeCloseTo(1.0)
  })

  it('multiplier is 1.4 at level 5', () => {
    expect(getSpellLevelMultiplier(5)).toBeCloseTo(1.4)
  })

  it('max spell level is 5', () => {
    expect(MAX_SPELL_LEVEL).toBe(5)
  })
})
