'use client'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

export function ShopView() {
  return (
    <ViewTemplate>
      <h2>Shop</h2>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            eventEmitter.emit({ type: 'SHOP_SELECT_BLIND' })
          }}
        >
          Select Blind
        </Button>
        <Button
          onClick={() => {
            eventEmitter.emit({ type: 'SHOP_OPEN_PACK' })
          }}
        >
          Open Pack
        </Button>
      </div>
    </ViewTemplate>
  )
}
