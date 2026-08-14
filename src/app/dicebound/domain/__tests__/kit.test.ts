import { describe, expect, it } from 'vitest'

import {
  KIT_BONUS_CAP,
  MAX_ITEMS,
  MAX_LEVEL,
  MAX_POWERS,
  MAX_TRAIT,
  REST_MINUTES,
  TIER_CHARGES,
  emptyKit,
  isRest,
  levelFor,
  maxPowersAt,
  maxTierAt,
  restore,
  validateItem,
  validateKit,
  validatePower,
  validateSpecies,
  validateTrait,
} from '@/app/dicebound/domain/kit'

describe('levels', () => {
  it('starts at 1 and advances every three earned ranks', () => {
    expect(levelFor(0)).toBe(1)
    expect(levelFor(2)).toBe(1)
    expect(levelFor(3)).toBe(2)
    expect(levelFor(9)).toBe(4)
  })

  it('caps, so a very long campaign does not run away', () => {
    expect(levelFor(9999)).toBe(MAX_LEVEL)
  })

  it('grants power slots slowly', () => {
    expect(maxPowersAt(1)).toBe(1)
    expect(maxPowersAt(4)).toBe(3)
    expect(maxPowersAt(MAX_LEVEL)).toBeLessThanOrEqual(MAX_POWERS)
  })

  it('keeps the big powers out of reach until the character has earned them', () => {
    // Fireball is tier 2, and tier 2 is level 4. Nothing at level 1 can be granted.
    expect(maxTierAt(1)).toBe(0)
    expect(maxTierAt(2)).toBe(1)
    expect(maxTierAt(4)).toBe(2)
    expect(maxTierAt(7)).toBe(3)
  })
})

describe('rest', () => {
  it('needs time, safety, and nothing pressing — all three', () => {
    expect(isRest(REST_MINUTES, true, false)).toBe(true)
    expect(isRest(REST_MINUTES - 1, true, false)).toBe(false)
    expect(isRest(REST_MINUTES, false, false)).toBe(false)
    // The condition the model cannot wave away.
    expect(isRest(REST_MINUTES, true, true)).toBe(false)
  })

  it('refills every power to its own maximum', () => {
    const kit = validateKit({
      powers: [
        {
          id: 'ember-word',
          name: 'Ember Word',
          tier: 2,
          source: 'keeper-imra',
          charges: { now: 0 },
        },
      ],
    })
    expect(kit.powers[0].charges.now).toBe(0)
    expect(restore(kit).powers[0].charges.now).toBe(TIER_CHARGES[2])
  })
})

describe('validateTrait', () => {
  it('clamps a bonus the model got excited about', () => {
    expect(validateTrait({ label: 'the lantern is lit', bonus: 9 })?.bonus).toBe(MAX_TRAIT)
    expect(validateTrait({ label: 'blind drunk', bonus: -9 })?.bonus).toBe(-MAX_TRAIT)
  })

  it('drops a trait with nothing to show on the die card', () => {
    expect(validateTrait({ bonus: 2 })).toBeNull()
  })

  it('keeps only real attributes and skills in its applicability', () => {
    const trait = validateTrait({
      label: 'sure-footed',
      bonus: 1,
      applies: { attributes: ['dexterity', 'vibes'], skills: ['balance', 'telekinesis'] },
    })
    expect(trait?.applies).toEqual({ attributes: ['dexterity'], skills: ['balance'] })
  })
})

describe('validatePower', () => {
  it('refuses a power that came from nowhere', () => {
    // Provenance is the gate. A power with no source is exactly what the
    // `source` field exists to make impossible, so it is dropped, not repaired.
    expect(validatePower({ id: 'fireball', name: 'Fireball', tier: 3 })).toBeNull()
  })

  it('re-derives charges from the tier, so an edited save cannot widen them', () => {
    const power = validatePower({
      id: 'ember-word',
      name: 'Ember Word',
      tier: 2,
      source: 'keeper-imra',
      charges: { now: 99, max: 99 },
    })
    expect(power?.charges).toEqual({ max: TIER_CHARGES[2], now: TIER_CHARGES[2] })
  })

  it('clamps the tier rather than trusting it', () => {
    const power = validatePower({ id: 'x', name: 'X', tier: 12, source: 'somewhere' })
    expect(power?.tier).toBe(3)
  })
})

describe('validateSpecies', () => {
  it('forces the drawback to actually be one', () => {
    // A species that is all upside is a stat bonus wearing a name.
    const species = validateSpecies({
      name: 'Cat',
      trait: { label: 'lands on its feet', bonus: 1 },
      drawback: { label: 'cannot resist a string', bonus: 2 },
    })
    expect(species?.drawback.bonus).toBe(-2)
  })

  it('refuses a species missing either half', () => {
    expect(validateSpecies({ name: 'Cat', trait: { label: 'quick', bonus: 1 } })).toBeNull()
  })
})

describe('validateKit', () => {
  it('is an empty kit for anything unreadable', () => {
    expect(validateKit(undefined)).toEqual(emptyKit())
    expect(validateKit({ items: 'a rope', powers: 3 })).toEqual(emptyKit())
  })

  it('caps what a character can carry and know', () => {
    const kit = validateKit({
      items: Array.from({ length: MAX_ITEMS + 5 }, (_, i) => ({ id: `i${i}`, name: `Item ${i}` })),
      powers: Array.from({ length: MAX_POWERS + 5 }, (_, i) => ({
        id: `p${i}`,
        name: `Power ${i}`,
        tier: 1,
        source: 'somewhere',
      })),
    })
    expect(kit.items).toHaveLength(MAX_ITEMS)
    expect(kit.powers).toHaveLength(MAX_POWERS)
  })

  it('keeps at most two traits on an item', () => {
    const item = validateItem({
      id: 'lantern',
      name: 'Storm lantern',
      traits: [
        { label: 'a', bonus: 1 },
        { label: 'b', bonus: 1 },
        { label: 'c', bonus: 1 },
      ],
    })
    expect(item?.traits).toHaveLength(2)
    // And even two maxed traits cannot outrun the kit ceiling.
    const total = (item?.traits ?? []).reduce((sum, t) => sum + t.bonus, 0)
    expect(total).toBeLessThanOrEqual(KIT_BONUS_CAP)
  })
})
