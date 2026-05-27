'use client'

import { motion, useReducedMotion } from 'framer-motion'

import { PrimaryButton } from '@/app/comet-cards/components/cosmic/buttons'
import { TokenCard } from '@/app/comet-cards/components/cosmic/token-card'
import { getPackDefinition } from '@/app/comet-cards/domain/booster-pack/utils'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import type { BuyableCard, PackState } from '@/app/comet-cards/domain/shop/types'
import { canAffordToBuy } from '@/app/comet-cards/domain/shop/utils'
import { useGameState } from '@/app/comet-cards/useGameState'

const packRarityLabels: Record<PackState['rarity'], string> = {
  normal: 'Normal',
  jumbo: 'Jumbo',
  mega: 'Mega',
}

const cardTypeLabels: Record<BuyableCard['type'], string> = {
  playingCard: 'Playing Cards',
  tarotCard: 'Tarot Cards',
  jokerCard: 'Jokers',
  celestialCard: 'Celestials',
  spectralCard: 'Spectrals',
}

const cardTypeAccent: Record<BuyableCard['type'], string> = {
  playingCard: 'var(--cc-mint)',
  tarotCard: 'var(--cc-pink)',
  jokerCard: 'var(--cc-mint)',
  celestialCard: 'var(--cc-gold)',
  spectralCard: 'var(--cc-rarity-uncommon)',
}

const cardTypeGlyph: Record<BuyableCard['type'], string> = {
  playingCard: '♣',
  tarotCard: '◈',
  jokerCard: '✺',
  celestialCard: '✷',
  spectralCard: '✦',
}

function BoosterPackForSale({ pack }: { pack: PackState }) {
  const { game } = useGameState()
  const cardType = pack.cards[0].type
  const packDefinition = getPackDefinition(cardType, pack.rarity)
  const discountedPrice = Math.floor(packDefinition.price * game.shopState.priceMultiplier)
  const canAffordPack = canAffordToBuy(discountedPrice, game)
  return (
    <div className="flex flex-col items-stretch gap-2">
      <TokenCard
        title={`${packRarityLabels[pack.rarity]} Pack`}
        description={`${cardTypeLabels[cardType]} · choose ${packDefinition.numberOfCardsToSelect} of ${packDefinition.numberOfCardsPerPack}`}
        glyph={cardTypeGlyph[cardType]}
        accent={cardTypeAccent[cardType]}
        size="sm"
      />
      <PrimaryButton
        style={{ width: '100%' }}
        disabled={!canAffordPack}
        onClick={() => eventEmitter.emit({ type: 'SHOP_OPEN_PACK', id: pack.id })}
      >
        Open · ${discountedPrice}
      </PrimaryButton>
    </div>
  )
}

export function BoosterPacksForSale() {
  const { game } = useGameState()
  const reducedMotion = useReducedMotion()
  const boosterPacks = game.shopState.packsForSale
  if (boosterPacks.length === 0) return null
  return (
    <div className="flex flex-wrap items-stretch gap-3">
      {boosterPacks.map((pack, i) => (
        <motion.div
          key={pack.id}
          initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.3,
            delay: 0.15 + i * 0.08,
            ease: [0.2, 0.9, 0.3, 1],
          }}
        >
          <BoosterPackForSale pack={pack} />
        </motion.div>
      ))}
    </div>
  )
}
