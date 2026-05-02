'use client'

import { useState } from 'react'

import { GhostButton } from '@/app/daily-card-game/components/cosmic/buttons'
import { PlayingCard } from '@/app/daily-card-game/components/gameplay/playing-card'
import { getDrawPile, getOwnedCards } from '@/app/daily-card-game/domain/game/card-registry-utils'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { useGameState } from '@/app/daily-card-game/useGameState'

const SUIT_ORDER: Array<{ key: 'spades' | 'hearts' | 'clubs' | 'diamonds'; label: string }> = [
  { key: 'spades', label: 'Spades' },
  { key: 'hearts', label: 'Hearts' },
  { key: 'clubs', label: 'Clubs' },
  { key: 'diamonds', label: 'Diamonds' },
]

const SuitRow = ({
  label,
  suit,
  cards,
}: {
  label: string
  suit: 'spades' | 'hearts' | 'clubs' | 'diamonds'
  cards: PlayingCardState[]
}) => {
  return (
    <div data-suit={suit}>
      <div
        className="mb-2 flex items-center gap-2 uppercase"
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 10,
          letterSpacing: 2,
          color: 'var(--cc-suit-color)',
          opacity: 0.85,
        }}
      >
        <span>{label}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ opacity: 0.6 }}>{cards.length}</span>
      </div>
      <div className="flex flex-wrap items-end" style={{ minHeight: 132 }}>
        {cards.length === 0 ? (
          <div
            className="uppercase"
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              letterSpacing: 2,
              opacity: 0.35,
            }}
          >
            No cards
          </div>
        ) : (
          cards.map((card, index) => (
            <div key={card.id} style={{ marginLeft: index === 0 ? 0 : -52 }}>
              <PlayingCard playingCard={card} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export const Deck = () => {
  const { game } = useGameState()
  const [deckType, setDeckType] = useState<'remaining' | 'full'>('remaining')

  const deck = deckType === 'remaining' ? getDrawPile(game) : getOwnedCards(game)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <GhostButton
          onClick={() => setDeckType('remaining')}
          style={
            deckType === 'remaining'
              ? { color: 'var(--cc-mint)', borderColor: 'var(--cc-mint)' }
              : undefined
          }
        >
          Remaining
        </GhostButton>
        <GhostButton
          onClick={() => setDeckType('full')}
          style={
            deckType === 'full'
              ? { color: 'var(--cc-mint)', borderColor: 'var(--cc-mint)' }
              : undefined
          }
        >
          Full
        </GhostButton>
      </div>

      <div className="flex flex-col gap-4">
        {SUIT_ORDER.map(({ key, label }) => (
          <SuitRow
            key={key}
            label={label}
            suit={key}
            cards={deck.filter(card => playingCards[card.playingCardId].suit === key)}
          />
        ))}
      </div>
    </div>
  )
}
