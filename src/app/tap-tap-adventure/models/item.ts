import { z } from 'zod'

import { SpellSchema } from './spell'

/** ItemSchema is the single source of truth for both runtime validation and static typing. */

export const ItemEffectsSchema = z.object({
  gold: z.number().optional(),
  reputation: z.number().optional(),
  strength: z.number().optional(),
  intelligence: z.number().optional(),
  luck: z.number().optional(),
  charisma: z.number().optional(),
  heal: z.number().optional(),
  range: z.enum(['close', 'mid', 'far']).optional(),
  /** Grants a damage-absorbing shield (points) */
  shield: z.number().optional(),
  /** Restores mana points */
  manaRestore: z.number().optional(),
  /** Removes all negative status effects */
  cleanse: z.boolean().optional(),
  /** Temporary damage multiplier boost (e.g., 1.5 = +50% damage for 2 turns) */
  damageBoost: z.number().optional(),
})
export type ItemEffects = z.infer<typeof ItemEffectsSchema>

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  quantity: z.number(),
  status: z.enum(['active', 'deleted']).optional(),
  type: z.enum(['consumable', 'equipment', 'quest', 'misc', 'spell_scroll']).optional(),
  effects: ItemEffectsSchema.optional(),
  price: z.number().optional(),
  spell: SpellSchema.optional(),
  isHeirloom: z.boolean().optional(),
  enchantmentLevel: z.number().optional(),
})

export type Item = z.infer<typeof ItemSchema>
