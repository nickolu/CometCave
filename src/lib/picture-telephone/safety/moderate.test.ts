import { describe, expect, it } from 'vitest'

import { MODERATION_THRESHOLDS } from './config'
import { type ModerationLike, decideModeration, isUnavailable, moderateImage, moderateText } from './moderate'

import type OpenAI from 'openai'

const clean = (over: Record<string, number | null> = {}): ModerationLike => ({
  flagged: false,
  category_scores: { sexual: 0.001, violence: 0.002, 'self-harm': 0.001, illicit: null, ...over },
})

describe('decideModeration', () => {
  it('allows a clean result', () => {
    expect(decideModeration(clean())).toEqual({ allowed: true, reasons: [] })
  })
  it('rejects a category at its threshold, allows just under', () => {
    expect(decideModeration(clean({ sexual: MODERATION_THRESHOLDS.sexual - 0.001 })).allowed).toBe(true)
    const d = decideModeration(clean({ sexual: MODERATION_THRESHOLDS.sexual }))
    expect(d.allowed).toBe(false)
    expect(d.reasons).toEqual(['sexual'])
  })
  it('rejects when flagged even with low scores', () => {
    const d = decideModeration({ ...clean(), flagged: true })
    expect(d).toEqual({ allowed: false, reasons: ['flagged'] })
  })
  it('ignores null and absent categories', () => {
    expect(decideModeration({ flagged: false, category_scores: { sexual: 0, illicit: null } }).allowed).toBe(true)
  })
  it('fails closed on a missing or malformed result', () => {
    for (const bad of [undefined, null, {}, { flagged: false }, { flagged: false, category_scores: {} }, { flagged: false, category_scores: { sexual: null } }]) {
      const d = decideModeration(bad as unknown as ModerationLike)
      expect(d.allowed).toBe(false)
      expect(isUnavailable(d)).toBe(true)
    }
    expect(isUnavailable(decideModeration({ flagged: false, category_scores: { sexual: 'x' as unknown as number } }))).toBe(true)
    expect(isUnavailable(decideModeration({ flagged: false, category_scores: { sexual: NaN } }))).toBe(true)
  })
  it('covers every category the SDK knows about', () => {
    // Compile-time guard: adding a category to the SDK breaks this object's type.
    const sdk: Record<keyof OpenAI.Moderation.CategoryScores, true> = {
      'harassment': true, 'harassment/threatening': true, 'hate': true, 'hate/threatening': true,
      'illicit': true, 'illicit/violent': true, 'self-harm': true, 'self-harm/instructions': true,
      'self-harm/intent': true, 'sexual': true, 'sexual/minors': true, 'violence': true, 'violence/graphic': true,
    }
    expect(Object.keys(MODERATION_THRESHOLDS).sort()).toEqual(Object.keys(sdk).sort())
  })
})

describe('moderateText / moderateImage', () => {
  it('passes a clean result through', async () => {
    expect((await moderateText('hi', async () => clean())).allowed).toBe(true)
  })
  it('is unavailable when the call throws, returns nothing, or times out', async () => {
    const thrown = await moderateText('hi', async () => {
      throw new Error('boom')
    })
    expect(isUnavailable(thrown)).toBe(true)
    expect(isUnavailable(await moderateText('hi', async () => undefined))).toBe(true)
    const slow = await moderateText('hi', () => new Promise(() => undefined), 20)
    expect(isUnavailable(slow)).toBe(true)
  })
  it('sends images as image_url input', async () => {
    let seen: unknown
    await moderateImage('data:image/jpeg;base64,AAAA', async input => {
      seen = input
      return clean()
    })
    expect(seen).toEqual([{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }])
  })
})
