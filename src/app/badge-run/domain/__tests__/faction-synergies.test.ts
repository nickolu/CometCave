import { describe, it, expect } from 'vitest'
import { applyFactionSynergies } from '../battle/faction-synergies'
import type { BattleUnit } from '../battle/types'

// Team Rocket dexIds: 19, 20, 23, 24 (Rattata, Raticate, Ekans, Arbok)
// Silph Co. dexIds: 63, 64, 65, 81, 82, 137 (Abra, Kadabra, Alakazam, Magnemite, Magneton, Porygon)
// Elite Four dexIds: 79, 80, 87, 90, 91, 93, 94, 106, 107, 124, 130, 131, 148, 149
// Fossils dexIds: 138, 139, 140, 141, 142
// Eeveelutions: 133, 134, 135, 136
// Safari Zone: 29,30,31,32,33,34,46,47,48,49,102,103,...
// Legendary Birds: 144, 145, 146

function makeUnit(id: string, dexId: number): BattleUnit {
  return {
    instanceId: id, dexId, name: id, types: ['Normal'], tier: 'T1', kin: 'Pack',
    maxHp: 100, currentHp: 100, attack: 100, defense: 100,
    specialAttack: 100, specialDefense: 100, speed: 100,
    signatureMove: null, fainted: false,
  }
}

