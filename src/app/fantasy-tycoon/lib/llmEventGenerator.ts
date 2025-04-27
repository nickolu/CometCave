import { OpenAI } from "openai";
import { z } from "zod";
import { FantasyCharacter } from "../models/character";

export interface LLMEventOption {
  id: string;
  text: string;
  probability: number; // 0-1
  outcome: {
    description: string;
    goldDelta?: number;
    reputationDelta?: number;
    statusChange?: string;
    rewardItems?: { id: string; qty: number }[];
  };
}

export interface LLMGeneratedEvent {
  id: string;
  description: string;
  options: LLMEventOption[];
}

const eventOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  probability: z.number().min(0).max(1),
  outcome: z.object({
    description: z.string(),
    goldDelta: z.number().optional(),
    reputationDelta: z.number().optional(),
    statusChange: z.string().optional(),
    rewardItems: z.array(z.object({
      id: z.string(),
      qty: z.number().int().min(1)
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



export async function generateLLMEvents(character: FantasyCharacter, context: string): Promise<LLMGeneratedEvent[]> {
  // Function calling schema for event generation
  const eventOptionSchemaForOpenAI = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      text: { type: 'string' },
      probability: { type: 'number', minimum: 0, maximum: 1 },
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
                qty: { type: 'number', minimum: 1 }
              },
              required: ['id', 'qty']
            },
            description: 'Array of item rewards (id and qty)'
          },
        },
      },
    },
    required: ['id', 'text', 'probability', 'outcome'],
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
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Generate 3 fantasy adventure event objects for the following character and context. Each event must match the following JSON schema and be part of a JSON array. Do not return any extra text.\n\nCharacter:\n${JSON.stringify(character, null, 2)}\n\nContext:\n${context}`,
        },
      ],
      tools: [
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
      ],
      tool_choice: { type: 'function', function: { name: 'generate_events' } },
      temperature: 0.7,
      max_tokens: 1200,
    });
    // Parse tool calls response
    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.name === 'generate_events') {
      const toolArgs = JSON.parse(toolCall.function.arguments);
      const events = eventsArraySchema.parse(toolArgs.events);
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
    // fallback to legacy parsing if tool call missing
    const raw = response.choices[0]?.message?.content?.trim();
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

  } catch (err) {
    console.error("LLM event generation failed", err);
    // Fallback: return a simple default event
    const uniqueSuffix = `fallback-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    return [
      {
        id: `default-1-${uniqueSuffix}`,
        description: "You encounter a fork in the road.",
        options: [
          {
            id: `left-1-${uniqueSuffix}`,
            text: "Take the left path",
            probability: 0.5,
            outcome: {
              description: "You find a pouch of gold.",
              goldDelta: 10,
            },
          },
          {
            id: `right-1-${uniqueSuffix}`,
            text: "Take the right path",
            probability: 0.5,
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
            probability: 0.7,
            outcome: {
              description: "The potion boosts your reputation!",
              reputationDelta: 5,
            },
          },
          {
            id: `decline-2-${uniqueSuffix}`,
            text: "Refuse the offer",
            probability: 0.3,
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
            probability: 0.8,
            outcome: {
              description: "The animal recovers and you gain reputation.",
              reputationDelta: 3,
            },
          },
          {
            id: `ignore-3-${uniqueSuffix}`,
            text: "Ignore it",
            probability: 0.2,
            outcome: {
              description: "You walk on, feeling a bit guilty.",
            },
          },
        ],
      },
    ];
  }
}
