'use client'

import { BuyableCard } from '@/app/comet-cards/components/shop/buyable-card'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { useGameState } from '@/app/comet-cards/useGameState'
import { Button } from '@/components/ui/button'
import { motion, useReducedMotion } from 'framer-motion'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
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
  if (!game.shopState.openPackState) return <div>No pack open</div>
  const cardsForSale = game.shopState.openPackState.cards

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-bold">
        Choose {game.shopState.openPackState.remainingCardsToSelect} cards
      </h2>
      <motion.div
        className="flex flex-wrap gap-2"
        variants={containerVariants}
        initial={reducedMotion ? false : 'hidden'}
        animate="visible"
      >
        {cardsForSale.map(buyableCard => (
          <motion.div key={buyableCard.card.id} variants={itemVariants} className="flex flex-col gap-2">
            <BuyableCard
              key={buyableCard.card.id}
              buyableCard={buyableCard}
              isSelected={game.shopState.selectedCardId === buyableCard.card.id}
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
