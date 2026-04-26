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
  socialEncounter: z.object({
    npc: z.object({
      id: z.string(),
      name: z.string(),
      role: z.string(),
      description: z.string(),
      regionId: z.string(),
      personality: z.string(),
      icon: z.string(),
      greeting: z.string(),
      personalityWeights: z.record(z.string(), z.number()).optional(),
      topics: z.array(z.string()).optional(),
    }),
    scenario: z.string(),
  }).optional().nullable(),
  genericMessage: z.string().optional().nullable(),
  landmarkArrival: z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    icon: z.string(),
    hasShop: z.boolean(),
  }).optional().nullable(),
  landmarkProgress: z.object({
    nextLandmarkName: z.string(),
    nextLandmarkIcon: z.string(),
    stepsRemaining: z.number(),
  }).optional().nullable(),
  availableTargets: z.array(z.object({
    index: z.number(),
    name: z.string(),
    icon: z.string(),
    type: z.string(),
    position: z.number(),
    distance: z.number(),
    isExplored: z.boolean().optional(),
    hasShop: z.boolean().optional(),
  })).optional().nullable(),
})

export type MoveForwardResponse = z.infer<typeof MoveForwardResponseSchema>
