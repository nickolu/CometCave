'use client'

import { useState } from 'react'

import { PlayingCard } from '@/app/daily-card-game/components/gameplay/playing-card'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CardRow = ({ cards }: { cards: PlayingCardState[] }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {cards.map((card, index) => (
        <div key={card.id} className={index !== 0 ? '-ml-16' : ''}>
          <PlayingCard playingCard={card} />
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
  const spades = deck.filter(card => playingCards[card.playingCardId].suit === 'spades')
  const hearts = deck.filter(card => playingCards[card.playingCardId].suit === 'hearts')
  const clubs = deck.filter(card => playingCards[card.playingCardId].suit === 'clubs')
  const diamonds = deck.filter(card => playingCards[card.playingCardId].suit === 'diamonds')

  return (
    <div>
      <div className="mb-2">
        {' '}
        <Button
          className={cn(deckType === 'remaining' ? 'bg-space-blue' : 'bg-space-grey')}
          onClick={() => setDeckType('remaining')}
        >
          Remaining Deck
        </Button>
        <Button
          className={cn(deckType === 'full' ? 'bg-space-blue' : 'bg-space-grey')}
          onClick={() => setDeckType('full')}
        >
          Full Deck
        </Button>
      </div>

      <CardRow cards={spades} />
      <CardRow cards={hearts} />
      <CardRow cards={clubs} />
      <CardRow cards={diamonds} />
    </div>
  )
}
