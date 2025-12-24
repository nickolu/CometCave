'use client'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

export function PackOpenView() {
  return (
    <ViewTemplate>
      <h2>Pack Open</h2>
      <Button
        onClick={() => {
          eventEmitter.emit({ type: 'PACK_OPEN_BACK_TO_SHOP' })
        }}
      >
        Back
      </Button>
    </ViewTemplate>
  )
}
