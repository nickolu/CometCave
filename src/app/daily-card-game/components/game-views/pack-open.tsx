'use client'

import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

export function PackOpenView() {
  const { setGamePhase } = useGameState()
  return (
    <ViewTemplate>
      <h2>Pack Open</h2>
      <Button
        onClick={() => {
          setGamePhase('shop')
        }}
      >
        Back
      </Button>
    </ViewTemplate>
  )
}
