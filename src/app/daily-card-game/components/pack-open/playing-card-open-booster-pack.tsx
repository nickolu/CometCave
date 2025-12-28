'use client'

import { BuyableCard } from '@/app/daily-card-game/components/shop/buyable-card'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

export function PlayingCardOpenBoosterPack() {
  const { game } = useGameState()
  if (!game.shopState.openPackState) return <div>No pack open</div>
  const cardsForSale = game.shopState.openPackState.cards

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-bold">
        Choose {game.shopState.openPackState.remainingCardsToSelect} cards
      </h2>
      <div className="flex flex-wrap gap-2">
        {cardsForSale.map(buyableCard => (
          <div key={buyableCard.card.id} className="flex flex-col gap-2">
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
          </div>
        ))}
      </div>
    </div>
  )
}
