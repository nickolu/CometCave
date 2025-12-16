'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Hand } from '@/app/daily-card-game/components/gameplay/hand'
import { Deck } from '@/app/daily-card-game/components/global/deck'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

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
        await sleep(1000)
        console.log('CARD_SCORED', cardId)
        eventEmitter.emit({ type: 'CARD_SCORED', id: cardId })
      }

      await sleep(1000)
      console.log('HAND_SCORING_END')
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

  const { scoreHand } = useScoreHand()

  useEffect(() => {
    eventEmitter.emit({ type: 'HAND_DEALT' })
  }, [])

  return (
    <div>
      <h1>Game Play</h1>
      <div className="mt-4">Discards: {gamePlayState.remainingDiscards}</div>
      <div>Remaining Hands: {gamePlayState.remainingHands}</div>
      <div>Current Blind: {getInProgressBlind(game)?.name}</div>
      <div>
        Ante:{' '}
        {game.rounds[game.roundIndex].baseAnte * (getInProgressBlind(game)?.anteMultiplier || 1)}
      </div>
      <div className="mt-4">
        <div className="flex justify-end">
          <Button
            disabled={gamePlayState.remainingDiscards === 0}
            onClick={() => {
              eventEmitter.emit({ type: 'DISCARD_SELECTED_CARDS' })
            }}
          >
            Discard
          </Button>
          <Button onClick={scoreHand}>Score Hand</Button>
          <Button onClick={() => setShowDeck(!showDeck)}>
            {showDeck ? 'Hide Deck' : 'Show Deck'}
          </Button>
        </div>
        <div className="mt-4">
          <Hand />
        </div>
      </div>
      {showDeck && <Deck />}

      <div>
        Blind Score: {gamePlayState.score.chips} x {gamePlayState.score.mult}
      </div>
      <div>Total Score: {game.totalScore}</div>
      <div>Selected Hand: {gamePlayState.selectedHand?.[0]?.name || 'None'}</div>
    </div>
  )
}
