import { OpenAI } from 'openai'
import { z } from 'zod'

import { FantasyCharacter } from '../models/character'
import { Item } from '../models/item'

const processFallbackRewardItems = (
  items?: { id: string; name?: string; description?: string; quantity: number }[]
): Item[] | undefined =>
  items?.map(item => ({
    id: item.id,
    quantity: item.quantity,
    name: item.name || 'Unknown Item',
    description: item.description || 'No description available',
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
}

export interface LLMGeneratedEvent {
  id: string
  description: string
  options: LLMEventOption[]
}

const eventOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  successProbability: z.number().min(0).max(1),
  successDescription: z.string(),
  successEffects: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    statusChange: z.string().optional(),
    rewardItems: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          quantity: z.number(),
        })
      )
      .optional(),
  }),
  failureDescription: z.string(),
  failureEffects: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    statusChange: z.string().optional(),
    rewardItems: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          quantity: z.number(),
        })
      )
      .optional(),
  }),
})

const eventSchema = z.object({
  id: z.string(),
  description: z.string(),
  options: z.array(eventOptionSchema).min(2),
})

const eventsArraySchema = z.array(eventSchema).length(3)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Function calling schema for event generation
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
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              quantity: { type: 'number', minimum: 1 },
              name: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['id', 'quantity', 'name', 'description'],
          },
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
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              quantity: { type: 'number', minimum: 1 },
              name: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['id', 'quantity', 'name', 'description'],
          },
        },
      },
    },
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
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: `Generate 3 fantasy adventure event objects for the following character and context. Each event must match the following JSON schema and be part of a JSON array. Do not return any extra text.\n\nCharacter:\n${JSON.stringify(character, null, 2)}\n\nContext:\n${context}`,
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

function getDefaultEvents() {
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
                description: 'A swirling potion with unknown effects',
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
      description: 'You find a wounded animal on the road.',
      options: [
        {
          id: `help-3-${uniqueSuffix}`,
          text: 'Help the animal',
          successProbability: 0.8,
          successDescription: 'The animal recovers and you gain reputation.',
          successEffects: {
            reputation: 3,
          },
          failureDescription: 'The animal was more dangerous than it appeared.',
          failureEffects: {
            gold: -5,
            reputation: -2,
          },
        },
        {
          id: `ignore-3-${uniqueSuffix}`,
          text: 'Ignore it',
          successProbability: 0.2,
          successDescription: 'You made the right choice - it was a trap!',
          successEffects: {
            gold: 5,
          },
          failureDescription: 'You walk on, feeling a bit guilty.',
          failureEffects: {
            reputation: -1,
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
