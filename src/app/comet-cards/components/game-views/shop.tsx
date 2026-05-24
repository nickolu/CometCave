'use client'

import { useEffect } from 'react'

import { motion } from 'framer-motion'

import { CurrentConsumables } from '@/app/comet-cards/components/consumables/current-consumables'
import {
  DangerButton,
  GhostButton,
  PrimaryButton,
} from '@/app/comet-cards/components/cosmic/buttons'
import { Panel } from '@/app/comet-cards/components/cosmic/panel'
import { CurrentJokers } from '@/app/comet-cards/components/joker/current-jokers'
import { BoosterPacksForSale } from '@/app/comet-cards/components/shop/booster-packs'
import { BuyableCard } from '@/app/comet-cards/components/shop/buyable-card'
import { Voucher } from '@/app/comet-cards/components/shop/voucher'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import {
  canAffordToBuy,
  getIsRoomForSelectedCard,
  getIsSelectedCardPlayable,
} from '@/app/comet-cards/domain/shop/utils'
import { VOUCHER_PRICE } from '@/app/comet-cards/domain/voucher/constants'
import { useGameState } from '@/app/comet-cards/useGameState'

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
  const rerollPrice = game.shopState.baseRerollPrice + game.shopState.rerollsUsed

  return (
    <ViewTemplate
      sidebarContentBottom={
        <Panel title="Shop Actions">
          <div className="flex flex-col" style={{ gap: 8, padding: '12px 16px' }}>
            <PrimaryButton
              style={{ width: '100%' }}
              onClick={() => eventEmitter.emit({ type: 'SHOP_SELECT_BLIND' })}
            >
              Continue → Blind
            </PrimaryButton>
            <DangerButton
              style={{ width: '100%' }}
              disabled={game.money < rerollPrice}
              onClick={() => eventEmitter.emit({ type: 'SHOP_REROLL' })}
            >
              Reroll · ${rerollPrice}
            </DangerButton>
          </div>
        </Panel>
      }
    >
      <div className="flex flex-col" style={{ gap: 18 }}>
        <Panel
          title="Shop"
          subtitle={`$${game.money} on hand`}
        >
          <div className="flex flex-col" style={{ padding: 16, gap: 18 }}>
            {game.jokers.length > 0 && (
              <SectionHeader label="Jokers in Play">
                <CurrentJokers />
              </SectionHeader>
            )}

            {/* Two-column grid: Cards for Sale (left) | Voucher + Booster Packs (right) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 18,
              }}
              className="shop-two-col"
            >
              {/* Left column: Cards for Sale */}
              <div className="flex flex-col" style={{ gap: 12 }}>
                <SectionHeader label="Cards for Sale">
                  <div className="flex flex-wrap items-stretch gap-3">
                    {game.shopState.cardsForSale.map((buyableCard, i) => (
                      <motion.div
                        key={buyableCard.card.id}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          duration: 0.3,
                          delay: i * 0.08,
                          ease: [0.2, 0.9, 0.3, 1],
                        }}
                      >
                        <BuyableCard
                          buyableCard={buyableCard}
                          isSelected={game.shopState.selectedCardId === buyableCard.card.id}
                        />
                      </motion.div>
                    ))}
                  </div>
                </SectionHeader>

                {selectedCard && (
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton
                      disabled={!canAffordSelectedCard || !isRoomForSelectedCard}
                      onClick={() => eventEmitter.emit({ type: 'SHOP_BUY_CARD' })}
                    >
                      Buy · ${Math.floor(selectedCard.price * game.shopState.priceMultiplier)}
                    </PrimaryButton>
                    <GhostButton
                      disabled={!canAffordSelectedCard || !isSelectedCardPlayable}
                      onClick={() => eventEmitter.emit({ type: 'SHOP_BUY_AND_USE_CARD' })}
                    >
                      Buy &amp; Use · ${Math.floor(selectedCard.price * game.shopState.priceMultiplier)}
                    </GhostButton>
                  </div>
                )}
              </div>

              {/* Right column: Voucher + Booster Packs */}
              <div className="flex flex-col" style={{ gap: 18 }}>
                {game.shopState.voucher && (
                  <SectionHeader label="Voucher">
                    <motion.div
                      className="flex flex-wrap items-center gap-3"
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: 0.3,
                        delay: 0.1,
                        ease: [0.2, 0.9, 0.3, 1],
                      }}
                    >
                      <Voucher voucher={game.shopState.voucher} />
                      <PrimaryButton
                        disabled={!canAffordVoucher}
                        onClick={() =>
                          eventEmitter.emit({
                            type: 'SHOP_BUY_VOUCHER',
                            id: game.shopState.voucher!,
                          })
                        }
                      >
                        Buy · ${VOUCHER_PRICE}
                      </PrimaryButton>
                    </motion.div>
                  </SectionHeader>
                )}

                <SectionHeader label="Booster Packs">
                  <BoosterPacksForSale />
                </SectionHeader>
              </div>
            </div>

            {game.consumables.length > 0 && (
              <SectionHeader label="Your Consumables">
                <CurrentConsumables />
              </SectionHeader>
            )}
          </div>
        </Panel>
      </div>
    </ViewTemplate>
  )
}

function SectionHeader({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <div
        className="uppercase"
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 10,
          letterSpacing: 2,
          opacity: 0.55,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}
