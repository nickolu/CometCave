/* Picture Telephone: layout of the shareable chain image. Pure: text width is
   measured through an injected function, so this runs (and is tested) in node.
   compose.ts turns the result into pixels. */

import type { Entry } from '../types'

/** Measures one line of text in the body font, in px. */
export type Measure = (text: string) => number

export interface LayoutOptions {
  width: number
  padding: number
  headerHeight: number
  footerHeight: number
  /** Gap between blocks, where the connector arrow sits. */
  connectorHeight: number
  imageSize: number
  cardPadding: number
  /** Height of the "by {name}" line inside a text card. */
  labelHeight: number
  lineHeight: number
  /** Above this many pixels the canvas is scaled down (iOS Safari caps near 16.7M). */
  maxArea: number
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  width: 1080,
  padding: 48,
  headerHeight: 170,
  footerHeight: 130,
  connectorHeight: 64,
  imageSize: 720,
  cardPadding: 32,
  labelHeight: 44,
  lineHeight: 56,
  maxArea: 14_000_000,
}

export type Block =
  | { kind: 'header'; x: number; y: number; w: number; h: number }
  | { kind: 'connector'; x: number; y: number; w: number; h: number }
  | { kind: 'footer'; x: number; y: number; w: number; h: number }
  | {
      kind: 'text'
      x: number
      y: number
      w: number
      h: number
      label: string
      name: string
      ai: boolean
      lines: string[]
    }
  | { kind: 'image'; x: number; y: number; w: number; h: number; src: string; alt: string }

export interface ChainLayout {
  /** Logical size, before any scale-down. */
  width: number
  height: number
  /** Multiply by this for the canvas size (1 unless the area guard kicked in). */
  scale: number
  blocks: Block[]
}

/** The label a sentence gets in the chain: opening, final or in between. */
export function stepLabel(entries: readonly Entry[], index: number): string {
  const textIndexes = entries.map((e, i) => (e.kind === 'text' ? i : -1)).filter(i => i >= 0)
  if (index === textIndexes[0]) return 'Opening sentence'
  if (index === textIndexes[textIndexes.length - 1]) return 'Final guess'
  return 'Said'
}

/**
 * Greedy word wrap. A word wider than the line is hard-split by characters.
 * Empty or whitespace-only text gives no lines.
 */
export function wrapLines(measure: Measure, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  const pushWord = (word: string) => {
    // Hard split: fill a line with as many characters as fit (at least one).
    let rest = word
    while (measure(rest) > maxWidth && rest.length > 1) {
      let n = 1
      while (n < rest.length && measure(rest.slice(0, n + 1)) <= maxWidth) n++
      lines.push(rest.slice(0, n))
      rest = rest.slice(n)
    }
    line = rest
  }

  for (const word of words) {
    if (!line) {
      pushWord(word)
      continue
    }
    const candidate = `${line} ${word}`
    if (measure(candidate) <= maxWidth) {
      line = candidate
    } else {
      lines.push(line)
      line = ''
      pushWord(word)
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Scale factor so width x height x scale^2 stays within maxArea. */
export function areaScale(width: number, height: number, maxArea: number): number {
  const area = width * height
  return area <= maxArea ? 1 : Math.sqrt(maxArea / area)
}

export function layoutChain(
  entries: readonly Entry[],
  seatNames: Readonly<Record<string, string>>,
  measure: Measure,
  opts: Partial<LayoutOptions> = {}
): ChainLayout {
  const o = { ...DEFAULT_LAYOUT, ...opts }
  const inner = o.width - 2 * o.padding
  const blocks: Block[] = []
  let y = 0

  blocks.push({ kind: 'header', x: 0, y, w: o.width, h: o.headerHeight })
  y += o.headerHeight

  entries.forEach((entry, i) => {
    if (i > 0) {
      blocks.push({ kind: 'connector', x: o.padding, y, w: inner, h: o.connectorHeight })
      y += o.connectorHeight
    }
    if (entry.kind === 'image') {
      blocks.push({
        kind: 'image',
        x: (o.width - o.imageSize) / 2,
        y,
        w: o.imageSize,
        h: o.imageSize,
        src: entry.src,
        alt: `Picture ${Math.ceil((i + 1) / 2)} of the chain`,
      })
      y += o.imageSize
    } else {
      const lines = wrapLines(measure, entry.text, inner - 2 * o.cardPadding)
      const h = o.cardPadding * 2 + o.labelHeight + Math.max(1, lines.length) * o.lineHeight
      blocks.push({
        kind: 'text',
        x: o.padding,
        y,
        w: inner,
        h,
        label: stepLabel(entries, i),
        name: seatNames[entry.seatId] ?? 'Someone',
        ai: entry.viaAi,
        lines,
      })
      y += h
    }
  })

  blocks.push({ kind: 'footer', x: 0, y, w: o.width, h: o.footerHeight })
  y += o.footerHeight

  return { width: o.width, height: y, scale: areaScale(o.width, y, o.maxArea), blocks }
}
