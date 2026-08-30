'use client'

import { useEffect, useState } from 'react'

import { motion, useReducedMotion } from 'framer-motion'

import { CurrentConsumables } from '@/app/comet-cards/components/consumables/current-consumables'
import { Tag } from '@/app/comet-cards/components/gameplay/tag'
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
import { useAutoFocus } from '@/app/comet-cards/hooks/useAutoFocus'
import { useGridKeyboardNav } from '@/app/comet-cards/hooks/useGridKeyboardNav'
import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'
import { useRunHistory } from '@/app/comet-cards/hooks/useRunHistory'
import { bossBlinds } from '@/app/comet-cards/domain/round/boss-blinds'
import { useGameState } from '@/app/comet-cards/useGameState'

import { Modal } from '@/app/comet-cards/components/ui/modal'

import { ViewTemplate } from './view-template'

export function ShopView() {
  const isLandscape = useLandscapeMobile()
  const { game } = useGameState()
  const reducedMotion = useReducedMotion()
  const autoFocusRef = useAutoFocus()
  const { containerRef: cardsForSaleRef, handleKeyDown: handleCardsKeyDown, focusedIndexRef: cardsFocusedRef } = useGridKeyboardNav()
  const [showGiveUpModal, setShowGiveUpModal] = useState(false)
  const { findTodayRun } = useRunHistory()
  const isPractice = findTodayRun(game.mode) !== null

  // Shop 0 on a Last Ante run is the draft: it is wider, it names the boss the
  // player is drafting against, and leaving it opens the memory phase rather
  // than a blind.
  const isDraft = game.mode === 'lastAnte' && game.lastAnte?.draftResolved === false
  const continueLabel = isDraft ? 'Continue → Memories' : 'Continue → Blind'
  const boss = isDraft
    ? bossBlinds.find(blind => blind.name === game.rounds[game.roundIndex].bossBlindName)
    : undefined
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
    <>
    <ViewTemplate
      topBarAction={
        <GhostButton onClick={() => setShowGiveUpModal(true)} style={{ fontSize: 10, opacity: 0.6 }}>
          {isPractice ? 'Restart' : 'Give Up'}
        </GhostButton>
      }
      sidebarContentBottom={
        isLandscape ? (
          <div className="flex items-center justify-center" style={{ gap: 8 }}>
            <PrimaryButton
              onClick={() => eventEmitter.emit({ type: 'SHOP_SELECT_BLIND' })}
            >
              {continueLabel}
            </PrimaryButton>
            <DangerButton
              disabled={game.money < rerollPrice}
              onClick={() => eventEmitter.emit({ type: 'SHOP_REROLL' })}
            >
              Reroll · ${rerollPrice}
            </DangerButton>
          </div>
        ) : (
          <Panel title="Shop Actions">
            <div className="flex flex-col" style={{ gap: 8, padding: '12px 16px' }}>
              <PrimaryButton
                style={{ width: '100%' }}
                onClick={() => eventEmitter.emit({ type: 'SHOP_SELECT_BLIND' })}
              >
                {continueLabel}
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
        )
      }
    >
      <div className="flex flex-col" ref={autoFocusRef} style={{ gap: 18 }}>
        {boss && (
          <div
            style={{
              border: '1px solid var(--cc-pink-border)',
              background: 'var(--cc-pink-bg)',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <div
              className="uppercase"
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 10,
                letterSpacing: 2,
                opacity: 0.6,
              }}
            >
              Tonight you play
            </div>
            <div
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--cc-pink)',
                marginTop: 4,
              }}
            >
              {boss.name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4, lineHeight: 1.45 }}>
              {boss.description}
            </div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 10, lineHeight: 1.5 }}>
              Buy the run you wish you had played. Whatever you leave this shop with is what your
              memories will have been charging all along.
            </div>
          </div>
        )}
        <Panel
          title={isDraft ? 'The Draft' : 'Shop'}
          subtitle={`$${game.money} on hand`}
        >
          <div className="flex flex-col" style={{ padding: 16, gap: 18 }}>
            <SectionHeader label={`Your Jokers (${game.jokers.length}/${game.maxJokers})`}>
              <CurrentJokers />
            </SectionHeader>

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
                  <div
                    ref={cardsForSaleRef}
                    role="toolbar"
                    aria-label="Cards for sale"
                    className="flex flex-wrap items-stretch gap-3"
                    onKeyDown={handleCardsKeyDown}
                  >
                    {game.shopState.cardsForSale.map((buyableCard, i) => (
                      <motion.div
                        key={buyableCard.card.id}
                        className="flex flex-col items-center"
                        style={{ gap: 4 }}
                        initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.9 }}
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
                          tabIndex={i === cardsFocusedRef.current ? 0 : -1}
                        />
                        <span
                          style={{
                            fontFamily: 'var(--cc-font-mono)',
                            fontSize: 11,
                            fontWeight: 600,
                            color: canAffordToBuy(Math.floor(buyableCard.price * game.shopState.priceMultiplier), game)
                              ? 'var(--cc-gold)'
                              : 'var(--cc-text-default)',
                            opacity: canAffordToBuy(Math.floor(buyableCard.price * game.shopState.priceMultiplier), game)
                              ? 1
                              : 0.4,
                          }}
                        >
                          ${Math.floor(buyableCard.price * game.shopState.priceMultiplier)}
                        </span>
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
                      initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.9 }}
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

            {game.tags.length > 0 && (
              <SectionHeader label={`Active Tags (${game.tags.length})`}>
                <div className="flex flex-wrap" style={{ gap: 8 }}>
                  {game.tags.map(tag => (
                    <Tag key={tag.id} tag={tag} />
                  ))}
                </div>
              </SectionHeader>
            )}
          </div>
        </Panel>
      </div>
    </ViewTemplate>
    {showGiveUpModal && (
      <Modal
        eyebrow={isPractice ? 'Practice Run' : 'End Run'}
        title={isPractice ? 'Restart?' : 'Give up?'}
        onClose={() => setShowGiveUpModal(false)}
      >
        <div style={{ padding: '16px 20px', fontFamily: 'var(--cc-font-mono)', fontSize: 12 }}>
          <p style={{ opacity: 0.7, marginBottom: 16 }}>
            {isPractice
              ? "Start over from round 1. Practice runs don't record scores."
              : `Your current score of ${game.totalScore.toString()} will be your final score for today.`}
          </p>
          <div className="flex items-center justify-end gap-3">
            <GhostButton onClick={() => setShowGiveUpModal(false)}>Cancel</GhostButton>
            {isPractice ? (
              <PrimaryButton onClick={() => eventEmitter.emit({ type: 'GAME_START' })}>
                Restart
              </PrimaryButton>
            ) : (
              <DangerButton onClick={() => eventEmitter.emit({ type: 'GIVE_UP' })}>
                Give Up
              </DangerButton>
            )}
          </div>
        </div>
      </Modal>
    )}
    </>
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
