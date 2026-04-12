import { OpenAI } from 'openai'

import { FALLBACK_CLASSES } from '@/app/tap-tap-adventure/config/fallbackClasses'
import { GeneratedClass, GeneratedClassStartingAbility } from '@/app/tap-tap-adventure/models/generatedClass'
import { SpellEffect, SpellElement, SpellSchool } from '@/app/tap-tap-adventure/models/spell'

export const COMBAT_STYLES = [
  // Physical
  'martial', 'berserker', 'duelist', 'guardian', 'monk',
  // Magical
  'arcane', 'elementalist', 'enchanter', 'summoner', 'ritualist',
  // Spiritual
  'divine', 'shaman', 'oracle', 'mystic', 'zealot',
  // Wild
  'primal', 'feral', 'druid', 'beastmaster', 'nomad',
  // Stealth
  'shadow', 'assassin', 'trickster', 'phantom', 'spy',
  // Mental
  'psionic', 'telepath', 'dreamwalker', 'illusionist', 'savant',
] as const

export const MODIFIERS = [
  // Elements
  'fire', 'ice', 'storm', 'lightning', 'earth', 'water', 'wind',
  // Dark/Light
  'shadow', 'void', 'light', 'radiance', 'twilight', 'eclipse',
  // Life/Death
  'blood', 'bone', 'death', 'life', 'spirit', 'soul',
  // Nature
  'nature', 'beast', 'flora', 'fungal', 'venom', 'coral',
  // Material
  'iron', 'crystal', 'obsidian', 'gold', 'jade', 'amber',
  // Concepts
  'time', 'fate', 'chaos', 'order', 'dream', 'memory', 'rage', 'song',
] as const

export type CombatStyle = (typeof COMBAT_STYLES)[number]
export type Modifier = (typeof MODIFIERS)[number]

export interface SeedCombo {
  style: CombatStyle
  modifier: Modifier
}

/**
 * Pick N unique random seed combos from style x modifier space.
 */
export function pickRandomSeeds(count: number): SeedCombo[] {
  const allCombos: SeedCombo[] = []
  for (const style of COMBAT_STYLES) {
    for (const modifier of MODIFIERS) {
      allCombos.push({ style, modifier })
    }
  }

  // Fisher-Yates shuffle
  for (let i = allCombos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allCombos[i], allCombos[j]] = [allCombos[j], allCombos[i]]
  }

  return allCombos.slice(0, count)
}

/**
 * Map a modifier to a spell school.
 */
export function getSchoolForModifier(modifier: string): SpellSchool {
  const mapping: Record<string, SpellSchool> = {
    // Elements → war/arcane
    fire: 'war', ice: 'arcane', storm: 'arcane', lightning: 'arcane',
    earth: 'war', water: 'nature', wind: 'arcane',
    // Dark/Light → shadow/arcane
    shadow: 'shadow', void: 'shadow', light: 'arcane', radiance: 'arcane',
    twilight: 'shadow', eclipse: 'shadow',
    // Life/Death → nature/shadow
    blood: 'shadow', bone: 'shadow', death: 'shadow', life: 'nature',
    spirit: 'nature', soul: 'arcane',
    // Nature → nature
    nature: 'nature', beast: 'nature', flora: 'nature', fungal: 'nature',
    venom: 'shadow', coral: 'nature',
    // Material → war
    iron: 'war', crystal: 'arcane', obsidian: 'war', gold: 'war',
    jade: 'nature', amber: 'nature',
    // Concepts → arcane/shadow
    time: 'arcane', fate: 'arcane', chaos: 'shadow', order: 'war',
    dream: 'arcane', memory: 'arcane', rage: 'war', song: 'nature',
  }
  return mapping[modifier] ?? 'arcane'
}

/**
 * Style categories used to determine ability effect combinations.
 */
const STYLE_CATEGORIES: Record<string, string[]> = {
  martial: ['martial', 'berserker', 'duelist', 'guardian', 'monk'],
  arcane: ['arcane', 'elementalist', 'enchanter', 'summoner', 'ritualist'],
  divine: ['divine', 'shaman', 'oracle', 'mystic', 'zealot'],
  primal: ['primal', 'feral', 'druid', 'beastmaster', 'nomad'],
  shadow: ['shadow', 'assassin', 'trickster', 'phantom', 'spy'],
  psionic: ['psionic', 'telepath', 'dreamwalker', 'illusionist', 'savant'],
}

/**
 * Get the style category for a given combat style.
 */
