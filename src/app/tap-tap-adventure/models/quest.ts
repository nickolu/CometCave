import { z } from 'zod'

import { ItemSchema } from './item'

export const TimedQuestSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['active', 'completed', 'failed']),
  type: z.enum(['reach_distance', 'collect_gold', 'win_combat', 'gain_reputation', 'explore_landmarks', 'survive_combats', 'reach_level', 'hoard_items', 'visit_region']),
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

export const MainQuestMilestoneSchema = z.object({
  regionsRequired: z.number(),
  title: z.string(),
  goldReward: z.number(),
  claimed: z.boolean(),
})
export type MainQuestMilestone = z.infer<typeof MainQuestMilestoneSchema>

export const MainQuestSchema = z.object({
  title: z.string(),
  description: z.string(),
  status: z.enum(['active', 'completed']),
  milestones: z.array(MainQuestMilestoneSchema),
})
export type MainQuest = z.infer<typeof MainQuestSchema>
