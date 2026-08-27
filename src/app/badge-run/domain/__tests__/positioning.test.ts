import { describe, it, expect } from 'vitest'
import { getTargets } from '../battle/positioning'
import type { BattleUnit } from '../battle/types'

function makeUnit(id: string, fainted = false): BattleUnit {
  return {
    instanceId: id, dexId: 1, name: id, types: ['Normal'], tier: 'T1', kin: 'Amorphous',
    maxHp: 100, currentHp: fainted ? 0 : 100, attack: 50, defense: 50,
    specialAttack: 50, specialDefense: 50, speed: 50, signatureMove: null, fainted,
  }
}

const physicalMove = { name: 'Tackle', type: 'Normal' as const, category: 'physical' as const, power: 40 }
const specialMove = { name: 'Swift', type: 'Normal' as const, category: 'special' as const, power: 40 }

describe('getTargets', () => {
  it('physical targets front row when front row alive', () => {
    const units = [makeUnit('front1'), makeUnit('front2'), makeUnit('front3'), makeUnit('back1')]
    const targets = getTargets(units, physicalMove, [])
    expect(targets.map(u => u.instanceId)).toEqual(['front1', 'front2', 'front3'])
  })

  it('physical falls through to back row when front row all fainted', () => {
    const units = [makeUnit('front1', true), makeUnit('front2', true), makeUnit('front3', true), makeUnit('back1'), makeUnit('back2')]
    const targets = getTargets(units, physicalMove, [])
    expect(targets.map(u => u.instanceId)).toEqual(['back1', 'back2'])
  })

  it('special move can target any alive unit including back row', () => {
    const units = [makeUnit('front1'), makeUnit('front2'), makeUnit('front3'), makeUnit('back1')]
    const targets = getTargets(units, specialMove, [])
    expect(targets.map(u => u.instanceId)).toEqual(['front1', 'front2', 'front3', 'back1'])
  })

  it('excavation site: physical reaches back row too', () => {
    const units = [makeUnit('front1'), makeUnit('front2'), makeUnit('front3'), makeUnit('back1')]
    const targets = getTargets(units, physicalMove, ['excavation'])
    expect(targets.map(u => u.instanceId)).toEqual(['front1', 'front2', 'front3', 'back1'])
  })

  it('excludes fainted units from results', () => {
    const units = [makeUnit('front1', true), makeUnit('front2'), makeUnit('front3'), makeUnit('back1')]
    const targets = getTargets(units, physicalMove, [])
    expect(targets.map(u => u.instanceId)).toEqual(['front2', 'front3'])
  })
})
