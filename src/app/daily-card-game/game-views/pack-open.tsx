'use client'

import { Button } from '@/components/ui/button'
import { useGameState } from '@/app/daily-card-game/useGameState'

export function PackOpenView() {
  const { setGamePhase } = useGameState()
  return (
    <div>
      <h1>Pack Open</h1>
      <Button
        onClick={() => {
          setGamePhase('shop')
        }}
      >
        Back
      </Button>
    </div>
  )
}
