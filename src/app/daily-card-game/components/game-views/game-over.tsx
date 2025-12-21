'use client'

import { useGameState } from '@/app/daily-card-game/useGameState'

import { ViewTemplate } from './view-template'

export function GameOverView() {
  const { game } = useGameState()

  return (
    <ViewTemplate>
      <h2>Game Over: You Lose</h2>
      <div>Total Score: {game.totalScore}</div>
      <div>Hands Played: {game.handsPlayed}</div>
    </ViewTemplate>
  )
}
