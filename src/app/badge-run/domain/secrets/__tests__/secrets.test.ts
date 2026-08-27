import { describe, it, expect } from 'vitest'
import {
  detectActiveSecrets,
  getUnitSecretMultiplier,
  applySecretBonus,
  FOSSIL_DEX_IDS,
  type SecretSnapshot,
} from '../secrets'
import { MAX_SURVIVAL_LEVEL } from '../../levels/survival'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUnit(dexId: number, types: string[]) {
  return { dexId, types }
}

function makeSnap(overrides: Partial<SecretSnapshot> = {}): SecretSnapshot {
  return {
    team: [],
    boardLevels: {},
    round: 1,
    firstTeamDexIds: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Grunt Squad
// ---------------------------------------------------------------------------

describe('Grunt Squad', () => {
  it('triggers when all units (≥2) are Poison type', () => {
    const snap = makeSnap({
      team: [
        makeUnit(23, ['Poison']),         // Ekans
        makeUnit(29, ['Poison']),         // Nidoran♀
        makeUnit(88, ['Poison']),         // Grimer
      ],
    })
    const secrets = detectActiveSecrets(snap)
    expect(secrets.find(s => s.id === 'grunt-squad')).toBeDefined()
  })

  it('triggers with dual-type Poison units (Grass/Poison)', () => {
    const snap = makeSnap({
      team: [
        makeUnit(1, ['Grass', 'Poison']),  // Bulbasaur
        makeUnit(43, ['Grass', 'Poison']), // Oddish
      ],
    })
    const secrets = detectActiveSecrets(snap)
    expect(secrets.find(s => s.id === 'grunt-squad')).toBeDefined()
  })

  it('does NOT trigger with a single Poison unit', () => {
    const snap = makeSnap({
      team: [makeUnit(23, ['Poison'])],
    })
    const secrets = detectActiveSecrets(snap)
    expect(secrets.find(s => s.id === 'grunt-squad')).toBeUndefined()
  })

  it('does NOT trigger when any unit lacks Poison type', () => {
    const snap = makeSnap({
      team: [
        makeUnit(23, ['Poison']),
        makeUnit(1, ['Grass', 'Poison']),
        makeUnit(4, ['Fire']),   // Charmander — not Poison
      ],
    })
    const secrets = detectActiveSecrets(snap)
    expect(secrets.find(s => s.id === 'grunt-squad')).toBeUndefined()
  })

  it('applies +15% stat bonus to all units', () => {
    const snap = makeSnap({
      team: [makeUnit(23, ['Poison']), makeUnit(29, ['Poison'])],
    })
    const secrets = detectActiveSecrets(snap)
    const multiplier = getUnitSecretMultiplier(23, secrets)
    expect(multiplier).toBeCloseTo(0.15)

    const stats = { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 }
    const boosted = applySecretBonus(stats, multiplier)
    expect(boosted.hp).toBe(115)
    expect(boosted.attack).toBe(115)
  })
})

// ---------------------------------------------------------------------------
// Bug Catcher's Net
// ---------------------------------------------------------------------------

describe("Bug Catcher's Net", () => {
  it('triggers when all units (≥2) are Bug type', () => {
    const snap = makeSnap({
      team: [
        makeUnit(10, ['Bug']),          // Caterpie
        makeUnit(13, ['Bug', 'Poison']), // Weedle
      ],
    })
    const secrets = detectActiveSecrets(snap)
    expect(secrets.find(s => s.id === 'bug-catchers-net')).toBeDefined()
  })

  it('does NOT trigger with one Bug unit', () => {
    const snap = makeSnap({ team: [makeUnit(10, ['Bug'])] })
    expect(detectActiveSecrets(snap).find(s => s.id === 'bug-catchers-net')).toBeUndefined()
  })

  it('does NOT trigger if any unit lacks Bug type', () => {
    const snap = makeSnap({
      team: [
        makeUnit(10, ['Bug']),
        makeUnit(4, ['Fire']),
      ],
    })
    expect(detectActiveSecrets(snap).find(s => s.id === 'bug-catchers-net')).toBeUndefined()
  })

  it('applies +20% stat bonus to all units', () => {
    const snap = makeSnap({
      team: [makeUnit(10, ['Bug']), makeUnit(13, ['Bug', 'Poison'])],
    })
    const secrets = detectActiveSecrets(snap)
    const multiplier = getUnitSecretMultiplier(10, secrets)
    expect(multiplier).toBeCloseTo(0.20)

    const stats = { hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 }
    const boosted = applySecretBonus(stats, multiplier)
    expect(boosted.hp).toBe(60)
    expect(boosted.speed).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// Lavender Hour
// ---------------------------------------------------------------------------

describe('Lavender Hour', () => {
  it('triggers when a Ghost unit is at max survival level', () => {
    const snap = makeSnap({
      team: [makeUnit(92, ['Ghost', 'Poison'])], // Gastly
      boardLevels: { 92: MAX_SURVIVAL_LEVEL },
    })
    const secrets = detectActiveSecrets(snap)
    expect(secrets.find(s => s.id === 'lavender-hour')).toBeDefined()
  })

  it('does NOT trigger when Ghost unit is below max survival level', () => {
    const snap = makeSnap({
      team: [makeUnit(92, ['Ghost', 'Poison'])],
      boardLevels: { 92: MAX_SURVIVAL_LEVEL - 1 },
    })
    expect(detectActiveSecrets(snap).find(s => s.id === 'lavender-hour')).toBeUndefined()
  })

  it('does NOT trigger for a non-Ghost unit at max survival level', () => {
    const snap = makeSnap({
      team: [makeUnit(6, ['Fire', 'Flying'])], // Charizard
      boardLevels: { 6: MAX_SURVIVAL_LEVEL },
    })
    expect(detectActiveSecrets(snap).find(s => s.id === 'lavender-hour')).toBeUndefined()
  })

  it('only affects Ghost units, not teammates', () => {
    const snap = makeSnap({
      team: [
        makeUnit(94, ['Ghost', 'Poison']), // Gengar at max
        makeUnit(6, ['Fire', 'Flying']),   // Charizard (teammate)
      ],
      boardLevels: { 94: MAX_SURVIVAL_LEVEL, 6: MAX_SURVIVAL_LEVEL },
    })
    const secrets = detectActiveSecrets(snap)
    const ghost = secrets.find(s => s.id === 'lavender-hour')!
    expect(ghost).toBeDefined()
    expect(ghost.affectedDexIds).toContain(94)
    expect(ghost.affectedDexIds).not.toContain(6)
  })

  it('applies +50% stat bonus to the Ghost unit', () => {
    const snap = makeSnap({
      team: [makeUnit(92, ['Ghost', 'Poison'])],
      boardLevels: { 92: MAX_SURVIVAL_LEVEL },
    })
    const secrets = detectActiveSecrets(snap)
    const multiplier = getUnitSecretMultiplier(92, secrets)
    expect(multiplier).toBeCloseTo(0.50)

    const stats = { hp: 60, attack: 65, defense: 60, specialAttack: 130, specialDefense: 75, speed: 110 }
    const boosted = applySecretBonus(stats, multiplier)
    expect(boosted.specialAttack).toBe(195)
  })
})

// ---------------------------------------------------------------------------
// Cinnabar Files
// ---------------------------------------------------------------------------

describe('Cinnabar Files', () => {
  it('triggers when a fossil Pokémon is on the team at round ≥ 25', () => {
    const fossilDexId = FOSSIL_DEX_IDS[0] // Omanyte = 138
    const snap = makeSnap({
      team: [makeUnit(fossilDexId, ['Rock', 'Water'])],
      round: 25,
    })
    const secrets = detectActiveSecrets(snap)
    expect(secrets.find(s => s.id === 'cinnabar-files')).toBeDefined()
  })

  it('triggers for every FOSSIL_DEX_ID at round 29', () => {
    for (const dexId of FOSSIL_DEX_IDS) {
      const snap = makeSnap({
        team: [makeUnit(dexId, ['Rock', 'Water'])],
        round: 29,
      })
      const secrets = detectActiveSecrets(snap)
      expect(secrets.find(s => s.id === 'cinnabar-files')).toBeDefined()
    }
  })

  it('does NOT trigger before round 25', () => {
    const fossilDexId = FOSSIL_DEX_IDS[0]
    const snap = makeSnap({
      team: [makeUnit(fossilDexId, ['Rock', 'Water'])],
      round: 24,
    })
    expect(detectActiveSecrets(snap).find(s => s.id === 'cinnabar-files')).toBeUndefined()
  })

  it('does NOT trigger if no fossil is on the team', () => {
    const snap = makeSnap({
      team: [makeUnit(4, ['Fire'])],
      round: 29,
    })
    expect(detectActiveSecrets(snap).find(s => s.id === 'cinnabar-files')).toBeUndefined()
  })

  it('applies +40% stat bonus to fossil unit(s)', () => {
    const fossilDexId = FOSSIL_DEX_IDS[0]
    const snap = makeSnap({
      team: [makeUnit(fossilDexId, ['Rock', 'Water'])],
      round: 25,
    })
    const secrets = detectActiveSecrets(snap)
    const multiplier = getUnitSecretMultiplier(fossilDexId, secrets)
    expect(multiplier).toBeCloseTo(0.40)

    const stats = { hp: 70, attack: 60, defense: 125, specialAttack: 115, specialDefense: 70, speed: 55 }
    const boosted = applySecretBonus(stats, multiplier)
    expect(boosted.defense).toBe(175)
  })
})

// ---------------------------------------------------------------------------
// Old Friend
// ---------------------------------------------------------------------------

describe('Old Friend', () => {
  it('triggers when a round-1 unit is still on the team at round ≥ 25', () => {
    const snap = makeSnap({
      team: [makeUnit(1, ['Grass', 'Poison'])], // Bulbasaur picked in round 1
      round: 25,
      firstTeamDexIds: [1],
    })
    const secrets = detectActiveSecrets(snap)
    expect(secrets.find(s => s.id === 'old-friend')).toBeDefined()
  })

  it('does NOT trigger before round 25 even with a veteran on team', () => {
    const snap = makeSnap({
      team: [makeUnit(1, ['Grass', 'Poison'])],
      round: 24,
      firstTeamDexIds: [1],
    })
    expect(detectActiveSecrets(snap).find(s => s.id === 'old-friend')).toBeUndefined()
  })

  it('does NOT trigger if the round-1 unit was replaced (e.g. evolved)', () => {
    const snap = makeSnap({
      team: [makeUnit(2, ['Grass', 'Poison'])], // Ivysaur (evolved from Bulbasaur)
      round: 29,
      firstTeamDexIds: [1], // Bulbasaur was round-1 pick; now it's Ivysaur
    })
    expect(detectActiveSecrets(snap).find(s => s.id === 'old-friend')).toBeUndefined()
  })

  it('does NOT trigger if firstTeamDexIds is empty (round 1 not yet completed)', () => {
    const snap = makeSnap({
      team: [makeUnit(1, ['Grass', 'Poison'])],
      round: 29,
      firstTeamDexIds: [],
    })
    expect(detectActiveSecrets(snap).find(s => s.id === 'old-friend')).toBeUndefined()
  })

  it('applies +75% stat bonus to the veteran unit', () => {
    const snap = makeSnap({
      team: [makeUnit(131, ['Water', 'Ice'])], // Lapras — no evolutions
      round: 29,
      firstTeamDexIds: [131],
    })
    const secrets = detectActiveSecrets(snap)
    const multiplier = getUnitSecretMultiplier(131, secrets)
    expect(multiplier).toBeCloseTo(0.75)

    const stats = { hp: 130, attack: 85, defense: 80, specialAttack: 85, specialDefense: 95, speed: 60 }
    const boosted = applySecretBonus(stats, multiplier)
    expect(boosted.hp).toBe(228)
    expect(boosted.speed).toBe(105)
  })
})

// ---------------------------------------------------------------------------
// Stacking
// ---------------------------------------------------------------------------

describe('Secret stacking', () => {
  it('stacks multiplicative effects additively when two secrets apply to the same unit', () => {
    // Weedle (Bug/Poison) — qualifies for both Grunt Squad and Bug Catcher's Net
    const snap = makeSnap({
      team: [
        makeUnit(13, ['Bug', 'Poison']), // Weedle
        makeUnit(15, ['Bug', 'Poison']), // Beedrill
      ],
    })
    const secrets = detectActiveSecrets(snap)
    // Both secrets should be active
    expect(secrets.find(s => s.id === 'grunt-squad')).toBeDefined()
    expect(secrets.find(s => s.id === 'bug-catchers-net')).toBeDefined()

    const multiplier = getUnitSecretMultiplier(13, secrets)
    // 0.15 (Grunt Squad) + 0.20 (Bug Catcher's Net) = 0.35
    expect(multiplier).toBeCloseTo(0.35)

    const stats = { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 }
    const boosted = applySecretBonus(stats, multiplier)
    expect(boosted.hp).toBe(135)
  })
})
