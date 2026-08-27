import { buildTurnQueue } from '../battle/turn-queue'
import { makePRNG } from '../rng'
import type { BattleUnit } from '../battle/types'

function makeUnit(overrides: Partial<BattleUnit> & { instanceId: string; speed: number }): BattleUnit {
  return {
    dexId: 1,
    name: 'TestMon',
    types: ['Normal'],
    tier: 'T1',
    kin: 'Pack',
    maxHp: 100,
    currentHp: 100,
    attack: 50,
    defense: 50,
    specialAttack: 50,
    specialDefense: 50,
    signatureMove: null,
    fainted: false,
    ...overrides,
  }
}

describe('buildTurnQueue', () => {
  it('orders units by speed descending', () => {
    const attacker = [makeUnit({ instanceId: 'a-0', speed: 40 })]
    const defender = [makeUnit({ instanceId: 'd-0', speed: 80 })]
    const rng = makePRNG(1)
    const queue = buildTurnQueue(attacker, defender, rng)
    expect(queue[0].unit.instanceId).toBe('d-0')
    expect(queue[1].unit.instanceId).toBe('a-0')
  })

  it('tie-breaks deterministically with the same seed', () => {
    const attacker = [makeUnit({ instanceId: 'a-0', speed: 50 })]
    const defender = [makeUnit({ instanceId: 'd-0', speed: 50 })]
    const queue1 = buildTurnQueue(attacker, defender, makePRNG(42))
    const queue2 = buildTurnQueue(attacker, defender, makePRNG(42))
    expect(queue1.map(e => e.unit.instanceId)).toEqual(queue2.map(e => e.unit.instanceId))
  })

  it('different seeds can produce different tie-break order', () => {
    const attacker = [makeUnit({ instanceId: 'a-0', speed: 50 })]
    const defender = [makeUnit({ instanceId: 'd-0', speed: 50 })]
    const results = new Set<string>()
    // Try a handful of seeds — at least two should differ
    for (let seed = 0; seed < 20; seed++) {
      const queue = buildTurnQueue(attacker, defender, makePRNG(seed))
      results.add(queue[0].unit.instanceId)
    }
    expect(results.size).toBeGreaterThan(1)
  })

  it('fainted units are excluded from the queue', () => {
    const attacker = [
      makeUnit({ instanceId: 'a-0', speed: 80 }),
      makeUnit({ instanceId: 'a-1', speed: 60, fainted: true }),
    ]
    const defender = [makeUnit({ instanceId: 'd-0', speed: 70 })]
    const rng = makePRNG(1)
    const queue = buildTurnQueue(attacker, defender, rng)
    expect(queue).toHaveLength(2)
    expect(queue.map(e => e.unit.instanceId)).not.toContain('a-1')
  })

  it('labels entries with correct teamId', () => {
    const attacker = [makeUnit({ instanceId: 'a-0', speed: 50 })]
    const defender = [makeUnit({ instanceId: 'd-0', speed: 50 })]
    const rng = makePRNG(1)
    const queue = buildTurnQueue(attacker, defender, rng)
    const aEntry = queue.find(e => e.unit.instanceId === 'a-0')
    const dEntry = queue.find(e => e.unit.instanceId === 'd-0')
    expect(aEntry?.teamId).toBe('attacker')
    expect(dEntry?.teamId).toBe('defender')
  })
})
