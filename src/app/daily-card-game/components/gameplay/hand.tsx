'use client'

import { useMemo, useState } from 'react'

import { cardValuePriority } from '@/app/daily-card-game/domain/hand/constants'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { cn } from '@/lib/utils'

import { Card } from './card'

export const Hand = () => {
  const [sortKey, setSortKey] = useState<'value' | 'suit'>('value')
  const { game } = useGameState()
  const { gamePlayState } = game
  const { dealtCards, selectedCardIds } = gamePlayState

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
    <div>
      <div className="flex flex-wrap gap-2 w-full justify-center">
        {sortedCards?.map((card: PlayingCardState, index: number) => (
          <Card
            key={card.id}
            playingCard={card}
            handIndex={index}
            isSelected={selectedCardIds.includes(card.id)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 w-full justify-center mt-2">
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
  )
}
