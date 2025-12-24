import { BossBlindDefinition, RoundState } from '@/app/daily-card-game/domain/round/types'

import { bossBlinds } from './boss-blinds'

const getBossBlind = (ante: number): BossBlindDefinition => {
  const bossBlindsForAnte = bossBlinds.filter(blind => blind.minimumAnte <= ante)
  if (bossBlindsForAnte.length === 0) {
    throw new Error(`No boss blind found for ante ${ante}`)
  }
  return bossBlindsForAnte[0]
}

const getDefaultRoundState = (baseAnte: number, ante: number): RoundState => {
  return {
    baseAnte: baseAnte,
    bossBlindName: getBossBlind(ante).name,
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

export const rounds: RoundState[] = [
  getDefaultRoundState(100, 0), // can only go here due to voucher
  getDefaultRoundState(300, 1), // starting ante
  getDefaultRoundState(800, 2),
  getDefaultRoundState(2000, 3),
  getDefaultRoundState(5000, 4),
  getDefaultRoundState(11000, 5),
  getDefaultRoundState(20000, 6),
  getDefaultRoundState(35000, 7),
]
