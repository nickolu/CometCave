import { z } from 'zod'

import { ItemSchema } from './item'

export const TimedQuestSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['active', 'completed', 'failed']),
  type: z.enum(['reach_distance', 'collect_gold', 'win_combat', 'gain_reputation']),
  // Target value to reach
  target: z.number(),
  // Starting value when quest was accepted
  startValue: z.number(),
  // Day deadline (quest fails if current day exceeds this)
  deadlineDay: z.number(),
  // Day quest was accepted
  startDay: z.number(),
  // Rewards
  rewards: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    items: z.array(ItemSchema).optional(),
  }),
})
export type TimedQuest = z.infer<typeof TimedQuestSchema>
