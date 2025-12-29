'use client'

import { useCallback, useEffect, useState } from 'react'

import { CurrentConsumables } from '@/app/daily-card-game/components/consumables/current-consumables'
import { Hand } from '@/app/daily-card-game/components/gameplay/hand'
import { Deck } from '@/app/daily-card-game/components/global/deck'
import { CurrentJokers } from '@/app/daily-card-game/components/joker/current-jokers'
import { Modal } from '@/app/daily-card-game/components/ui/modal'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { scoreHand as domainScoreHand } from '@/app/daily-card-game/domain/game/score-hand'
import { pokerHands } from '@/app/daily-card-game/domain/hand/hands'
import { PokerHandState } from '@/app/daily-card-game/domain/hand/types'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { useDailyCardGameStore } from '@/app/daily-card-game/store'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

const SelectedHandScore = ({ hand }: { hand: PokerHandState }) => {
  const currentHandChips =
    pokerHands[hand.handId].baseChips +
    pokerHands[hand.handId].chipIncreasePerLevel * (hand.level - 1)
  const currentHandMult =
    pokerHands[hand.handId].baseMult +
    pokerHands[hand.handId].multIncreasePerLevel * (hand.level - 1)
  return (
    <div>
      <div>
        <strong>Selected Hand:</strong>
      </div>{' '}
      <div className="pl-4">
        {pokerHands[hand.handId].name} (Lvl {hand.level}) ({currentHandChips}x{currentHandMult})
      </div>
    </div>
  )
}

function getMultTimes(card: PlayingCardState) {
  let multTimes = 1
  if (card.flags.edition === 'polychrome') multTimes += 0.5
  if (card.flags.enchantment === 'glass') multTimes += 1
  return multTimes
}

const SelectedCardDetails = ({ card }: { card: PlayingCardState }) => {
  const modifications = []
  if (card.flags.edition !== 'normal') modifications.push(card.flags.edition + ' edition')
  if (card.flags.enchantment !== 'none') modifications.push(card.flags.enchantment + ' card')
  if (card.flags.seal !== 'none') modifications.push(card.flags.seal + ' seal')
  const enchantmentChips = card.flags.enchantment === 'bonus' ? 30 : 0
  const enchantmentMult = card.flags.enchantment === 'mult' ? 5 : 0
  const editionChips = card.flags.edition === 'foil' ? 50 : 0
  const editionMultPlus = card.flags.edition === 'holographic' ? 10 : 0
  const editionMultTimes = getMultTimes(card)
  const cardChips =
    playingCards[card.playingCardId].baseChips + card.bonusChips + editionChips + enchantmentChips
  const cardMult = enchantmentMult + editionMultPlus

  return (
    <div>
      <div>
        <strong>Selected Card:</strong>
      </div>
      <div className="pl-4">
        <div>
          {playingCards[card.playingCardId].value} of {playingCards[card.playingCardId].suit}
        </div>
        <div>+ {cardChips} chips</div>
        {cardMult > 0 && <div>+ {cardMult} mult</div>}
        {editionMultTimes > 1 && <div>+ {editionMultTimes}x mult</div>}
        {modifications.length > 0 && <div>{modifications.join(', ')}</div>}
      </div>
    </div>
  )
}

const useScoreHand = () => {
  const scoreHand = useCallback(() => {
    domainScoreHand({
      getGameState: () => useDailyCardGameStore.getState().game,
    })
  }, [])
  return { scoreHand }
}

export function GamePlayView() {
  const [showDeck, setShowDeck] = useState(false)
  const { game } = useGameState()
  const { gamePlayState } = game
  const { score, selectedHand, selectedCardIds } = gamePlayState
  const selectedCard =
    selectedCardIds.length === 1
      ? game.fullDeck.find(card => card.id === selectedCardIds[0])
      : undefined
  const currentBlind = getInProgressBlind(game)

  const { isScoring, remainingDiscards } = gamePlayState
  const { scoreHand } = useScoreHand()

  useEffect(() => {
    eventEmitter.emit({ type: 'HAND_DEALT' })
  }, [])

  return (
    <ViewTemplate
      sidebarContentBottom={
        <>
          <div className="pl-2">
            <div>
              <strong>Chips x Mult:</strong> {score.chips} x {score.mult}
            </div>
            <div>
              <strong>Your Score:</strong> {currentBlind?.score}
            </div>
            {selectedHand?.[0] && <SelectedHandScore hand={game.pokerHands[selectedHand[0]]} />}
            {selectedCard && <SelectedCardDetails card={selectedCard} />}
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

        <div className="flex mt-4 gap-2 justify-start">
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
        </div>
      </div>
      <div className="mt-4">
        <Button className="bg-blue-500" onClick={() => setShowDeck(true)}>
          Show Deck
        </Button>
      </div>

      {showDeck && (
        <Modal onClose={() => setShowDeck(false)}>
          <Deck />
        </Modal>
      )}
    </ViewTemplate>
  )
}
