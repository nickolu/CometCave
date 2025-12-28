import { GameCard } from '@/app/daily-card-game/components/ui/game-card'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { getPackDefinition } from '@/app/daily-card-game/domain/shop/packs'
import type { BuyableCard, PackState } from '@/app/daily-card-game/domain/shop/types'
import { canAffordToBuy } from '@/app/daily-card-game/domain/shop/utils'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

const packRarityLabels: Record<PackState['rarity'], string> = {
  normal: 'Normal',
  jumbo: 'Jumbo',
  mega: 'Mega',
}

const cardTypeLabels: Record<BuyableCard['type'], string> = {
  playingCard: 'Playing Cards',
  tarotCard: 'Tarot Cards',
  jokerCard: 'Joker Cards',
  celestialCard: 'Celestial Cards',
  spectralCard: 'Spectral Cards',
}

function BoosterPackForSale({ pack }: { pack: PackState }) {
  const { game } = useGameState()
  const cardType = pack.cards[0].type
  const packDefinition = getPackDefinition(cardType, pack.rarity)
  const canAffordPack = canAffordToBuy(packDefinition.price, game)
  return (
    <div className="flex flex-col gap-2">
      <GameCard>
        <h2 className="text-sm font-bold">{packRarityLabels[pack.rarity]} Pack</h2>
        <p className="text-xs font-bold"> of {cardTypeLabels[cardType]}</p>
        <p className="text-xs text-gray-500">
          Choose {packDefinition.numberOfCardsToSelect} of {packDefinition.numberOfCardsPerPack}{' '}
          cards
        </p>
      </GameCard>
      <Button
        disabled={!canAffordPack}
        onClick={() => {
          eventEmitter.emit({ type: 'SHOP_OPEN_PACK', id: pack.id })
        }}
      >
        Open (${packDefinition.price})
      </Button>
    </div>
  )
}

export function BoosterPacksForSale() {
  const { game } = useGameState()
  const boosterPacks = game.shopState.packsForSale
  if (boosterPacks.length === 0) {
    return null
  }
  return (
    <div className="flex gap-2">
      {boosterPacks.map(pack => (
        <BoosterPackForSale key={pack.id} pack={pack} />
      ))}
    </div>
  )
}
