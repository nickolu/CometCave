import type { GameState } from '@/app/daily-card-game/domain/game/types'

import type { BlindDefinition, BlindState } from './types'

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

export const smallBlind: BlindDefinition = {
  type: 'smallBlind',
  name: 'Small Blind',
  anteMultiplier: 1,
  baseReward: 3,
  effects: [],
}

export const bigBlind: BlindDefinition = {
  type: 'bigBlind',
  name: 'Big Blind',
  anteMultiplier: 1.5,
  baseReward: 4,
  effects: [],
}
