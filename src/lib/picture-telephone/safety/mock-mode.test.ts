import { describe, expect, it } from 'vitest'

import { isMockMode } from './mock-mode'

describe('isMockMode', () => {
  it('is on only with the flag outside production', () => {
    expect(isMockMode({ PICTURE_TELEPHONE_MOCK_IMAGES: 'true' })).toBe(true)
    expect(isMockMode({ PICTURE_TELEPHONE_MOCK_IMAGES: 'true', VERCEL_ENV: 'preview' })).toBe(true)
    expect(isMockMode({ PICTURE_TELEPHONE_MOCK_IMAGES: 'true', VERCEL_ENV: 'development' })).toBe(true)
  })
  it('is ignored in production', () => {
    expect(isMockMode({ PICTURE_TELEPHONE_MOCK_IMAGES: 'true', VERCEL_ENV: 'production' })).toBe(false)
  })
  it('is off without the flag or with other values', () => {
    expect(isMockMode({})).toBe(false)
    expect(isMockMode({ PICTURE_TELEPHONE_MOCK_IMAGES: 'false' })).toBe(false)
    expect(isMockMode({ PICTURE_TELEPHONE_MOCK_IMAGES: '1' })).toBe(false)
  })
})
