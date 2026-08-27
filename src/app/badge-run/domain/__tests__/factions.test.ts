import { FACTIONS, getFaction, FactionName } from '../data/factions'
import units from '../data/units.json'

describe('FACTIONS', () => {
  it('every faction has at least 3 members', () => {
    for (const [name, ids] of Object.entries(FACTIONS) as [FactionName, readonly number[]][]) {
      expect(ids.length, `${name} has fewer than 3 members`).toBeGreaterThanOrEqual(3)
    }
  })

  it('no unit carries more than one faction', () => {
    const seen = new Map<number, FactionName>()
    for (const [name, ids] of Object.entries(FACTIONS) as [FactionName, readonly number[]][]) {
      for (const id of ids) {
        expect(seen.has(id), `dexId ${id} appears in both "${seen.get(id)}" and "${name}"`).toBe(false)
        seen.set(id, name)
      }
    }
  })

  it('all faction dexIds are valid Kanto units (1-149)', () => {
    const validIds = new Set(units.map(u => u.dexId))
    for (const [name, ids] of Object.entries(FACTIONS) as [FactionName, readonly number[]][]) {
      for (const id of ids) {
        expect(validIds.has(id), `${name} references dexId ${id} which is not in the unit catalog`).toBe(true)
      }
    }
  })

  it('getFaction returns correct faction', () => {
    expect(getFaction(52)).toBe('Team Rocket')   // Meowth
    expect(getFaction(133)).toBe('Eeveelutions') // Eevee
    expect(getFaction(144)).toBe('Legendary Birds') // Articuno
    expect(getFaction(1)).toBeNull()              // Bulbasaur — unaffiliated
  })
})
