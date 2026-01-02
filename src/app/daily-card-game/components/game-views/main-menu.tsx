'use client'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { Button } from '@/components/ui/button'

export function MainMenuView() {
  return (
    <div className="flex flex-col items-center mt-10">
      <h1 className="text-2xl font-bold">Daily Card Game</h1>
      <Button
        className="mt-4"
        size="lg"
        onClick={() => {
          eventEmitter.emit({ type: 'GAME_START' })
        }}
      >
        Start Game
      </Button>

      <div className="flex flex-wrap justify-center gap-2 mt-4 w-3/4 mx-auto">
        <Button
          className="mt-4"
          variant="space"
          onClick={() => {
            eventEmitter.emit({ type: 'DISPLAY_JOKERS' })
          }}
        >
          Jokers
        </Button>

        <Button
          className="mt-4"
          variant="space"
          onClick={() => {
            eventEmitter.emit({ type: 'DISPLAY_VOUCHERS' })
          }}
        >
          Vouchers
        </Button>
        <Button
          className="mt-4"
          variant="space"
          onClick={() => {
            eventEmitter.emit({ type: 'DISPLAY_TAROT_CARDS' })
          }}
        >
          Tarot Cards
        </Button>
        <Button
          className="mt-4"
          variant="space"
          onClick={() => {
            eventEmitter.emit({ type: 'DISPLAY_CELESTIALS' })
          }}
        >
          Celestial Cards
        </Button>
        <Button
          className="mt-4"
          variant="space"
          onClick={() => {
            eventEmitter.emit({ type: 'DISPLAY_BOSS_BLINDS' })
          }}
        >
          Boss Blinds
        </Button>
        <Button
          className="mt-4"
          variant="space"
          onClick={() => {
            eventEmitter.emit({ type: 'DISPLAY_TAGS' })
          }}
        >
          Tags
        </Button>
        <Button
          className="mt-4"
          variant="space"
          onClick={() => {
            eventEmitter.emit({ type: 'DISPLAY_SPECTRAL_CARDS' })
          }}
        >
          Spectral Cards
        </Button>
      </div>
    </div>
  )
}
