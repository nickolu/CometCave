import { OpenAI } from 'openai'
import { z } from 'zod'

import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { SpellSchema } from '@/app/tap-tap-adventure/models/spell'

import { getReputationTier } from './contextBuilder'
import { inferItemTypeAndEffects } from './itemPostProcessor'

const processFallbackRewardItems = (
  items?: { id: string; name?: string; description?: string; quantity: number; type?: string; effects?: Record<string, number> }[]
): Item[] | undefined =>
  items?.map(item => inferItemTypeAndEffects({
    id: item.id,
    quantity: item.quantity,
    name: item.name || 'Unknown Item',
    description: item.description || 'No description available',
    type: (item.type as Item['type']) || 'misc',
    effects: item.effects,
  })) || []

export interface LLMEventOption {
  id: string
  text: string
  successProbability: number
  successDescription: string
  successEffects: {
    gold?: number
    reputation?: number
    statusChange?: string
    rewardItems?: Item[]
  }
  failureDescription: string
  failureEffects: {
    gold?: number
    reputation?: number
    statusChange?: string
    rewardItems?: Item[]
  }
  triggersCombat?: boolean
}

export interface LLMGeneratedEvent {
  id: string
  description: string
  options: LLMEventOption[]
}

const rewardItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  quantity: z.number(),
  type: z.enum(['consumable', 'equipment', 'quest', 'misc', 'spell_scroll']).optional().default('misc'),
  effects: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    strength: z.number().optional(),
    intelligence: z.number().optional(),
    luck: z.number().optional(),
  }).optional(),
  spell: SpellSchema.optional(),
})

const eventOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  successProbability: z.number().min(0).max(1),
  successDescription: z.string(),
  successEffects: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    statusChange: z.string().optional(),
    rewardItems: z.array(rewardItemSchema).optional(),
  }),
  failureDescription: z.string(),
  failureEffects: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    statusChange: z.string().optional(),
    rewardItems: z.array(rewardItemSchema).optional(),
  }),
  triggersCombat: z.boolean().optional(),
})

const eventSchema = z.object({
  id: z.string(),
  description: z.string(),
  options: z.array(eventOptionSchema).min(2),
})

const eventsArraySchema = z.array(eventSchema).length(3)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Function calling schema for event generation
const spellEffectSchemaForOpenAI = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['damage', 'damage_over_time', 'true_damage', 'lifesteal', 'heal', 'heal_over_time', 'shield', 'damage_reduction', 'buff', 'debuff', 'stun', 'bleed', 'cleanse', 'mana_restore', 'combo_boost'] },
    value: { type: 'number' },
    element: { type: 'string', enum: ['fire', 'ice', 'lightning', 'shadow', 'nature', 'arcane', 'none'] },
    stat: { type: 'string' },
    duration: { type: 'number' },
    percentage: { type: 'number' },
  },
  required: ['type', 'value'],
}

const spellSchemaForOpenAI = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    school: { type: 'string', enum: ['arcane', 'nature', 'shadow', 'war'] },
    manaCost: { type: 'number' },
    cooldown: { type: 'number' },
    target: { type: 'string', enum: ['enemy', 'self'] },
    effects: { type: 'array', items: spellEffectSchemaForOpenAI },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'name', 'description', 'school', 'manaCost', 'cooldown', 'target', 'effects', 'tags'],
}

const rewardItemSchemaForOpenAI = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    quantity: { type: 'number', minimum: 1 },
    name: { type: 'string' },
    description: { type: 'string' },
    type: { type: 'string', enum: ['consumable', 'equipment', 'quest', 'misc', 'spell_scroll'] },
    effects: {
      type: 'object',
      properties: {
        gold: { type: 'number' },
        reputation: { type: 'number' },
        strength: { type: 'number' },
        intelligence: { type: 'number' },
        luck: { type: 'number' },
      },
    },
    spell: spellSchemaForOpenAI,
  },
  required: ['id', 'quantity', 'name', 'description'],
}

const eventOptionSchemaForOpenAI = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    text: { type: 'string' },
    successProbability: { type: 'number', minimum: 0, maximum: 1 },
    successDescription: { type: 'string' },
    successEffects: {
      type: 'object',
      properties: {
        gold: { type: 'number' },
        reputation: { type: 'number' },
        statusChange: { type: 'string' },
        rewardItems: {
          type: 'array',
          items: rewardItemSchemaForOpenAI,
        },
      },
    },
    failureDescription: { type: 'string' },
    failureEffects: {
      type: 'object',
      properties: {
        gold: { type: 'number' },
        reputation: { type: 'number' },
        statusChange: { type: 'string' },
        rewardItems: {
          type: 'array',
          items: rewardItemSchemaForOpenAI,
        },
      },
    },
    triggersCombat: { type: 'boolean', description: 'Set to true if this option leads to a fight' },
  },
  required: [
    'id',
    'text',
    'successProbability',
    'successDescription',
    'successEffects',
    'failureDescription',
    'failureEffects',
  ],
  additionalProperties: false,
}

