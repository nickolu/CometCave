'use client'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { Button } from '@/components/ui/button'

export function MainMenuView() {
  return (
    <div className="flex flex-col items-center mt-10 h-screen">
      <h1 className="text-2xl font-bold">Cosmic Cards</h1>
      <Button
        className="mt-4"
        size="lg"
        onClick={() => {
          eventEmitter.emit({ type: 'GAME_START' })
        }}
      >
        Start Game
      </Button>
      <div className="flex gap-2 mt-4">
        <Button
          className="mt-4"
          variant="space"
          onClick={() => {
            eventEmitter.emit({ type: 'DISPLAY_JOKERS' })
          }}
        >
          Jokers
        </Button>
        <Button className="mt-4" variant="space" disabled={true}>
          Tags
        </Button>
        <Button className="mt-4" variant="space" disabled={true}>
          Vouchers
        </Button>
        <Button className="mt-4" variant="space" disabled={true}>
          Arcana Cards
        </Button>
        <Button className="mt-4" variant="space" disabled={true}>
          Celestial Cards
        </Button>
        <Button className="mt-4" variant="space" disabled={true}>
          Spectral Cards
        </Button>
      </div>
    </div>
  )
}
