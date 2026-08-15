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
  addPower,
  appliesTo,
  canGrantPower,
  emptyKit,
  isRest,
  itemFromGrant,
  kitModifiers,
  levelFor,
  maxPowersAt,
  maxTierAt,
  powerEffect,
  powerFromGrant,
  restore,
  spendPower,
  validateItem,
  validateKit,
  validatePower,
  validateSpecies,
  validateTrait,
} from '@/app/dicebound/domain/kit'
import { type Entity, type World, emptyWorld } from '@/app/dicebound/domain/world'

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

/** A world holding one actor the player met an hour into the story. */
function worldWith(entities: Record<string, Partial<Entity>> = {}, elapsed = 600): World {
  const base = emptyWorld()
  const built: Record<string, Entity> = {}
  for (const [id, over] of Object.entries(entities)) {
    built[id] = {
      id,
      kind: 'actor',
      name: id,
      note: '',
      state: '',
      status: 'active',
      firstSeen: 60,
      lastSeen: 60,
      disposition: 0,
      scale: 'person',
      ...over,
    } as Entity
  }
  return { ...base, clock: { ...base.clock, elapsed }, entities: built }
}

const grant = (over: Record<string, unknown> = {}) => ({
  id: 'ember-hand',
  name: 'Ember Hand',
  source: 'maren',
  shape: 'permits',
  permits: 'throw fire, at short range',
  ...over,
})

describe('canGrantPower', () => {
  it('a power with a source the world has never heard of is refused', () => {
    // Invariant 12 in one line: "nothing" fails a lookup. The DM cannot conjure
    // fireball out of a teacher the story never contained.
    const verdict = canGrantPower(
      emptyKit(),
      worldWith({ maren: {} }),
      4,
      { id: 'ember-hand', source: 'the-mountain', tier: 1 },
      600
    )
    expect(verdict.granted).toBe(false)
    expect(verdict.reason).toContain('the-mountain')
  })

  it('a source invented this turn does not count as an entity the player has met', () => {
    // The same rule Edge.since enforces. Without it the DM introduces a
    // mysterious stranger and has them teach fireball in the same breath, which
    // is granting a power to yourself with extra steps.
    const world = worldWith({ stranger: { firstSeen: 600 } }, 600)
    const verdict = canGrantPower(
      emptyKit(),
      world,
      4,
      { id: 'ember-hand', source: 'stranger', tier: 1 },
      600
    )
    expect(verdict.granted).toBe(false)
  })

  it('refuses a source the story has finished with', () => {
    const world = worldWith({ maren: { status: 'gone' } })
    expect(
      canGrantPower(emptyKit(), world, 4, { id: 'ember-hand', source: 'maren', tier: 1 }, 600)
        .granted
    ).toBe(false)
  })

  it('refuses the player as their own provenance', () => {
    // A power sourced from `you` is a power with no provenance wearing an id
    // that happens to resolve.
    const world = worldWith({ you: { firstSeen: 0 } })
    expect(
      canGrantPower(emptyKit(), world, 4, { id: 'ember-hand', source: 'you', tier: 1 }, 600).granted
    ).toBe(false)
  })

  it('refuses outright below the level where powers exist at all', () => {
    // maxTierAt(1) is 0 — they are not yet someone who has powers.
    const verdict = canGrantPower(
      emptyKit(),
      worldWith({ maren: {} }),
      1,
      { id: 'ember-hand', source: 'maren', tier: 1 },
      600
    )
    expect(verdict.granted).toBe(false)
    expect(verdict.tier).toBe(0)
  })

  it('a tier the level cannot reach is clamped down, never up', () => {
    const world = worldWith({ maren: {} })
    // Level 4 reaches tier 2. Asking for 3 gets 2.
    expect(
      canGrantPower(emptyKit(), world, 4, { id: 'ember-hand', source: 'maren', tier: 3 }, 600).tier
    ).toBe(2)
    // Asking for 1 gets 1 — the clamp is a ceiling, not a floor that promotes.
    expect(
      canGrantPower(emptyKit(), world, 4, { id: 'ember-hand', source: 'maren', tier: 1 }, 600).tier
    ).toBe(1)
  })

  it('the same power cannot be granted twice under the same id', () => {
    const world = worldWith({ maren: {} })
    const power = powerFromGrant(grant(), 1, 600)!
    const { kit } = addPower(emptyKit(), power)
    const verdict = canGrantPower(
      kit,
      world,
      4,
      { id: 'ember-hand', source: 'maren', tier: 1 },
      600
    )
    expect(verdict.granted).toBe(false)
    expect(verdict.reason).toContain('already')
  })

  it('refuses once the slots the level allows are full', () => {
    const world = worldWith({ maren: {} })
    // Level 4 allows maxPowersAt(4) = 3.
    let kit = emptyKit()
    for (const id of ['a', 'b', 'c']) {
      kit = addPower(kit, powerFromGrant(grant({ id }), 1, 600)!).kit
    }
    expect(kit.powers).toHaveLength(maxPowersAt(4))
    expect(
      canGrantPower(kit, world, 4, { id: 'ember-hand', source: 'maren', tier: 1 }, 600).granted
    ).toBe(false)
  })
})