const eventSchemaForOpenAI = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    description: { type: 'string' },
    options: {
      type: 'array',
      items: eventOptionSchemaForOpenAI,
      minItems: 2,
      maxItems: 4,
    },
  },
  required: ['id', 'description', 'options'],
  additionalProperties: false,
}

const eventsArraySchemaForOpenAI = {
  type: 'array',
  items: eventSchemaForOpenAI,
  minItems: 3,
  maxItems: 3,
}

export async function generateLLMEvents(
  character: FantasyCharacter,
  context: string
): Promise<LLMGeneratedEvent[]> {
  const { model, messages, tools, toolChoice, temperature, maxTokens } = getCompletionsConfig(
    character,
    context
  )
  try {
    const response = await openai.chat.completions.create({
      model,
      messages,
      tools,
      temperature,
      tool_choice: toolChoice,
      max_tokens: maxTokens,
    })
    // Parse tool calls response
    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (toolCall && toolCall.function?.name === 'generate_events') {
      return parseEventsFromToolCall(toolCall)
    }
    const raw = response.choices[0]?.message?.content?.trim()
    return parseRawEvents(raw)
  } catch (err) {
    console.error('LLM event generation failed', err)
    return getDefaultEvents()
  }
}

function getCompletionsConfig(character: FantasyCharacter, context: string) {
  const model = 'gpt-4o'
  const reputationTier = getReputationTier(character.reputation)

  let reputationGuidance = ''
  if (character.reputation >= 50) {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). NPCs should be friendly and welcoming. Offer better deals, share secrets, and present important quests. Some NPCs may recognize the character by name and ask for help with critical tasks.`
  } else if (character.reputation >= 20) {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). NPCs should be generally positive and willing to help. Fair deals and occasional bonus opportunities.`
  } else if (character.reputation >= 0) {
    reputationGuidance = `This character has an ${reputationTier} reputation (${character.reputation}). NPCs are neutral — standard interactions and pricing.`
  } else if (character.reputation >= -20) {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). NPCs should be suspicious and wary. Prices are higher, information is harder to obtain, and some may refuse to deal with the character.`
  } else {
    reputationGuidance = `This character has an ${reputationTier} reputation (${character.reputation}). NPCs are hostile or fearful. Bounty hunters or rival adventurers may appear. Prices are much higher. Very few friendly encounters — most NPCs want nothing to do with this character.`
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: `Generate 3 fantasy adventure events for this character. Reference their past adventures and current state when creating events. Events should feel like a continuation of their story, not random encounters.

IMPORTANT — Reputation guidance:
${reputationGuidance}
Tailor the tone, NPC attitudes, and available opportunities to reflect the character's reputation tier.

When rewarding items, sometimes include consumable items (type: "consumable") with effects like stat boosts or gold. Examples: potions that grant +2 strength, scrolls that grant +2 intelligence, lucky coins that grant +1 luck.
Sometimes include equipment items (type: "equipment") like weapons, armor, or accessories with stat-boosting effects. Examples: a steel sword with +2 strength, iron armor with +2 intelligence, or a lucky charm with +1 luck.
Sometimes reward spell scrolls — items with type "spell_scroll" containing a spell with a creative name, 2-3 effects, optional conditions, and tags. The spell field should have: id, name, description, school (arcane/nature/shadow/war), manaCost, cooldown, target (enemy/self), effects array, optional conditions array, and tags array.

IMPORTANT: About 1 in 3 events should involve a potential confrontation (bandits, monsters, rivals, etc.). For these events, include at least one option with "triggersCombat": true — this represents the character choosing to fight. Other options can be peaceful alternatives (negotiate, flee, pay a toll, sneak past). This gives the player agency over whether to fight.

Character:
${JSON.stringify(character, null, 2)}

Recent History & Context:
${context || 'No prior adventures yet — this is the beginning of their journey.'}`,
    },
  ]

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'generate_events',
        description: 'Generate 3 fantasy adventure event objects as an array.',
        parameters: {
          type: 'object',
          properties: {
            events: eventsArraySchemaForOpenAI,
          },
          required: ['events'],
        },
      },
    },
  ]
  const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = {
    type: 'function',
    function: { name: 'generate_events' },
  }
  const temperature = 0.7
  const maxTokens = 1200

  return {
    model,
    messages,
    tools,
    toolChoice,
    temperature,
    maxTokens,
  }
}

function parseEventsFromToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall) {
  const toolArgs = JSON.parse(toolCall.function.arguments)
  const events = eventsArraySchema.parse(toolArgs.events)
  // Ensure unique event ids
  const seenIds = new Set<string>()
  const uniqueEvents: LLMGeneratedEvent[] = events.map(event => {
    let newId = event.id
    if (seenIds.has(event.id)) {
      newId = `${event.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    }
    seenIds.add(newId)

    // Process options with the new structure
    const processedOptions: LLMEventOption[] = event.options.map(option => ({
      ...option,
      successEffects: {
        ...option.successEffects,
        rewardItems: processFallbackRewardItems(option.successEffects.rewardItems),
      },
      failureEffects: {
        ...option.failureEffects,
        rewardItems: processFallbackRewardItems(option.failureEffects.rewardItems),
      },
    }))

    return { ...event, id: newId, options: processedOptions }
  })
  return uniqueEvents
}

