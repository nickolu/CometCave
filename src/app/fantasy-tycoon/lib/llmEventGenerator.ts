import { OpenAI } from "openai";
import { z } from "zod";
import { FantasyCharacter } from "../models/character";
import { Item } from "../models/item";
import { ToolCall } from "openai/resources/beta/threads/runs/steps.mjs";

// Process reward items to ensure they have required name and description
const processFallbackRewardItems = (items?: { id: string; name?: string; description?: string; quantity: number }[]): Item[] | undefined =>
  items?.map(item => ({
    id: item.id,
    quantity: item.quantity,
    name: item.name || 'Unknown Item',
    description: item.description || 'No description available',
  })) || [];

  type Outcome = {
    description: string;
    goldDelta?: number;
    reputationDelta?: number;
    statusChange?: string;
    rewardItems?: Item[];
  };

export interface LLMEventOption {
  id: string;
  text: string;
  successProbability: number; // 0-1
  outcome: Outcome;
}

export interface LLMGeneratedEvent {
  id: string;
  description: string;
  options: LLMEventOption[];
}

const eventOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  successProbability: z.number().min(0).max(1),
  outcome: z.object({
    description: z.string(),
    goldDelta: z.number().optional(),
    reputationDelta: z.number().optional(),
    statusChange: z.string().optional(),
    rewardItems: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      quantity: z.number(),
    })).optional(),
  }),
});

const eventSchema = z.object({
  id: z.string(),
  description: z.string(),
  options: z.array(eventOptionSchema).min(2),
});

const eventsArraySchema = z.array(eventSchema).length(3);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Function calling schema for event generation
const eventOptionSchemaForOpenAI = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    text: { type: 'string' },
    successProbability: { type: 'number', minimum: 0, maximum: 1 },
    outcome: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        goldDelta: { type: 'number' },
        reputationDelta: { type: 'number' },
        statusChange: { type: 'string' },
        rewardItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              quantity: { type: 'number', minimum: 1 },
              name: { type: 'string' },
              description: { type: 'string' }
            },
            required: ['id', 'quantity', 'name', 'description']
          },
          description: 'Array of item rewards (id, qty, name, description)'
        },
      },
    },
  },
  required: ['id', 'text', 'successProbability', 'outcome'],
  additionalProperties: false
};

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
};

const eventsArraySchemaForOpenAI = {
  type: 'array',
  items: eventSchemaForOpenAI,
  minItems: 3,
  maxItems: 3,
};


export async function generateLLMEvents(character: FantasyCharacter, context: string): Promise<LLMGeneratedEvent[]> {
  const { model, messages, tools, toolChoice, temperature, maxTokens } = getCompletionsConfig(character, context)
  try {
    const response = await openai.chat.completions.create({
      model,
      messages,
      tools,
      temperature,
      tool_choice: toolChoice,
      max_tokens: maxTokens,
    });
    // Parse tool calls response
    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.name === 'generate_events') {
      console.log('[generateLLMEvents] using tool call to get events')
      return parseEventsFromToolCall(toolCall)
    }
    // fallback to legacy parsing if tool call missing
    console.log('[generateLLMEvents] no tool call, using legacy parsing')
    const raw = response.choices[0]?.message?.content?.trim();
    return parseRawEvents(raw);

  } catch (err) {
    console.error("LLM event generation failed", err);
    console.log("[generateLLMEvents] failed to get events from llm")
    return getDefaultEvents()
  }
}


function getCompletionsConfig (character: FantasyCharacter, context: string)  { 
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
  const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = { type: 'function', function: { name: 'generate_events' } }
  const temperature = 0.7;
  const maxTokens = 1200;

  return {
    model,
    messages, 
    tools,
    toolChoice,
    temperature,
    maxTokens
  }
}

function parseEventsFromToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall) { 
  const toolArgs = JSON.parse(toolCall.function.arguments);
  const events = eventsArraySchema.parse(toolArgs.events);
  // Ensure unique event ids
  const seenIds = new Set<string>();
  const uniqueEvents: LLMGeneratedEvent[] = events.map((event) => {
    let newId = event.id;
    if (seenIds.has(event.id)) {
      newId = `${event.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    seenIds.add(newId);
    
    // Ensure reward items have required name and description
    const processedOptions: LLMEventOption[] = event.options.map(option => ({
      ...option,
      outcome: {
        ...option.outcome,
        rewardItems: processFallbackRewardItems(option.outcome.rewardItems),
      },
    }));

    return { ...event, id: newId, options: processedOptions };
  });
  return uniqueEvents;
}

function getDefaultEvents() { 
  const uniqueSuffix = `fallback-${Date.now()}-${Math.floor(Math.random() * 10000)}`; 

  return [
    {
      id: `default-1-${uniqueSuffix}`,
      description: "You encounter a fork in the road.",
      options: [
        {
          id: `left-1-${uniqueSuffix}`,
          text: "Take the left path",
          successProbability: 0.5,
          outcome: {
            description: "You find a pouch of gold.",
            goldDelta: 10,
            rewardItems: processFallbackRewardItems([
              { id: 'gold-pouch', quantity: 1, name: 'Gold Pouch', description: 'A small leather pouch filled with gold coins' }
            ])
          },
        },
        {
          id: `right-1-${uniqueSuffix}`,
          text: "Take the right path",
          successProbability: 0.5,
          outcome: {
            description: "You are ambushed by bandits and lose reputation.",
            reputationDelta: -5,
          },
        },
      ],
    },
    {
      id: `default-2-${uniqueSuffix}`,
      description: "A merchant offers you a mysterious potion.",
      options: [
        {
          id: `accept-2-${uniqueSuffix}`,
          text: "Buy the potion",
          successProbability: 0.7,
          outcome: {
            description: "The potion boosts your reputation!",
            reputationDelta: 5,
            rewardItems: processFallbackRewardItems([
              { id: 'mysterious-potion', quantity: 1, name: 'Mysterious Potion', description: 'A swirling potion with unknown effects' }
            ])
          },
        },
        {
          id: `decline-2-${uniqueSuffix}`,
          text: "Refuse the offer",
          successProbability: 0.3,
          outcome: {
            description: "The merchant shrugs and leaves.",
          },
        },
      ],
    },
    {
      id: `default-3-${uniqueSuffix}`,
      description: "You find a wounded animal on the road.",
      options: [
        {
          id: `help-3-${uniqueSuffix}`,
          text: "Help the animal",
          successProbability: 0.8,
          outcome: {
            description: "The animal recovers and you gain reputation.",
            reputationDelta: 3,
          },
        },
        {
          id: `ignore-3-${uniqueSuffix}`,
          text: "Ignore it",
          successProbability: 0.2,
          outcome: {
            description: "You walk on, feeling a bit guilty.",
          },
        },
      ],
    },
  ];
}

  
function parseRawEvents(raw: any) { 
    if (!raw) throw new Error('No content from LLM');
    const parsed = JSON.parse(raw);
    let events;
    if (Array.isArray(parsed)) {
      events = eventsArraySchema.parse(parsed);
    } else if (parsed && Array.isArray(parsed.events)) {
      events = eventsArraySchema.parse(parsed.events);
    } else {
      throw new Error('LLM response is not an array or object with events array');
    }
    // Ensure unique event ids
    const seenIds = new Set<string>();
    const uniqueEvents = events.map((event) => {
      let newId = event.id;
      if (seenIds.has(event.id)) {
        newId = `${event.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      }
      seenIds.add(newId);
      return { ...event, id: newId };
    });
    return uniqueEvents;
}