import type { RoundState } from '@/app/daily-card-game/domain/round/types'

import { getRandomBossBlind } from './boss-blinds'

const getDefaultRoundState = (baseAnte: number, ante: number, seed: string): RoundState => {
  return {
    baseAnte: baseAnte,
    bossBlindName: getRandomBossBlind(ante, seed).name,
    smallBlind: {
      type: 'smallBlind',
      status: 'notStarted',
      additionalRewards: [],
      score: 0,
    },
    bigBlind: {
      type: 'bigBlind',
      status: 'notStarted',
      additionalRewards: [],
      score: 0,
    },
    bossBlind: {
      type: 'bossBlind',
      status: 'notStarted',
      additionalRewards: [],
      score: 0,
    },
  }
}

export const initializeRounds = (seed: string): RoundState[] => {
  return [
    getDefaultRoundState(100, 0, seed), // can only go here due to voucher
    getDefaultRoundState(300, 1, seed), // starting ante
    getDefaultRoundState(800, 2, seed),
    getDefaultRoundState(2000, 3, seed),
    getDefaultRoundState(5000, 4, seed),
    getDefaultRoundState(11000, 5, seed),
    getDefaultRoundState(20000, 6, seed),
    getDefaultRoundState(35000, 7, seed),
  ]
}
