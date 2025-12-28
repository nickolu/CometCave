'use client'

import { PlayingCardOpenBoosterPack } from '@/app/daily-card-game/components/pack-open/playing-card-open-booster-pack'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import type { BuyableCard as BuyableCardType } from '@/app/daily-card-game/domain/shop/types'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

function OpenBoosterPack({ cardType }: { cardType: BuyableCardType['type'] }) {
  if (cardType === 'playingCard') {
    return <PlayingCardOpenBoosterPack />
  }
  return null
}

export function PackOpenView() {
  const { game } = useGameState()
  if (!game.shopState.openPackState) return <div>No pack open</div>
  return (
    <ViewTemplate>
      <OpenBoosterPack cardType={game.shopState.openPackState.cards[0].type} />
      <Button
        onClick={() => {
          eventEmitter.emit({ type: 'PACK_OPEN_SKIP' })
        }}
      >
        Skip
      </Button>
    </ViewTemplate>
  )
}
