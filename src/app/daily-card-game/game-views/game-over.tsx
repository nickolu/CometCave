'use client'

import { useGameState } from '@/app/daily-card-game/useGameState'

export function GameOverView() {
  const { game } = useGameState()

  return (
    <div>
      <h1>Game Over: You Lose</h1>
      <div>Total Score: {game.totalScore}</div>
      <div>Hands Played: {game.handsPlayed}</div>
    </div>
  )
}
