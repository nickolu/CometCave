import { describe, expect, it } from 'vitest'

import { dispatchEffects } from '@/app/comet-cards/domain/events/dispatch-effects'
import type { CardDestroyedEvent, Effect, EffectContext } from '@/app/comet-cards/domain/events/types'

describe('CARD_DESTROYED event', () => {
  it('dispatches effects matching CARD_DESTROYED', () => {
    const applied: string[] = []

    const event: CardDestroyedEvent = {
      type: 'CARD_DESTROYED',
      cardId: 'card-1',
      source: 'spectral',
    }

    const effects: Effect[] = [
      {
        event: { type: 'CARD_DESTROYED', cardId: '', source: 'spectral' },
        priority: 1,
        apply: () => { applied.push('effect-1') },
      },
      {
        event: { type: 'CARD_SCORED' },
        priority: 1,
        apply: () => { applied.push('should-not-run') },
      },
    ]

    dispatchEffects(event, {} as EffectContext, effects)

    expect(applied).toEqual(['effect-1'])
  })

  it('supports glass_break source', () => {
    const event: CardDestroyedEvent = {
      type: 'CARD_DESTROYED',
      cardId: 'card-2',
      source: 'glass_break',
    }

    expect(event.type).toBe('CARD_DESTROYED')
    expect(event.source).toBe('glass_break')
    expect(event.cardId).toBe('card-2')
  })

  it('supports joker_effect source', () => {
    const event: CardDestroyedEvent = {
      type: 'CARD_DESTROYED',
      cardId: 'card-3',
      source: 'joker_effect',
    }

    expect(event.source).toBe('joker_effect')
  })
})
