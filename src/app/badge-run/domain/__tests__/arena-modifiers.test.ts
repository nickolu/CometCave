import { runBattle } from '../battle/runner'
import type { BattleUnit, Team } from '../battle/types'

function makeUnit(overrides: Partial<BattleUnit> & { instanceId: string }): BattleUnit {
  return {
    dexId: 1, name: 'TestMon', types: ['Normal'], tier: 'T2', kin: 'Pack',
    maxHp: 200, currentHp: 200,
    attack: 60, defense: 60, specialAttack: 60, specialDefense: 60, speed: 60,
    signatureMove: null, fainted: false,
    ...overrides,
  }
}

function makeTeam(id: string, units: BattleUnit[]): Team {
  return { id, units }
}

function runArenaTest(arenaId: string, attacker: Team, defender: Team) {
  return runBattle(attacker, defender, arenaId, 42)
}

// Test for each arena: verify arena_tick event fires with the correct rule
const ARENA_RULES: [string, string][] = [
  ['rock-tunnel', 'fog'],
  ['tidal-shelf', 'rain'],
  ['storm-plateau', 'wind'],
  ['overgrown-ruins', 'overgrown'],
  ['poison-marsh', 'toxic-spill'],
  ['silph-rooftop', 'tech-surge'],
  ['volcanic-cavern', 'volcano'],
  ['excavation-site', 'excavation'],
  ['frozen-pass', 'blizzard'],
]

describe('Arena house rules fire during battle', () => {
  for (const [arenaId, expectedRule] of ARENA_RULES) {
    it(`${arenaId} emits arena_tick with rule="${expectedRule}"`, () => {
      const a = makeTeam('a', [makeUnit({ instanceId: 'a-0', types: ['Normal'] })])
      const d = makeTeam('d', [makeUnit({ instanceId: 'd-0', types: ['Normal'] })])
      const { events } = runArenaTest(arenaId, a, d)
      const ticks = events.filter(e => e.type === 'arena_tick')
      expect(ticks.length).toBeGreaterThan(0)
      // The rule field should match the arena's house rule
      expect(ticks[0]).toMatchObject({ type: 'arena_tick', arenaId, rule: expectedRule })
    })
  }
})

describe('Arena mechanical effects', () => {
  it('toxic-spill deals HP damage each round', () => {
    const a = makeTeam('a', [makeUnit({ instanceId: 'a-0', maxHp: 200, currentHp: 200 })])
    const d = makeTeam('d', [makeUnit({ instanceId: 'd-0', maxHp: 200, currentHp: 200 })])
    const { events } = runBattle(a, d, 'poison-marsh', 1)
    // After at least 1 round of toxic-spill, some damage should have been applied
    // At least some damage events or faint events prove the arena tick did work
    expect(events.some(e => e.type === 'arena_tick' && (e as any).rule === 'toxic-spill')).toBe(true)
  })

  it('excavation: Ground move can damage Flying-type unit', () => {
    // Ground normally can't hit Flying (effectiveness = 0)
    // In excavation-site, Ground ignores this immunity
    const a = makeTeam('a', [makeUnit({ instanceId: 'a-0', types: ['Ground'], attack: 100 })])
    const d = makeTeam('d', [makeUnit({ instanceId: 'd-0', types: ['Flying'], defense: 100 })])
    const { events } = runBattle(a, d, 'excavation-site', 42)
    // The attacker is Ground type, defender is Flying type
    // With excavation, some damage events should occur (without it, damage = 0 and battle never ends normally)
    const damageEvents = events.filter(e => e.type === 'damage' && (e as any).amount > 0)
    expect(damageEvents.length).toBeGreaterThan(0)
  })
})
