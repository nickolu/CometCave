'use client'

import { useEffect } from 'react'

import { CurrentConsumables } from '@/app/daily-card-game/components/consumables/current-consumables'
import { CurrentJokers } from '@/app/daily-card-game/components/joker/current-jokers'
import { BuyableCard } from '@/app/daily-card-game/components/shop/buyable-card'
import { Voucher } from '@/app/daily-card-game/components/shop/voucher'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import {
  canAffordToBuy,
  getIsRoomForSelectedCard,
  getIsSelectedCardPlayable,
} from '@/app/daily-card-game/domain/shop/utils'
import { VOUCHER_PRICE } from '@/app/daily-card-game/domain/voucher/constants'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

export function ShopView() {
  const { game } = useGameState()

  useEffect(() => {
    eventEmitter.emit({ type: 'SHOP_OPEN' })
  }, [])

  const selectedCard = game.shopState.cardsForSale.find(
    card => card.card.id === game.shopState.selectedCardId
  )
  const canAffordSelectedCard = canAffordToBuy(selectedCard?.price, game)
  const isSelectedCardPlayable = getIsSelectedCardPlayable(selectedCard, game)
  const isRoomForSelectedCard = getIsRoomForSelectedCard(selectedCard, game)

  return (
    <ViewTemplate
      sidebarContentBottom={
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              eventEmitter.emit({ type: 'SHOP_SELECT_BLIND' })
            }}
          >
            Finish and Select Blind
          </Button>
          <Button
            disabled={game.money < game.shopState.baseRerollPrice + game.shopState.rerollsUsed}
            onClick={() => {
              eventEmitter.emit({ type: 'SHOP_REROLL' })
            }}
          >
            Reroll (${game.shopState.baseRerollPrice + game.shopState.rerollsUsed})
          </Button>
        </div>
      }
    >
      <h2 className="text-xl font-bold">Shop</h2>
      <div className="flex">
        <div className="flex flex-col gap-2 w-3/4">
          {game.jokers.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2">Jokers</h3>
              <div className="flex flex-wrap">
                <CurrentJokers />
              </div>
            </div>
          )}
          <div className="mt-4">
            <h3 className="mb-2">Cards for Sale</h3>
            <div className="flex gap-2">
              {game.shopState.cardsForSale.map(buyableCard => (
                <BuyableCard
                  key={buyableCard.card.id}
                  buyableCard={buyableCard}
                  isSelected={game.shopState.selectedCardId === buyableCard.card.id}
                />
              ))}
            </div>
          </div>
          {selectedCard && (
            <div className="mt-4">
              <Button
                disabled={!canAffordSelectedCard || !isRoomForSelectedCard}
                onClick={() => {
                  eventEmitter.emit({ type: 'SHOP_BUY_CARD' })
                }}
              >
                Buy (${selectedCard.price})
              </Button>
              <Button
                disabled={!canAffordSelectedCard || !isSelectedCardPlayable}
                onClick={() => {
                  eventEmitter.emit({ type: 'SHOP_BUY_AND_USE_CARD' })
                }}
              >
                Buy and Use (${selectedCard.price})
              </Button>
            </div>
          )}
          {game.shopState.voucher !== null && (
            <div className="mt-4">
              <h3 className="mb-2">Voucher</h3>
              <div className="flex flex-wrap">
                <Voucher voucher={game.shopState.voucher} />
              </div>
              <Button
                onClick={() => {
                  eventEmitter.emit({ type: 'VOUCHER_PURCHASED', id: game.shopState.voucher! })
                }}
              >
                Buy (${VOUCHER_PRICE})
              </Button>
            </div>
          )}
        </div>
        {game.consumables.length > 0 && (
          <div className="flex flex-col items-end gap-2 w-1/4 mt-4">
            <h3 className="mb-2">Consumables</h3>
            <div className="flex flex-wrap justify-end">
              <CurrentConsumables />
            </div>
          </div>
        )}
      </div>
    </ViewTemplate>
  )
}
