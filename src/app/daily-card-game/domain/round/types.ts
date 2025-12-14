import { Effect } from '@/app/daily-card-game/domain/events/types'

export interface SmallBlindState {
  status: 'completed' | 'skipped' | 'notStarted' | 'inProgress'
  anteMultiplier: 1
}

export interface BigBlindState {
  status: 'completed' | 'skipped' | 'notStarted' | 'inProgress'
  anteMultiplier: 1.5
}

export interface BossBlindDefinition {
  status: 'completed' | 'notStarted' | 'inProgress' // boss blind cannot be skipped
  anteMultiplier: 1 | 2 | 4 | 6
  winnings: number
  name: string
  description: string
  image: string
  effects: Effect[]
  minimumAnte: number
}

export interface RoundDefinition {
  baseChips: number
  smallBlind: SmallBlindState
  bigBlind: BigBlindState
  bossBlind: BossBlindDefinition
}
