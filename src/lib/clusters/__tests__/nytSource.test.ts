import { describe, expect, it } from 'vitest'

import { SourceParseError, classifySource, parseNytPuzzle } from '@/lib/clusters/nytSource'

/** The real NYT 2023-06-12 document, trimmed to the fields we read. */
const DAY_ONE = {
  status: 'OK',
  id: 1,
  print_date: '2023-06-12',
  editor: 'Wyna Liu',
  categories: [
    {
      title: 'WET WEATHER',
      cards: [
        { content: 'HAIL', position: 9 },
        { content: 'RAIN', position: 11 },
        { content: 'SLEET', position: 12 },
        { content: 'SNOW', position: 0 },
      ],
    },
    {
      title: 'NBA TEAMS',
      cards: [
        { content: 'BUCKS', position: 6 },
        { content: 'HEAT', position: 4 },
        { content: 'JAZZ', position: 8 },
        { content: 'NETS', position: 15 },
      ],
    },
    {
      title: 'KEYBOARD KEYS',
      cards: [
        { content: 'OPTION', position: 10 },
        { content: 'RETURN', position: 7 },
        { content: 'SHIFT', position: 2 },
        { content: 'TAB', position: 5 },
      ],
    },
    {
      title: 'PALINDROMES',
      cards: [
        { content: 'KAYAK', position: 3 },
        { content: 'LEVEL', position: 1 },
        { content: 'MOM', position: 14 },
        { content: 'RACECAR', position: 13 },
      ],
    },
  ],
}

const clone = () => JSON.parse(JSON.stringify(DAY_ONE))

describe('parseNytPuzzle', () => {
  it('rebuilds the board in the order the source laid it out', () => {
    const p = parseNytPuzzle(DAY_ONE, '2026-06-12')
    expect(p.layout).toEqual([
      'SNOW', 'LEVEL', 'SHIFT', 'KAYAK',
      'HEAT', 'TAB', 'BUCKS', 'RETURN',
      'JAZZ', 'HAIL', 'OPTION', 'RAIN',
      'SLEET', 'RACECAR', 'MOM', 'NETS',
    ])
  })

  it('maps category order onto the difficulty tiers', () => {
    const p = parseNytPuzzle(DAY_ONE, '2026-06-12')
    expect(p.groups.map((g) => g.tier)).toEqual(['yellow', 'green', 'blue', 'purple'])
    expect(p.groups[0].title).toBe('WET WEATHER')
    expect(p.groups[3].title).toBe('PALINDROMES')
  })

  it('numbers the puzzle by our sequence, not the source id', () => {
    expect(parseNytPuzzle(DAY_ONE, '2026-06-12').puzzleNumber).toBe(1)
    // Source id 1, but on our 86th day it is our puzzle 86.
    expect(parseNytPuzzle(DAY_ONE, '2026-09-05').puzzleNumber).toBe(86)
  })

  it('keeps the source date and editor for credit', () => {
    const p = parseNytPuzzle(DAY_ONE, '2026-06-12')
    expect(p.source).toEqual({ provider: 'nyt', date: '2023-06-12', editor: 'Wyna Liu' })
  })

  it('normalizes words to upper case', () => {
    const raw = clone()
    raw.categories[0].cards[0].content = 'hail'
    const p = parseNytPuzzle(raw, '2026-06-12')
    expect(p.groups[0].words).toContain('HAIL')
    expect(p.layout[9]).toBe('HAIL')
  })
})

describe('parseNytPuzzle rejects a board it cannot trust', () => {
  it('refuses a document with the wrong number of categories', () => {
    const raw = clone()
    raw.categories.pop()
    expect(() => parseNytPuzzle(raw, '2026-06-12')).toThrow(SourceParseError)
  })

  it('refuses a category with the wrong number of cards', () => {
    const raw = clone()
    raw.categories[1].cards.pop()
    expect(() => parseNytPuzzle(raw, '2026-06-12')).toThrow(/4 cards|expected/)
  })

  it('refuses two cards claiming one position', () => {
    const raw = clone()
    raw.categories[0].cards[0].position = 11
    expect(() => parseNytPuzzle(raw, '2026-06-12')).toThrow(/position 11/)
  })

  it('refuses an out-of-range position', () => {
    const raw = clone()
    raw.categories[0].cards[0].position = 16
    expect(() => parseNytPuzzle(raw, '2026-06-12')).toThrow(/out-of-range/)
  })

  it('refuses a missing print_date', () => {
    const raw = clone()
    delete raw.print_date
    expect(() => parseNytPuzzle(raw, '2026-06-12')).toThrow(/print_date/)
  })

  it('refuses an untitled category', () => {
    const raw = clone()
    raw.categories[2].title = '   '
    expect(() => parseNytPuzzle(raw, '2026-06-12')).toThrow(/no title/)
  })

  it('refuses a board with a repeated word', () => {
    const raw = clone()
    raw.categories[3].cards[0].content = 'MOM'
    expect(() => parseNytPuzzle(raw, '2026-06-12')).toThrow(/duplicate words/)
  })

  it('falls back rather than throwing when only the editor is missing', () => {
    const raw = clone()
    delete raw.editor
    expect(parseNytPuzzle(raw, '2026-06-12').source.editor).toBe('unknown')
  })
})

/**
 * Roughly one archive day in 170 is a visual puzzle: every card is an SVG
 * with alt text and no content. A full sweep of 2023-06-12..2026-09-05
 * turned up seven, including "PIPS ON A DIE" and "CURRENCY SYMBOLS".
 */
describe('classifySource', () => {
  const imageCard = (position: number, alt: string) => ({
    position,
    image_url: `https://example.invalid/img-${position}.svg`,
    image_alt_text: alt,
  })

  function imagePuzzle() {
    const raw = clone()
    let n = 0
    for (const category of raw.categories) {
      category.cards = category.cards.map(() => imageCard(n, `ALT${n++}`))
    }
    return raw
  }

  it('recognizes an ordinary word puzzle', () => {
    expect(classifySource(DAY_ONE)).toBe('words')
  })

  it('recognizes a puzzle whose cards are all images', () => {
    expect(classifySource(imagePuzzle())).toBe('images')
  })

  it('reports a board that mixes words and images as mixed', () => {
    // 2026-03-07 is real: fifteen words plus one image tile reading
    // "THIS GAME". Alt text would have worked there and would have been
    // nonsense elsewhere, so mixed boards are skipped rather than guessed.
    const raw = clone()
    raw.categories[3].cards[0] = {
      position: raw.categories[3].cards[0].position,
      image_url: 'https://example.invalid/img.svg',
      image_alt_text: 'THIS GAME',
    }
    expect(classifySource(raw)).toBe('mixed')
  })

  it('reports a board with cards that are neither as unknown', () => {
    const raw = clone()
    raw.categories[0].cards[0] = { position: 9 }
    expect(classifySource(raw)).toBe('unknown')
  })

  it('reports unknown for a document with no categories', () => {
    expect(classifySource({})).toBe('unknown')
    expect(classifySource({ categories: [] })).toBe('unknown')
    expect(classifySource(null)).toBe('unknown')
  })

  it('does not treat an image puzzle as parseable', () => {
    // The ingest checks classifySource first; this is the backstop.
    expect(() => parseNytPuzzle(imagePuzzle(), '2026-06-12')).toThrow(SourceParseError)
  })
})
