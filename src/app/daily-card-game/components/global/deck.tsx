'use client'

import { useState } from 'react'

import { Card } from '@/app/daily-card-game/components/gameplay/card'
import { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

const CardRow = ({ cards }: { cards: PlayingCard[] }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {cards.map((card, index) => (
        <div key={card.id} className={index !== 0 ? '-ml-16' : ''}>
          <Card playingCard={card} />
        </div>
      ))}
    </div>
  )
}

export const Deck = () => {
  const { game } = useGameState()
  const { gamePlayState, fullDeck } = game
  const { remainingDeck } = gamePlayState
  const [deckType, setDeckType] = useState<'remaining' | 'full'>('remaining')

  const deck = deckType === 'remaining' ? remainingDeck : fullDeck
  const spades = deck.filter(card => card.suit === 'spades')
  const hearts = deck.filter(card => card.suit === 'hearts')
  const clubs = deck.filter(card => card.suit === 'clubs')
  const diamonds = deck.filter(card => card.suit === 'diamonds')

  return (
    <div>
      <Button onClick={() => setDeckType(deckType === 'remaining' ? 'full' : 'remaining')}>
        Show {deckType === 'remaining' ? 'Full' : 'Remaining'} Deck
      </Button>

      <CardRow cards={spades} />
      <CardRow cards={hearts} />
      <CardRow cards={clubs} />
      <CardRow cards={diamonds} />
    </div>
  )
}
