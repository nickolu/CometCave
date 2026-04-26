import { describe, expect, it } from 'vitest'

import { applyPartyMemberAttacks } from '@/app/tap-tap-adventure/lib/combatEngine'
import { CombatEnemy, PartyMemberCombatState } from '@/app/tap-tap-adventure/models/combat'

const baseEnemy: CombatEnemy = {
  id: 'enemy-1',
  name: 'Goblin',
  description: 'A nasty goblin',
  hp: 30,
  maxHp: 30,
  attack: 8,
  defense: 3,
  level: 2,
  goldReward: 15,
}

function makePartyMember(overrides: Partial<PartyMemberCombatState> = {}): PartyMemberCombatState {
  return {
    memberId: 'member-1',
    name: 'Rowan',
    icon: '⚔️',
    hp: 20,
    maxHp: 20,
    attack: 8,
    defense: 3,
    isKnockedOut: false,
    ...overrides,
  }
}

describe('applyPartyMemberAttacks', () => {
  it('deals damage to enemy', () => {
    const member = makePartyMember()
    const result = applyPartyMemberAttacks([member], baseEnemy, 1)
    expect(result.enemy.hp).toBeLessThan(baseEnemy.hp)
    expect(result.logs.length).toBeGreaterThan(0)
    expect(result.logs[0].actor).toBe('party_member')
    expect(result.logs[0].action).toBe('attack')
  })

  it('KO\'d members do not attack', () => {
    const member = makePartyMember({ isKnockedOut: true })
    const result = applyPartyMemberAttacks([member], baseEnemy, 1)
    expect(result.enemy.hp).toBe(baseEnemy.hp)
    expect(result.logs.length).toBe(0)
    expect(result.killedEnemy).toBe(false)
  })

  it('low HP members defend instead of attacking', () => {
    // HP at 20% of max — below the 30% threshold
    const member = makePartyMember({ hp: 4, maxHp: 20 })
    const result = applyPartyMemberAttacks([member], baseEnemy, 1)
    expect(result.enemy.hp).toBe(baseEnemy.hp)
    expect(result.logs.length).toBe(1)
    expect(result.logs[0].action).toBe('defend')
    expect(result.killedEnemy).toBe(false)
  })

  it('enemy can be killed by party member', () => {
    const weakEnemy: CombatEnemy = { ...baseEnemy, hp: 1, defense: 0 }
    const strongMember = makePartyMember({ attack: 50 })
    const result = applyPartyMemberAttacks([strongMember], weakEnemy, 1)
    expect(result.killedEnemy).toBe(true)
    expect(result.enemy.hp).toBe(0)
    const victoryLog = result.logs.find(l => l.action === 'victory')
    expect(victoryLog).toBeDefined()
    expect(victoryLog?.actor).toBe('party_member')
  })

  it('multiple members attack in sequence and stop when enemy is dead', () => {
    const weakEnemy: CombatEnemy = { ...baseEnemy, hp: 1, defense: 0 }
    const members = [
      makePartyMember({ memberId: 'member-1', name: 'Rowan', attack: 50 }),
      makePartyMember({ memberId: 'member-2', name: 'Kael', attack: 50 }),
    ]
    const result = applyPartyMemberAttacks(members, weakEnemy, 1)
    expect(result.killedEnemy).toBe(true)
    // Only one attack log since second member skips after enemy is dead
    const attackLogs = result.logs.filter(l => l.action === 'attack')
    expect(attackLogs.length).toBe(1)
  })

  it('returns updated partyStates unchanged when no attack occurs', () => {
    const member = makePartyMember({ isKnockedOut: true })
    const result = applyPartyMemberAttacks([member], baseEnemy, 1)
    expect(result.partyStates[0].memberId).toBe(member.memberId)
    expect(result.partyStates[0].isKnockedOut).toBe(true)
  })

  it('PartyMemberCombatState initialization from party data maps correctly', () => {
    // Simulate what the start route does
    const partyMember = {
      id: 'pm-1',
      name: 'Lyra',
      customName: 'Lyra the Bold',
      icon: '🧙',
      hp: 15,
      maxHp: 20,
      role: 'combatant',
      stats: { strength: 10, intelligence: 5, luck: 3, charisma: 4 },
    }
    const state: PartyMemberCombatState = {
      memberId: partyMember.id,
      name: partyMember.customName ?? partyMember.name,
      icon: partyMember.icon ?? '⚔️',
      hp: partyMember.hp,
      maxHp: partyMember.maxHp,
      attack: partyMember.stats?.strength ?? 5,
      defense: Math.floor((partyMember.stats?.strength ?? 5) / 2),
      isKnockedOut: false,
    }
    expect(state.memberId).toBe('pm-1')
    expect(state.name).toBe('Lyra the Bold')
    expect(state.icon).toBe('🧙')
    expect(state.attack).toBe(10)
    expect(state.defense).toBe(5)
    expect(state.isKnockedOut).toBe(false)
  })
})
