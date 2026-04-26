import { z } from 'zod'
import { ItemSchema } from './item'
import { GeneratedClassSchema } from '../models/generatedClass'

export const PartyMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  customName: z.string().optional(),
  description: z.string(),
  icon: z.string(),

  // Class info
  className: z.string(),
  generatedClass: GeneratedClassSchema.optional(),

  // Combat stats
  level: z.number().default(1),
  hp: z.number(),
  maxHp: z.number(),
  stats: z.object({
    strength: z.number(),
    intelligence: z.number(),
    luck: z.number(),
    charisma: z.number(),
  }),

  // Equipment (same slot structure as player)
  equipment: z.object({
    weapon: ItemSchema.nullable().default(null),
    armor: ItemSchema.nullable().default(null),
    accessory: ItemSchema.nullable().default(null),
  }).default({ weapon: null, armor: null, accessory: null }),

  // Economy
  dailyCost: z.number().default(0),
  recruitCost: z.number().default(0),
  rarity: z.enum(['common', 'uncommon', 'rare', 'legendary']),

  // Social
  personality: z.string().optional(),
  relationship: z.number().default(0),

  // Role
  role: z.enum(['combatant', 'non-combatant']).default('combatant'),
})

export type PartyMember = z.infer<typeof PartyMemberSchema>

export const MAX_PARTY_SIZE = 3
