import { UNIT_CATALOG, Tier, Kin } from '../unit-catalog'

describe('UNIT_CATALOG', () => {
  it('every unit has exactly one tier', () => {
    const validTiers: Tier[] = ['T1', 'T2', 'T3', 'T4', 'T5']
    for (const u of UNIT_CATALOG) {
      expect(validTiers).toContain(u.tier)
    }
  })

  it('every unit has exactly one kin', () => {
    const validKin: Kin[] = ['Pack', 'Flock', 'Brood', 'Shell', 'Mineral', 'Serpent', 'Humanoid', 'Amorphous']
    for (const u of UNIT_CATALOG) {
      expect(validKin).toContain(u.kin)
    }
  })

  it('tier distribution snapshot', () => {
    const dist: Record<string, number> = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 }
    for (const u of UNIT_CATALOG) dist[u.tier]++
    expect(dist).toMatchSnapshot()
  })

  it('Bulbasaur is T1 (BST 318)', () => {
    const bulbasaur = UNIT_CATALOG.find(u => u.dexId === 1)
    expect(bulbasaur?.tier).toBe('T1')
  })

  it('Dragonite is T5 (BST 600)', () => {
    const dragonite = UNIT_CATALOG.find(u => u.dexId === 149)
    expect(dragonite?.tier).toBe('T5')
  })
})
