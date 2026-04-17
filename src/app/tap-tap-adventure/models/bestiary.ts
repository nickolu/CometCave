import { z } from 'zod'

import { SpellElementSchema } from './spell'
import { StatusAbilitySchema } from './combat'

export const BestiaryEntrySchema = z.object({
  name: z.string(),
  element: SpellElementSchema.optional(),
  level: z.number(),
  attack: z.number(),
  defense: z.number(),
  maxHp: z.number(),
  specialAbility: z
    .object({
      name: z.string(),
      description: z.string(),
      damage: z.number(),
      cooldown: z.number(),
    })
    .optional(),
  statusAbility: StatusAbilitySchema.optional(),
  region: z.string(),
  timesDefeated: z.number(),
  firstEncountered: z.string(),
  isBoss: z.boolean().optional(),
})

export type BestiaryEntry = z.infer<typeof BestiaryEntrySchema>
