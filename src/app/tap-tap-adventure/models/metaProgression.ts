import { z } from 'zod'

/** All schemas in this file are the single source of truth for meta-progression types. */

export const EternalUpgradeEffectsSchema = z.object({
  bonusHp: z.number().optional(),
  bonusStrength: z.number().optional(),
  bonusIntelligence: z.number().optional(),
  bonusLuck: z.number().optional(),
  bonusGold: z.number().optional(),
  bonusMana: z.number().optional(),
  healRateMultiplier: z.number().optional(),
  xpMultiplier: z.number().optional(),
  shopDiscount: z.number().optional(),
  lootBonusChance: z.number().optional(),
})
export type EternalUpgradeEffects = z.infer<typeof EternalUpgradeEffectsSchema>

export const EternalUpgradeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  maxLevel: z.number(),
  costPerLevel: z.array(z.number()),
  effects: EternalUpgradeEffectsSchema,
})
export type EternalUpgrade = z.infer<typeof EternalUpgradeSchema>

export const MetaProgressionStateSchema = z.object({
  soulEssence: z.number(),
  totalEssenceEarned: z.number(),
  totalRuns: z.number(),
  bestDistance: z.number(),
  bestLevel: z.number(),
  upgradeLevels: z.record(z.string(), z.number()),
})
export type MetaProgressionState = z.infer<typeof MetaProgressionStateSchema>
