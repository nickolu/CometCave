import { describe, expect, it } from 'vitest'

import { DEFAULT_LAYOUT, areaScale, layoutChain, stepLabel, wrapLines } from './layout'
import { withSvgSize } from './image-src'

import type { Entry } from '../types'

/** Every character is 10px wide. */
const measure = (t: string) => t.length * 10

const names = { a: 'Ann', b: 'Bo' }

function chain(n: number, sentence = 'a cat on a bike'): Entry[] {
  const out: Entry[] = []
  for (let i = 0; i <= n; i++) {
    out.push({ kind: 'text', seatId: i % 2 ? 'b' : 'a', text: sentence, viaAi: false })
    if (i < n) out.push({ kind: 'image', src: `data:image/jpeg;base64,${i}`, mock: false })
  }
  return out
}

describe('wrapLines', () => {
  it('returns no lines for empty text', () => {
    expect(wrapLines(measure, '', 100)).toEqual([])
    expect(wrapLines(measure, '   ', 100)).toEqual([])
  })

  it('keeps text that fits exactly on one line', () => {
    expect(wrapLines(measure, 'abcd efgh', 90)).toEqual(['abcd efgh'])
  })

  it('wraps greedily across lines', () => {
    expect(wrapLines(measure, 'aaa bbb ccc ddd', 70)).toEqual(['aaa bbb', 'ccc ddd'])
  })

  it('hard-splits a word wider than the line', () => {
    expect(wrapLines(measure, 'abcdefghij', 40)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('splits a long word that follows short ones', () => {
    expect(wrapLines(measure, 'hi abcdefgh', 50)).toEqual(['hi', 'abcde', 'fgh'])
  })

  it('never loops on a width smaller than one character', () => {
    expect(wrapLines(measure, 'abc', 1)).toEqual(['a', 'b', 'c'])
  })
})

describe('layoutChain', () => {
  it('orders blocks header, chain with connectors, footer', () => {
    const { blocks } = layoutChain(chain(2), names, measure)
    expect(blocks.map(b => b.kind)).toEqual([
      'header', 'text', 'connector', 'image', 'connector', 'text', 'connector', 'image', 'connector', 'text', 'footer',
    ])
  })

  it('stacks blocks with no gaps and the heights sum to the total', () => {
    const l = layoutChain(chain(4), names, measure)
    let y = 0
    for (const b of l.blocks) {
      expect(b.y).toBe(y)
      y += b.h
    }
    expect(l.height).toBe(y)
    expect(l.blocks.reduce((s, b) => s + b.h, 0)).toBe(l.height)
  })

  it('uses a fixed height for short text and grows with wrapping', () => {
    const o = DEFAULT_LAYOUT
    const one = layoutChain([{ kind: 'text', seatId: 'a', text: 'hi', viaAi: false }], names, measure)
    const cardH = o.cardPadding * 2 + o.labelHeight + o.lineHeight
    expect(one.height).toBe(o.headerHeight + cardH + o.footerHeight)
    const long = layoutChain([{ kind: 'text', seatId: 'a', text: 'word '.repeat(60), viaAi: false }], names, measure)
    expect(long.height).toBeGreaterThan(one.height)
  })

  it('computes the total for N=4 and N=10', () => {
    const o = DEFAULT_LAYOUT
    const card = o.cardPadding * 2 + o.labelHeight + o.lineHeight
    const total = (n: number) =>
      o.headerHeight + (n + 1) * card + n * o.imageSize + 2 * n * o.connectorHeight + o.footerHeight
    expect(layoutChain(chain(4), names, measure).height).toBe(total(4))
    expect(layoutChain(chain(10), names, measure).height).toBe(total(10))
  })

  it('keeps N=10 under the area guard, so no scaling', () => {
    const l = layoutChain(chain(10), names, measure)
    expect(l.width * l.height).toBeLessThan(DEFAULT_LAYOUT.maxArea)
    expect(l.scale).toBe(1)
  })

  it('scales down uniformly when over the area limit', () => {
    const l = layoutChain(chain(10), names, measure, { maxArea: 4_000_000 })
    expect(l.scale).toBeLessThan(1)
    expect(l.width * l.scale * (l.height * l.scale)).toBeLessThanOrEqual(4_000_000 + 1)
  })

  it('carries names, AI badge and labels', () => {
    const entries: Entry[] = [
      { kind: 'text', seatId: 'a', text: 'one', viaAi: false },
      { kind: 'image', src: 'x', mock: true },
      { kind: 'text', seatId: 'zzz', text: 'two', viaAi: true },
    ]
    const texts = layoutChain(entries, names, measure).blocks.filter(b => b.kind === 'text')
    expect(texts.map(b => b.kind === 'text' && [b.name, b.ai, b.label])).toEqual([
      ['Ann', false, 'Opening sentence'],
      ['Someone', true, 'Final guess'],
    ])
  })

  it('handles an empty chain', () => {
    const l = layoutChain([], names, measure)
    expect(l.height).toBe(DEFAULT_LAYOUT.headerHeight + DEFAULT_LAYOUT.footerHeight)
  })
})

describe('areaScale', () => {
  it('is 1 at or under the limit', () => {
    expect(areaScale(1000, 1000, 1_000_000)).toBe(1)
  })
  it('is sqrt of the ratio over it', () => {
    expect(areaScale(2000, 2000, 1_000_000)).toBeCloseTo(0.5)
  })
})

describe('stepLabel', () => {
  it('labels opening, middle and final sentences', () => {
    const e = chain(2)
    expect([0, 2, 4].map(i => stepLabel(e, i))).toEqual(['Opening sentence', 'Said', 'Final guess'])
  })
})

describe('withSvgSize', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect/></svg>'
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  it('adds width and height when missing', () => {
    const out = decodeURIComponent(withSvgSize(url).split(',')[1])
    expect(out).toContain('<svg width="1024" height="1024" xmlns=')
  })
  it('leaves sized svgs and other images alone', () => {
    const sized = `data:image/svg+xml,${encodeURIComponent('<svg width="5" height="5"></svg>')}`
    expect(withSvgSize(sized)).toBe(sized)
    expect(withSvgSize('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA')
  })
})
