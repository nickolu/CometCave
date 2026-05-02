'use client'

import { GhostButton } from '@/app/daily-card-game/components/cosmic/buttons'
import { Panel } from '@/app/daily-card-game/components/cosmic/panel'
import { CelestialCardOpenBoosterPack } from '@/app/daily-card-game/components/pack-open/celestial-card-open-booster-pack'
import { JokerCardOpenBoosterPack } from '@/app/daily-card-game/components/pack-open/joker-card-open-booster-pack'
import { PlayingCardOpenBoosterPack } from '@/app/daily-card-game/components/pack-open/playing-card-open-booster-pack'
import { SpectralCardOpenBoosterPack } from '@/app/daily-card-game/components/pack-open/spectral-card-open-booster-pack'
import { TarotCardOpenBoosterPack } from '@/app/daily-card-game/components/pack-open/tarot-card-open-booster-pack'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import type { BuyableCard as BuyableCardType } from '@/app/daily-card-game/domain/shop/types'
import { useGameState } from '@/app/daily-card-game/useGameState'

import { ViewTemplate } from './view-template'

function OpenBoosterPack({ cardType }: { cardType: BuyableCardType['type'] }) {
  if (cardType === 'playingCard') return <PlayingCardOpenBoosterPack />
  if (cardType === 'tarotCard') return <TarotCardOpenBoosterPack />
  if (cardType === 'celestialCard') return <CelestialCardOpenBoosterPack />
  if (cardType === 'jokerCard') return <JokerCardOpenBoosterPack />
  if (cardType === 'spectralCard') return <SpectralCardOpenBoosterPack />
  return null
}

export function PackOpenView() {
  const { game } = useGameState()
  if (!game.shopState.openPackState) {
    return (
      <ViewTemplate>
        <Panel title="Pack">
          <div style={{ padding: '24px 16px', textAlign: 'center', opacity: 0.7 }}>
            No pack to open.
          </div>
        </Panel>
      </ViewTemplate>
    )
  }
  return (
    <ViewTemplate>
      <Panel title="Booster Pack">
        <div className="flex flex-col" style={{ padding: 16, gap: 14 }}>
          <OpenBoosterPack cardType={game.shopState.openPackState.cards[0].type} />
          <div>
            <GhostButton onClick={() => eventEmitter.emit({ type: 'PACK_OPEN_SKIP' })}>
              Skip
            </GhostButton>
          </div>
        </div>
      </Panel>
    </ViewTemplate>
  )
}
