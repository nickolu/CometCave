import { z } from 'zod'

import type { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

// Use z.custom<FantasyCharacter>() to validate the full FantasyCharacter shape
export const MoveForwardRequestSchema = z.object({
  character: z.custom<FantasyCharacter>(),
  storyEvents: z.array(z.any()).optional(),
})

export type MoveForwardRequest = z.infer<typeof MoveForwardRequestSchema>

export const MoveForwardResponseSchema = z.object({
  character: z.any(),
  event: z.any().optional().nullable(),
  decisionPoint: z.any().optional().nullable(),
  combatEncounter: z.any().optional().nullable(),
  shopEvent: z.boolean().optional().nullable(),
  genericMessage: z.string().optional().nullable(),
})

export type MoveForwardResponse = z.infer<typeof MoveForwardResponseSchema>