export function getStyleCategory(style: string): string {
  for (const [category, styles] of Object.entries(STYLE_CATEGORIES)) {
    if (styles.includes(style)) return category
  }
  return 'martial'
}

/**
 * Map a modifier to a SpellElement for use in damage effects.
 */
export function getElementForModifier(modifier: string): SpellElement {
  const mapping: Record<string, SpellElement> = {
    fire: 'fire', ice: 'ice', storm: 'lightning', lightning: 'lightning',
    earth: 'nature', water: 'ice', wind: 'arcane',
    shadow: 'shadow', void: 'shadow', light: 'arcane', radiance: 'arcane',
    twilight: 'shadow', eclipse: 'shadow',
    blood: 'shadow', bone: 'shadow', death: 'shadow', life: 'nature',
    spirit: 'nature', soul: 'arcane',
    nature: 'nature', beast: 'nature', flora: 'nature', fungal: 'nature',
    venom: 'nature', coral: 'nature',
    iron: 'none', crystal: 'arcane', obsidian: 'none', gold: 'none',
    jade: 'nature', amber: 'nature',
    time: 'arcane', fate: 'arcane', chaos: 'shadow', order: 'arcane',
    dream: 'arcane', memory: 'arcane', rage: 'fire', song: 'nature',
  }
  return mapping[modifier] ?? 'none'
}

/**
 * Effect templates for each style category. Each template is a list of
 * effect-building functions that produce valid SpellEffect arrays.
 */
type EffectTemplate = {
  effects: (element: SpellElement) => SpellEffect[]
  target: 'enemy' | 'self'
  manaCost: number
  cooldown: number
}

const EFFECT_TEMPLATES: Record<string, EffectTemplate[]> = {
  martial: [
    {
      effects: (el) => [
        { type: 'damage', value: 10, element: el },
        { type: 'buff', value: 3, stat: 'attack', duration: 2 },
      ],
      target: 'enemy', manaCost: 6, cooldown: 2,
    },
    {
      effects: (el) => [
        { type: 'damage', value: 12, element: el },
        { type: 'stun', value: 1 },
      ],
      target: 'enemy', manaCost: 7, cooldown: 3,
    },
    {
      effects: () => [
        { type: 'shield', value: 12 },
        { type: 'buff', value: 3, stat: 'defense', duration: 2 },
      ],
      target: 'self', manaCost: 5, cooldown: 3,
    },
  ],
  arcane: [
    {
      effects: (el) => [
        { type: 'damage', value: 11, element: el },
        { type: 'damage_over_time', value: 3, element: el, duration: 3 },
      ],
      target: 'enemy', manaCost: 6, cooldown: 2,
    },
    {
      effects: (el) => [
        { type: 'damage', value: 10, element: el },
        { type: 'shield', value: 8 },
      ],
      target: 'enemy', manaCost: 7, cooldown: 2,
    },
    {
      effects: (el) => [
        { type: 'damage', value: 10, element: el },
        { type: 'debuff', value: 2, stat: 'attack', duration: 2 },
      ],
      target: 'enemy', manaCost: 5, cooldown: 1,
    },
  ],
  divine: [
    {
      effects: () => [
        { type: 'heal', value: 8 },
        { type: 'buff', value: 3, stat: 'defense', duration: 2 },
      ],
      target: 'self', manaCost: 6, cooldown: 3,
    },
    {
      effects: () => [
        { type: 'shield', value: 10 },
        { type: 'heal', value: 5 },
      ],
      target: 'self', manaCost: 6, cooldown: 3,
    },
    {
      effects: (el) => [
        { type: 'debuff', value: 3, stat: 'attack', duration: 2 },
        { type: 'damage', value: 6, element: el },
      ],
      target: 'enemy', manaCost: 7, cooldown: 3,
    },
  ],
  primal: [
    {
      effects: (el) => [
        { type: 'damage', value: 9, element: el },
        { type: 'apply_poison', value: 3, duration: 3 },
      ],
      target: 'enemy', manaCost: 5, cooldown: 2,
    },
    {
      effects: (el) => [
        { type: 'damage', value: 9, element: el },
        { type: 'combo_boost', value: 1 },
      ],
      target: 'enemy', manaCost: 5, cooldown: 2,
    },
    {
      effects: (el) => [
        { type: 'damage', value: 5, element: el },
        { type: 'damage_over_time', value: 4, element: el, duration: 3 },
      ],
      target: 'enemy', manaCost: 6, cooldown: 3,
    },
  ],
  shadow: [
    {
      effects: (el) => [
        { type: 'damage', value: 10, element: el },
        { type: 'debuff', value: 2, stat: 'defense', duration: 2 },
      ],
      target: 'enemy', manaCost: 6, cooldown: 2,
    },
    {
      effects: (el) => [
        { type: 'damage', value: 9, element: el },
        { type: 'apply_slow', value: 1, duration: 2 },
      ],
      target: 'enemy', manaCost: 5, cooldown: 2,
    },
    {
      effects: (el) => [
        { type: 'damage', value: 9, element: el },
        { type: 'combo_boost', value: 2 },
      ],
      target: 'enemy', manaCost: 5, cooldown: 2,
    },
  ],
  psionic: [
    {
      effects: (el) => [
        { type: 'debuff', value: 3, stat: 'attack', duration: 2 },
        { type: 'shield', value: 8 },
      ],
      target: 'enemy', manaCost: 7, cooldown: 3,
    },
    {
      effects: (el) => [
        { type: 'stun', value: 1 },
        { type: 'damage', value: 10, element: el },
      ],
      target: 'enemy', manaCost: 7, cooldown: 3,
    },
    {
      effects: () => [
        { type: 'buff', value: 5, stat: 'attack', duration: 3 },
        { type: 'damage', value: 3 },
      ],
      target: 'self', manaCost: 4, cooldown: 2,
    },
  ],
}

