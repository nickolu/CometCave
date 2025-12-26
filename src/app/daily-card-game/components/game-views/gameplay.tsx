'use client'

import { useEffect, useState } from 'react'

import { CurrentConsumables } from '@/app/daily-card-game/components/consumables/current-consumables'
import { Hand } from '@/app/daily-card-game/components/gameplay/hand'
import { Deck } from '@/app/daily-card-game/components/global/deck'
import { CurrentJokers } from '@/app/daily-card-game/components/joker/current-jokers'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { pokerHands } from '@/app/daily-card-game/domain/hand/hands'
import { PokerHandState } from '@/app/daily-card-game/domain/hand/types'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

const SelectedHandScore = ({ hand }: { hand: PokerHandState }) => {
  const currentHandChips =
    pokerHands[hand.handId].baseChips + pokerHands[hand.handId].chipIncreasePerLevel * hand.level
  const currentHandMult =
    pokerHands[hand.handId].baseMult + pokerHands[hand.handId].multIncreasePerLevel * hand.level
  return (
    <div>
      Selected Hand: {pokerHands[hand.handId].name} (Lvl {hand.level + 1}) ({currentHandChips}x
      {currentHandMult})
    </div>
  )
}

export function GamePlayView() {
  const [showDeck, setShowDeck] = useState(false)
  const { game } = useGameState()
  const { gamePlayState } = game
  const { score, selectedHand } = gamePlayState
  const currentBlind = getInProgressBlind(game)

  useEffect(() => {
    eventEmitter.emit({ type: 'HAND_DEALT' })
  }, [])

  return (
    <ViewTemplate>
      <div>
        <div className="flex flex-wrap justify-between ">
          <div className="mt-4 flex gap-2 justify-center w-1/2">
            <CurrentJokers />
          </div>

          <div className="flex flex-wrap gap-2 justify-end w-1/2">
            <CurrentConsumables />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Hand />
      </div>
      <Button className="bg-blue-500" onClick={() => setShowDeck(true)}>
        Show Deck
      </Button>

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
