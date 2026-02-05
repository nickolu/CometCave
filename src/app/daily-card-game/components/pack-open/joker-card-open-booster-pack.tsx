'use client'

import { CurrentConsumables } from '@/app/daily-card-game/components/consumables/current-consumables'
import { CurrentJokers } from '@/app/daily-card-game/components/joker/current-jokers'
import { BuyableCard } from '@/app/daily-card-game/components/shop/buyable-card'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

export function JokerCardOpenBoosterPack() {
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
                        type: 'SHOP_SELECT_JOKER_FROM_PACK',
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