/**
 * Generate a starting ability's mechanical data from style, modifier, and school.
 * Picks a random effect template for the style category.
 */
export function generateStartingAbility(
  style: string,
  modifier: string,
  school: SpellSchool
): Omit<GeneratedClassStartingAbility, 'name' | 'description'> {
  const category = getStyleCategory(style)
  const element = getElementForModifier(modifier)
  const templates = EFFECT_TEMPLATES[category] ?? EFFECT_TEMPLATES.martial
  const template = templates[Math.floor(Math.random() * templates.length)]
  const effects = template.effects(element)

  return {
    manaCost: template.manaCost,
    cooldown: template.cooldown,
    target: template.target,
    effects,
    tags: [school, modifier, template.target === 'self' ? 'defense' : 'offense'],
  }
}

/**
 * Generate stat distribution based on style category.
 * Total always sums to 18, each stat between 3 and 10.
 */
export function generateStatDistribution(style: string): {
  strength: number
  intelligence: number
  luck: number
} {
  const category = getStyleCategory(style)
  // Base distributions per category with small random variance
  const bases: Record<string, [number, number, number]> = {
    martial:  [8, 4, 6],
    arcane:   [3, 9, 6],
    divine:   [5, 7, 6],
    primal:   [7, 4, 7],
    shadow:   [5, 4, 9],
    psionic:  [3, 8, 7],
  }
  const [str, int, lck] = bases[category] ?? bases.martial

  // Add small random variance (-1 to +1) while keeping total at 18 and within bounds
  const variance = Math.floor(Math.random() * 3) - 1 // -1, 0, or 1
  let strength = Math.max(3, Math.min(10, str + variance))
  let intelligence = Math.max(3, Math.min(10, int - variance))
  let luck = 18 - strength - intelligence
  luck = Math.max(3, Math.min(10, luck))
  // Re-adjust if luck clamping changed the total
  const remaining = 18 - strength - luck
  intelligence = Math.max(3, Math.min(10, remaining))

  return { strength, intelligence, luck }
}

/**
 * Generate mana multiplier and spell slots from style category.
 */
export function generateManaAndSlots(style: string): {
  manaMultiplier: number
  spellSlots: number
} {
  const category = getStyleCategory(style)
  const config: Record<string, { mana: number; slots: number }> = {
    martial:  { mana: 0.6, slots: 2 },
    arcane:   { mana: 1.3, slots: 5 },
    divine:   { mana: 1.1, slots: 4 },
    primal:   { mana: 0.8, slots: 3 },
    shadow:   { mana: 0.8, slots: 3 },
    psionic:  { mana: 1.2, slots: 5 },
  }
  const { mana, slots } = config[category] ?? config.martial
  // Small random variance
  const manaVariance = (Math.random() * 0.2 - 0.1) // -0.1 to +0.1
  const slotVariance = Math.random() > 0.5 ? 1 : 0
  return {
    manaMultiplier: Math.round(Math.max(0.5, Math.min(1.5, mana + manaVariance)) * 10) / 10,
    spellSlots: Math.max(2, Math.min(6, slots + slotVariance)),
  }
}

