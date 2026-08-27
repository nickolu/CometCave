import { computeDamage, type MoveData } from '../battle/damage'
import type { BattleUnit } from '../battle/types'

function makeUnit(overrides: {
  instanceId: string
  types: string[]
  attack?: number
  defense?: number
  specialAttack?: number
  specialDefense?: number
}): BattleUnit {
  return {
    dexId: 1,
    name: 'TestMon',
    tier: 'T1',
    kin: 'Pack',
    maxHp: 100,
    currentHp: 100,
    attack: overrides.attack ?? 80,
    defense: overrides.defense ?? 80,
    specialAttack: overrides.specialAttack ?? 80,
    specialDefense: overrides.specialDefense ?? 80,
    speed: 80,
    signatureMove: null,
    fainted: false,
    ...overrides,
  }
}

const CASES: Array<{
  label: string
  attacker: BattleUnit
  defender: BattleUnit
  move: MoveData
  expectedMin: number
  expectedMax: number
}> = [
  {
    label: 'neutral physical move, no STAB',
    attacker: makeUnit({ instanceId: 'a', types: ['Water'], attack: 80 }),
    defender: makeUnit({ instanceId: 'd', types: ['Normal'], defense: 80 }),
    move: { name: 'Tackle', type: 'Normal', category: 'physical', power: 40 },
    expectedMin: 40,
    expectedMax: 40,
  },
  {
    label: 'physical move with STAB (1.5x)',
    attacker: makeUnit({ instanceId: 'a', types: ['Fire'], attack: 80 }),
    defender: makeUnit({ instanceId: 'd', types: ['Normal'], defense: 80 }),
    move: { name: 'Ember', type: 'Fire', category: 'physical', power: 40 },
    expectedMin: 60,
    expectedMax: 60,
  },
  {
    label: 'super effective (2x)',
    attacker: makeUnit({ instanceId: 'a', types: ['Normal'], attack: 80 }),
    defender: makeUnit({ instanceId: 'd', types: ['Fire'], defense: 80 }),
    move: { name: 'Water Gun', type: 'Water', category: 'physical', power: 40 },
    expectedMin: 80,
    expectedMax: 80,
  },
  {
    label: 'STAB + super effective (3x total)',
    attacker: makeUnit({ instanceId: 'a', types: ['Water'], attack: 80 }),
    defender: makeUnit({ instanceId: 'd', types: ['Fire'], defense: 80 }),
    move: { name: 'Surf', type: 'Water', category: 'physical', power: 90 },
    expectedMin: 270,
    expectedMax: 270,
  },
  {
    label: 'immune (0 damage)',
    attacker: makeUnit({ instanceId: 'a', types: ['Normal'], attack: 80 }),
    defender: makeUnit({ instanceId: 'd', types: ['Ghost'], defense: 80 }),
    move: { name: 'Tackle', type: 'Normal', category: 'physical', power: 40 },
    expectedMin: 0,
    expectedMax: 0,
  },
  {
    label: 'special move uses SpAtk/SpDef',
    attacker: makeUnit({ instanceId: 'a', types: ['Fire'], specialAttack: 120, attack: 40 }),
    defender: makeUnit({ instanceId: 'd', types: ['Normal'], specialDefense: 60, defense: 40 }),
    move: { name: 'Flamethrower', type: 'Fire', category: 'special', power: 90 },
    // 90 * (120/60) * 1 * 1.5 = 270
    expectedMin: 270,
    expectedMax: 270,
  },
  {
    label: 'minimum damage is 1 for non-zero effectiveness',
    attacker: makeUnit({ instanceId: 'a', types: ['Normal'], attack: 1 }),
    defender: makeUnit({ instanceId: 'd', types: ['Normal'], defense: 10000 }),
    move: { name: 'Tackle', type: 'Normal', category: 'physical', power: 1 },
    expectedMin: 1,
    expectedMax: 1,
  },
]

describe('computeDamage', () => {
  for (const tc of CASES) {
    it(tc.label, () => {
      const dmg = computeDamage(tc.attacker, tc.defender, tc.move)
      expect(dmg).toBeGreaterThanOrEqual(tc.expectedMin)
      expect(dmg).toBeLessThanOrEqual(tc.expectedMax)
    })
  }
})
