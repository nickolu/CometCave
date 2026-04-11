import { OpenAI } from 'openai'

import { FALLBACK_CLASSES } from '@/app/tap-tap-adventure/config/fallbackClasses'
import { GeneratedClass } from '@/app/tap-tap-adventure/models/generatedClass'
import { SpellSchool } from '@/app/tap-tap-adventure/models/spell'

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

const CLASS_GENERATION_PROMPT = `Generate 5 unique fantasy character classes based on the seed: [STYLE] + [MODIFIER].

Each class must have:
- A creative, thematic name (2-3 words)
- A 1-2 sentence description
- Stat distribution (strength, intelligence, luck) totaling 18, each between 3 and 10
- A favored spell school (arcane/nature/shadow/war)
- Mana multiplier (0.5-1.5, higher for caster types)
- Spell slots (2-6, more for caster types)
- A starting ability with effects using these types: damage, heal, buff, debuff, shield, damage_over_time, stun, combo_boost

The [STYLE] determines the combat feel:
- martial/berserker/duelist/guardian/monk: physical fighters, melee, high strength
- arcane/elementalist/enchanter/summoner/ritualist: spellcasters, ranged, high intelligence
- divine/shaman/oracle/mystic/zealot: spiritual, support/healing, balanced stats
- primal/feral/druid/beastmaster/nomad: wild, nature-connected, strength + luck
- shadow/assassin/trickster/phantom/spy: stealth, precision, high luck
- psionic/telepath/dreamwalker/illusionist/savant: mental powers, intelligence + luck

The [MODIFIER] adds elemental/thematic flavor and determines the starting ability's element. Be creative — combine the style and modifier into something unique and evocative.`

const classGenerationFunctions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'return_classes',
      description: 'Return 5 generated character classes',
      parameters: {
        type: 'object',
        properties: {
          classes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'kebab-case identifier, e.g. "frost-weaver"' },
                name: { type: 'string', description: 'Display name, 2-3 words' },
                description: { type: 'string', description: '1-2 sentence flavor text' },
                statDistribution: {
                  type: 'object',
                  properties: {
                    strength: { type: 'number', minimum: 3, maximum: 10 },
                    intelligence: { type: 'number', minimum: 3, maximum: 10 },
                    luck: { type: 'number', minimum: 3, maximum: 10 },
                  },
                  required: ['strength', 'intelligence', 'luck'],
                },
                favoredSchool: { type: 'string', enum: ['arcane', 'nature', 'shadow', 'war'] },
                manaMultiplier: { type: 'number', minimum: 0.5, maximum: 1.5 },
                spellSlots: { type: 'number', minimum: 2, maximum: 6 },
                startingAbility: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    manaCost: { type: 'number' },
                    cooldown: { type: 'number' },
                    target: { type: 'string', enum: ['enemy', 'self'] },
                    effects: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            enum: ['damage', 'heal', 'buff', 'debuff', 'shield', 'damage_over_time', 'stun', 'combo_boost'],
                          },
                          value: { type: 'number' },
                          element: { type: 'string', enum: ['fire', 'ice', 'lightning', 'shadow', 'nature', 'arcane', 'none'] },
                          stat: { type: 'string' },
                          duration: { type: 'number' },
                          percentage: { type: 'number' },
                        },
                        required: ['type', 'value'],
                      },
                    },
                    tags: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['name', 'description', 'manaCost', 'cooldown', 'target', 'effects', 'tags'],
                },
              },
              required: ['id', 'name', 'description', 'statDistribution', 'favoredSchool', 'manaMultiplier', 'spellSlots', 'startingAbility'],
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
 */
export async function generateClassFromSeed(
  style: string,
  modifier: string
): Promise<GeneratedClass> {
  const openai = new OpenAI()

  const prompt = CLASS_GENERATION_PROMPT
    .replace('[STYLE]', style)
    .replace('[MODIFIER]', modifier)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    tools: classGenerationFunctions,
    tool_choice: { type: 'function', function: { name: 'return_classes' } },
    temperature: 1.0,
  })

  const toolCall = response.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall?.function?.arguments) {
    throw new Error('No function call in LLM response')
  }

  const parsed = JSON.parse(toolCall.function.arguments)
  const classes: GeneratedClass[] = parsed.classes.map((cls: Record<string, unknown>) => ({
    ...cls,
    combatStyle: style,
    modifier: modifier,
  }))

  // Validate and fix stat totals
  for (const cls of classes) {
    const total = cls.statDistribution.strength + cls.statDistribution.intelligence + cls.statDistribution.luck
    if (total !== 18) {
      // Adjust intelligence to make total 18
      cls.statDistribution.intelligence = Math.max(3, Math.min(10, 18 - cls.statDistribution.strength - cls.statDistribution.luck))
      const remaining = 18 - cls.statDistribution.strength - cls.statDistribution.intelligence
      cls.statDistribution.luck = Math.max(3, Math.min(10, remaining))
    }
  }

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
