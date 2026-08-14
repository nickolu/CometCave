import { describe, expect, it } from 'vitest'

import {
  KIT_BONUS_CAP,
  MAX_ITEMS,
  MAX_LEVEL,
  MAX_POWERS,
  MAX_TRAIT,
  QUALITY_BANDS,
  REST_MINUTES,
  TIER_CHARGES,
  addItem,
  emptyKit,
  isRest,
  itemFromGrant,
  kitModifiers,
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

describe('itemFromGrant', () => {
  const rope = {
    id: 'coil-of-rope',
    name: 'Coil of rope',
    quality: 'plain',
    traits: [{ label: 'you have rope' }],
  }

  it('prices the item from the band, never from the proposal', () => {
    // An item is permanent, so a model allowed to write its own bonus is a
    // model writing a bonus onto every future roll.
    const item = itemFromGrant({ ...rope, traits: [{ label: 'you have rope', bonus: 2 }] }, 100)
    expect(item?.traits[0].bonus).toBe(QUALITY_BANDS.plain.bonus)
    expect(item?.traits[0].bonus).toBe(0)
  })

  it('gives a plain thing a named trait worth nothing — a permission, not a bonus', () => {
    const item = itemFromGrant(rope, 100)
    expect(item?.traits).toHaveLength(1)
    expect(item?.traits[0].label).toBe('you have rope')
    expect(item?.traits[0].bonus).toBe(0)
  })

  it('buys extra traits with rarity rather than a bigger number', () => {
    const storied = itemFromGrant(
      {
        id: 'lamp',
        name: 'The Lamp',
        quality: 'storied',
        traits: [{ label: 'lit' }, { label: 'warm' }, { label: 'third' }],
      },
      0
    )
    expect(storied?.traits).toHaveLength(QUALITY_BANDS.storied.traits)
    expect(storied?.traits[0].bonus).toBe(2)
  })

  it('refuses a thing with no name — an item nobody can call on again', () => {
    expect(itemFromGrant({ id: '!!!', name: 'Ghost' }, 0)).toBeNull()
    expect(itemFromGrant({ id: 'thing', name: '  ' }, 0)).toBeNull()
  })

  it('gives a consumable its uses and stamps when it was gained', () => {
    const item = itemFromGrant({ id: 'draught', name: 'Draught', consumable: true, uses: 3 }, 480)
    expect(item?.charges).toEqual({ now: 3, max: 3 })
    expect(item?.gainedAt).toBe(480)
  })
})

describe('addItem', () => {
  const make = (id: string) => itemFromGrant({ id, name: id }, 0)!

  it('refuses a full pack rather than dropping something you were carrying', () => {
    // Being told "you have no room" hands the decision back. Waking up to find
    // your rope gone is a bug as far as anyone at the table can tell.
    let kit = emptyKit()
    for (let i = 0; i < MAX_ITEMS; i++) kit = addItem(kit, make(`item-${i}`)).kit

    const { kit: after, added } = addItem(kit, make('one-too-many'))
    expect(added).toBe(false)
    expect(after.items).toHaveLength(MAX_ITEMS)
  })

  it('replaces rather than duplicates when the same thing is granted twice', () => {
    const kit = addItem(addItem(emptyKit(), make('rope')).kit, make('rope')).kit
    expect(kit.items).toHaveLength(1)
  })
})

describe('kitModifiers', () => {
  function kitWith(...grants: Parameters<typeof itemFromGrant>[0][]) {
    let kit = emptyKit()
    for (const g of grants) kit = addItem(kit, itemFromGrant(g, 0)!).kit
    return kit
  }

  it('says what the rope is worth, which is usually nothing', () => {
    const kit = kitWith({
      id: 'rope',
      name: 'Rope',
      quality: 'plain',
      traits: [{ label: 'you have rope' }],
    })
    // A +0 trait is real in the fiction and adds no row to the die card.
    expect(kitModifiers(kit, ['rope'], 'dexterity', null)).toEqual([])
  })

  it('only counts a trait where it claims to count', () => {
    // An item good at seeing does not help you lift — the same discipline
    // applicableSkill enforces for skills.
    const kit = kitWith({
      id: 'lantern',
      name: 'Lantern',
      quality: 'fine',
      traits: [{ label: 'the lantern is lit', applies: { attributes: ['wisdom'] } }],
    })
    expect(kitModifiers(kit, ['lantern'], 'wisdom', null)).toEqual([
      { label: 'the lantern is lit', value: 1 },
    ])
    expect(kitModifiers(kit, ['lantern'], 'strength', null)).toEqual([])
  })

  it('lets a trait that claims nothing apply anywhere', () => {
    const kit = kitWith({
      id: 'boots',
      name: 'Boots',
      quality: 'fine',
      traits: [{ label: 'good boots' }],
    })
    expect(kitModifiers(kit, ['boots'], 'strength', null)).toHaveLength(1)
  })

  it('ignores an item the DM did not name', () => {
    const kit = kitWith({
      id: 'boots',
      name: 'Boots',
      quality: 'fine',
      traits: [{ label: 'good boots' }],
    })
    expect(kitModifiers(kit, ['rope'], 'strength', null)).toEqual([])
    expect(kitModifiers(kit, undefined, 'strength', null)).toEqual([])
  })

  it('stops a spent consumable helping, without taking it off you', () => {
    let kit = kitWith({
      id: 'draught',
      name: 'Draught',
      quality: 'storied',
      consumable: true,
      uses: 1,
      traits: [{ label: 'the draught burns' }],
    })
    kit = {
      ...kit,
      items: kit.items.map(i => ({ ...i, charges: { now: 0, max: 1 } })),
    }
    expect(kitModifiers(kit, ['draught'], 'strength', null)).toEqual([])
    expect(kit.items).toHaveLength(1)
  })

  it('holds a well-packed character under the ceiling', () => {
    // Kit is permanent, so without its own cap a well-equipped character simply
    // stops rolling.
    const kit = kitWith(
      { id: 'a', name: 'A', quality: 'storied', traits: [{ label: 'a' }, { label: 'a2' }] },
      { id: 'b', name: 'B', quality: 'storied', traits: [{ label: 'b' }, { label: 'b2' }] }
    )
    const mods = kitModifiers(kit, ['a', 'b'], 'strength', null)
    const total = mods.reduce((sum, m) => sum + m.value, 0)
    expect(total).toBeLessThanOrEqual(KIT_BONUS_CAP)
  })

  it('trims the smallest first, so the thing that helped most still shows', () => {
    const kit = kitWith(
      { id: 'big', name: 'Big', quality: 'storied', traits: [{ label: 'the great sword' }] },
      { id: 'small', name: 'Small', quality: 'fine', traits: [{ label: 'a good grip' }] },
      { id: 'small2', name: 'Small2', quality: 'fine', traits: [{ label: 'dry hands' }] }
    )
    const mods = kitModifiers(kit, ['big', 'small', 'small2'], 'strength', null)
    expect(mods.map(m => m.label)).toContain('the great sword')
    expect(mods.reduce((sum, m) => sum + m.value, 0)).toBeLessThanOrEqual(KIT_BONUS_CAP)
  })
})