describe('powerFromGrant', () => {
  it('charges come from the tier table, not from the model', () => {
    const power = powerFromGrant({ ...grant(), charges: { now: 99, max: 99 }, tier: 3 }, 2, 600)!
    expect(power.tier).toBe(2)
    expect(power.charges).toEqual({ now: TIER_CHARGES[2], max: TIER_CHARGES[2] })
  })

  it('refuses a power with no provenance rather than repairing it', () => {
    // A placeholder source would defeat the entire point of the field.
    expect(powerFromGrant({ ...grant(), source: '' }, 1, 600)).toBeNull()
    expect(powerFromGrant({ ...grant(), source: '  ' }, 1, 600)).toBeNull()
  })

  it('takes the clock for gainedAt rather than anything the model sent', () => {
    const power = powerFromGrant({ ...grant(), gainedAt: 0 }, 1, 600)!
    expect(power.gainedAt).toBe(600)
  })
})

describe('addPower', () => {
  it('refuses a duplicate rather than replacing it, so charges cannot be refilled by re-granting', () => {
    // Unlike addItem, which replaces. Re-granting a power would silently
    // restore its charges — a rest the player never took.
    const spent = { ...powerFromGrant(grant(), 1, 600)!, charges: { now: 0, max: 3 } }
    const kit = { ...emptyKit(), powers: [spent] }
    const { kit: after, added } = addPower(kit, powerFromGrant(grant(), 1, 600)!)
    expect(added).toBe(false)
    expect(after.powers[0].charges.now).toBe(0)
  })

  it('never exceeds the hard ceiling, whatever the level says', () => {
    let kit = emptyKit()
    for (let i = 0; i < MAX_POWERS + 3; i++) {
      kit = addPower(kit, powerFromGrant(grant({ id: `p${i}` }), 1, 600)!).kit
    }
    expect(kit.powers).toHaveLength(MAX_POWERS)
  })
})

