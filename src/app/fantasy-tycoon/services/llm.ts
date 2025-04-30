import { z } from "zod";
import { FantasyCharacter } from "../models/character";
import { LLMGeneratedEvent } from "../lib/llmEventGenerator";

// --- Zod schemas copied from llmEventGenerator.ts for type safety ---
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
      quantity: z.number().int().min(1),
      name: z.string().optional(),
      description: z.string().optional(),
    })).optional(),
  }),
});

const eventSchema = z.object({
  id: z.string(),
  description: z.string(),
  options: z.array(eventOptionSchema).min(2),
});

const eventsArraySchema = z.array(eventSchema).length(3);

// --- buildPrompt ---
export function buildPrompt(input: FantasyCharacter, context: string): string {
  return `Generate 3 fantasy adventure event objects for the following character and context. Each event must match the following JSON schema and be part of a JSON array. Do not return any extra text.\n\nCharacter:\n${JSON.stringify(input, null, 2)}\n\nContext:\n${context}`;
}

// --- parseResponse ---
export function parseResponse(raw: string): LLMGeneratedEvent[] {
  if (!raw) throw new Error("No content from LLM");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse LLM response as JSON");
  }
  let events;
  if (Array.isArray(parsed)) {
    events = eventsArraySchema.parse(parsed);
  } else if (parsed && Array.isArray(parsed.events)) {
    events = eventsArraySchema.parse(parsed.events);
  } else {
    throw new Error("LLM response is not an array or object with events array");
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
