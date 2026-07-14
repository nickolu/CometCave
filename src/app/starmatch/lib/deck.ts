/* ---------------------------------------------------------------------------
   Starmatch — deck geometry
   Every two star charts share EXACTLY one glyph. Guaranteed by the
   finite-projective-plane construction (prime order), so the "one shared sign"
   promise is mathematics, not luck.
   -------------------------------------------------------------------------- */

export interface GlyphPos {
  sym: number
  x: number
  y: number
  rot: number
  scale: number
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function shuffle<T>(input: readonly T[]): T[] {
  const a = input.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Build a Dobble-style deck for projective-plane order `n` (prime).
 * Returns n*n + n + 1 charts, each a list of n+1 glyph indices; any two
 * charts intersect in exactly one glyph.
 */
export function generateDeck(n: number): number[][] {
  const cards: number[][] = []

  const first: number[] = []
  for (let i = 0; i <= n; i++) first.push(i)
  cards.push(first)

  for (let i = 0; i < n; i++) {
    const c = [0]
    for (let j = 0; j < n; j++) c.push(n + 1 + n * i + j)
    cards.push(c)
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const c = [i + 1]
      for (let k = 0; k < n; k++) c.push(n + 1 + n * k + ((i * k + j) % n))
      cards.push(c)
    }
  }

  return cards
}

/** The single glyph index shared by two charts. */
export function sharedGlyph(a: number[], b: number[]): number {
  return a.filter((s) => b.includes(s))[0]
}

/** Scatter glyphs on a disc: one near the eye, the rest on a jittered ring. */
export function makeLayout(symbols: number[]): GlyphPos[] {
  const shuffled = shuffle(symbols)
  const k = shuffled.length
  const pos: GlyphPos[] = []

  pos.push({
    sym: shuffled[0],
    x: 50 + rand(-6, 6),
    y: 50 + rand(-6, 6),
    rot: rand(-35, 35),
    scale: rand(0.95, 1.25),
  })

  const ringN = k - 1
  const start = rand(0, 360)
  const base = 33
  for (let i = 0; i < ringN; i++) {
    const ang = start + (360 / ringN) * i + rand(-14, 14)
    const r = base + rand(-5, 6)
    const radn = (ang * Math.PI) / 180
    pos.push({
      sym: shuffled[i + 1],
      x: 50 + Math.cos(radn) * r,
      y: 50 + Math.sin(radn) * r,
      rot: rand(-42, 42),
      scale: rand(0.82, 1.18),
    })
  }

  // shuffle z-order so the shared sign isn't always drawn on top
  return shuffle(pos)
}
