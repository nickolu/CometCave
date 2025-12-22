'use client'

import { useMemo, useState } from 'react'

import { cardValuePriority } from '@/app/daily-card-game/domain/decks/poker-deck'
import { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

import { Card } from './card'

export const Hand = () => {
  const [sortKey, setSortKey] = useState<'value' | 'suit'>('value')
  const { game } = useGameState()
  const { gamePlayState } = game
  const { dealtCards, selectedCardIds } = gamePlayState

  const sortedCards = useMemo(() => {
    return (
      [...dealtCards].sort((a, b) => {
        if (sortKey === 'value') {
          return cardValuePriority[b.value] - cardValuePriority[a.value]
        }
        return a.suit.localeCompare(b.suit)
      }) ?? []
    )
  }, [dealtCards, sortKey])

  return (
    <div>
      <div className="flex flex-wrap gap-2 w-full">
        {sortedCards.map((card: PlayingCard, index: number) => (
          <Card
            key={card.id}
            playingCard={card}
            handIndex={index}
            isSelected={selectedCardIds.includes(card.id)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 w-full">
        <Button
          className={sortKey === 'value' ? 'border-white border-2' : ''}
          onClick={() => setSortKey('value')}
        >
          Sort by Value
        </Button>
        <Button
          className={sortKey === 'suit' ? 'border-white border-2' : ''}
          onClick={() => setSortKey('suit')}
        >
          Sort by Suit
        </Button>
      </div>
    </div>
  )
}
