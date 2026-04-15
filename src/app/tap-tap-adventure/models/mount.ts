import { z } from 'zod'

export const MountBonusesSchema = z.object({
  strength: z.number().optional(),
  intelligence: z.number().optional(),
  luck: z.number().optional(),
  autoWalkSpeed: z.number().optional(),
  healRate: z.number().optional(),
})

export type MountBonuses = z.infer<typeof MountBonusesSchema>

export const MountRaritySchema = z.enum(['common', 'uncommon', 'rare', 'legendary'])
export type MountRarity = z.infer<typeof MountRaritySchema>

export const MountPersonalitySchema = z.enum([
  'loyal', 'skittish', 'aggressive', 'cautious', 'prideful',
  'wild', 'gentle', 'fierce', 'stubborn', 'greedy',
])
export type MountPersonality = z.infer<typeof MountPersonalitySchema>

export const MountSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  rarity: MountRaritySchema,
  bonuses: MountBonusesSchema,
  icon: z.string(),
  dailyCost: z.number(),
  customName: z.string().optional(),
  personality: MountPersonalitySchema.optional(),
})

export type Mount = z.infer<typeof MountSchema>
