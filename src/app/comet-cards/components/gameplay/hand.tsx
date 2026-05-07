'use client'

import { useMemo } from 'react'

import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { getHand } from '@/app/comet-cards/domain/game/card-registry-utils'
import { cardValuePriority } from '@/app/comet-cards/domain/hand/constants'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'
import { getInProgressBlind } from '@/app/comet-cards/domain/round/blinds'
import { useGameState } from '@/app/comet-cards/useGameState'

import { PlayingCard } from './playing-card'

const CARD_W = 92
const OVERLAP = 48

export type HandSortKey = 'value' | 'suit'

export const Hand = ({ sortKey = 'value' }: { sortKey?: HandSortKey } = {}) => {
  const { game } = useGameState()
  const { gamePlayState } = game
  const { selectedCardIds } = gamePlayState
  const dealtCards = getHand(game)

  const sortedCards: PlayingCardState[] = useMemo(() => {
    return [...dealtCards].sort((a, b) => {
      if (sortKey === 'value') {
        return (
          cardValuePriority[playingCards[b.playingCardId]?.value] -
          cardValuePriority[playingCards[a.playingCardId]?.value]
        )
      }
      const suitCompare = playingCards[a.playingCardId]?.suit.localeCompare(
        playingCards[b.playingCardId]?.suit
      )
      if (suitCompare !== 0) return suitCompare
      return (
        cardValuePriority[playingCards[b.playingCardId]?.value] -
        cardValuePriority[playingCards[a.playingCardId]?.value]
      )
    })
  }, [dealtCards, sortKey])

  const debuffedIds = useMemo(() => {
    const blind = getInProgressBlind(game)
    if (!blind || blind.type !== 'bossBlind') return new Set<string>()

    const round = game.rounds[game.roundIndex]
    const bossName = round.bossBlindName

    const ids = new Set<string>()
    for (const card of dealtCards) {
      const def = playingCards[card.playingCardId]
      if (!def) continue

      const suit = def.suit
      const value = def.value
      const isFace = value === 'J' || value === 'Q' || value === 'K'

      if (
        (bossName === 'The Club' && suit === 'clubs') ||
        (bossName === 'The Goad' && suit === 'spades') ||
        (bossName === 'The Window' && suit === 'diamonds') ||
        (bossName === 'The Head' && suit === 'hearts') ||
        (bossName === 'The Plant' && isFace) ||
        (bossName === 'The Pillar' && game.gamePlayState.cardIdsPlayedThisAnte.includes(card.id)) ||
        bossName === 'Verdant Leaf'
      ) {
        ids.add(card.id)
      }
    }
    return ids
  }, [game, dealtCards])

  const fanWidth = sortedCards.length
    ? CARD_W + (sortedCards.length - 1) * (CARD_W - OVERLAP)
    : CARD_W
  const half = sortedCards.length / 2

  return (
    <div
      className="relative mx-auto"
      style={
        {
          width: fanWidth,
          height: 160,
          perspective: 1200,
          paddingTop: 14,
          // Selected cards lift fully above the resting row instead of overlapping.
          ['--cc-card-lift' as string]: '-160px',
        } as React.CSSProperties
      }
    >
      {sortedCards.map((card, i) => {
        const isSelected = selectedCardIds.includes(card.id)
        const offsetFromCenter = i - half + 0.5
        const arcY = Math.abs(offsetFromCenter) * 3
        const rotation = offsetFromCenter * 2
        return (
          <div
            key={card.id}
            style={{
              position: 'absolute',
              left: i * (CARD_W - OVERLAP),
              top: 14 + arcY,
              transform: `rotateZ(${rotation}deg)`,
              transition: 'transform 300ms, top 300ms',
              zIndex: isSelected ? 20 : i,
              // Wrapper doesn't capture clicks — the inner BrandCard button
              // does, at its translated position. Without this, a selected
              // card's wrapper stays in the original layout slot and shadows
              // its neighbour.
              pointerEvents: 'none',
            }}
          >
            <PlayingCard
              playingCard={card}
              isSelected={isSelected}
              debuffed={debuffedIds.has(card.id)}
              onClick={(wasSelected, id) => {
                if (wasSelected) {
                  eventEmitter.emit({ type: 'CARD_DESELECTED', id })
                } else {
                  eventEmitter.emit({ type: 'CARD_SELECTED', id })
                }
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
