'use client'

import { useDailyCardGameStore } from './store'

export function useGameState() {
  const game = useDailyCardGameStore(state => state.game)
  const setGamePhase = useDailyCardGameStore(state => state.setGamePhase)
  const dealHand = useDailyCardGameStore(state => state.dealHand)
  const selectCard = useDailyCardGameStore(state => state.selectCard)
  const deselectCard = useDailyCardGameStore(state => state.deselectCard)
  const discardSelectedCards = useDailyCardGameStore(state => state.discardSelectedCards)
  const dealCards = useDailyCardGameStore(state => state.dealCards)
  const refillHand = useDailyCardGameStore(state => state.refillHand)
  const handScoringStart = useDailyCardGameStore(state => state.handScoringStart)
  const handScoringEnd = useDailyCardGameStore(state => state.handScoringEnd)
  const cardScored = useDailyCardGameStore(state => state.cardScored)
  const selectSmallBlind = useDailyCardGameStore(state => state.selectSmallBlind)
  const selectBigBlind = useDailyCardGameStore(state => state.selectBigBlind)
  const selectBossBlind = useDailyCardGameStore(state => state.selectBossBlind)
  const addMoney = useDailyCardGameStore(state => state.addMoney)
  const setBlindCompleted = useDailyCardGameStore(state => state.setBlindCompleted)

  return {
    game,
    setGamePhase,
    addMoney,
    dealHand,
    selectCard,
    deselectCard,
    discardSelectedCards,
    dealCards,
    refillHand,
    handScoringStart,
    handScoringEnd,
    cardScored,
    selectSmallBlind,
    selectBigBlind,
    selectBossBlind,
    setBlindCompleted,
  }
}
