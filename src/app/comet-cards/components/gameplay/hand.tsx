'use client'

import { useCallback, useMemo, useRef } from 'react'

import { AnimatePresence, motion } from 'framer-motion'

import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { getHand } from '@/app/comet-cards/domain/game/card-registry-utils'
import { cardValuePriority } from '@/app/comet-cards/domain/hand/constants'
import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'
import { isFaceCard } from '@/app/comet-cards/domain/playing-card/utils'
import { getInProgressBlind } from '@/app/comet-cards/domain/round/blinds'
import { useGameState } from '@/app/comet-cards/useGameState'

import { PlayingCard } from './playing-card'

export type HandSortKey = 'value' | 'suit'

export const Hand = ({ sortKey = 'value' }: { sortKey?: HandSortKey } = {}) => {
  const isLandscape = useLandscapeMobile()
  const CARD_W = isLandscape ? 58 : 92
  const OVERLAP = isLandscape ? 32 : 48
  const containerHeight = isLandscape ? 100 : 160
  const cardLift = isLandscape ? '-100px' : '-160px'

  const { game } = useGameState()
  const { gamePlayState } = game
  const { selectedCardIds } = gamePlayState
  const isDiscarding = gamePlayState.isDiscarding
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
      const isFace = isFaceCard(value, game)

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

  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const container = containerRef.current
    if (!container) return
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button.bc-card'))
    const currentIndex = buttons.indexOf(e.target as HTMLButtonElement)
    if (currentIndex === -1) return
    e.preventDefault()
    const nextIndex = e.key === 'ArrowRight'
      ? Math.min(currentIndex + 1, buttons.length - 1)
      : Math.max(currentIndex - 1, 0)
    buttons[nextIndex]?.focus()
  }, [])

  const fanWidth = sortedCards.length
    ? CARD_W + (sortedCards.length - 1) * (CARD_W - OVERLAP)
    : CARD_W
  const half = sortedCards.length / 2

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Cards in hand"
      onKeyDown={handleKeyDown}
      className="relative mx-auto"
      style={
        {
          width: fanWidth,
          height: containerHeight,
          perspective: 1200,
          paddingTop: 14,
          // Selected cards lift fully above the resting row instead of overlapping.
          ['--cc-card-lift' as string]: cardLift,
        } as React.CSSProperties
      }
    >
      <AnimatePresence>
        {sortedCards.map((card, i) => {
          const isSelected = selectedCardIds.includes(card.id)
          const offsetFromCenter = i - half + 0.5
          const arcY = Math.abs(offsetFromCenter) * 3
          const rotation = offsetFromCenter * 2
          return (
            <motion.div
              key={card.id}
              layoutId={`playing-card-${card.id}`}
              layout
              initial={{ opacity: 0, y: 60, scale: 0.8 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={isDiscarding
                ? { opacity: 0, y: 80, scale: 0.6, rotate: (i - half) * 8 }
                : { opacity: 0, y: -30, scale: 0.9 }
              }
              transition={{
                duration: 0.3,
                delay: i * 0.05,
                ease: [0.2, 0.9, 0.3, 1],
                layout: { duration: 0.3 },
              }}
              style={{
                position: 'absolute',
                left: i * (CARD_W - OVERLAP),
                top: 14 + arcY,
                transform: `rotateZ(${rotation}deg)`,
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
                size={isLandscape ? 'xs' : 'md'}
                onClick={(wasSelected, id) => {
                  if (wasSelected) {
                    eventEmitter.emit({ type: 'CARD_DESELECTED', id })
                  } else {
                    eventEmitter.emit({ type: 'CARD_SELECTED', id })
                  }
                }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
