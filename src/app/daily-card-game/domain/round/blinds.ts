import type { GameState } from '@/app/daily-card-game/domain/game/types'

import type { BigBlindState, BossBlindDefinition, SmallBlindState } from './types'

export function getInProgressBlind(
  game: GameState
): SmallBlindState | BigBlindState | BossBlindDefinition | undefined {
  const currentRoundIndex = game.roundIndex
  const currentRound = game.rounds[currentRoundIndex]
  const blindsInCurrentRound = [
    currentRound.smallBlind,
    currentRound.bigBlind,
    currentRound.bossBlind,
  ]
  return blindsInCurrentRound.find(blind => blind.status === 'inProgress')
}
