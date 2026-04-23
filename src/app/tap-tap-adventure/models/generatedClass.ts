import { z } from 'zod'

import { SpellEffectSchema, SpellSchoolSchema } from './spell'

export const GeneratedClassStartingAbilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  manaCost: z.number(),
  cooldown: z.number(),
  target: z.enum(['enemy', 'self']),
  effects: z.array(SpellEffectSchema),
  tags: z.array(z.string()),
})
export type GeneratedClassStartingAbility = z.infer<typeof GeneratedClassStartingAbilitySchema>

export const GeneratedClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  combatStyle: z.string(),
  modifier: z.string(),
  statDistribution: z.object({
    strength: z.number().min(3).max(10),
    intelligence: z.number().min(3).max(10),
    luck: z.number().min(3).max(10),
    charisma: z.number().min(3).max(10).default(5),
  }),
  favoredSchool: SpellSchoolSchema,
  manaMultiplier: z.number().min(0.5).max(1.5),
  spellSlots: z.number().min(2).max(6),
  startingAbility: GeneratedClassStartingAbilitySchema,
})
export type GeneratedClass = z.infer<typeof GeneratedClassSchema>
