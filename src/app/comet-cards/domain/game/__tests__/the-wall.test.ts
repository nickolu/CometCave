import { describe, expect, it } from 'vitest'
import { bossBlinds } from '@/app/comet-cards/domain/round/boss-blinds'

describe('The Wall boss blind', () => {
  const theWall = bossBlinds.find(b => b.name === 'The Wall')

  it('exists in the boss blinds registry', () => {
    expect(theWall).toBeDefined()
  })

  it('has 4x ante multiplier (extra large blind)', () => {
    expect(theWall!.anteMultiplier).toBe(4)
  })

  it('has no effects (purely a score threshold increase)', () => {
    expect(theWall!.effects).toHaveLength(0)
  })
})
