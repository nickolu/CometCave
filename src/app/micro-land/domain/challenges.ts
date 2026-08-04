import type { Tuning } from '@/app/micro-land/domain/tuning'

export interface ChallengePreset {
  id: string
  name: string
  blurb: string
  goal: string
  tuning: Partial<Tuning>
}

export const CHALLENGES: ChallengePreset[] = [
  {
    id: 'empty-table',
    name: 'Empty Table',
    blurb: 'The soil grows nothing. Everything alive comes from your hands.',
    goal: 'Keep at least one species alive for 5 minutes.',
    tuning: { nativePlantTarget: 0, plantSeedBatch: 1, plantSeedInterval: 60 },
  },
  {
    id: 'extreme-gravity',
    name: 'Extreme Gravity',
    blurb: 'Three times the pull. The surface is everything.',
    goal: 'Keep two species alive for 3 minutes.',
    tuning: { gravity: 75 },
  },
  {
    id: 'last-generation',
    name: 'Last Generation',
    blurb: 'Nothing here can have children. The world winds down.',
    goal: 'Keep any creature alive for 5 minutes.',
    tuning: { breedCooldown: 120, hungerRateScale: 0.5 },
  },
  {
    id: 'winter',
    name: 'Permanent Winter',
    blurb: 'Plants barely grow. Everything competes for the little that does.',
    goal: 'Build a stable food chain of two or more species.',
    tuning: { nativePlantTarget: 15, plantSpeciesCap: 12, plantSpreadCooldown: 120 },
  },
]
