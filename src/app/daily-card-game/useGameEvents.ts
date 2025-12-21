'use client'

import { useEffect } from 'react'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { useGameState } from '@/app/daily-card-game/useGameState'

export const useGameEvents = () => {
  const { dispatch } = useGameState()

  useEffect(() => {
    const unsubs = [
      eventEmitter.on('ROUND_START', event => dispatch(event)),
      eventEmitter.on('SMALL_BLIND_SELECTED', event => dispatch(event)),
      eventEmitter.on('BIG_BLIND_SELECTED', event => dispatch(event)),
      eventEmitter.on('BOSS_BLIND_SELECTED', event => dispatch(event)),
      eventEmitter.on('ROUND_END', event => dispatch(event)),
      eventEmitter.on('CARD_SCORED', event => dispatch(event)),
      eventEmitter.on('HAND_DEALT', event => dispatch(event)),
      eventEmitter.on('CARD_SELECTED', event => dispatch(event)),
      eventEmitter.on('CARD_DESELECTED', event => dispatch(event)),
      eventEmitter.on('DISCARD_SELECTED_CARDS', event => dispatch(event)),
      eventEmitter.on('HAND_SCORING_START', event => dispatch(event)),
      eventEmitter.on('HAND_SCORING_END', event => dispatch(event)),
      eventEmitter.on('BLIND_REWARDS_START', event => dispatch(event)),
      eventEmitter.on('BLIND_REWARDS_END', event => dispatch(event)),
    ]

    return () => {
      for (const unsub of unsubs) unsub()
    }
  }, [dispatch])
}