describe('applyFactionSynergies', () => {
  // Team Rocket
  describe('Team Rocket', () => {
    it('at 2 (dexIds 19, 20): attack becomes 105', () => {
      const team = [makeUnit('u0', 19), makeUnit('u1', 20)]
      applyFactionSynergies(team)
      expect(team[0].attack).toBe(105)
      expect(team[1].attack).toBe(105)
    })

    it('at 3 (dexIds 19, 20, 23): attack becomes 110', () => {
      const team = [makeUnit('u0', 19), makeUnit('u1', 20), makeUnit('u2', 23)]
      applyFactionSynergies(team)
      expect(team[0].attack).toBe(110)
      expect(team[1].attack).toBe(110)
      expect(team[2].attack).toBe(110)
    })

    it('at 4 (dexIds 19, 20, 23, 24): attack becomes 115', () => {
      const team = [makeUnit('u0', 19), makeUnit('u1', 20), makeUnit('u2', 23), makeUnit('u3', 24)]
      applyFactionSynergies(team)
      expect(team[0].attack).toBe(115)
    })
  })

  // Silph Co.
  describe('Silph Co.', () => {
    it('at 2: specialAttack becomes 110', () => {
      const team = [makeUnit('u0', 63), makeUnit('u1', 64)]
      applyFactionSynergies(team)
      expect(team[0].specialAttack).toBe(110)
      expect(team[1].specialAttack).toBe(110)
    })

    it('at 3: specialAttack becomes 120', () => {
      const team = [makeUnit('u0', 63), makeUnit('u1', 64), makeUnit('u2', 65)]
      applyFactionSynergies(team)
      expect(team[0].specialAttack).toBe(120)
    })

    it('at 4: specialAttack becomes 130', () => {
      const team = [makeUnit('u0', 63), makeUnit('u1', 64), makeUnit('u2', 65), makeUnit('u3', 81)]
      applyFactionSynergies(team)
      expect(team[0].specialAttack).toBe(130)
    })
  })

  // Elite Four
  describe('Elite Four', () => {
    it('at 2: attack 110, specialAttack 110', () => {
      const team = [makeUnit('u0', 79), makeUnit('u1', 80)]
      applyFactionSynergies(team)
      expect(team[0].attack).toBe(110)
      expect(team[0].specialAttack).toBe(110)
    })

    it('at 3: attack 115, specialAttack 115', () => {
      const team = [makeUnit('u0', 79), makeUnit('u1', 80), makeUnit('u2', 87)]
      applyFactionSynergies(team)
      expect(team[0].attack).toBe(115)
      expect(team[0].specialAttack).toBe(115)
    })

    it('at 4: attack 120, specialAttack 120', () => {
      const team = [makeUnit('u0', 79), makeUnit('u1', 80), makeUnit('u2', 87), makeUnit('u3', 90)]
      applyFactionSynergies(team)
      expect(team[0].attack).toBe(120)
      expect(team[0].specialAttack).toBe(120)
    })
  })

  // Fossils
  describe('Fossils', () => {
    it('at 2: defense becomes 115', () => {
      const team = [makeUnit('u0', 138), makeUnit('u1', 139)]
      applyFactionSynergies(team)
      expect(team[0].defense).toBe(115)
      expect(team[0].specialDefense).toBe(100)
    })

    it('at 3: defense becomes 125, specialDefense becomes 110', () => {
      const team = [makeUnit('u0', 138), makeUnit('u1', 139), makeUnit('u2', 140)]
      applyFactionSynergies(team)
      expect(team[0].defense).toBe(125)
      expect(team[0].specialDefense).toBe(110)
    })

    it('at 4: defense becomes 130, specialDefense becomes 120', () => {
      const team = [makeUnit('u0', 138), makeUnit('u1', 139), makeUnit('u2', 140), makeUnit('u3', 141)]
      applyFactionSynergies(team)
      expect(team[0].defense).toBe(130)
      expect(team[0].specialDefense).toBe(120)
    })
  })

  // Eeveelutions
  describe('Eeveelutions', () => {
    it('at 2: speed becomes 110, attack becomes 105', () => {
      const team = [makeUnit('u0', 133), makeUnit('u1', 134)]
      applyFactionSynergies(team)
      expect(team[0].speed).toBe(110)
      expect(team[0].attack).toBe(105)
    })

    it('at 3: speed becomes 115, attack becomes 110', () => {
      const team = [makeUnit('u0', 133), makeUnit('u1', 134), makeUnit('u2', 135)]
      applyFactionSynergies(team)
      expect(team[0].speed).toBe(115)
      expect(team[0].attack).toBe(110)
    })

    it('at 4: speed becomes 120, attack becomes 115, specialAttack becomes 110', () => {
      const team = [makeUnit('u0', 133), makeUnit('u1', 134), makeUnit('u2', 135), makeUnit('u3', 136)]
      applyFactionSynergies(team)
      expect(team[0].speed).toBe(120)
      expect(team[0].attack).toBe(115)
      expect(team[0].specialAttack).toBe(110)
    })
  })

  // Safari Zone
  describe('Safari Zone', () => {
    it('at 2: maxHp becomes 110, currentHp becomes 110', () => {
      const team = [makeUnit('u0', 29), makeUnit('u1', 30)]
      applyFactionSynergies(team)
      expect(team[0].maxHp).toBe(110)
      expect(team[0].currentHp).toBe(110)
    })

    it('at 3: maxHp becomes 115, defense becomes 105', () => {
      const team = [makeUnit('u0', 29), makeUnit('u1', 30), makeUnit('u2', 31)]
      applyFactionSynergies(team)
      expect(team[0].maxHp).toBe(115)
      expect(team[0].currentHp).toBe(115)
      expect(team[0].defense).toBe(105)
    })

    it('at 4: maxHp becomes 120, defense becomes 110', () => {
      const team = [makeUnit('u0', 29), makeUnit('u1', 30), makeUnit('u2', 31), makeUnit('u3', 32)]
      applyFactionSynergies(team)
      expect(team[0].maxHp).toBe(120)
      expect(team[0].currentHp).toBe(120)
      expect(team[0].defense).toBe(110)
    })
  })

  // Legendary Birds
  describe('Legendary Birds', () => {
    it('at 2 (dexIds 144, 145): speed becomes 120, specialAttack becomes 115', () => {
      const team = [makeUnit('u0', 144), makeUnit('u1', 145)]
      applyFactionSynergies(team)
      expect(team[0].speed).toBe(120)
      expect(team[0].specialAttack).toBe(115)
    })

    it('with all 3 members (144, 145, 146): STILL speed 120, specialAttack 115 (capped at 2)', () => {
      const team = [makeUnit('u0', 144), makeUnit('u1', 145), makeUnit('u2', 146)]
      applyFactionSynergies(team)
      expect(team[0].speed).toBe(120)
      expect(team[0].specialAttack).toBe(115)
      expect(team[1].speed).toBe(120)
      expect(team[1].specialAttack).toBe(115)
      expect(team[2].speed).toBe(120)
      expect(team[2].specialAttack).toBe(115)
    })
  })

  // Edge cases
  describe('edge cases', () => {
    it('1 unit of any faction: no boost applied', () => {
      const team = [makeUnit('u0', 19)] // Team Rocket
      applyFactionSynergies(team)
      expect(team[0].attack).toBe(100)
      expect(team[0].defense).toBe(100)
      expect(team[0].specialAttack).toBe(100)
    })

    it('units with dexId not in any faction: not affected', () => {
      // dexId 1 (Bulbasaur) is not in any faction
      const team = [makeUnit('u0', 1), makeUnit('u1', 2), makeUnit('u2', 3)]
      applyFactionSynergies(team)
      expect(team[0].attack).toBe(100)
      expect(team[0].defense).toBe(100)
      expect(team[0].specialAttack).toBe(100)
      expect(team[0].speed).toBe(100)
      expect(team[0].maxHp).toBe(100)
    })

    it('returns correct synergyId', () => {
      const team = [makeUnit('u0', 19), makeUnit('u1', 20)]
      const result = applyFactionSynergies(team)
      expect(result).toHaveLength(1)
      expect(result[0].synergyId).toBe('faction:Team Rocket:2')
    })

    it('returns affectedUnitIds for all units in the faction group', () => {
      const team = [makeUnit('u0', 63), makeUnit('u1', 64)]
      const result = applyFactionSynergies(team)
      expect(result[0].affectedUnitIds).toEqual(['u0', 'u1'])
    })

    it('handles multiple factions independently', () => {
      const rocketUnits = [makeUnit('r0', 19), makeUnit('r1', 20)]
      const silphUnits = [makeUnit('s0', 63), makeUnit('s1', 64)]
      const mixed = [...rocketUnits, ...silphUnits]
      const result = applyFactionSynergies(mixed)
      expect(result).toHaveLength(2)
      expect(rocketUnits[0].attack).toBe(105)
      expect(silphUnits[0].specialAttack).toBe(110)
    })
  })
})
