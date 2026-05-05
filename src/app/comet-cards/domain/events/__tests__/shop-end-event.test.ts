import { describe, expect, it } from 'vitest'

import { dispatchEffects } from '@/app/comet-cards/domain/events/dispatch-effects'
import type { Effect, EffectContext, ShopEndEvent } from '@/app/comet-cards/domain/events/types'

describe('SHOP_END event', () => {
  it('dispatches effects matching SHOP_END', () => {
    const applied: string[] = []

    const event: ShopEndEvent = { type: 'SHOP_END' }

    const effects: Effect[] = [
      {
        event: { type: 'SHOP_END' },
        priority: 1,
        apply: () => { applied.push('shop-end-effect') },
      },
      {
        event: { type: 'SHOP_OPEN' },
        priority: 1,
        apply: () => { applied.push('should-not-run') },
      },
    ]

    dispatchEffects(event, {} as EffectContext, effects)

    expect(applied).toEqual(['shop-end-effect'])
  })

  it('respects effect priority ordering', () => {
    const applied: number[] = []

    const event: ShopEndEvent = { type: 'SHOP_END' }

    const effects: Effect[] = [
      {
        event: { type: 'SHOP_END' },
        priority: 3,
        apply: () => { applied.push(3) },
      },
      {
        event: { type: 'SHOP_END' },
        priority: 1,
        apply: () => { applied.push(1) },
      },
      {
        event: { type: 'SHOP_END' },
        priority: 2,
        apply: () => { applied.push(2) },
      },
    ]

    dispatchEffects(event, {} as EffectContext, effects)

    expect(applied).toEqual([1, 2, 3])
  })
})
