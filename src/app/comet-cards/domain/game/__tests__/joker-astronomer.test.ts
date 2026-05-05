import { describe, expect, it } from 'vitest'
import { astronomer, jokers } from '@/app/comet-cards/domain/joker/jokers'

describe('Astronomer joker', () => {
  it('is defined with correct properties', () => {
    expect(astronomer.id).toBe('astronomer')
    expect(astronomer.name).toBe('Astronomer')
    expect(astronomer.rarity).toBe('uncommon')
    expect(astronomer.price).toBe(8)
    expect(astronomer.effects.length).toBe(1)
    expect(astronomer.effects[0].event.type).toBe('SHOP_OPEN')
  })

  it('is registered in the jokers record', () => {
    expect(jokers.astronomer).toBeDefined()
    expect(jokers.astronomer.id).toBe('astronomer')
  })
})
