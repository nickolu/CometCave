'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Hand } from '@/app/daily-card-game/components/gameplay/hand'
import { Deck } from '@/app/daily-card-game/components/global/deck'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const useScoreHand = () => {
  const { game } = useGameState()
  const { gamePlayState } = game
  const selectedCardIds = gamePlayState.selectedCardIds
  const isScoringRef = useRef(false)

  const scoreHand = useCallback(async () => {
    if (isScoringRef.current) return

    const cardIdsToScore = [...selectedCardIds]
    if (cardIdsToScore.length === 0) return

    isScoringRef.current = true
    try {
      eventEmitter.emit({ type: 'HAND_SCORING_START' })

      for (const cardId of cardIdsToScore) {
        await sleep(250)
        eventEmitter.emit({ type: 'CARD_SCORED', id: cardId })
      }

      await sleep(750)
      eventEmitter.emit({ type: 'HAND_SCORING_END' })
    } finally {
      isScoringRef.current = false
    }
  }, [selectedCardIds])
  return { scoreHand }
}

export function GamePlayView() {
  const [showDeck, setShowDeck] = useState(false)
  const { game } = useGameState()
  const { gamePlayState } = game
  const { isScoring, remainingDiscards, score, selectedHand } = gamePlayState
  const { scoreHand } = useScoreHand()
  const currentBlind = getInProgressBlind(game)

  useEffect(() => {
    eventEmitter.emit({ type: 'HAND_DEALT' })
  }, [])

  return (
    <ViewTemplate>
      <div>
        <div className="mt-4">
          <Hand />
        </div>
        <div className="flex mt-4 gap-2">
          <Button
            disabled={remainingDiscards === 0 || isScoring}
            onClick={() => {
              eventEmitter.emit({ type: 'DISCARD_SELECTED_CARDS' })
            }}
          >
            Discard
          </Button>
          <Button disabled={isScoring} onClick={scoreHand}>
            Score Hand
          </Button>
          <Button onClick={() => setShowDeck(!showDeck)}>
            {showDeck ? 'Hide Deck' : 'Show Deck'}
          </Button>
        </div>
      </div>

      {showDeck && <Deck />}
      <div className="mt-4">
        <div>
          Blind Score: {score.chips} x {score.mult}
        </div>
        <div>Your Score: {currentBlind?.score}</div>
        <div>Selected Hand: {selectedHand?.[0]?.name || 'None'}</div>
      </div>
    </ViewTemplate>
  )
}
