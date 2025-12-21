'use client'

import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

export function ShopView() {
  const { setGamePhase } = useGameState()
  return (
    <ViewTemplate>
      <h2>Shop</h2>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            setGamePhase('blindSelection')
          }}
        >
          Select Blind
        </Button>
        <Button
          onClick={() => {
            setGamePhase('packOpening')
          }}
        >
          Open Pack
        </Button>
      </div>
    </ViewTemplate>
  )
}
