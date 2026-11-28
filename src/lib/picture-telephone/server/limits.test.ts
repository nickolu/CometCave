import { describe, expect, it } from 'vitest'

import { AI_FEATURES, costOf } from '@/lib/ai/limits'

describe('picture telephone credits', () => {
  it('weighs image 3, describe 1, starter 1; moderation has no key (free)', () => {
    expect(costOf('picture-telephone-image')).toBe(3)
    expect(costOf('picture-telephone-describe')).toBe(1)
    expect(costOf('picture-telephone-starter')).toBe(1)
    expect(Object.keys(AI_FEATURES).filter(k => k.startsWith('picture-telephone'))).toHaveLength(3)
  })
})
