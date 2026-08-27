import { runBattle } from '../battle/runner'
import type { BattleUnit, Team } from '../battle/types'

function makeUnit(overrides: Partial<BattleUnit> & { instanceId: string }): BattleUnit {
  return {
    dexId: 1,
    name: 'TestMon',
    types: ['Normal'],
    tier: 'T2',
    kin: 'Pack',
    maxHp: 60,
    currentHp: 60,
    attack: 60,
    defense: 60,
    specialAttack: 60,
    specialDefense: 60,
    speed: 60,
    signatureMove: null,
    fainted: false,
    ...overrides,
  }
}

function makeTeam(id: string, units: BattleUnit[]): Team {
  return { id, units }
}

function make3v3(): { attackerTeam: Team; defenderTeam: Team } {
  const attackerTeam = makeTeam('team-a', [
    makeUnit({ instanceId: 'a-0', types: ['Fire'] }),
    makeUnit({ instanceId: 'a-1', types: ['Water'] }),
    makeUnit({ instanceId: 'a-2', types: ['Grass'] }),
  ])
  const defenderTeam = makeTeam('team-d', [
    makeUnit({ instanceId: 'd-0', types: ['Normal'] }),
    makeUnit({ instanceId: 'd-1', types: ['Rock'] }),
    makeUnit({ instanceId: 'd-2', types: ['Electric'] }),
  ])
  return { attackerTeam, defenderTeam }
}

