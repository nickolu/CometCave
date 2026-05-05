'use client'

import { useEffect } from 'react'

import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { useGameState } from '@/app/comet-cards/useGameState'

export const useGameEvents = () => {
  const { dispatch } = useGameState()

  useEffect(() => {
    return eventEmitter.onAny(event => dispatch(event))
  }, [dispatch])
}
