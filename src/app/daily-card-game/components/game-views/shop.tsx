'use client'

import { useEffect } from 'react'

import { CurrentConsumables } from '@/app/daily-card-game/components/consumables/current-consumables'
import { CurrentJokers } from '@/app/daily-card-game/components/joker/current-jokers'
import { BoosterPacksForSale } from '@/app/daily-card-game/components/shop/booster-packs'
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
    if (!game.shopState.isOpen) {
      eventEmitter.emit({ type: 'SHOP_OPEN' })
    }
  }, [game.shopState.isOpen])

  const selectedCard = game.shopState.cardsForSale.find(
    card => card.card.id === game.shopState.selectedCardId
  )
  const canAffordSelectedCard = canAffordToBuy(selectedCard?.price, game)
  const canAffordVoucher = canAffordToBuy(VOUCHER_PRICE, game)
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
            <div className="mt-4 flex gap-2">
              <Button
                disabled={!canAffordSelectedCard || !isRoomForSelectedCard}
                onClick={() => {
                  eventEmitter.emit({ type: 'SHOP_BUY_CARD' })
                }}
              >
                Buy (${Math.floor(selectedCard.price * game.shopState.priceMultiplier)})
              </Button>
              <Button
                disabled={!canAffordSelectedCard || !isSelectedCardPlayable}
                onClick={() => {
                  eventEmitter.emit({ type: 'SHOP_BUY_AND_USE_CARD' })
                }}
              >
                Buy and Use (${Math.floor(selectedCard.price * game.shopState.priceMultiplier)})
              </Button>
            </div>
          )}
          <div className="flex justify-between gap-2 mt-4 w-full">
            {game.shopState.voucher !== null && (
              <div className="mt-4">
                <h3 className="mb-2">Voucher</h3>
                <div className="flex flex-wrap">
                  <Voucher voucher={game.shopState.voucher} />
                </div>
                <Button
                  disabled={!canAffordVoucher}
                  onClick={() => {
                    eventEmitter.emit({ type: 'SHOP_BUY_VOUCHER', id: game.shopState.voucher! })
                  }}
                >
                  Buy (${VOUCHER_PRICE})
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 w-1/3">
          {game.consumables.length > 0 && (
            <div className="flex flex-col items-end gap-2 mt-4">
              <h3 className="mb-2">Consumables</h3>
              <div className="flex flex-wrap justify-end">
                <CurrentConsumables />
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-col items-end gap-2">
            <h3 className="mb-2">Booster Packs</h3>
            <BoosterPacksForSale />
          </div>
        </div>
      </div>
    </ViewTemplate>
  )
}
