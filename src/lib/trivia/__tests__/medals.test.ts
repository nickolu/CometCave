import { describe, expect, it } from 'vitest'

import { CATEGORY_META } from '@/lib/trivia/categories'
import {
  CATEGORY_MEDAL_LADDERS,
  MEDAL_THRESHOLDS,
  getMedalLabel,
  getMedalTier,
  getNextThreshold,
} from '@/lib/trivia/medals'

describe('medals config', () => {
  it('every category in CATEGORY_META has a medal ladder', () => {
    for (const id of Object.keys(CATEGORY_META).map(Number)) {
      expect(CATEGORY_MEDAL_LADDERS[id], `missing ladder for category ${id}`).toBeDefined()
      expect(CATEGORY_MEDAL_LADDERS[id]).toHaveLength(5)
    }
  })

  it('no medal ladder targets a category that does not exist', () => {
    for (const id of Object.keys(CATEGORY_MEDAL_LADDERS).map(Number)) {
      expect(CATEGORY_META[id], `unknown category ${id} in medal ladders`).toBeDefined()
    }
  })

  it('thresholds are strictly increasing', () => {
    const ts = [
      MEDAL_THRESHOLDS.bronze,
      MEDAL_THRESHOLDS.silver,
      MEDAL_THRESHOLDS.gold,
      MEDAL_THRESHOLDS.platinum,
      MEDAL_THRESHOLDS.diamond,
    ]
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1])
    }
  })
})

describe('getMedalTier', () => {
  it('returns "none" below the bronze threshold', () => {
    expect(getMedalTier(0)).toBe('none')
    expect(getMedalTier(15)).toBe('none')
  })

  it('returns each tier at its exact threshold', () => {
    expect(getMedalTier(16)).toBe('bronze')
    expect(getMedalTier(64)).toBe('silver')
    expect(getMedalTier(256)).toBe('gold')
    expect(getMedalTier(1024)).toBe('platinum')
    expect(getMedalTier(4096)).toBe('diamond')
  })

  it('returns the highest tier earned for in-between counts', () => {
    expect(getMedalTier(63)).toBe('bronze')
    expect(getMedalTier(255)).toBe('silver')
    expect(getMedalTier(1023)).toBe('gold')
    expect(getMedalTier(4095)).toBe('platinum')
    expect(getMedalTier(99_999)).toBe('diamond')
  })
})

describe('getMedalLabel', () => {
  it('returns null for tier "none"', () => {
    expect(getMedalLabel(9, 'none')).toBeNull()
  })

  it('returns null for an unknown category', () => {
    expect(getMedalLabel(999, 'bronze')).toBeNull()
  })

  it('returns the category-specific label for each tier', () => {
    // Anime ladder — sanity-check the full custom progression
    expect(getMedalLabel(31, 'bronze')).toBe('Bug Trainer')
    expect(getMedalLabel(31, 'silver')).toBe('Krillin')
    expect(getMedalLabel(31, 'gold')).toBe('Soul Reaper')
    expect(getMedalLabel(31, 'platinum')).toBe('Hokage')
    expect(getMedalLabel(31, 'diamond')).toBe('Truth')
  })

  it('returns the right Diamond honorific for a different category', () => {
    expect(getMedalLabel(24, 'diamond')).toBe('President')
    expect(getMedalLabel(20, 'diamond')).toBe('Dreamweaver')
  })
})

describe('getNextThreshold', () => {
  it('returns the bronze threshold when no tier is earned yet', () => {
    expect(getNextThreshold('none')).toBe(16)
  })

  it('returns the next tier threshold for each intermediate tier', () => {
    expect(getNextThreshold('bronze')).toBe(64)
    expect(getNextThreshold('silver')).toBe(256)
    expect(getNextThreshold('gold')).toBe(1024)
    expect(getNextThreshold('platinum')).toBe(4096)
  })

  it('returns null at the top tier', () => {
    expect(getNextThreshold('diamond')).toBeNull()
  })
})