describe('runBattle', () => {
  it('determinism: same inputs produce identical events and result', () => {
    const { attackerTeam, defenderTeam } = make3v3()
    const arenaId = 'rock-tunnel'
    const seed = 42

    const run1 = runBattle(attackerTeam, defenderTeam, arenaId, seed)
    const run2 = runBattle(attackerTeam, defenderTeam, arenaId, seed)

    expect(run1.events).toEqual(run2.events)
    expect(run1.result).toEqual(run2.result)
  })

  it('cycle cap: nearly unkillable units still produce a valid result within MAX_ROUNDS', () => {
    // Huge HP, minimal damage output (low attack vs high defense)
    const tankTeam = makeTeam('team-tank', [
      makeUnit({ instanceId: 't-0', maxHp: 100000, currentHp: 100000, attack: 1, defense: 10000, specialDefense: 10000 }),
      makeUnit({ instanceId: 't-1', maxHp: 100000, currentHp: 100000, attack: 1, defense: 10000, specialDefense: 10000 }),
    ])
    const tankTeam2 = makeTeam('team-tank2', [
      makeUnit({ instanceId: 'u-0', maxHp: 100000, currentHp: 100000, attack: 1, defense: 10000, specialDefense: 10000 }),
      makeUnit({ instanceId: 'u-1', maxHp: 100000, currentHp: 100000, attack: 1, defense: 10000, specialDefense: 10000 }),
    ])

    const { result } = runBattle(tankTeam, tankTeam2, 'rock-tunnel', 99)

    expect(result.totalTurns).toBeLessThanOrEqual(100)
    const validIds = new Set(['team-tank', 'team-tank2'])
    expect(validIds.has(result.winnerId)).toBe(true)
    expect(validIds.has(result.config.attackerTeamId)).toBe(true)
    expect(validIds.has(result.config.defenderTeamId)).toBe(true)
  })

  it('valid result: winner is one of the two team IDs, loser is the other, totalTurns >= 1', () => {
    const { attackerTeam, defenderTeam } = make3v3()
    const { result } = runBattle(attackerTeam, defenderTeam, 'tidal-shelf', 7)

    expect([attackerTeam.id, defenderTeam.id]).toContain(result.winnerId)
    const loserId = result.events.find(e => e.type === 'battle_end')
    expect(loserId).toBeDefined()
    if (loserId && loserId.type === 'battle_end') {
      expect(loserId.winnerId).toBe(result.winnerId)
      const otherId = result.winnerId === attackerTeam.id ? defenderTeam.id : attackerTeam.id
      expect(loserId.loserId).toBe(otherId)
    }
    expect(result.totalTurns).toBeGreaterThanOrEqual(1)
  })

  it('events structure: all events have correct turn field, battle_end is last', () => {
    const { attackerTeam, defenderTeam } = make3v3()
    const { events } = runBattle(attackerTeam, defenderTeam, 'poison-marsh', 13)

    expect(events.length).toBeGreaterThan(0)

    // synergy_applied events fire at turn 0 (pre-battle); all others are >= 1
    for (const ev of events) {
      if (ev.type === 'synergy_applied') {
        expect(ev.turn).toBe(0)
      } else {
        expect(ev.turn).toBeGreaterThanOrEqual(1)
      }
    }

    // battle_end is the last event
    const lastEvent = events[events.length - 1]
    expect(lastEvent.type).toBe('battle_end')

    // There should be exactly one battle_end event
    const battleEnds = events.filter(e => e.type === 'battle_end')
    expect(battleEnds).toHaveLength(1)
  })

  it('does not mutate input teams', () => {
    const { attackerTeam, defenderTeam } = make3v3()
    const originalAttackerHp = attackerTeam.units.map(u => u.currentHp)
    const originalDefenderHp = defenderTeam.units.map(u => u.currentHp)

    runBattle(attackerTeam, defenderTeam, 'rock-tunnel', 1)

    expect(attackerTeam.units.map(u => u.currentHp)).toEqual(originalAttackerHp)
    expect(defenderTeam.units.map(u => u.currentHp)).toEqual(originalDefenderHp)
    expect(attackerTeam.units.every(u => !u.fainted)).toBe(true)
    expect(defenderTeam.units.every(u => !u.fainted)).toBe(true)
  })

  it('unknown arenaId is handled gracefully (no crash, valid result)', () => {
    const { attackerTeam, defenderTeam } = make3v3()
    const { result, events } = runBattle(attackerTeam, defenderTeam, 'nonexistent-arena', 5)

    expect(result.totalTurns).toBeGreaterThanOrEqual(1)
    expect(events[events.length - 1].type).toBe('battle_end')
  })

  it('6v6 battle resolves in a finite number of rounds', () => {
    const attackerTeam = makeTeam('team-a6', [
      makeUnit({ instanceId: 'a-0', types: ['Fire'], speed: 80 }),
      makeUnit({ instanceId: 'a-1', types: ['Water'], speed: 70 }),
      makeUnit({ instanceId: 'a-2', types: ['Grass'], speed: 65 }),
      makeUnit({ instanceId: 'a-3', types: ['Electric'], speed: 60 }),
      makeUnit({ instanceId: 'a-4', types: ['Ice'], speed: 55 }),
      makeUnit({ instanceId: 'a-5', types: ['Fighting'], speed: 50 }),
    ])
    const defenderTeam = makeTeam('team-d6', [
      makeUnit({ instanceId: 'd-0', types: ['Normal'], speed: 75 }),
      makeUnit({ instanceId: 'd-1', types: ['Rock'], speed: 68 }),
      makeUnit({ instanceId: 'd-2', types: ['Bug'], speed: 62 }),
      makeUnit({ instanceId: 'd-3', types: ['Poison'], speed: 57 }),
      makeUnit({ instanceId: 'd-4', types: ['Dragon'], speed: 52 }),
      makeUnit({ instanceId: 'd-5', types: ['Dark'], speed: 45 }),
    ])

    const { result } = runBattle(attackerTeam, defenderTeam, 'volcanic-cavern', 2024)

    expect(result.totalTurns).toBeGreaterThanOrEqual(1)
    expect(result.totalTurns).toBeLessThanOrEqual(100)
    expect([attackerTeam.id, defenderTeam.id]).toContain(result.winnerId)
  })
})
