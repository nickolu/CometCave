import type { RoundState } from '@/app/comet-cards/domain/round/types'

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

export const initializeRounds = (seed: string, anteMultiplier: bigint = 1n): RoundState[] => {
  return [
    getDefaultRoundState(100n * anteMultiplier, 0, seed), // can only go here due to voucher
    getDefaultRoundState(300n * anteMultiplier, 1, seed), // starting ante
    getDefaultRoundState(800n * anteMultiplier, 2, seed),
    getDefaultRoundState(2000n * anteMultiplier, 3, seed),
    getDefaultRoundState(5000n * anteMultiplier, 4, seed),
    getDefaultRoundState(11000n * anteMultiplier, 5, seed),
    getDefaultRoundState(20000n * anteMultiplier, 6, seed),
    getDefaultRoundState(35000n * anteMultiplier, 7, seed),
    getDefaultRoundState(110000n * anteMultiplier, 8, seed),
    getDefaultRoundState(560000n * anteMultiplier, 9, seed),
    getDefaultRoundState(7200000n * anteMultiplier, 10, seed),
    getDefaultRoundState(300000000n * anteMultiplier, 11, seed),
    getDefaultRoundState(47000000000n * anteMultiplier, 12, seed),
    getDefaultRoundState(2900000000000n * anteMultiplier, 13, seed),
    getDefaultRoundState(77000000000000n * anteMultiplier, 14, seed),
    getDefaultRoundState(860000000000000n * anteMultiplier, 15, seed),
    getDefaultRoundState(4200000000000000n * anteMultiplier, 16, seed),
    getDefaultRoundState(92000000000000000n * anteMultiplier, 17, seed),
    getDefaultRoundState(920000000000000000n * anteMultiplier, 18, seed),
    getDefaultRoundState(4300000000000000000n * anteMultiplier, 19, seed),
    getDefaultRoundState(97000000000000000000n * anteMultiplier, 20, seed),
    getDefaultRoundState(100000000000000000000n * anteMultiplier, 21, seed),
    getDefaultRoundState(580000000000000000000n * anteMultiplier, 22, seed),
    getDefaultRoundState(1600000000000000000000n * anteMultiplier, 23, seed),
    getDefaultRoundState(2400000000000000000000n * anteMultiplier, 24, seed),
    getDefaultRoundState(19000000000000000000000n * anteMultiplier, 25, seed),
    getDefaultRoundState(84000000000000000000000n * anteMultiplier, 26, seed),
    getDefaultRoundState(200000000000000000000000n * anteMultiplier, 27, seed),
    getDefaultRoundState(270000000000000000000000n * anteMultiplier, 28, seed),
    getDefaultRoundState(2100000000000000000000000n * anteMultiplier, 29, seed),
    getDefaultRoundState(9900000000000000000000000n * anteMultiplier, 30, seed),
    getDefaultRoundState(27000000000000000000000000n * anteMultiplier, 31, seed),
    getDefaultRoundState(44000000000000000000000000n * anteMultiplier, 32, seed),
    getDefaultRoundState(440000000000000000000000000n * anteMultiplier, 33, seed),
    getDefaultRoundState(4400000000000000000000000000n * anteMultiplier, 34, seed),
    getDefaultRoundState(28000000000000000000000000000n * anteMultiplier, 35, seed),
    getDefaultRoundState(110000000000000000000000000000n * anteMultiplier, 36, seed),
    getDefaultRoundState(270000000000000000000000000000n * anteMultiplier, 37, seed),
    getDefaultRoundState(4500000000000000000000000000000n * anteMultiplier, 38, seed),
    getDefaultRoundState(48000000000000000000000000000000n * anteMultiplier, 39, seed),
  ]
}
