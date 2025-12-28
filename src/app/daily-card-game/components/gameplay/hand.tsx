'use client'

import { useCallback, useMemo, useState } from 'react'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { scoreHand as domainScoreHand } from '@/app/daily-card-game/domain/game/score-hand'
import { cardValuePriority } from '@/app/daily-card-game/domain/hand/constants'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { useDailyCardGameStore } from '@/app/daily-card-game/store'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { PlayingCard } from './playing-card'

const useScoreHand = () => {
  const scoreHand = useCallback(() => {
    domainScoreHand({
      getGameState: () => useDailyCardGameStore.getState().game,
    })
  }, [])
  return { scoreHand }
}

export const Hand = () => {
  const [sortKey, setSortKey] = useState<'value' | 'suit'>('value')
  const { game } = useGameState()
  const { gamePlayState } = game
  const { dealtCards, selectedCardIds } = gamePlayState
  const { isScoring, remainingDiscards } = gamePlayState
  const { scoreHand } = useScoreHand()

  const sortedCards: PlayingCardState[] | undefined = useMemo(() => {
    return (
      [...dealtCards].sort((a, b) => {
        if (sortKey === 'value') {
          return (
            cardValuePriority[playingCards[b.playingCardId]?.value] -
            cardValuePriority[playingCards[a.playingCardId]?.value]
          )
        }
        return playingCards[a.playingCardId]?.suit.localeCompare(
          playingCards[b.playingCardId]?.suit
        )
      }) ?? undefined
    )
  }, [dealtCards, sortKey])

  return (
    <>
      <div>
        <div className="flex flex-wrap gap-2 w-full justify-start">
          {sortedCards?.map((card: PlayingCardState) => (
            <PlayingCard
              key={card.id}
              playingCard={card}
              isSelected={selectedCardIds.includes(card.id)}
              onClick={(isSelected, id) => {
                if (isSelected) {
                  eventEmitter.emit({ type: 'CARD_DESELECTED', id })
                } else {
                  eventEmitter.emit({ type: 'CARD_SELECTED', id })
                }
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 w-full justify-start mt-2">
          Sort By:{' '}
          <span
            className={cn(
              'cursor-pointer text-underline inline-block',
              sortKey === 'value' ? 'text-white font-bold' : 'text-space-gray'
            )}
            onClick={() => setSortKey('value')}
          >
            Value
          </span>
          <span
            className={cn(
              'cursor-pointer text-underline inline-block',
              sortKey === 'suit' ? 'text-white font-bold' : 'text-space-gray'
            )}
            onClick={() => setSortKey('suit')}
          >
            Suit
          </span>
        </div>
      </div>

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
    </>
  )
}
