'use client'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { Button } from '@/components/ui/button'

export function MainMenuView() {
  return (
    <div>
      <h1>Main Menu</h1>
      <Button
        onClick={() => {
          eventEmitter.emit({ type: 'GAME_START' })
        }}
      >
        Start Game
      </Button>
    </div>
  )
}
