import { describe, it, expect } from 'vitest'
import { applyKinSynergies } from '../battle/kin-synergies'
import type { BattleUnit } from '../battle/types'

function makeUnit(id: string, kin: BattleUnit['kin']): BattleUnit {
  return {
    instanceId: id, dexId: 1, name: id, types: ['Normal'], tier: 'T1', kin,
    maxHp: 100, currentHp: 100, attack: 100, defense: 100,
    specialAttack: 100, specialDefense: 100, speed: 100,
    signatureMove: null, fainted: false,
  }
}

function makeTeam(kin: BattleUnit['kin'], count: number): BattleUnit[] {
  return Array.from({ length: count }, (_, i) => makeUnit(`u${i}`, kin))
}

describe('applyKinSynergies', () => {
  // Pack
  describe('Pack', () => {
    it('at 2: attack becomes 110', () => {
      const team = makeTeam('Pack', 2)
      applyKinSynergies(team)
      expect(team[0].attack).toBe(110)
      expect(team[1].attack).toBe(110)
    })

    it('at 4: attack becomes 120', () => {
      const team = makeTeam('Pack', 4)
      applyKinSynergies(team)
      expect(team[0].attack).toBe(120)
    })

    it('at 6: attack becomes 130, defense becomes 110', () => {
      const team = makeTeam('Pack', 6)
      applyKinSynergies(team)
      expect(team[0].attack).toBe(130)
      expect(team[0].defense).toBe(110)
    })
  })

  // Flock
  describe('Flock', () => {
    it('at 2: speed becomes 110', () => {
      const team = makeTeam('Flock', 2)
      applyKinSynergies(team)
      expect(team[0].speed).toBe(110)
    })

    it('at 4: speed becomes 120', () => {
      const team = makeTeam('Flock', 4)
      applyKinSynergies(team)
      expect(team[0].speed).toBe(120)
    })

    it('at 6: speed becomes 130', () => {
      const team = makeTeam('Flock', 6)
      applyKinSynergies(team)
      expect(team[0].speed).toBe(130)
    })
  })

  // Brood
  describe('Brood', () => {
    it('at 2: maxHp becomes 110, currentHp becomes 110', () => {
      const team = makeTeam('Brood', 2)
      applyKinSynergies(team)
      expect(team[0].maxHp).toBe(110)
      expect(team[0].currentHp).toBe(110)
    })

    it('at 4: maxHp becomes 120, currentHp becomes 120', () => {
      const team = makeTeam('Brood', 4)
      applyKinSynergies(team)
      expect(team[0].maxHp).toBe(120)
      expect(team[0].currentHp).toBe(120)
    })

    it('at 6: maxHp becomes 130, currentHp becomes 130', () => {
      const team = makeTeam('Brood', 6)
      applyKinSynergies(team)
      expect(team[0].maxHp).toBe(130)
      expect(team[0].currentHp).toBe(130)
    })
  })

  // Shell
  describe('Shell', () => {
    it('at 2: defense becomes 110', () => {
      const team = makeTeam('Shell', 2)
      applyKinSynergies(team)
      expect(team[0].defense).toBe(110)
      expect(team[0].specialDefense).toBe(100)
    })

    it('at 4: defense becomes 115, specialDefense becomes 110', () => {
      const team = makeTeam('Shell', 4)
      applyKinSynergies(team)
      expect(team[0].defense).toBe(115)
      expect(team[0].specialDefense).toBe(110)
    })

    it('at 6: defense becomes 120, specialDefense becomes 120', () => {
      const team = makeTeam('Shell', 6)
      applyKinSynergies(team)
      expect(team[0].defense).toBe(120)
      expect(team[0].specialDefense).toBe(120)
    })
  })

  // Mineral
  describe('Mineral', () => {
    it('at 2: defense becomes 115', () => {
      const team = makeTeam('Mineral', 2)
      applyKinSynergies(team)
      expect(team[0].defense).toBe(115)
    })

    it('at 4: defense becomes 125', () => {
      const team = makeTeam('Mineral', 4)
      applyKinSynergies(team)
      expect(team[0].defense).toBe(125)
    })

    it('at 6: defense becomes 130, specialDefense becomes 115', () => {
      const team = makeTeam('Mineral', 6)
      applyKinSynergies(team)
      expect(team[0].defense).toBe(130)
      expect(team[0].specialDefense).toBe(115)
    })
  })

  // Serpent
  describe('Serpent', () => {
    it('at 2: attack becomes 110, specialAttack becomes 110', () => {
      const team = makeTeam('Serpent', 2)
      applyKinSynergies(team)
      expect(team[0].attack).toBe(110)
      expect(team[0].specialAttack).toBe(110)
    })

    it('at 4: attack becomes 120, specialAttack becomes 120', () => {
      const team = makeTeam('Serpent', 4)
      applyKinSynergies(team)
      expect(team[0].attack).toBe(120)
      expect(team[0].specialAttack).toBe(120)
    })

    it('at 6: attack becomes 130, specialAttack becomes 130', () => {
      const team = makeTeam('Serpent', 6)
      applyKinSynergies(team)
      expect(team[0].attack).toBe(130)
      expect(team[0].specialAttack).toBe(130)
    })
  })

  // Humanoid
  describe('Humanoid', () => {
    it('at 2: attack becomes 110', () => {
      const team = makeTeam('Humanoid', 2)
      applyKinSynergies(team)
      expect(team[0].attack).toBe(110)
    })

    it('at 4: attack becomes 125', () => {
      const team = makeTeam('Humanoid', 4)
      applyKinSynergies(team)
      expect(team[0].attack).toBe(125)
    })

    it('at 6: attack becomes 140', () => {
      const team = makeTeam('Humanoid', 6)
      applyKinSynergies(team)
      expect(team[0].attack).toBe(140)
    })
  })

  // Amorphous
  describe('Amorphous', () => {
    it('at 2: specialAttack becomes 110', () => {
      const team = makeTeam('Amorphous', 2)
      applyKinSynergies(team)
      expect(team[0].specialAttack).toBe(110)
    })

    it('at 4: specialAttack becomes 120', () => {
      const team = makeTeam('Amorphous', 4)
      applyKinSynergies(team)
      expect(team[0].specialAttack).toBe(120)
    })

    it('at 6: specialAttack becomes 130, specialDefense becomes 110', () => {
      const team = makeTeam('Amorphous', 6)
      applyKinSynergies(team)
      expect(team[0].specialAttack).toBe(130)
      expect(team[0].specialDefense).toBe(110)
    })
  })

  // Edge cases
  describe('edge cases', () => {
    it('1 unit of a kin: no boost applied', () => {
      const team = makeTeam('Pack', 1)
      applyKinSynergies(team)
      expect(team[0].attack).toBe(100)
      expect(team[0].defense).toBe(100)
    })

    it('3 units: level 2 boost applies (×2 threshold)', () => {
      const team = makeTeam('Pack', 3)
      applyKinSynergies(team)
      // 3 units triggers the 2-unit threshold (level 0 = ×1.10)
      expect(team[0].attack).toBe(110)
    })

    it('returns correct synergyId for Pack at 2', () => {
      const team = makeTeam('Pack', 2)
      const result = applyKinSynergies(team)
      expect(result).toHaveLength(1)
      expect(result[0].synergyId).toBe('kin:Pack:2')
    })

    it('returns correct synergyId for Flock at 4', () => {
      const team = makeTeam('Flock', 4)
      const result = applyKinSynergies(team)
      expect(result[0].synergyId).toBe('kin:Flock:4')
    })

    it('returns correct synergyId for Brood at 6', () => {
      const team = makeTeam('Brood', 6)
      const result = applyKinSynergies(team)
      expect(result[0].synergyId).toBe('kin:Brood:6')
    })

    it('returns affectedUnitIds for all units in the kin group', () => {
      const team = makeTeam('Shell', 4)
      const result = applyKinSynergies(team)
      expect(result[0].affectedUnitIds).toEqual(['u0', 'u1', 'u2', 'u3'])
    })

    it('handles multiple kin groups independently', () => {
      const packUnits = makeTeam('Pack', 2)
      const flockUnits = makeTeam('Flock', 4)
      const mixed = [...packUnits, ...flockUnits]
      const result = applyKinSynergies(mixed)
      expect(result).toHaveLength(2)
      // Pack at 2: attack boosted
      expect(packUnits[0].attack).toBe(110)
      // Flock at 4: speed boosted
      expect(flockUnits[0].speed).toBe(120)
    })
  })
})
