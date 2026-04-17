import { z } from 'zod'

export const CampStateSchema = z.object({
  buildingLevels: z.record(z.string(), z.number()),
})

export type CampState = z.infer<typeof CampStateSchema>
