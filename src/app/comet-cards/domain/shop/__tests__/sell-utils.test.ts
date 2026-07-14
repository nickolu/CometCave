import { describe, expect, it } from 'vitest'
import { getConsumableSellValue, getJokerSellValue } from '../sell-utils'

describe('getJokerSellValue', () => {
  it('returns floor(price/2) when bonusSellValue is 0 (even price)', () => {
    expect(getJokerSellValue({ price: 4 }, { bonusSellValue: 0 })).toBe(2)
  })

  it('returns floor(price/2) when bonusSellValue is 0 (odd price)', () => {
    expect(getJokerSellValue({ price: 5 }, { bonusSellValue: 0 })).toBe(2)
  })

  it('adds bonusSellValue to floor(price/2)', () => {
    expect(getJokerSellValue({ price: 4 }, { bonusSellValue: 6 })).toBe(8)
  })
})

describe('getConsumableSellValue', () => {
  it('returns floor(price/2) for even price', () => {
    expect(getConsumableSellValue({ price: 4 })).toBe(2)
  })

  it('returns floor(price/2) for odd price (rounds down)', () => {
    expect(getConsumableSellValue({ price: 3 })).toBe(1)
  })

  it('returns 1 for price 2', () => {
    expect(getConsumableSellValue({ price: 2 })).toBe(1)
  })
})
