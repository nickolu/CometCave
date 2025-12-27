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
      <div>
        <strong>Selected Hand:</strong>
      </div>{' '}
      <div className="pl-4">
        {pokerHands[hand.handId].name} (Lvl {hand.level + 1}) ({currentHandChips}x{currentHandMult})
      </div>
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
    <ViewTemplate
      sidebarContentBottom={
        <>
          <div className="pl-2">
            <div>
              <strong>Blind Score:</strong> {score.chips} x {score.mult}
            </div>
            <div>
              <strong>Your Score:</strong> {currentBlind?.score}
            </div>
            {selectedHand?.[0] && <SelectedHandScore hand={game.pokerHands[selectedHand[0]]} />}
          </div>
          <hr />
        </>
      }
    >
      <div>
        <div className="flex flex-wrap justify-between ">
          {game.jokers.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 justify-start w-3/4">
              <h3 className="mb-2">Jokers</h3>
              <CurrentJokers />
            </div>
          )}

          {game.consumables.length > 0 && (
            <div className="flex flex-col gap-2 justify-end text-rightw-1/4">
              <h3 className="mb-2">Consumables</h3>
              <CurrentConsumables />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <h3 className="mb-2">Hand</h3>
        <Hand />
      </div>
      <div className="mt-4">
        <Button className="bg-blue-500" onClick={() => setShowDeck(true)}>
          Show Deck
        </Button>
      </div>

      {showDeck && (
        <div className="absolute top-0 right-1/8 w-3/4 h-full bg-black/90 flex flex-col items-center justify-center p-4 rounded-l-lg border-2 border-space-white">
          <div className="flex justify-end w-3/4">
            <Button onClick={() => setShowDeck(false)}>Close</Button>
          </div>
          <Deck />
        </div>
      )}
    </ViewTemplate>
  )
}
