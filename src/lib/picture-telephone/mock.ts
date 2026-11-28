import { getPersonality } from './personalities'
import { randomStarter } from './starters'

import type { PictureProvider } from './provider'

/* Placeholder provider: no network, no keys. Pictures are small generated SVG
   scenes picked by a hash of the sentence. They must NEVER draw the sentence
   itself, or the next player could just read it off the picture. */

export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number): () => number {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PALETTES: readonly (readonly [string, string, string, string, string])[] = [
  ['#fde68a', '#f59e0b', '#ef4444', '#3b82f6', '#1f2937'],
  ['#bae6fd', '#38bdf8', '#f472b6', '#facc15', '#1e3a5f'],
  ['#d9f99d', '#4ade80', '#fb923c', '#a78bfa', '#14532d'],
  ['#fecdd3', '#fb7185', '#fde047', '#2dd4bf', '#4c1d3b'],
  ['#ddd6fe', '#8b5cf6', '#34d399', '#fbbf24', '#2e1065'],
  ['#fed7aa', '#f97316', '#0ea5e9', '#a3e635', '#431407'],
]

type Rand = () => number

function shape(r: Rand, colors: readonly string[], size: number): string {
  const c = colors[Math.floor(r() * 4)]
  const x = Math.round(r() * (size - 200)) + 100
  const y = Math.round(r() * (size - 200)) + 100
  const s = Math.round(r() * 120) + 60
  const kind = Math.floor(r() * 3)
  if (kind === 0) return `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="${c}"/>`
  if (kind === 1) {
    return `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" rx="${s / 6}" fill="${c}" transform="rotate(${Math.round(r() * 60 - 30)} ${x} ${y})"/>`
  }
  return `<polygon points="${x},${y - s / 2} ${x + s / 2},${y + s / 2} ${x - s / 2},${y + s / 2}" fill="${c}"/>`
}

/** One emoji-like figure, built from shapes (so there is no text in the picture). */
function glyph(r: Rand, colors: readonly string[], size: number): string {
  const cx = size / 2
  const cy = size / 2 + 20
  const ink = colors[4]
  const kind = Math.floor(r() * 3)
  if (kind === 0) {
    return [
      `<circle cx="${cx}" cy="${cy}" r="120" fill="#fde047" stroke="${ink}" stroke-width="10"/>`,
      `<circle cx="${cx - 40}" cy="${cy - 30}" r="14" fill="${ink}"/>`,
      `<circle cx="${cx + 40}" cy="${cy - 30}" r="14" fill="${ink}"/>`,
      `<path d="M ${cx - 55} ${cy + 25} Q ${cx} ${cy + 85} ${cx + 55} ${cy + 25}" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>`,
    ].join('')
  }
  if (kind === 1) {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const a = (Math.PI / 5) * i - Math.PI / 2
      const rad = i % 2 === 0 ? 130 : 55
      return `${Math.round(cx + Math.cos(a) * rad)},${Math.round(cy + Math.sin(a) * rad)}`
    }).join(' ')
    return `<polygon points="${pts}" fill="#fde047" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/>`
  }
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i
    return `<circle cx="${Math.round(cx + Math.cos(a) * 75)}" cy="${Math.round(cy + Math.sin(a) * 75)}" r="55" fill="${colors[2]}" stroke="${ink}" stroke-width="8"/>`
  }).join('')
  return `${petals}<circle cx="${cx}" cy="${cy}" r="48" fill="#fde047" stroke="${ink}" stroke-width="8"/>`
}

/** A deterministic 600x600 SVG scene for a sentence. Contains none of its text. */
export function mockImageSvg(sentence: string): string {
  const size = 600
  const r = rng(hashString(sentence))
  const colors = PALETTES[Math.floor(r() * PALETTES.length)]
  const count = 3 + Math.floor(r() * 3)
  const shapes = Array.from({ length: count }, () => shape(r, colors, size)).join('')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" fill="${colors[0]}"/>`,
    `<rect y="${size * 0.7}" width="${size}" height="${size * 0.3}" fill="${colors[1]}" opacity="0.55"/>`,
    shapes,
    glyph(r, colors, size),
    '</svg>',
  ].join('')
}

export function mockImageDataUrl(sentence: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mockImageSvg(sentence))}`
}

/* Canned drifting lines. They do not look at the picture, which is the point
   of a placeholder: the chain still reads like a telephone game. */
const LINES: Record<string, readonly string[]> = {
  'literal-lou': [
    'There are four shapes and one yellow circle in the middle.',
    'I count three colors and one round yellow thing.',
    'A flat background with five objects sitting on it.',
    'One big yellow shape is surrounded by smaller shapes.',
  ],
  'dramatic-dee': [
    'A glorious golden sun rises over a kingdom of shapes!',
    'The grand yellow hero stands bravely before a rainbow army.',
    'Behold, a magnificent festival of colors under a shining star.',
    'A legendary yellow face smiles upon the whole wide world.',
  ],
  'easily-distracted-ed': [
    'There is a small blue triangle hiding in the corner.',
    'I only noticed the tiny red square near the bottom.',
    'Something orange is peeking out from behind the big thing.',
    'A little green blob in the background looks very interesting.',
  ],
  'poet-pat': [
    'Soft colors dance together like petals in the morning breeze.',
    'A golden smile glows above a field of drifting shapes.',
    'Bright little dreams float across a warm and gentle sky.',
    'The yellow moon hums a song to the sleepy shapes below.',
  ],
  'detective-dot': [
    'The clue is the odd little triangle next to the yellow circle.',
    'Someone arranged these shapes in a very suspicious pattern.',
    'A mysterious yellow face watches over a pile of colorful clues.',
    'The shapes are in a line, so someone planned this.',
  ],
  'grumpy-gus': [
    'A yellow face sits there looking unimpressed by all the shapes.',
    'Too many colors, but I suppose the round thing is nice.',
    'A star in the middle that clearly wants all the attention.',
    'The shapes are fine, but the yellow one is showing off.',
  ],
  'hungry-hana': [
    'That yellow circle looks like a big round cookie.',
    'A plate of colorful candies with a lemon in the middle.',
    'The shapes look like a picnic of fruit and cheese.',
    'A big yellow star-shaped biscuit with sprinkles all around it.',
  ],
}

export function mockDescribeLine(personalityId: string | undefined, src: string): string {
  const persona = getPersonality(personalityId)
  const lines = LINES[persona.id] ?? LINES['literal-lou']
  return lines[hashString(src) % lines.length]
}

export interface MockOptions {
  /** Artificial wait so the working screen is exercised. Return 0 in tests. */
  delay?: () => number
}

const defaultDelay = () => 400 + Math.floor(Math.random() * 500)

export function createMockProvider(options: MockOptions = {}): PictureProvider {
  const delay = options.delay ?? defaultDelay
  const wait = () => {
    const ms = delay()
    return ms > 0 ? new Promise<void>(resolve => setTimeout(resolve, ms)) : Promise.resolve()
  }
  return {
    async image(sentence) {
      await wait()
      return { src: mockImageDataUrl(sentence), mock: true }
    },
    async describe(personalityId, src) {
      await wait()
      return { text: mockDescribeLine(personalityId, src) }
    },
    async starter() {
      await wait()
      return { text: randomStarter() }
    },
    async checkText() {
      // The real blocklist and moderation arrive with the server routes.
      return { ok: true }
    },
  }
}
