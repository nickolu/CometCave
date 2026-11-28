import { describe, expect, it } from 'vitest'

import { createMockProvider, mockDescribeLine, mockImageDataUrl, mockImageSvg } from './mock'
import { PERSONALITIES } from './personalities'
import { STARTER_SENTENCES } from './starters'

describe('mock image', () => {
  it('is deterministic', () => {
    expect(mockImageDataUrl('a cat on a mat')).toBe(mockImageDataUrl('a cat on a mat'))
  })

  it('differs per sentence', () => {
    const urls = new Set(
      ['a cat on a mat', 'a dog in a bog', 'a frog on a log', 'a bat in a hat', 'an owl in a towel'].map(
        mockImageDataUrl
      )
    )
    expect(urls.size).toBeGreaterThan(1)
  })

  it('never contains the sentence, in any encoding', () => {
    const sentence = 'a secret sentence about purple elephants'
    const url = mockImageDataUrl(sentence)
    expect(url.startsWith('data:image/svg+xml')).toBe(true)
    expect(url).not.toContain(sentence)
    expect(url).not.toContain(encodeURIComponent(sentence))
    expect(mockImageSvg(sentence)).not.toContain('purple')
    expect(mockImageSvg(sentence)).not.toContain('<text')
  })
})

describe('mock describe', () => {
  it('is deterministic per persona and picture', () => {
    const src = mockImageDataUrl('x y z')
    for (const p of PERSONALITIES) {
      expect(mockDescribeLine(p.id, src)).toBe(mockDescribeLine(p.id, src))
      expect(mockDescribeLine(p.id, src).length).toBeGreaterThan(10)
    }
  })

  it('falls back to a default persona for an unknown id', () => {
    expect(mockDescribeLine('nobody', 'src').length).toBeGreaterThan(10)
  })
})

describe('createMockProvider', () => {
  const provider = createMockProvider({ delay: () => 0 })

  it('draws, describes, starts and accepts text without waiting', async () => {
    const image = await provider.image('a cat on a mat')
    expect(image.mock).toBe(true)
    expect((await provider.describe('poet-pat', image.src)).text.length).toBeGreaterThan(10)
    expect(STARTER_SENTENCES).toContain((await provider.starter()).text)
    expect((await provider.checkText('anything')).ok).toBe(true)
  })
})
