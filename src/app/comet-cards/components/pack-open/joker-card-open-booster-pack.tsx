'use client'

import { CurrentConsumables } from '@/app/comet-cards/components/consumables/current-consumables'
import { CurrentJokers } from '@/app/comet-cards/components/joker/current-jokers'
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

export function JokerCardOpenBoosterPack() {
  const reducedMotion = useReducedMotion()
  const { game } = useGameState()
  if (!game.shopState.openPackState) return <div>No pack open</div>
  const cardsForSale = game.shopState.openPackState.cards

  return (
    <div className="flex flex-col gap-2">
      {game.jokers.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2">Current Jokers</h3>
          <div className="flex flex-wrap">
            <CurrentJokers />
          </div>
        </div>
      )}

      <div className="flex">
        <div className="flex flex-col gap-2 w-3/4">
          <h2 className="text-xl font-bold">
            Select {game.shopState.openPackState.remainingCardsToSelect} joker
            {game.shopState.openPackState.remainingCardsToSelect > 1 ? 's' : ''}
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
                        type: 'SHOP_SELECT_JOKER_FROM_PACK',
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
        {game.consumables.length > 0 && (
          <div className="flex flex-col items-end gap-2 w-1/4">
            <h3 className="mb-2">Consumables</h3>
            <div className="flex flex-wrap justify-end">
              <CurrentConsumables />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
