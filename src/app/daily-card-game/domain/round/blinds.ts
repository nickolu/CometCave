import type { GameState } from '@/app/daily-card-game/domain/game/types'

import type { BlindDefinition, BlindState } from './types'

export const blindIndices: Record<BlindState['type'], number> = {
  smallBlind: 0,
  bigBlind: 1,
  bossBlind: 2,
}

export function getInProgressBlind(game: GameState): BlindState | undefined {
  const currentRoundIndex = game.roundIndex
  const currentRound = game.rounds[currentRoundIndex]
  const blindsInCurrentRound = [
    currentRound.smallBlind,
    currentRound.bigBlind,
    currentRound.bossBlind,
  ]
  return blindsInCurrentRound.find(blind => blind.status === 'inProgress')
}

export function getNextBlind(game: GameState): BlindState | undefined {
  const currentRoundIndex = game.roundIndex
  const currentRound = game.rounds[currentRoundIndex]
  const blindsInCurrentRound = [
    currentRound.smallBlind,
    currentRound.bigBlind,
    currentRound.bossBlind,
  ]
  return blindsInCurrentRound.find(blind => blind.status === 'notStarted')
}

export const smallBlind: BlindDefinition = {
  type: 'smallBlind',
  name: 'Small Blind',
  description: 'The small blind is the first blind in the round.',
  anteMultiplier: 1,
  baseReward: 3,
  effects: [],
}

export const bigBlind: BlindDefinition = {
  type: 'bigBlind',
  name: 'Big Blind',
  description: 'The big blind is the second blind in the round.',
  anteMultiplier: 1.5,
  baseReward: 4,
  effects: [],
}
