'use client'

import { useEffect } from 'react'

import { CurrentConsumables } from '@/app/daily-card-game/components/consumables/current-consumables'
import { PlayingCard } from '@/app/daily-card-game/components/gameplay/card'
import { CelestialCard } from '@/app/daily-card-game/components/gameplay/celestial-card'
import { Joker } from '@/app/daily-card-game/components/gameplay/joker'
import { TarotCard } from '@/app/daily-card-game/components/gameplay/tarot-card'
import { CurrentJokers } from '@/app/daily-card-game/components/joker/current-jokers'
import {
  isCelestialCardState,
  isTarotCardState,
} from '@/app/daily-card-game/domain/consumable/utils'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { isJokerState } from '@/app/daily-card-game/domain/joker/utils'
import { isPlayingCardState } from '@/app/daily-card-game/domain/playing-card/utils'
import type { BuyableCard } from '@/app/daily-card-game/domain/shop/types'
import {
  canAffordToBuy,
  getIsRoomForSelectedCard,
  getIsSelectedCardPlayable,
} from '@/app/daily-card-game/domain/shop/utils'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

function handleCardSelection(isSelected: boolean, id: string) {
  if (isSelected) {
    eventEmitter.emit({ type: 'SHOP_DESELECT_CARD', id })
  } else {
    eventEmitter.emit({ type: 'SHOP_SELECT_CARD', id })
  }
}

export function BuyableCard({
  buyableCard,
  isSelected,
}: {
  buyableCard: BuyableCard
  isSelected: boolean
}) {
  if (isCelestialCardState(buyableCard.card)) {
    return (
      <CelestialCard
        celestialCard={buyableCard.card}
        isSelected={isSelected}
        onClick={handleCardSelection}
      />
    )
  }
  if (isTarotCardState(buyableCard.card)) {
    return (
      <TarotCard
        tarotCard={buyableCard.card}
        isSelected={isSelected}
        onClick={handleCardSelection}
      />
    )
  }
  if (isJokerState(buyableCard.card)) {
    return <Joker joker={buyableCard.card} isSelected={isSelected} onClick={handleCardSelection} />
  }
  if (isPlayingCardState(buyableCard.card)) {
    return (
      <PlayingCard
        playingCard={buyableCard.card}
        isSelected={isSelected}
        onClick={handleCardSelection}
      />
    )
  }
  return null
}

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
