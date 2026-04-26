import { z } from 'zod'

export const RunHistoryEntrySchema = z.object({
  id: z.string(),
  characterName: z.string(),
  characterClass: z.string(),
  level: z.number(),
  distance: z.number(),
  gold: z.number(),
  reputation: z.number(),
  regionsConquered: z.number(),
  reason: z.enum(['death', 'permadeath', 'retirement', 'victory']),
  essenceEarned: z.number(),
  endedAt: z.string(),
  difficultyMode: z.string().optional(),
})

export type RunHistoryEntry = z.infer<typeof RunHistoryEntrySchema>
