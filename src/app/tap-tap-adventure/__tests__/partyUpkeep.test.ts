import { processPartyUpkeep } from '@/app/tap-tap-adventure/lib/partyUpkeep'
import { PartyMember } from '@/app/tap-tap-adventure/models/partyMember'

function makePartyMember(overrides: Partial<PartyMember>): PartyMember {
  return {
    id: 'member-1',
    name: 'Test Member',
    description: 'A test party member',
    icon: '⚔️',
    className: 'Warrior',
    level: 1,
    hp: 50,
    maxHp: 50,
    stats: { strength: 5, intelligence: 3, luck: 2, charisma: 3 },
    equipment: { weapon: null, armor: null, accessory: null },
    dailyCost: 10,
    recruitCost: 100,
    rarity: 'common',
    relationship: 0,
    role: 'combatant',
    ...overrides,
  }
}

describe('processPartyUpkeep', () => {
  it('deducts daily cost for each party member at day boundary', () => {
    const party = [
      makePartyMember({ id: 'a', name: 'Alice', dailyCost: 10 }),
      makePartyMember({ id: 'b', name: 'Bob', dailyCost: 5 }),
    ]
    const { remainingParty, newGold, dismissed } = processPartyUpkeep(party, 50, 0)

    expect(newGold).toBe(35) // 50 - 10 - 5
    expect(remainingParty).toHaveLength(2)
    expect(dismissed).toHaveLength(0)
  })

  it('quest-reward companion with dailyCost=0 incurs no cost', () => {
    const party = [
      makePartyMember({ id: 'quest', name: 'Quest Companion', dailyCost: 0 }),
    ]
    const { remainingParty, newGold, dismissed } = processPartyUpkeep(party, 100, 0)

    expect(newGold).toBe(100)
    expect(remainingParty).toHaveLength(1)
    expect(dismissed).toHaveLength(0)
  })

  it('dismisses most expensive member first when gold is insufficient', () => {
    const party = [
      makePartyMember({ id: 'cheap', name: 'Cheap', dailyCost: 5 }),
      makePartyMember({ id: 'expensive', name: 'Expensive', dailyCost: 20 }),
    ]
    // Only 10 gold — can't afford the 20-cost member; should dismiss Expensive and keep Cheap
    const { remainingParty, newGold, dismissed } = processPartyUpkeep(party, 10, 0)

    expect(dismissed).toContain('Expensive')
    expect(remainingParty.map(m => m.name)).toContain('Cheap')
    expect(newGold).toBe(5) // 10 - 5
  })

  it('gold never goes negative after upkeep', () => {
    const party = [
      makePartyMember({ id: 'a', name: 'Alice', dailyCost: 50 }),
      makePartyMember({ id: 'b', name: 'Bob', dailyCost: 30 }),
    ]
    // Only 5 gold — can't afford either
    const { newGold, dismissed } = processPartyUpkeep(party, 5, 0)

    expect(newGold).toBeGreaterThanOrEqual(0)
    expect(dismissed).toHaveLength(2)
  })

  it('barracks discount reduces party upkeep correctly', () => {
    const party = [
      makePartyMember({ id: 'a', name: 'Alice', dailyCost: 20 }),
    ]
    // 15% discount (1 level barracks): cost = floor(20 * (1 - 0.15)) = floor(17) = 17
    const { newGold, remainingParty } = processPartyUpkeep(party, 100, 15)

    expect(newGold).toBe(83) // 100 - 17
    expect(remainingParty).toHaveLength(1)
  })

  it('applies 45% discount with 3 levels of barracks', () => {
    const party = [
      makePartyMember({ id: 'a', name: 'Alice', dailyCost: 20 }),
    ]
    // 45% discount: cost = floor(20 * (1 - 0.45)) = floor(11) = 11
    const { newGold, remainingParty } = processPartyUpkeep(party, 100, 45)

    expect(newGold).toBe(89) // 100 - 11
    expect(remainingParty).toHaveLength(1)
  })

  it('handles empty party without error', () => {
    const { remainingParty, newGold, dismissed } = processPartyUpkeep([], 100, 0)

    expect(remainingParty).toHaveLength(0)
    expect(newGold).toBe(100)
    expect(dismissed).toHaveLength(0)
  })

  it('retains zero-cost companions even when gold is zero', () => {
    const party = [
      makePartyMember({ id: 'quest', name: 'Quest NPC', dailyCost: 0 }),
      makePartyMember({ id: 'paid', name: 'Hired', dailyCost: 10 }),
    ]
    const { remainingParty, dismissed } = processPartyUpkeep(party, 0, 0)

    expect(dismissed).toContain('Hired')
    expect(remainingParty.map(m => m.name)).toContain('Quest NPC')
  })
})
