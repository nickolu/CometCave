import { describe, expect, it } from 'vitest'
import { bossBlinds } from '@/app/comet-cards/domain/round/boss-blinds'

describe('Violet Vessel showdown boss blind', () => {
  const violetVessel = bossBlinds.find(b => b.name === 'Violet Vessel')

  it('exists in the boss blinds registry', () => {
    expect(violetVessel).toBeDefined()
  })

  it('has 6x ante multiplier (very large blind)', () => {
    expect(violetVessel!.anteMultiplier).toBe(6)
  })

  it('has minimum ante of 8 (showdown boss)', () => {
    expect(violetVessel!.minimumAnte).toBe(8)
  })

  it('has base reward of $8', () => {
    expect(violetVessel!.baseReward).toBe(8)
  })
})
