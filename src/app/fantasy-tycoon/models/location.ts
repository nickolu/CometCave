import { z } from "zod";

/** All schemas in this file are the single source of truth for both runtime validation and static typing. */

export const FantasyLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  region: z.string(),
  dangerLevel: z.number(), // 0-10
  connectedLocationIds: z.array(z.string()),
  npcs: z.array(z.string()), // FantasyNPC ids
});
export type FantasyLocation = z.infer<typeof FantasyLocationSchema>;

export const FantasyLocationChoiceSchema = z.object({
  locationId: z.string(),
  label: z.string(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
});
export type FantasyLocationChoice = z.infer<typeof FantasyLocationChoiceSchema>;
