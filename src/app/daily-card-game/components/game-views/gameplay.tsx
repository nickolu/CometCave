'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Hand } from '@/app/daily-card-game/components/gameplay/hand'
import { Joker } from '@/app/daily-card-game/components/gameplay/joker'
import { Deck } from '@/app/daily-card-game/components/global/deck'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { pokerHands } from '@/app/daily-card-game/domain/hand/hands'
import { PokerHandState } from '@/app/daily-card-game/domain/hand/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
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

const SelectedHandScore = ({ hand }: { hand: PokerHandState }) => {
  const currentHandChips =
    pokerHands[hand.handId].baseChips + pokerHands[hand.handId].chipIncreasePerLevel * hand.level
  const currentHandMult =
    pokerHands[hand.handId].baseMult + pokerHands[hand.handId].multIncreasePerLevel * hand.level
  return (
    <div>
      Selected Hand: {pokerHands[hand.handId].name} ({currentHandChips}x{currentHandMult})
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
        <div className="mt-4 flex gap-2 justify-center">
          {game.jokers.map(joker => (
            <Joker key={joker.jokerId} joker={jokers[joker.jokerId]} />
          ))}
        </div>
        <div className="mt-4">
          <Hand />
        </div>
        <div className="flex mt-4 gap-2 justify-center">
          <Button
            disabled={remainingDiscards === 0 || isScoring}
            className="bg-red-500"
            onClick={() => {
              eventEmitter.emit({ type: 'DISCARD_SELECTED_CARDS' })
            }}
          >
            Discard
          </Button>
          <Button disabled={isScoring} className="bg-green-500" onClick={scoreHand}>
            Play Hand
          </Button>
          <Button className="bg-blue-500" onClick={() => setShowDeck(true)}>
            Show Deck
          </Button>
        </div>
      </div>

      {showDeck && (
        <div className="absolute top-0 right-1/8 w-3/4 h-full bg-black/90 flex flex-col items-center justify-center p-4 rounded-l-lg border-2 border-space-white">
          <div className="flex justify-end w-3/4">
            <Button onClick={() => setShowDeck(false)}>Close</Button>
          </div>
          <Deck />
        </div>
      )}
      <div className="mt-4">
        <div>
          Blind Score: {score.chips} x {score.mult}
        </div>
        <div>Your Score: {currentBlind?.score}</div>
        {selectedHand?.[0] && <SelectedHandScore hand={game.pokerHands[selectedHand[0]]} />}
      </div>
    </ViewTemplate>
  )
}