/**
 * Format effects into a human-readable string for the LLM prompt.
 */
function describeEffects(effects: SpellEffect[]): string {
  return effects.map(e => {
    const parts = [e.type]
    if (e.value) parts.push(`value: ${e.value}`)
    if (e.element) parts.push(`element: ${e.element}`)
    if (e.stat) parts.push(`stat: ${e.stat}`)
    if (e.duration) parts.push(`duration: ${e.duration} turns`)
    return parts.join(', ')
  }).join('; ')
}

const classNamingFunctions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'return_classes',
      description: 'Return creative names and descriptions for 5 pre-built character classes',
      parameters: {
        type: 'object',
        properties: {
          classes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Creative display name, 2-3 words' },
                description: { type: 'string', description: '1-2 sentence flavor text that matches the actual mechanics' },
                abilityName: { type: 'string', description: 'Creative name for the starting ability' },
                abilityDescription: { type: 'string', description: 'Short description of the ability that accurately reflects its effects' },
              },
              required: ['name', 'description', 'abilityName', 'abilityDescription'],
            },
            minItems: 5,
            maxItems: 5,
          },
        },
        required: ['classes'],
      },
    },
  },
]

/**
 * Call OpenAI to generate 5 classes from a seed combo, then pick 1 randomly.
 * Mechanical effects are built programmatically first; the LLM only provides
 * creative names and descriptions that match the pre-built effects.
 */
export async function generateClassFromSeed(
  style: string,
  modifier: string
): Promise<GeneratedClass> {
  const openai = new OpenAI()
  const school = getSchoolForModifier(modifier)

  // Step 1: Build 5 classes mechanically
  const mechanicalClasses = Array.from({ length: 5 }, () => {
    const stats = generateStatDistribution(style)
    const { manaMultiplier, spellSlots } = generateManaAndSlots(style)
    const ability = generateStartingAbility(style, modifier, school)
    return { stats, manaMultiplier, spellSlots, ability }
  })

  // Step 2: Ask LLM only for creative names/descriptions
  const classDescriptions = mechanicalClasses.map((cls, i) => {
    return `Class ${i + 1}:
- Combat style: ${style}, Modifier: ${modifier}
- Stats: STR ${cls.stats.strength}, INT ${cls.stats.intelligence}, LCK ${cls.stats.luck}
- Spell school: ${school}
- Starting ability target: ${cls.ability.target}
- Starting ability effects: ${describeEffects(cls.ability.effects)}`
  }).join('\n\n')

  const prompt = `Given these 5 fantasy character classes with pre-built mechanics, generate a creative name for each class and a 1-2 sentence description.
Also name each starting ability and describe what it does.

DO NOT invent new mechanics. Each description must accurately reflect the effects listed.

${classDescriptions}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    tools: classNamingFunctions,
    tool_choice: { type: 'function', function: { name: 'return_classes' } },
    temperature: 1.0,
  })

  const toolCall = response.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall?.function?.arguments) {
    throw new Error('No function call in LLM response')
  }

  const parsed = JSON.parse(toolCall.function.arguments)
  const namedClasses = parsed.classes as {
    name: string
    description: string
    abilityName: string
    abilityDescription: string
  }[]

  // Step 3: Combine mechanical data with LLM-generated names
  const classes: GeneratedClass[] = namedClasses.map((named, i) => {
    const mech = mechanicalClasses[i]
    const id = named.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return {
      id,
      name: named.name,
      description: named.description,
      combatStyle: style,
      modifier: modifier,
      statDistribution: mech.stats,
      favoredSchool: school,
      manaMultiplier: mech.manaMultiplier,
      spellSlots: mech.spellSlots,
      startingAbility: {
        name: named.abilityName,
        description: named.abilityDescription,
        ...mech.ability,
      },
    }
  })

  // Pick 1 random class from the 5
  const randomIndex = Math.floor(Math.random() * classes.length)
  return classes[randomIndex]
}

/**
 * Pick a random fallback class, optionally excluding certain IDs.
 */
export function pickRandomFallback(excludeIds: Set<string> = new Set()): GeneratedClass {
  const available = FALLBACK_CLASSES.filter(c => !excludeIds.has(c.id))
  if (available.length === 0) {
    // If all are excluded (shouldn't happen with 17 fallbacks and 4 picks), return any
    return FALLBACK_CLASSES[Math.floor(Math.random() * FALLBACK_CLASSES.length)]
  }
  return available[Math.floor(Math.random() * available.length)]
}
