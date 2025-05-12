import { z } from 'zod';
import { ItemSchema } from './item';

/** All schemas in this file are the single source of truth for both runtime validation and static typing. */

const ResourceDeltaSchema = z.object({
  gold: z.number().optional(),
  reputation: z.number().optional(),
  distance: z.number().optional(),
  statusChange: z.string().optional(),
  rewardItems: z.array(ItemSchema).optional(),
});

export type FantasyStoryEvent = z.infer<typeof FantasyStoryEventSchema>;

const EffectsSchema = z.object({
  gold: z.number().optional(),
  reputation: z.number().optional(),
  distance: z.number().optional(),
  statusChange: z.string().optional(),
  rewardItems: z.array(ItemSchema).optional(),
});

export const FantasyDecisionOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  successProbability: z.number().optional(),
  relevantAttributes: z.array(z.enum(['strength', 'intelligence', 'luck'])).optional(),
  attributeModifiers: z.record(z.enum(['strength', 'intelligence', 'luck']), z.number()).optional(),
  successDescription: z.string().optional(),
  successEffects: EffectsSchema.optional(),
  failureDescription: z.string().optional(),
  failureEffects: EffectsSchema.optional(),
  resultDescription: z.string().optional(),
  effects: EffectsSchema.optional(),
  rewardItems: z.array(ItemSchema).optional(),
});
export type FantasyDecisionOption = z.infer<typeof FantasyDecisionOptionSchema>;

export const FantasyDecisionPointSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  prompt: z.string(),
  options: z.array(FantasyDecisionOptionSchema),
  resolved: z.boolean(),
  chosenOptionId: z.string().optional(),
});
export type FantasyDecisionPoint = z.infer<typeof FantasyDecisionPointSchema>;

export const FantasyStoryEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  characterId: z.string(),
  locationId: z.string(),
  questId: z.string().optional(),
  timestamp: z.string(),
  selectedOptionId: z.string().optional(),
  selectedOptionText: z.string().optional(),
  outcomeDescription: z.string().optional(),
  resourceDelta: ResourceDeltaSchema.optional(),
  rewardItems: z.array(ItemSchema).optional(),
  decisionPoint: FantasyDecisionPointSchema.optional(),
});
