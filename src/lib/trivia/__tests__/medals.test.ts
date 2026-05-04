import { describe, expect, it } from 'vitest'

import { CATEGORY_META, getCategoryIdByName } from '@/lib/trivia/categories'
import {
  CATEGORY_MEDAL_LADDERS,
  CUSTOM_CATEGORY_MEDAL_LADDER,
  MEDAL_THRESHOLDS,
  customCategorySlug,
  detectCustomMedalEarned,
  detectMedalEarned,
  getCustomCategoryMedalLabel,
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

describe('detectMedalEarned', () => {
  it('returns null when no tier line is crossed', () => {
    expect(detectMedalEarned(0, 1, 31)).toBeNull()
    expect(detectMedalEarned(64, 65, 31)).toBeNull()
    expect(detectMedalEarned(255, 255, 31)).toBeNull()
  })

  it('returns the new tier and label on a tier crossing', () => {
    expect(detectMedalEarned(15, 16, 31)).toEqual({ tier: 'bronze', label: 'Bug Trainer' })
    expect(detectMedalEarned(63, 64, 31)).toEqual({ tier: 'silver', label: 'Krillin' })
    expect(detectMedalEarned(1023, 1024, 31)).toEqual({ tier: 'platinum', label: 'Hokage' })
    expect(detectMedalEarned(4095, 4096, 31)).toEqual({ tier: 'diamond', label: 'Truth' })
  })

  it('returns null for an unknown category', () => {
    expect(detectMedalEarned(15, 16, 999)).toBeNull()
  })
})

describe('custom-topic medals', () => {
  it('reuses the shared 5-tier threshold ladder', () => {
    expect(CUSTOM_CATEGORY_MEDAL_LADDER).toHaveLength(5)
  })

  it('getCustomCategoryMedalLabel returns null for "none"', () => {
    expect(getCustomCategoryMedalLabel('none')).toBeNull()
  })

  it('getCustomCategoryMedalLabel returns the same ladder for every topic', () => {
    expect(getCustomCategoryMedalLabel('bronze')).toBe(CUSTOM_CATEGORY_MEDAL_LADDER[0])
    expect(getCustomCategoryMedalLabel('diamond')).toBe(CUSTOM_CATEGORY_MEDAL_LADDER[4])
  })

  it('detectCustomMedalEarned mirrors detectMedalEarned at threshold crossings', () => {
    expect(detectCustomMedalEarned(0, 1)).toBeNull()
    expect(detectCustomMedalEarned(15, 16)).toEqual({
      tier: 'bronze',
      label: CUSTOM_CATEGORY_MEDAL_LADDER[0],
    })
    expect(detectCustomMedalEarned(4095, 4096)).toEqual({
      tier: 'diamond',
      label: CUSTOM_CATEGORY_MEDAL_LADDER[4],
    })
  })

  describe('customCategorySlug', () => {
    it('produces stable ids for plain topics', () => {
      expect(customCategorySlug('norse mythology')).toBe('norse%20mythology')
    })

    it('escapes characters that Firestore cannot store in a doc id', () => {
      expect(customCategorySlug('rock/pop')).not.toContain('/')
      expect(customCategorySlug('a.b')).not.toContain('.')
    })

    it('never collides for distinct topics', () => {
      const topics = ['music', 'Music', 'music ', 'mu/sic', 'mu.sic', '']
      const slugs = new Set(topics.map(customCategorySlug))
      expect(slugs.size).toBe(topics.length)
    })
  })
})

describe('getCategoryIdByName', () => {
  it('round-trips every CATEGORY_META entry', () => {
    for (const id of Object.keys(CATEGORY_META).map(Number)) {
      const name = CATEGORY_META[id].name
      expect(getCategoryIdByName(name)).toBe(id)
    }
  })

  // Questions are stamped with the OpenTDB-prefixed name from
  // src/app/trivia/data/seeds/categoryNames.ts, not the bare CATEGORY_META
  // name. Both must resolve to the same id or medal tracking silently
  // skips most categories.
  it('resolves OpenTDB-prefixed category names', () => {
    expect(getCategoryIdByName('Entertainment: Books')).toBe(10)
    expect(getCategoryIdByName('Entertainment: Film')).toBe(11)
    expect(getCategoryIdByName('Entertainment: Music')).toBe(12)
    expect(getCategoryIdByName('Entertainment: Musicals & Theatres')).toBe(13)
    expect(getCategoryIdByName('Entertainment: Television')).toBe(14)
    expect(getCategoryIdByName('Entertainment: Video Games')).toBe(15)
    expect(getCategoryIdByName('Entertainment: Board Games')).toBe(16)
    expect(getCategoryIdByName('Science: Computers')).toBe(18)
    expect(getCategoryIdByName('Science: Mathematics')).toBe(19)
    expect(getCategoryIdByName('Entertainment: Comics')).toBe(29)
    expect(getCategoryIdByName('Science: Gadgets')).toBe(30)
    expect(getCategoryIdByName('Entertainment: Japanese Anime & Manga')).toBe(31)
    expect(getCategoryIdByName('Entertainment: Cartoon & Animations')).toBe(32)
  })

  it('returns null for unknown names', () => {
    expect(getCategoryIdByName('Underwater Basket Weaving')).toBeNull()
    expect(getCategoryIdByName('')).toBeNull()
  })
})
