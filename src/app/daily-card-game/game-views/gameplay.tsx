'use client'

import { Hand } from '@/app/daily-card-game/components/gameplay/hand'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'
import { eventEmitter } from '@/app/daily-card-game/events/event-emitter'
import { useEffect, useState } from 'react'
import { Deck } from '@/app/daily-card-game/components/global/deck'

export function GamePlayView() {
  const [showDeck, setShowDeck] = useState(false)
  const { game } = useGameState()
  const { gamePlayState } = game

  useEffect(() => {
    eventEmitter.emit({ type: 'HAND_DEALT' })
  }, [])

  return (
    <div>
      <h1>Game Play</h1>
      <div className="mt-4">Discards: {gamePlayState.remainingDiscards}</div>
      <div className="mt-4">
        <div className="flex justify-end">
          <Button
            disabled={gamePlayState.remainingDiscards === 0}
            onClick={() => {
              eventEmitter.emit({ type: 'DISCARD_SELECTED_CARDS' })
            }}
          >
            Discard
          </Button>
          <Button onClick={() => setShowDeck(!showDeck)}>
            {showDeck ? 'Hide Deck' : 'Show Deck'}
          </Button>
        </div>
        <div className="mt-4">
          <Hand />
        </div>
      </div>
      {showDeck && <Deck />}
    </div>
  )
}
