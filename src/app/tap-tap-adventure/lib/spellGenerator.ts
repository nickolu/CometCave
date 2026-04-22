import { Spell, SpellEffect, SpellSchool, SpellElement, SpellCondition, ExplorationEffect } from '@/app/tap-tap-adventure/models/spell'

const SPELL_NAMES: Record<string, string[]> = {
  arcane: ['Arcane Missile', 'Mana Surge', 'Ethereal Lance', 'Astral Barrage', 'Void Bolt'],
  nature: ['Thornstrike', 'Rejuvenation', 'Earthen Shield', 'Vine Whip', 'Verdant Blessing'],
  shadow: ['Shadow Bolt', 'Dark Pact', 'Soul Siphon', 'Nightmare Touch', 'Umbral Strike'],
  war: ['Battle Cry', 'Iron Will', 'Wrath Strike', 'Fortify', 'Berserker Rage'],
}

const ELEMENTS_BY_SCHOOL: Record<string, SpellElement[]> = {
  arcane: ['arcane', 'lightning', 'ice'],
  nature: ['nature', 'fire', 'none'],
  shadow: ['shadow', 'ice', 'none'],
  war: ['fire', 'none', 'lightning'],
}

const EFFECT_TEMPLATES: Array<{
  weight: number
  create: (level: number, school: SpellSchool) => { effects: SpellEffect[]; target: 'enemy' | 'self'; tags: string[] }
}> = [
  {
    weight: 3,
    create: (level, school) => ({
      effects: [
        { type: 'damage', value: 8 + level * 3, element: pickRandom(ELEMENTS_BY_SCHOOL[school] ?? ['none']) },
      ],
      target: 'enemy',
      tags: [school, 'ranged', 'burst'],
    }),
  },
  {
    weight: 2,
    create: (level) => ({
      effects: [
        { type: 'heal', value: 6 + level * 2 },
      ],
      target: 'self',
      tags: ['heal'],
    }),
  },
  {
    weight: 2,
    create: (level, school) => ({
      effects: [
        { type: 'damage', value: 5 + level * 2, element: pickRandom(ELEMENTS_BY_SCHOOL[school] ?? ['none']) },
        { type: 'combo_boost', value: 1 },
      ],
      target: 'enemy',
      tags: [school, 'combo'],
    }),
  },
  {
    weight: 1,
    create: (level) => ({
      effects: [
        { type: 'shield', value: 8 + level * 3 },
      ],
      target: 'self',
      tags: ['defense', 'shield'],
    }),
  },
  {
    weight: 1,
    create: (level, school) => ({
      effects: [
        { type: 'damage_over_time', value: 3 + level, duration: 3, element: pickRandom(ELEMENTS_BY_SCHOOL[school] ?? ['none']) },
      ],
      target: 'enemy',
      tags: [school, 'dot'],
    }),
  },
  {
    weight: 1,
    create: (level) => ({
      effects: [
        { type: 'buff', value: 3 + Math.floor(level / 2), stat: 'attack', duration: 2 },
      ],
      target: 'self',
      tags: ['buff', 'melee'],
    }),
  },
  {
    weight: 1,
    create: (level, school) => ({
      effects: [
        { type: 'lifesteal', value: 6 + level * 2, percentage: 50, element: pickRandom(ELEMENTS_BY_SCHOOL[school] ?? ['none']) },
      ],
      target: 'enemy',
      tags: [school, 'lifesteal'],
    }),
  },
  {
    weight: 1,
    create: (level) => ({
      effects: [
        { type: 'heal_over_time', value: 2 + Math.floor(level / 2), duration: 3 },
      ],
      target: 'self',
      tags: ['heal', 'hot'],
    }),
  },
]

const POSSIBLE_CONDITIONS: SpellCondition[] = [
  { when: 'target_hp_below_50', bonus: 'double_damage' },
  { when: 'caster_hp_below_30', bonus: 'double_heal' },
  { when: 'caster_combo_3_plus', bonus: 'true_damage' },
  { when: 'target_debuffed', bonus: 'extend_duration' },
  { when: 'caster_defending', bonus: 'free_cast' },
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedRandom<T>(items: { weight: number; value: T }[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight
  for (const item of items) {
    random -= item.weight
    if (random <= 0) return item.value
  }
  return items[items.length - 1].value
}

/**
 * Generate a random spell appropriate for a given character level.
 */
export function generateSpellForLevel(level: number, school?: SpellSchool): Spell {
  const spellSchool: SpellSchool = school ?? pickRandom(['arcane', 'nature', 'shadow', 'war'] as SpellSchool[])
  const names = SPELL_NAMES[spellSchool] ?? SPELL_NAMES.arcane
  const name = pickRandom(names)

  const templateEntry = weightedRandom(
    EFFECT_TEMPLATES.map(t => ({ weight: t.weight, value: t }))
  )
  const { effects, target, tags } = templateEntry.create(level, spellSchool)

  const manaCost = Math.max(2, Math.round(3 + level * 1.5 + effects.length * 2))
  const cooldown = Math.floor(Math.random() * 3) // 0, 1, or 2

  // 30% chance to add a condition
  const conditions: SpellCondition[] = []
  if (Math.random() < 0.3) {
    conditions.push(pickRandom(POSSIBLE_CONDITIONS))
  }

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`

  // 30% chance for an exploration effect
  let explorationEffect: ExplorationEffect | undefined
  let explorationManaCost: number | undefined
  if (Math.random() < 0.3) {
    const explorationTypes = [
      {
        type: 'heal' as const,
        value: 10 + level * 5,
        description: `Restores ${10 + level * 5} HP outside of combat.`,
      },
      {
        type: 'mana_restore' as const,
        value: 5 + level * 2,
        description: `Restores ${5 + level * 2} mana outside of combat.`,
      },
      {
        type: 'speed_boost' as const,
        value: 3 + Math.floor(level / 2),
        description: `Advances ${3 + Math.floor(level / 2)} km toward your target.`,
      },
      {
        type: 'shield' as const,
        value: 8 + level * 3,
        description: `Grants a ${8 + level * 3} point shield that activates in your next combat.`,
      },
      {
        type: 'reveal' as const,
        value: 1,
        description: `Reveals details about the next landmark ahead.`,
      },
    ]
    const chosen = pickRandom(explorationTypes)
    explorationEffect = chosen
    explorationManaCost = Math.max(2, Math.floor(manaCost * 0.6)) // cheaper than combat cost
  }

  return {
    id: `spell-${spellSchool}-${suffix}`,
    name: `${name}${level > 3 ? ' II' : ''}${level > 7 ? 'I' : ''}`,
    description: `A ${spellSchool} spell that ${target === 'enemy' ? 'strikes your foe' : 'empowers you'}.`,
    school: spellSchool,
    manaCost,
    cooldown,
    target,
    effects,
    conditions: conditions.length > 0 ? conditions : undefined,
    tags: [spellSchool, ...tags],
    explorationEffect,
    explorationManaCost,
  }
}
