'use client'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

export function BlindSelectionView() {
  const { game } = useGameState()
  const currentRound = game.rounds[game.roundIndex]
  const blindsInCurrentRound = [
    currentRound.smallBlind,
    currentRound.bigBlind,
    currentRound.bossBlind,
  ]
  const nextBlind = blindsInCurrentRound.find(blind => blind.status === 'notStarted')

  return (
    <ViewTemplate>
      <h2>Blind Selection</h2>
      <Button
        disabled={nextBlind?.type !== 'smallBlind'}
        onClick={() => {
          eventEmitter.emit({ type: 'SMALL_BLIND_SELECTED' })
        }}
      >
        Start Small Blind
      </Button>
      <Button
        disabled={nextBlind?.type !== 'bigBlind'}
        onClick={() => {
          eventEmitter.emit({ type: 'BIG_BLIND_SELECTED' })
        }}
      >
        Start Big Blind
      </Button>
      <Button
        disabled={nextBlind?.type !== 'bossBlind'}
        onClick={() => {
          eventEmitter.emit({ type: 'BOSS_BLIND_SELECTED' })
        }}
      >
        Start Boss Blind
      </Button>
      <Button
        onClick={() => {
          eventEmitter.emit({ type: 'BLIND_SELECTION_BACK_TO_MENU' })
        }}
      >
        Back
      </Button>
    </ViewTemplate>
  )
}
