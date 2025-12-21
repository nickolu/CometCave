'use client'

import { useEffect } from 'react'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { useGameState } from '@/app/daily-card-game/useGameState'

export const useGameEvents = () => {
  const {
    setGamePhase,
    dealHand,
    selectCard,
    deselectCard,
    discardSelectedCards,
    refillHand,
    cardScored,
    handScoringStart,
    handScoringEnd,
    selectSmallBlind,
    selectBigBlind,
    selectBossBlind,
    setBlindCompleted,
  } = useGameState()

  useEffect(() => {
    const unsubRoundStart = eventEmitter.on('ROUND_START', () => {
      console.log('ROUND_START')
      setGamePhase('blindSelection')
    })

    const unsubSmallBlindSelected = eventEmitter.on('SMALL_BLIND_SELECTED', () => {
      console.log('SMALL_BLIND_SELECTED')
      selectSmallBlind()
    })

    const unsubBigBlindSelected = eventEmitter.on('BIG_BLIND_SELECTED', () => {
      console.log('BIG_BLIND_SELECTED')
      selectBigBlind()
    })
    const unsubBossBlindSelected = eventEmitter.on('BOSS_BLIND_SELECTED', () => {
      console.log('BOSS_BLIND_SELECTED')
      selectBossBlind()
    })

    const unsubRoundEnd = eventEmitter.on('ROUND_END', () => {
      console.log('ROUND_END')
    })

    const unsubCardScored = eventEmitter.on('CARD_SCORED', event => {
      console.log('CARD_SCORED', event.id)
      cardScored(event.id)
    })

    const unsubHandDealt = eventEmitter.on('HAND_DEALT', () => {
      console.log('HAND_DEALT')
      dealHand()
    })

    const unsubCardSelected = eventEmitter.on('CARD_SELECTED', event => {
      console.log('CARD_SELECTED', event.id)
      selectCard(event.id)
    })

    const unsubCardDeselected = eventEmitter.on('CARD_DESELECTED', event => {
      console.log('CARD_DESELECTED', event.id)
      deselectCard(event.id)
    })

    const unsubDiscardSelectedCards = eventEmitter.on('DISCARD_SELECTED_CARDS', () => {
      console.log('DISCARD_SELECTED_CARDS')
      discardSelectedCards()
      refillHand()
    })

    const unsubHandScoringStart = eventEmitter.on('HAND_SCORING_START', () => {
      console.log('HAND_SCORING_START')
      handScoringStart()
    })

    const unsubHandScoringEnd = eventEmitter.on('HAND_SCORING_END', () => {
      console.log('HAND_SCORING_END')
      handScoringEnd()
    })

    const unsubBlindRewardsStart = eventEmitter.on('BLIND_REWARDS_START', () => {
      console.log('BLIND_REWARDS_START')
    })

    const unsubBlindRewardsEnd = eventEmitter.on('BLIND_REWARDS_END', () => {
      setBlindCompleted()
      setGamePhase('shop')
    })

    return () => {
      unsubRoundStart()
      unsubRoundEnd()
      unsubCardScored()
      unsubHandDealt()
      unsubCardSelected()
      unsubCardDeselected()
      unsubDiscardSelectedCards()
      unsubHandScoringStart()
      unsubHandScoringEnd()
      unsubSmallBlindSelected()
      unsubBigBlindSelected()
      unsubBossBlindSelected()
      unsubBlindRewardsStart()
      unsubBlindRewardsEnd()
    }
  }, [
    dealHand,
    selectCard,
    deselectCard,
    setGamePhase,
    discardSelectedCards,
    refillHand,
    cardScored,
    handScoringEnd,
    selectSmallBlind,
    selectBigBlind,
    selectBossBlind,
    handScoringStart,
    setBlindCompleted,
  ])
}
