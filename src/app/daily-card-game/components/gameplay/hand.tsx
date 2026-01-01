'use client'

import { useMemo, useState } from 'react'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { getHand } from '@/app/daily-card-game/domain/game/card-registry-utils'
import { cardValuePriority } from '@/app/daily-card-game/domain/hand/constants'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { cn } from '@/lib/utils'

import { PlayingCard } from './playing-card'

export const Hand = () => {
  const [sortKey, setSortKey] = useState<'value' | 'suit'>('value')
  const { game } = useGameState()
  const { gamePlayState } = game
  const { selectedCardIds } = gamePlayState
  const dealtCards = getHand(game)

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
    </>
  )
}
