'use client'

import { Button } from '@/components/ui/button'
import { useGameState } from '@/app/daily-card-game/useGameState'

export function BlindSelectionView() {
  const { setGamePhase } = useGameState()
  return (
    <div>
      <h1>Blind Selection</h1>
      <Button
        onClick={() => {
          setGamePhase('gameplay')
        }}
      >
        Start Game
      </Button>
      <Button
        onClick={() => {
          setGamePhase('mainMenu')
        }}
      >
        Back
      </Button>
    </div>
  )
}
