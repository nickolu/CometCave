import { z } from 'zod'

/** FantasyQuestSchema is the single source of truth for both runtime validation and static typing. */
export const FantasyQuestSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['available', 'active', 'completed', 'failed']),
  giverNpcId: z.string(),
  locationId: z.string(),
  objectives: z.array(z.string()),
  rewards: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    items: z.array(z.string()).optional(),
  }),
  expiration: z.string().optional(),
})

export type FantasyQuest = z.infer<typeof FantasyQuestSchema>
