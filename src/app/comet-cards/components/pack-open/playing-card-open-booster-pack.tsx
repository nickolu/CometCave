'use client'

import { BuyableCard } from '@/app/comet-cards/components/shop/buyable-card'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { useGridKeyboardNav } from '@/app/comet-cards/hooks/useGridKeyboardNav'
import { useGameState } from '@/app/comet-cards/useGameState'
import { Button } from '@/components/ui/button'
import { type Variants, motion, useReducedMotion } from 'framer-motion'
import { useEffect } from 'react'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.85 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.2, 0.9, 0.3, 1] },
  },
}

export function PlayingCardOpenBoosterPack() {
  const reducedMotion = useReducedMotion()
  const { game } = useGameState()
  const { containerRef, handleKeyDown, focusedIndexRef } = useGridKeyboardNav()

  const remainingCardsToSelect = game.shopState.openPackState?.remainingCardsToSelect

  useEffect(() => {
    if (remainingCardsToSelect === 0) {
      const timer = setTimeout(() => {
        eventEmitter.emit({ type: 'SHOP_CLOSE_PACK' })
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [remainingCardsToSelect])

  if (!game.shopState.openPackState) return <div>No pack open</div>
  const cardsForSale = game.shopState.openPackState.cards

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-bold">
        Choose {game.shopState.openPackState.remainingCardsToSelect} cards
      </h2>
      <motion.div
        ref={containerRef}
        role="toolbar"
        aria-label="Playing cards"
        className="flex flex-wrap gap-2"
        variants={containerVariants}
        initial={reducedMotion ? false : 'hidden'}
        animate="visible"
        onKeyDown={handleKeyDown}
        style={{ pointerEvents: remainingCardsToSelect === 0 ? 'none' : 'auto' }}
      >
        {cardsForSale.map((buyableCard, i) => (
          <motion.div key={buyableCard.card.id} variants={itemVariants} className="flex flex-col gap-2">
            <BuyableCard
              key={buyableCard.card.id}
              buyableCard={buyableCard}
              isSelected={game.shopState.selectedCardId === buyableCard.card.id}
              tabIndex={i === focusedIndexRef.current ? 0 : -1}
            />
            {game.shopState.selectedCardId === buyableCard.card.id && (
              <Button
                onClick={() => {
                  eventEmitter.emit({
                    type: 'SHOP_SELECT_PLAYING_CARD_FROM_PACK',
                    id: buyableCard.card.id,
                  })
                }}
              >
                Select
              </Button>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
