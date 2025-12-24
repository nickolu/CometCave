'use client'

import { useDailyCardGameStore } from './store'

export function useGameState() {
  const game = useDailyCardGameStore(state => state.game)
  const dispatch = useDailyCardGameStore(state => state.dispatch)

  return {
    game,
    dispatch,
  }
}