describe('spendPower', () => {
  const kitWith = (over: Partial<Parameters<typeof powerFromGrant>[0]> = {}, tier = 1) => {
    const power = powerFromGrant({ ...grant(), ...over }, tier, 600)!
    return { ...emptyKit(), powers: [power] }
  }

  it('spends the charge and returns the power, and decides nothing else', () => {
    // The whole rule as an ordering: the charge is gone before any check is
    // rolled and without knowing whether one will land.
    const { kit, power, reason } = spendPower(kitWith(), 'ember-hand')
    expect(reason).toBe('')
    expect(power?.charges.now).toBe(TIER_CHARGES[1] - 1)
    expect(kit.powers[0].charges.now).toBe(TIER_CHARGES[1] - 1)
    // Nothing resembling an outcome comes back — no modifier, no roll, no band.
    expect(Object.keys(power ?? {})).not.toContain('bonus')
  })

  it('a power with no charges left cannot be spent into the negative', () => {
    const spent = {
      ...emptyKit(),
      powers: [{ ...powerFromGrant(grant(), 1, 600)!, charges: { now: 0, max: 3 } }],
    }
    const result = spendPower(spent, 'ember-hand')
    expect(result.power).toBeNull()
    expect(result.kit.powers[0].charges.now).toBe(0)
    expect(result.reason).toContain('spent')
  })

  it('says when the charge comes back, so the player is not left guessing', () => {
    const restful = {
      ...emptyKit(),
      powers: [{ ...powerFromGrant(grant(), 1, 600)!, charges: { now: 0, max: 3 } }],
    }
    expect(spendPower(restful, 'ember-hand').reason).toContain('rest')
  })

  it('refuses a power the kit does not hold rather than inventing one', () => {
    const result = spendPower(kitWith(), 'fireball')
    expect(result.power).toBeNull()
    expect(result.kit.powers[0].charges.now).toBe(TIER_CHARGES[1])
  })

  it('the same power cannot be spent twice in one turn', () => {
    // Without this a model that liked the answer spends it three times in one
    // message and pays for it once.
    const kit = kitWith()
    const first = spendPower(kit, 'ember-hand', new Set())
    const second = spendPower(first.kit, 'ember-hand', new Set(['ember-hand']))
    expect(second.power).toBeNull()
    expect(second.kit.powers[0].charges.now).toBe(TIER_CHARGES[1] - 1)
  })

  it('does not mutate the kit it was given', () => {
    const kit = kitWith()
    spendPower(kit, 'ember-hand')
    expect(kit.powers[0].charges.now).toBe(TIER_CHARGES[1])
  })
})

describe('appliesTo', () => {
  it('an empty claim covers everything — that is why a general thing is worth +0', () => {
    expect(appliesTo({}, 'dexterity', 'balance')).toBe(true)
  })

  it('a claim that names something covers only that', () => {
    expect(appliesTo({ attributes: ['power'] }, 'power', null)).toBe(true)
    expect(appliesTo({ attributes: ['power'] }, 'dexterity', null)).toBe(false)
    expect(appliesTo({ skills: ['balance'] }, 'dexterity', 'balance')).toBe(true)
    expect(appliesTo({ skills: ['balance'] }, 'dexterity', 'quickness')).toBe(false)
  })
})

describe('powerEffect', () => {
  it('a permits power adds a permission to the die card, not a modifier', () => {
    // +0, and the zero is the point. It is on the card so the player can see
    // why a thing they could not do a moment ago is suddenly a roll — the same
    // reason a +0 item trait is named. It is not a bonus and must never become
    // one.
    const power = powerFromGrant(
      { ...grant(), shape: 'permits', permits: 'throw fire, at range' },
      1,
      600
    )!
    const effect = powerEffect(power)

    expect(effect.advantage).toBeNull()
    expect(effect.permission?.value).toBe(0)
    expect(effect.permission?.label).toContain('throw fire, at range')
  })

  it('an advantage power carries no number at all', () => {
    // It moves the odds without moving anything anyone can point at, which is
    // why it sits outside the ±6 budget and the +3 kit ceiling.
    const power = powerFromGrant(
      { ...grant(), shape: 'advantage', applies: { attributes: ['power'] } },
      1,
      600
    )!
    const effect = powerEffect(power)

    expect(effect.permission).toBeNull()
    expect(effect.advantage?.source.direction).toBe('advantage')
    expect(JSON.stringify(effect.advantage?.source)).not.toMatch(/\d/)
  })

  it('an advantage power that matches nothing this turn still costs the charge', () => {
    // The charge is spent by spendPower, before anything is rolled and without
    // knowing whether a matching check will ever come. The effect it produces
    // is only ever *offered* to a check — nothing here can hand the charge
    // back, and that is what makes spending it a real decision.
    const power = powerFromGrant(
      { ...grant(), shape: 'advantage', applies: { attributes: ['power'] } },
      1,
      600
    )!
    const kit = { ...emptyKit(), powers: [power] }

    const spent = spendPower(kit, power.id)
    expect(spent.kit.powers[0].charges.now).toBe(TIER_CHARGES[1] - 1)

    const effect = powerEffect(spent.power!)
    // The turn's only check is a Dexterity one. The power claims Power, so
    // nothing claims it — and the charge above is still gone.
    expect(appliesTo(effect.advantage!.applies, 'dexterity', 'balance')).toBe(false)
    expect(spent.kit.powers[0].charges.now).toBe(TIER_CHARGES[1] - 1)
  })
})
