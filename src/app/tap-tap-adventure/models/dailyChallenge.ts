import { z } from 'zod'

export const DailyChallengeTypeSchema = z.enum([
  'travel_distance',
  'earn_gold',
  'win_combats',
  'gain_reputation',
  'craft_item',
])
export type DailyChallengeType = z.infer<typeof DailyChallengeTypeSchema>

export const DailyChallengeSchema = z.object({
  id: z.string(), // e.g. "2026-04-17-0"
  type: DailyChallengeTypeSchema,
  description: z.string(),
  target: z.number(),
  progress: z.number(),
  completed: z.boolean(),
  reward: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
  }),
})
export type DailyChallenge = z.infer<typeof DailyChallengeSchema>

export const DailyChallengesStateSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  challenges: z.array(DailyChallengeSchema), // always 3
  allCompletedClaimed: z.boolean(),
  streak: z.number(),
})
export type DailyChallengesState = z.infer<typeof DailyChallengesStateSchema>
