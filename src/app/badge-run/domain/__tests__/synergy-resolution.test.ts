import { describe, it, expect } from 'vitest'
import { runBattle } from '../battle/runner'
import type { Team } from '../battle/types'

// Helper to build a minimal BattleUnit
function makeUnit(instanceId: string, dexId: number, kin: string): any {
  return {
    instanceId, dexId, name: instanceId, types: ['Normal'], tier: 'T1', kin,
    maxHp: 100, currentHp: 100, attack: 100, defense: 100,
    specialAttack: 100, specialDefense: 100, speed: 100,
    signatureMove: null, fainted: false,
  }
}

function makeTeam(id: string, units: ReturnType<typeof makeUnit>[]): Team {
  return { id, units }
}

describe('synergy resolution in runBattle', () => {
  it('kin synergy fires: 2 Pack units produce a synergy_applied event with synergyId kin:Pack:2', () => {
    const attackerTeam = makeTeam('team-a', [
      makeUnit('a-0', 1, 'Pack'),
      makeUnit('a-1', 2, 'Pack'),
    ])
    const defenderTeam = makeTeam('team-d', [
      makeUnit('d-0', 3, 'Flock'),
      makeUnit('d-1', 4, 'Flock'),
    ])

    const { events } = runBattle(attackerTeam, defenderTeam, 'rock-tunnel', 1)

    const synergyEvents = events.filter(e => e.type === 'synergy_applied')
    const packSynergy = synergyEvents.find(
      e => e.type === 'synergy_applied' && e.synergyId === 'kin:Pack:2'
    )
    expect(packSynergy).toBeDefined()
  })

  it('faction synergy fires: 2 Team Rocket units (dexIds 19, 20) produce a synergy_applied event with synergyId faction:Team Rocket:2', () => {
    const attackerTeam = makeTeam('team-a', [
      makeUnit('a-0', 19, 'Pack'),
      makeUnit('a-1', 20, 'Pack'),
    ])
    const defenderTeam = makeTeam('team-d', [
      makeUnit('d-0', 3, 'Brood'),
      makeUnit('d-1', 4, 'Brood'),
    ])

    const { events } = runBattle(attackerTeam, defenderTeam, 'rock-tunnel', 2)

    const synergyEvents = events.filter(e => e.type === 'synergy_applied')
    const rocketSynergy = synergyEvents.find(
      e => e.type === 'synergy_applied' && e.synergyId === 'faction:Team Rocket:2'
    )
    expect(rocketSynergy).toBeDefined()
  })

  it('synergy events are at turn 0', () => {
    const attackerTeam = makeTeam('team-a', [
      makeUnit('a-0', 1, 'Pack'),
      makeUnit('a-1', 2, 'Pack'),
    ])
    const defenderTeam = makeTeam('team-d', [
      makeUnit('d-0', 3, 'Flock'),
      makeUnit('d-1', 4, 'Flock'),
    ])

    const { events } = runBattle(attackerTeam, defenderTeam, 'rock-tunnel', 3)

    const synergyEvents = events.filter(e => e.type === 'synergy_applied')
    expect(synergyEvents.length).toBeGreaterThan(0)
    for (const ev of synergyEvents) {
      expect(ev.turn).toBe(0)
    }
  })

  it('no synergy for lone units: all different kins produce no synergy_applied events', () => {
    const attackerTeam = makeTeam('team-a', [
      makeUnit('a-0', 1, 'Pack'),
      makeUnit('a-1', 2, 'Flock'),
      makeUnit('a-2', 3, 'Brood'),
    ])
    const defenderTeam = makeTeam('team-d', [
      makeUnit('d-0', 4, 'Shell'),
      makeUnit('d-1', 5, 'Mineral'),
      makeUnit('d-2', 6, 'Serpent'),
    ])

    const { events } = runBattle(attackerTeam, defenderTeam, 'rock-tunnel', 4)

    const synergyEvents = events.filter(e => e.type === 'synergy_applied')
    expect(synergyEvents).toHaveLength(0)
  })

  it('both teams get synergy resolution: events from both attacker and defender appear', () => {
    const attackerTeam = makeTeam('team-a', [
      makeUnit('a-0', 1, 'Pack'),
      makeUnit('a-1', 2, 'Pack'),
    ])
    const defenderTeam = makeTeam('team-d', [
      makeUnit('d-0', 3, 'Flock'),
      makeUnit('d-1', 4, 'Flock'),
    ])

    const { events } = runBattle(attackerTeam, defenderTeam, 'rock-tunnel', 5)

    const synergyEvents = events.filter(e => e.type === 'synergy_applied')
    // Attacker Pack synergy
    const packSynergy = synergyEvents.find(
      e => e.type === 'synergy_applied' && e.synergyId === 'kin:Pack:2'
    )
    // Defender Flock synergy
    const flockSynergy = synergyEvents.find(
      e => e.type === 'synergy_applied' && e.synergyId === 'kin:Flock:2'
    )
    expect(packSynergy).toBeDefined()
    expect(flockSynergy).toBeDefined()
  })
})
