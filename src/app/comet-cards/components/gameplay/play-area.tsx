'use client'

import { AnimatePresence, motion } from 'framer-motion'

import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'
import { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'

import { PlayingCard } from './playing-card'

export function PlayArea({
  cards,
  visible,
}: {
  cards: PlayingCardState[]
  visible: boolean
}) {
  const isLandscape = useLandscapeMobile()
  const CARD_W = isLandscape ? 52 : 80
  const GAP = 8

  if (!visible || cards.length === 0) return null

  return (
    <div
      className="flex items-center justify-center"
      style={{
        minHeight: isLandscape ? 80 : 120,
        gap: GAP,
        padding: '8px 0',
      }}
    >
      <AnimatePresence>
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            layoutId={`playing-card-${card.id}`}
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.35,
              delay: i * 0.05,
              ease: [0.2, 0.9, 0.3, 1],
              layout: { duration: 0.4, ease: [0.2, 0.9, 0.3, 1] },
            }}
            style={{ width: CARD_W, flexShrink: 0 }}
          >
            <PlayingCard
              playingCard={card}
              isSelected={false}
              size={isLandscape ? 'xs' : 'sm'}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
