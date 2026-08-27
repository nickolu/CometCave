import { describe, it, expect } from 'vitest'
import { GAUNTLET_SCHEDULE, getRoundInfo, isGymRound } from '../gauntlet/schedule'
import { BOSS_BOARDS, getBossTeam } from '../gauntlet/bosses'

describe('GAUNTLET_SCHEDULE', () => {
  it('has exactly 29 rounds', () => {
    expect(GAUNTLET_SCHEDULE.length).toBe(29)
  })

  it('all rounds have a valid arenaId', () => {
    for (const info of GAUNTLET_SCHEDULE) {
      expect(info.arenaId).toBeTruthy()
    }
  })

  it('has exactly 13 boss rounds', () => {
    const bossRounds = GAUNTLET_SCHEDULE.filter(r => r.isBoss)
    expect(bossRounds.length).toBe(13)
  })

  it('boss rounds are at the correct positions', () => {
    const bossRoundNumbers = GAUNTLET_SCHEDULE
      .filter(r => r.isBoss)
      .map(r => r.round)
    expect(bossRoundNumbers).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 25, 26, 27, 28, 29])
  })

  it('rounds 25-29 have draftEnabled: false', () => {
    for (let r = 25; r <= 29; r++) {
      expect(getRoundInfo(r).draftEnabled).toBe(false)
    }
  })

  it('rounds 1-24 have draftEnabled: true', () => {
    for (let r = 1; r <= 24; r++) {
      expect(getRoundInfo(r).draftEnabled).toBe(true)
    }
  })
})

describe('isGymRound', () => {
  it('returns true for known boss rounds', () => {
    for (const r of [3, 6, 9, 12, 15, 18, 21, 24, 25, 26, 27, 28, 29]) {
      expect(isGymRound(r)).toBe(true)
    }
  })

  it('returns false for free rounds', () => {
    for (const r of [1, 2, 4, 5, 7, 8, 10, 11]) {
      expect(isGymRound(r)).toBe(false)
    }
  })
})

describe('BOSS_BOARDS', () => {
  it('has exactly 13 boards', () => {
    expect(Object.keys(BOSS_BOARDS).length).toBe(13)
  })

  it('each board has between 3 and 6 units', () => {
    for (const [id, team] of Object.entries(BOSS_BOARDS)) {
      expect(team.length).toBeGreaterThanOrEqual(3)
      expect(team.length).toBeLessThanOrEqual(6)
    }
  })

  it('all units in boss boards exist in the catalog', () => {
    for (const [id, team] of Object.entries(BOSS_BOARDS)) {
      for (const unit of team) {
        expect(unit).toBeDefined()
        expect(unit.dexId).toBeGreaterThan(0)
      }
    }
  })

  it('Champion board has T4/T5 units', () => {
    const champion = getBossTeam('champion')
    const highTierCount = champion.filter(u => u.tier === 'T4' || u.tier === 'T5').length
    expect(highTierCount).toBeGreaterThanOrEqual(3)
  })

  it('Brock board has no T4+ units (early game appropriate)', () => {
    const brock = getBossTeam('brock')
    const highTier = brock.filter(u => u.tier === 'T4' || u.tier === 'T5')
    expect(highTier.length).toBe(0)
  })

  it('Lance board includes Dragonite (T5)', () => {
    const lance = getBossTeam('lance')
    const dragonite = lance.find(u => u.dexId === 149)
    expect(dragonite).toBeDefined()
  })

  it('Agatha board includes all Ghost units', () => {
    const agatha = getBossTeam('agatha')
    const ghostDexIds = [92, 93, 94]  // Gastly, Haunter, Gengar
    for (const id of ghostDexIds) {
      expect(agatha.find(u => u.dexId === id)).toBeDefined()
    }
  })
})

describe('B-5.7 — Elite Four draft lock', () => {
  it('rounds 25-29 have draftEnabled: false', () => {
    for (let r = 25; r <= 29; r++) {
      const info = getRoundInfo(r)
      expect(info.draftEnabled).toBe(false)
    }
  })

  it('rounds 1-24 have draftEnabled: true', () => {
    for (let r = 1; r <= 24; r++) {
      const info = getRoundInfo(r)
      expect(info.draftEnabled).toBe(true)
    }
  })
})
