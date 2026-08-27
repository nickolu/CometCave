import type { BattleEvent, BattleResult } from '../battle/events'

describe('BattleEvent discriminated union', () => {
  it('fixture log round-trips through JSON unchanged', () => {
    const log: BattleEvent[] = [
      {
        type: 'unit_acts',
        turn: 1,
        actorId: 'attacker-0',
        targetId: 'defender-0',
        moveName: 'Flamethrower',
      },
      {
        type: 'damage',
        turn: 1,
        targetId: 'defender-0',
        amount: 45,
        effectiveness: 2,
        critical: false,
      },
      {
        type: 'arena_tick',
        turn: 1,
        arenaId: 'poison-marsh',
        rule: 'toxic-spill',
        affectedUnitIds: ['attacker-0', 'defender-0'],
      },
      {
        type: 'synergy_applied',
        turn: 1,
        synergyId: 'kin:Brood:2',
        affectedUnitIds: ['attacker-0'],
        effect: '+15% attack',
      },
      {
        type: 'faint',
        turn: 2,
        unitId: 'defender-0',
      },
      {
        type: 'battle_end',
        turn: 2,
        winnerId: 'team-attacker',
        loserId: 'team-defender',
      },
    ]

    const serialized = JSON.stringify(log)
    const restored = JSON.parse(serialized) as BattleEvent[]
    expect(restored).toEqual(log)
  })

  it('BattleResult fixture round-trips through JSON', () => {
    const result: BattleResult = {
      config: {
        seed: 42,
        arenaId: 'rock-tunnel',
        attackerTeamId: 'team-a',
        defenderTeamId: 'team-b',
      },
      events: [
        { type: 'battle_end', turn: 5, winnerId: 'team-a', loserId: 'team-b' },
      ],
      winnerId: 'team-a',
      totalTurns: 5,
    }

    const serialized = JSON.stringify(result)
    const restored = JSON.parse(serialized) as BattleResult
    expect(restored).toEqual(result)
  })

  it('type discriminant narrows correctly', () => {
    const events: BattleEvent[] = [
      { type: 'damage', turn: 1, targetId: 'x', amount: 10, effectiveness: 1, critical: false },
      { type: 'faint', turn: 1, unitId: 'x' },
    ]

    for (const evt of events) {
      if (evt.type === 'damage') {
        expect(evt.amount).toBe(10)
      } else if (evt.type === 'faint') {
        expect(evt.unitId).toBe('x')
      }
    }
  })
})
