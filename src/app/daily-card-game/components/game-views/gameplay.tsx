'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Hand } from '@/app/daily-card-game/components/gameplay/hand'
import { Joker } from '@/app/daily-card-game/components/gameplay/joker'
import { Deck } from '@/app/daily-card-game/components/global/deck'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { HandState } from '@/app/daily-card-game/domain/hand/types'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { useDailyCardGameStore } from '@/app/daily-card-game/store'
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

    if (selectedCardIds.length === 0) return

    isScoringRef.current = true
    try {
      eventEmitter.emit({ type: 'HAND_SCORING_START' })

      const cardsToScoreCount =
        useDailyCardGameStore.getState().game.gamePlayState.cardsToScore.length

      for (let i = 0; i < cardsToScoreCount; i++) {
        await sleep(250)
        eventEmitter.emit({ type: 'CARD_SCORED' })
      }

      await sleep(750)
      eventEmitter.emit({ type: 'HAND_SCORING_END' })
    } finally {
      isScoringRef.current = false
    }
  }, [selectedCardIds])
  return { scoreHand }
}

const SelectedHandScore = ({ hand }: { hand: HandState }) => {
  const currentHandChips = hand.hand.baseChips + hand.hand.chipIncreasePerLevel * hand.level
  const currentHandMult = hand.hand.baseMult + hand.hand.multIncreasePerLevel * hand.level
  return (
    <div>
      Selected Hand: {hand.hand.name} ({currentHandChips}x{currentHandMult})
    </div>
  )
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
        <div className="mt-4 flex gap-2">
          {game.jokers.map(joker => (
            <Joker key={joker.id} joker={joker} />
          ))}
        </div>
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
            Play Hand
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
        {selectedHand?.[0]?.name && (
          <SelectedHandScore hand={game.pokerHands[selectedHand[0].id]} />
        )}
      </div>
    </ViewTemplate>
  )
}
