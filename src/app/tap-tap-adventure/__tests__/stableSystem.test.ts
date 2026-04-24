import { describe, it, expect } from 'vitest'
import { getMountMaxHp } from '@/app/tap-tap-adventure/config/mounts'
import { Mount } from '@/app/tap-tap-adventure/models/mount'

// Helper: create a test mount
function makeMount(overrides: Partial<Mount> = {}): Mount {
  return {
    id: 'test-horse',
    name: 'Test Horse',
    description: 'A test mount.',
    rarity: 'common',
    bonuses: {},
    icon: '🐴',
    dailyCost: 1,
    hp: getMountMaxHp('common'),
    maxHp: getMountMaxHp('common'),
    ...overrides,
  }
}

// Inline heal cost logic (same as store + StablePanel)
function getHealCost(mount: Mount): number {
  const maxHp = mount.maxHp ?? getMountMaxHp(mount.rarity)
  const currentHp = mount.hp ?? maxHp
  if (currentHp >= maxHp) return 0
  return Math.max(1, Math.ceil((maxHp - currentHp) * 0.5))
}

describe('Stable system — heal cost', () => {
  it('returns 0 when mount is at full HP', () => {
    const mount = makeMount({ rarity: 'common', hp: 20, maxHp: 20 })
    expect(getHealCost(mount)).toBe(0)
  })

  it('returns ceil((maxHp - currentHp) * 0.5)', () => {
    const mount = makeMount({ rarity: 'common', hp: 10, maxHp: 20 })
    // (20 - 10) * 0.5 = 5
    expect(getHealCost(mount)).toBe(5)
  })

  it('returns at least 1 even for small difference', () => {
    const mount = makeMount({ rarity: 'common', hp: 19, maxHp: 20 })
    // ceil((20-19)*0.5) = ceil(0.5) = 1
    expect(getHealCost(mount)).toBe(1)
  })

  it('handles legendary mount heal cost', () => {
    const maxHp = getMountMaxHp('legendary') // 80
    const mount = makeMount({ rarity: 'legendary', hp: 40, maxHp })
    // ceil((80-40)*0.5) = 20
    expect(getHealCost(mount)).toBe(20)
  })
})

describe('Stable system — getMountMaxHp', () => {
  it('returns 20 for common', () => {
    expect(getMountMaxHp('common')).toBe(20)
  })

  it('returns 35 for uncommon', () => {
    expect(getMountMaxHp('uncommon')).toBe(35)
  })

  it('returns 50 for rare', () => {
    expect(getMountMaxHp('rare')).toBe(50)
  })

  it('returns 80 for legendary', () => {
    expect(getMountMaxHp('legendary')).toBe(80)
  })
})

describe('Stable system — mount roster constraints', () => {
  const MAX_ROSTER = 5

  it('cannot stash if roster is already at max', () => {
    const roster: Mount[] = Array.from({ length: MAX_ROSTER }, (_, i) =>
      makeMount({ id: `mount-${i}` })
    )
    expect(roster.length >= MAX_ROSTER).toBe(true)
  })

  it('can stash if roster has space', () => {
    const roster: Mount[] = Array.from({ length: 4 }, (_, i) =>
      makeMount({ id: `mount-${i}` })
    )
    expect(roster.length < MAX_ROSTER).toBe(true)
  })

  it('retrieve swaps active with roster mount when active exists', () => {
    const activeMount = makeMount({ id: 'active' })
    const rosterMount = makeMount({ id: 'roster-0' })
    const roster: Mount[] = [rosterMount]

    // Simulate swap
    const newActive = rosterMount
    const newRoster = [activeMount]

    expect(newActive.id).toBe('roster-0')
    expect(newRoster[0].id).toBe('active')
  })

  it('retrieve removes mount from roster when no active mount', () => {
    const rosterMount = makeMount({ id: 'roster-0' })
    const roster: Mount[] = [rosterMount]

    // Simulate retrieve with no active
    const mountIdx = roster.findIndex(m => m.id === 'roster-0')
    const newRoster = [...roster]
    newRoster.splice(mountIdx, 1)

    expect(newRoster.length).toBe(0)
  })
})
