import { CelestialCard } from '@/app/daily-card-game/components/gameplay/celestial-card'
import { Joker } from '@/app/daily-card-game/components/gameplay/joker'
import { PlayingCard } from '@/app/daily-card-game/components/gameplay/playing-card'
import { SpectralCard } from '@/app/daily-card-game/components/gameplay/spectral-card'
import { TarotCard } from '@/app/daily-card-game/components/gameplay/tarot-card'
import {
  isCelestialCardState,
  isTarotCardState,
} from '@/app/daily-card-game/domain/consumable/utils'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { isJokerState } from '@/app/daily-card-game/domain/joker/utils'
import { isPlayingCardState } from '@/app/daily-card-game/domain/playing-card/utils'
import type { BuyableCard } from '@/app/daily-card-game/domain/shop/types'
import { isSpectralCardState } from '@/app/daily-card-game/domain/spectral/utils'

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
