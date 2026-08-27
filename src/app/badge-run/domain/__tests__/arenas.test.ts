import { ARENAS, ARENA_SCHEDULE, getArena } from '../data/arenas'

describe('ARENAS', () => {
  it('has exactly 9 arenas', () => {
    expect(ARENAS).toHaveLength(9)
  })

  it('every arena has a unique id', () => {
    const ids = ARENAS.map(a => a.id)
    expect(new Set(ids).size).toBe(9)
  })

  it('every arena has at least one type boost', () => {
    for (const arena of ARENAS) {
      expect(Object.keys(arena.typeBoosts).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('every arena in the schedule maps to a defined arena', () => {
    for (const id of ARENA_SCHEDULE) {
      expect(getArena(id)).toBeDefined()
    }
  })

  it('ARENA_SCHEDULE contains all 9 arena ids', () => {
    expect(ARENA_SCHEDULE).toHaveLength(9)
    const arenaIds = new Set(ARENAS.map(a => a.id))
    for (const id of ARENA_SCHEDULE) {
      expect(arenaIds.has(id)).toBe(true)
    }
  })

  it('getArena returns undefined for unknown id', () => {
    expect(getArena('unknown-arena')).toBeUndefined()
  })
})
