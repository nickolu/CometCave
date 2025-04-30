import { z } from "zod";

/** FantasyPlayerSchema is the single source of truth for both runtime validation and static typing. */
export const FantasyPlayerSchema = z.object({
  id: z.string(),
  username: z.string(),
  createdAt: z.string(),
  lastActive: z.string(),
  characters: z.array(z.string()), // FantasyCharacter ids
  gold: z.number(),
  reputation: z.number(),
  distance: z.number(),
  currentCharacterId: z.string().optional(),
});

export type FantasyPlayer = z.infer<typeof FantasyPlayerSchema>;
