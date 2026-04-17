import { z } from 'zod'

export const MercenaryClassSchema = z.enum(['warrior', 'ranger', 'mage', 'rogue', 'cleric'])
export type MercenaryClass = z.infer<typeof MercenaryClassSchema>

export const MercenaryRaritySchema = z.enum(['common', 'uncommon', 'rare', 'legendary'])
export type MercenaryRarity = z.infer<typeof MercenaryRaritySchema>

export const MercenaryPersonalitySchema = z.enum([
  'brave', 'cautious', 'aggressive', 'loyal', 'cunning', 'reckless',
])
export type MercenaryPersonality = z.infer<typeof MercenaryPersonalitySchema>

export const MercenarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  class: MercenaryClassSchema,
  rarity: MercenaryRaritySchema,
  attack: z.number(),
  defense: z.number(),
  icon: z.string(),
  dailyCost: z.number(),
  recruitCost: z.number(),
  personality: MercenaryPersonalitySchema.optional(),
  hp: z.number().optional(),
  maxHp: z.number().optional(),
  customName: z.string().optional(),
})

export type Mercenary = z.infer<typeof MercenarySchema>
