import { CelestialCard } from '@/app/comet-cards/components/gameplay/celestial-card'
import { Joker } from '@/app/comet-cards/components/gameplay/joker'
import { PlayingCard } from '@/app/comet-cards/components/gameplay/playing-card'
import { SpectralCard } from '@/app/comet-cards/components/gameplay/spectral-card'
import { TarotCard } from '@/app/comet-cards/components/gameplay/tarot-card'
import {
  isCelestialCardState,
  isTarotCardState,
} from '@/app/comet-cards/domain/consumable/utils'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { isJokerState } from '@/app/comet-cards/domain/joker/utils'
import { isPlayingCardState } from '@/app/comet-cards/domain/playing-card/utils'
import type { BuyableCard } from '@/app/comet-cards/domain/shop/types'
import { isSpectralCardState } from '@/app/comet-cards/domain/spectral/utils'

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
  if (isSpectralCardState(buyableCard.card)) {
    return (
      <SpectralCard
        spectralCard={buyableCard.card}
        isSelected={isSelected}
        onClick={handleCardSelection}
      />
    )
  }
  return null
}
