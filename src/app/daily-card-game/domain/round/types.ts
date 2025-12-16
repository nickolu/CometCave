import type { Effect } from '@/app/daily-card-game/domain/events/types'

export interface SmallBlindState {
  type: 'smallBlind'
  name: 'Small Blind'
  status: 'completed' | 'skipped' | 'notStarted' | 'inProgress'
  anteMultiplier: 1
  baseReward: number
  additionalRewards: [string, number][] // [rewardName, rewardAmount]
}

export interface BigBlindState {
  type: 'bigBlind'
  name: 'Big Blind'
  status: 'completed' | 'skipped' | 'notStarted' | 'inProgress'
  anteMultiplier: 1.5
  baseReward: number
  additionalRewards: [string, number][] // [rewardName, rewardAmount]
}

export interface BossBlindDefinition {
  type: 'bossBlind'
  status: 'completed' | 'notStarted' | 'inProgress' // boss blind cannot be skipped
  anteMultiplier: 1 | 2 | 4 | 6
  name: string
  description: string
  image: string
  effects: Effect[]
  minimumAnte: number
  baseReward: number
  additionalRewards: [string, number][] // [rewardName, rewardAmount]
}

export interface RoundDefinition {
  baseAnte: number
  smallBlind: SmallBlindState
  bigBlind: BigBlindState
  bossBlind: BossBlindDefinition
}
