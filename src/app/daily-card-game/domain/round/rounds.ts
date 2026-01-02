import type { RoundState } from '@/app/daily-card-game/domain/round/types'

import { getRandomBossBlind } from './boss-blinds'

const getDefaultRoundState = (baseAnte: bigint, ante: number, seed: string): RoundState => {
  return {
    baseAnte: baseAnte,
    bossBlindName: getRandomBossBlind(ante, seed).name,
    smallBlind: {
      type: 'smallBlind',
      status: 'notStarted',
      additionalRewards: [],
      score: 0n,
      tag: null,
    },
    bigBlind: {
      type: 'bigBlind',
      status: 'notStarted',
      additionalRewards: [],
      score: 0n,
      tag: null,
    },
    bossBlind: {
      type: 'bossBlind',
      status: 'notStarted',
      additionalRewards: [],
      score: 0n,
      tag: null,
    },
  }
}

export const initializeRounds = (seed: string): RoundState[] => {
  return [
    getDefaultRoundState(100n, 0, seed), // can only go here due to voucher
    getDefaultRoundState(300n, 1, seed), // starting ante
    getDefaultRoundState(800n, 2, seed),
    getDefaultRoundState(2000n, 3, seed),
    getDefaultRoundState(5000n, 4, seed),
    getDefaultRoundState(11000n, 5, seed),
    getDefaultRoundState(20000n, 6, seed),
    getDefaultRoundState(35000n, 7, seed),
    getDefaultRoundState(110000n, 8, seed),
    getDefaultRoundState(560000n, 9, seed),
    getDefaultRoundState(7200000n, 10, seed),
    getDefaultRoundState(300000000n, 11, seed),
    getDefaultRoundState(47000000000n, 12, seed),
    getDefaultRoundState(2900000000000n, 13, seed),
    getDefaultRoundState(77000000000000n, 14, seed),
    getDefaultRoundState(860000000000000n, 15, seed),
    getDefaultRoundState(4200000000000000n, 16, seed),
    getDefaultRoundState(92000000000000000n, 17, seed),
    getDefaultRoundState(920000000000000000n, 18, seed),
    getDefaultRoundState(4300000000000000000n, 19, seed),
    getDefaultRoundState(97000000000000000000n, 20, seed),
    getDefaultRoundState(100000000000000000000n, 21, seed),
    getDefaultRoundState(580000000000000000000n, 22, seed),
    getDefaultRoundState(1600000000000000000000n, 23, seed),
    getDefaultRoundState(2400000000000000000000n, 24, seed),
    getDefaultRoundState(19000000000000000000000n, 25, seed),
    getDefaultRoundState(84000000000000000000000n, 26, seed),
    getDefaultRoundState(200000000000000000000000n, 27, seed),
    getDefaultRoundState(270000000000000000000000n, 28, seed),
    getDefaultRoundState(2100000000000000000000000n, 29, seed),
    getDefaultRoundState(9900000000000000000000000n, 30, seed),
    getDefaultRoundState(27000000000000000000000000n, 31, seed),
    getDefaultRoundState(44000000000000000000000000n, 32, seed),
    getDefaultRoundState(440000000000000000000000000n, 33, seed),
    getDefaultRoundState(4400000000000000000000000000n, 34, seed),
    getDefaultRoundState(28000000000000000000000000000n, 35, seed),
    getDefaultRoundState(110000000000000000000000000000n, 36, seed),
    getDefaultRoundState(270000000000000000000000000000n, 37, seed),
    getDefaultRoundState(4500000000000000000000000000000n, 38, seed),
    getDefaultRoundState(48000000000000000000000000000000n, 39, seed),
  ]
}