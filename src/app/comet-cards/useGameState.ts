'use client'

import { useCometCardsStore } from './store'

export function useGameState() {
  const game = useCometCardsStore(state => state.game)
  const dispatch = useCometCardsStore(state => state.dispatch)

  return {
    game,
    dispatch,
  }
}
