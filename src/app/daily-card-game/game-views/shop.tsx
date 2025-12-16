'use client'

import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

export function ShopView() {
  const { setGamePhase } = useGameState()
  return (
    <div>
      <h1>Shop</h1>
      <Button
        onClick={() => {
          setGamePhase('blindSelection')
        }}
      >
        Select Blind
      </Button>
      <Button
        onClick={() => {
          setGamePhase('mainMenu')
        }}
      >
        Back
      </Button>
      <Button
        onClick={() => {
          setGamePhase('packOpening')
        }}
      >
        Open Pack
      </Button>
    </div>
  )
}
