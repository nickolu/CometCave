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
  }),
});

const eventSchema = z.object({
  id: z.string(),
  description: z.string(),
  options: z.array(eventOptionSchema).min(2),
});

const eventsArraySchema = z.array(eventSchema).length(3);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildPrompt(character: FantasyCharacter, context: string) {
  return `You are an event generator for a fantasy adventure game. Given the character and story context, generate 3 distinct event objects. Each event should have:
  - id: unique string
  - description: a short narrative of the event
  - options: 2-4 choices, each with:
      - id: unique string
      - text: option text
      - probability: likelihood (0-1) of success
      - outcome: description and possible goldDelta, reputationDelta, statusChange

Respond ONLY with a JSON array of 3 events in this schema. No extra text.

Character:
${JSON.stringify(character, null, 2)}

Context:
${context}`;
}

export async function generateLLMEvents(character: FantasyCharacter, context: string): Promise<LLMGeneratedEvent[]> {
  const prompt = buildPrompt(character, context);
  try {
    const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: prompt }],
  temperature: 0.7,
  max_tokens: 1200,
  response_format: { type: "json_object" },
});
const raw = response.choices[0]?.message?.content?.trim();
if (!raw) throw new Error("No content from LLM");
const parsed = JSON.parse(raw);
const events = eventsArraySchema.parse(parsed);
return events;
  } catch (err) {
    console.error("LLM event generation failed", err);
    // Fallback: return a simple default event
    return [
      {
        id: "default-1",
        description: "You encounter a fork in the road.",
        options: [
          {
            id: "left",
            text: "Take the left path",
            probability: 0.5,
            outcome: {
              description: "You find a pouch of gold.",
              goldDelta: 10,
            },
          },
          {
            id: "right",
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
        id: "default-2",
        description: "A merchant offers you a mysterious potion.",
        options: [
          {
            id: "accept",
            text: "Buy the potion",
            probability: 0.7,
            outcome: {
              description: "The potion boosts your reputation!",
              reputationDelta: 5,
            },
          },
          {
            id: "decline",
            text: "Refuse the offer",
            probability: 0.3,
            outcome: {
              description: "The merchant shrugs and leaves.",
            },
          },
        ],
      },
      {
        id: "default-3",
        description: "You find a wounded animal on the road.",
        options: [
          {
            id: "help",
            text: "Help the animal",
            probability: 0.8,
            outcome: {
              description: "The animal recovers and you gain reputation.",
              reputationDelta: 3,
            },
          },
          {
            id: "ignore",
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