function getDefaultEvents(): LLMGeneratedEvent[] {
  const uniqueSuffix = `fallback-${Date.now()}-${Math.floor(Math.random() * 10000)}`

  return [
    {
      id: `default-1-${uniqueSuffix}`,
      description: 'You encounter a fork in the road.',
      options: [
        {
          id: `left-1-${uniqueSuffix}`,
          text: 'Take the left path',
          successProbability: 0.5,
          successDescription: 'You find a pouch of gold.',
          successEffects: {
            gold: 10,
            rewardItems: processFallbackRewardItems([
              {
                id: 'gold-pouch',
                quantity: 1,
                name: 'Gold Pouch',
                description: 'A small leather pouch filled with gold coins',
                type: 'consumable',
                effects: { gold: 15 },
              },
            ]),
          },
          failureDescription: 'You find nothing of value.',
          failureEffects: {
            gold: -5,
          },
        },
        {
          id: `right-1-${uniqueSuffix}`,
          text: 'Take the right path',
          successProbability: 0.5,
          successDescription: 'You discover a shortcut and gain reputation.',
          successEffects: {
            reputation: 5,
          },
          failureDescription: 'You are ambushed by bandits and lose reputation.',
          failureEffects: {
            reputation: -5,
          },
        },
      ],
    },
    {
      id: `default-2-${uniqueSuffix}`,
      description: 'A merchant offers you a mysterious potion.',
      options: [
        {
          id: `accept-2-${uniqueSuffix}`,
          text: 'Buy the potion',
          successProbability: 0.7,
          successDescription: 'The potion boosts your reputation!',
          successEffects: {
            reputation: 5,
            rewardItems: processFallbackRewardItems([
              {
                id: 'mysterious-potion',
                quantity: 1,
                name: 'Mysterious Potion',
                description: 'A swirling potion that boosts your abilities',
                type: 'consumable',
                effects: { strength: 1, intelligence: 1, luck: 1 },
              },
            ]),
          },
          failureDescription: 'The potion was a fake and you lost your gold.',
          failureEffects: {
            gold: -10,
          },
        },
        {
          id: `decline-2-${uniqueSuffix}`,
          text: 'Refuse the offer',
          successProbability: 0.3,
          successDescription: 'The merchant respects your caution and offers a small reward.',
          successEffects: {
            reputation: 2,
          },
          failureDescription: 'The merchant is offended by your refusal.',
          failureEffects: {
            reputation: -2,
          },
        },
      ],
    },
    {
      id: `default-3-${uniqueSuffix}`,
      description: 'A band of thieves blocks the road ahead, demanding you hand over your gold.',
      options: [
        {
          id: `fight-3-${uniqueSuffix}`,
          text: 'Draw your weapon and fight',
          triggersCombat: true,
          successProbability: 0.5,
          successDescription: 'You prepare for battle!',
          successEffects: {},
          failureDescription: 'You prepare for battle!',
          failureEffects: {},
        },
        {
          id: `pay-3-${uniqueSuffix}`,
          text: 'Pay the toll and pass safely',
          successProbability: 0.9,
          successDescription: 'You hand over some gold and the thieves let you pass.',
          successEffects: {
            gold: -10,
          },
          failureDescription: 'They take your gold and shove you aside.',
          failureEffects: {
            gold: -15,
            reputation: -2,
          },
        },
        {
          id: `sneak-3-${uniqueSuffix}`,
          text: 'Try to sneak around them',
          successProbability: 0.4,
          successDescription: 'You slip past unnoticed!',
          successEffects: {
            reputation: 1,
          },
          failureDescription: 'They spot you and take your gold by force.',
          failureEffects: {
            gold: -15,
            reputation: -3,
          },
        },
      ],
    },
  ]
}

function parseRawEvents(raw?: string) {
  if (!raw) throw new Error('No content from LLM')
  const parsed = JSON.parse(raw)
  let events
  if (Array.isArray(parsed)) {
    events = eventsArraySchema.parse(parsed)
  } else if (parsed && Array.isArray(parsed.events)) {
    events = eventsArraySchema.parse(parsed.events)
  } else {
    throw new Error('LLM response is not an array or object with events array')
  }
  // Ensure unique event ids
  const seenIds = new Set<string>()
  const uniqueEvents = events.map(event => {
    let newId = event.id
    if (seenIds.has(event.id)) {
      newId = `${event.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    }
    seenIds.add(newId)
    return { ...event, id: newId }
  })
  return uniqueEvents
}
