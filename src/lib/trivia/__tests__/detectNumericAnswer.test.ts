import { describe, expect, it } from 'vitest'

import { detectNumericAnswer } from '@/lib/trivia/generateQuestion'

describe('detectNumericAnswer', () => {
  describe('fires on pure numeric answers', () => {
    it('plain integer', () => {
      expect(detectNumericAnswer('41')).toBe(true)
    })
    it('year', () => {
      expect(detectNumericAnswer('1986')).toBe(true)
    })
    it('year with era marker', () => {
      expect(detectNumericAnswer('49 BC')).toBe(true)
      expect(detectNumericAnswer('1582 CE')).toBe(true)
    })
    it('decimal', () => {
      expect(detectNumericAnswer('3.14')).toBe(true)
    })
    it('comma-grouped large number', () => {
      expect(detectNumericAnswer('1,642')).toBe(true)
    })
  })

  describe('fires on measurement / unit answers', () => {
    it('depth in meters', () => {
      expect(detectNumericAnswer('282 meters')).toBe(true)
    })
    it('age in years', () => {
      expect(detectNumericAnswer('4,800 years old')).toBe(true)
    })
    it('area with squared unit', () => {
      expect(detectNumericAnswer('5.5 million km²')).toBe(true)
    })
    it('approximated quantity', () => {
      expect(detectNumericAnswer('approximately 5.5 million square kilometers')).toBe(true)
    })
    it('currency', () => {
      expect(detectNumericAnswer('$300 million')).toBe(true)
    })
    it('percentage', () => {
      expect(detectNumericAnswer('27%')).toBe(true)
    })
  })

  describe('fires on date answers', () => {
    it('full date', () => {
      expect(detectNumericAnswer('February 21, 1986')).toBe(true)
    })
    it('month + day', () => {
      expect(detectNumericAnswer('January 21')).toBe(true)
    })
  })

  describe('does NOT fire on named entities', () => {
    it('plain name', () => {
      expect(detectNumericAnswer('Frederick Stanley Mockford')).toBe(false)
    })
    it('common noun', () => {
      expect(detectNumericAnswer('typewriter')).toBe(false)
    })
    it('place name', () => {
      expect(detectNumericAnswer('Mount Everest')).toBe(false)
    })
    it('title with article', () => {
      expect(detectNumericAnswer('The Gunslinger')).toBe(false)
    })
  })

  describe('does NOT fire on names that contain numbers', () => {
    it('Apollo 11 (named mission)', () => {
      expect(detectNumericAnswer('Apollo 11')).toBe(false)
    })
    it('Area 51 (named place)', () => {
      expect(detectNumericAnswer('Area 51')).toBe(false)
    })
    it('Catch-22 (named work)', () => {
      expect(detectNumericAnswer('Catch-22')).toBe(false)
    })
  })

  it('returns false for empty string', () => {
    expect(detectNumericAnswer('')).toBe(false)
  })
})
