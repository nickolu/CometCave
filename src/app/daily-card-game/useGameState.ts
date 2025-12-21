'use client'

import { useDailyCardGameStore } from './store'

export function useGameState() {
  const game = useDailyCardGameStore(state => state.game)
  const setGamePhase = useDailyCardGameStore(state => state.setGamePhase)
  const addMoney = useDailyCardGameStore(state => state.addMoney)
  const dispatch = useDailyCardGameStore(state => state.dispatch)

  return {
    game,
    setGamePhase,
    addMoney,
    dispatch,
  }
}
