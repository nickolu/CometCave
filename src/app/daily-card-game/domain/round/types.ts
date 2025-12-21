import type { Effect } from '@/app/daily-card-game/domain/events/types'

export interface BlindState {
  type: 'smallBlind' | 'bigBlind' | 'bossBlind'
  status: 'completed' | 'skipped' | 'notStarted' | 'inProgress'
  anteMultiplier: 1 | 1.5 | 2 | 4 | 6
  baseReward: number
  additionalRewards: [string, number][] // [rewardName, rewardAmount]
  score: number
}

export interface SmallBlindState extends BlindState {
  type: 'smallBlind'
  name: 'Small Blind'
  anteMultiplier: 1
}

export interface BigBlindState extends BlindState {
  type: 'bigBlind'
  name: 'Big Blind'
  anteMultiplier: 1.5
}

export interface BossBlindDefinition extends BlindState {
  type: 'bossBlind'
  status: 'completed' | 'notStarted' | 'inProgress' // boss blind cannot be skipped
  anteMultiplier: 1 | 2 | 4 | 6
  name:
    | 'The Hook'
    | 'The Ox'
    | 'The House'
    | 'The Wall'
    | 'The Wheel'
    | 'The Arm'
    | 'The Club'
    | 'The Fish'
    | 'The Psychic'
    | 'The Goad'
    | 'The Water'
    | 'The Window'
    | 'The Manacle'
    | 'The Eye'
    | 'The Mouth'
    | 'The Plant'
    | 'The Serpent'
    | 'The Pillar'
    | 'The Needle'
    | 'The Head'
    | 'The Tooth'
    | 'The Flint'
    | 'The Mark'
    | 'Amber Acorn'
    | 'Verdant Leaf'
    | 'Violet Vessel'
    | 'Crimson Heart'
    | 'Cerulean Bell'
  description: string
  image: string
  effects: Effect[]
  minimumAnte: number
}

export interface RoundDefinition {
  baseAnte: number
  smallBlind: SmallBlindState
  bigBlind: BigBlindState
  bossBlind: BossBlindDefinition
}
