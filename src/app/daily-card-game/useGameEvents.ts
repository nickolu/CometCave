'use client'

import { useEffect } from 'react'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { useGameState } from '@/app/daily-card-game/useGameState'

export const useGameEvents = () => {
  const { dispatch } = useGameState()

  useEffect(() => {
    return eventEmitter.onAny(event => dispatch(event))
  }, [dispatch])
}
