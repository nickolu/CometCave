import { RoundDefinition } from '@/app/daily-card-game/domain/round/types'

import { bossBlinds } from './boss-blinds'

const getDefaultRoundState = (baseAnte: number, ante: number): RoundDefinition => {
  console.log('ante', ante) // this will be used to determine the boss blind eventually
  return {
    baseAnte: baseAnte,
    smallBlind: {
      type: 'smallBlind',
      name: 'Small Blind',
      status: 'notStarted',
      anteMultiplier: 1,
      baseReward: 3,
      additionalRewards: [],
      score: 0,
    },
    bigBlind: {
      type: 'bigBlind',
      name: 'Big Blind',
      status: 'notStarted',
      anteMultiplier: 1.5,
      baseReward: 4,
      additionalRewards: [],
      score: 0,
    },
    bossBlind: bossBlinds[0],
  }
}

export const rounds: RoundDefinition[] = [
  getDefaultRoundState(100, 0), // can only go here due to voucher
  getDefaultRoundState(300, 1), // starting ante
  getDefaultRoundState(800, 2),
  getDefaultRoundState(2000, 3),
  getDefaultRoundState(5000, 4),
  getDefaultRoundState(11000, 5),
  getDefaultRoundState(20000, 6),
  getDefaultRoundState(35000, 7),
  getDefaultRoundState(80000, 8),
]
