import { z } from 'zod'

/** All schemas in this file are the single source of truth for both runtime validation and static typing. */

export const FantasyAbilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  power: z.number(),
  cooldown: z.number(),
})
export type FantasyAbility = z.infer<typeof FantasyAbilitySchema>

export const FantasyCharacterSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  name: z.string(),
  race: z.string(),
  class: z.string(),
  level: z.number(),
  abilities: z.array(FantasyAbilitySchema),
  locationId: z.string(),
  gold: z.number(),
  reputation: z.number(),
  distance: z.number(),
  status: z.enum(['active', 'retired', 'dead']),
  strength: z.number(),
  intelligence: z.number(),
  luck: z.number(),
  inventory: z.array(
    z.object({
      id: z.string(),
      quantity: z.number().int().min(1),
      name: z.string(),
      description: z.string(),
    })
  ),
})
export type FantasyCharacter = z.infer<typeof FantasyCharacterSchema>

export const FantasyNPCSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  description: z.string(),
  locationId: z.string(),
  disposition: z.number(), // -100 (hostile) to 100 (friendly)
})
export type FantasyNPC = z.infer<typeof FantasyNPCSchema>
