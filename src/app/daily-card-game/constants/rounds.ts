import { RoundDefinition } from '../domain/types'
import { bossBlinds } from './boss-blinds'

const getDefaultRoundState = (baseChips: number, ante: number): RoundDefinition => {
  console.log('ante', ante) // this will be used to determine the boss blind eventually
  return {
    baseChips: baseChips,
    smallBlind: {
      status: 'notStarted',
      anteMultiplier: 1,
    },
    bigBlind: {
      status: 'notStarted',
      anteMultiplier: 1.5,
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
