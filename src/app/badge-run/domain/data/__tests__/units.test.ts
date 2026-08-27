import units from '../units.json'
import typeChart from '../type-chart.json'

describe('Badge Run unit data', () => {
  it('has the right number of units', () => {
    expect(units.length).toBeGreaterThanOrEqual(140)
    expect(units.length).toBeLessThanOrEqual(151)
  })

  it('every unit has required fields', () => {
    for (const u of units) {
      expect(u.dexId).toBeGreaterThan(0)
      expect(u.name).toBeTruthy()
      expect(Array.isArray(u.types)).toBe(true)
      expect(u.types.length).toBeGreaterThan(0)
      expect(u.baseStats.hp).toBeGreaterThan(0)
      expect(Array.isArray(u.eggGroups)).toBe(true)
    }
  })

  it('type chart has all 18 types', () => {
    const types = Object.keys(typeChart)
    expect(types.length).toBe(18)
  })
})
