/**
 * The only provider-specific module in Clusters.
 *
 * Everything downstream (API, session, scoring, stats, share) reads
 * `layout` and `groups` and knows nothing about where they came from.
 * Swapping to hand-authored or generated puzzles is a change to this file
 * and the ingest script, and nothing else. Protect that boundary.
 */

import { BOARD_SIZE, type ClusterGroup, GROUP_SIZE, TIERS } from '@/app/clusters/models/clusters'

import { puzzleNumberFor } from './dateMap'

export const NYT_ENDPOINT = 'https://www.nytimes.com/svc/connections/v2'

export interface ParsedPuzzle {
  date: string
  puzzleNumber: number
  layout: string[]
  groups: ClusterGroup[]
  source: { provider: 'nyt'; date: string; editor: string }
}

export class SourceParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SourceParseError'
  }
}

interface RawCard {
  content?: unknown
  position?: unknown
}
interface RawCategory {
  title?: unknown
  cards?: unknown
}
interface RawPuzzle {
  print_date?: unknown
  editor?: unknown
  categories?: unknown
}

/**
 * Convert one NYT archive document into our shape.
 *
 * Verified across the whole archive: always exactly four categories of four
 * cards, positions always a complete 0-15, and categories always arrive in
 * difficulty order, so `categories[i]` maps straight onto `TIERS[i]`.
 * Every one of those is asserted here rather than assumed. If NYT ever
 * changes the shape, ingest fails loudly instead of writing a broken board.
 */
export function parseNytPuzzle(raw: unknown, playDate: string): ParsedPuzzle {
  const doc = raw as RawPuzzle
  const sourceDate = doc?.print_date
  if (typeof sourceDate !== 'string') {
    throw new SourceParseError('missing print_date')
  }

  const categories = doc.categories
  if (!Array.isArray(categories) || categories.length !== TIERS.length) {
    throw new SourceParseError(
      `expected ${TIERS.length} categories, got ${Array.isArray(categories) ? categories.length : typeof categories}`
    )
  }

  const layout: (string | undefined)[] = new Array(BOARD_SIZE).fill(undefined)
  const groups: ClusterGroup[] = []

  categories.forEach((rawCategory: RawCategory, index: number) => {
    const title = rawCategory?.title
    if (typeof title !== 'string' || !title.trim()) {
      throw new SourceParseError(`category ${index} has no title`)
    }

    const cards = rawCategory.cards
    if (!Array.isArray(cards) || cards.length !== GROUP_SIZE) {
      throw new SourceParseError(
        `category ${index} ("${title}") has ${Array.isArray(cards) ? cards.length : 0} cards, expected ${GROUP_SIZE}`
      )
    }

    const words: string[] = []
    for (const card of cards as RawCard[]) {
      const content = card?.content
      const position = card?.position
      if (typeof content !== 'string' || !content.trim()) {
        throw new SourceParseError(`category ${index} ("${title}") has a card with no content`)
      }
      if (typeof position !== 'number' || !Number.isInteger(position) || position < 0 || position >= BOARD_SIZE) {
        throw new SourceParseError(`card "${content}" has an out-of-range position: ${String(position)}`)
      }
      if (layout[position] !== undefined) {
        throw new SourceParseError(`two cards claim position ${position}`)
      }
      const word = content.trim().toUpperCase()
      layout[position] = word
      words.push(word)
    }

    groups.push({ tier: TIERS[index], title: title.trim().toUpperCase(), words })
  })

  if (layout.some((w) => w === undefined)) {
    const missing = layout.map((w, i) => (w === undefined ? i : -1)).filter((i) => i >= 0)
    throw new SourceParseError(`board has empty positions: ${missing.join(', ')}`)
  }

  const allWords = groups.flatMap((g) => g.words)
  if (new Set(allWords).size !== BOARD_SIZE) {
    throw new SourceParseError('board contains duplicate words')
  }

  const editor = typeof doc.editor === 'string' ? doc.editor : 'unknown'

  return {
    date: playDate,
    puzzleNumber: puzzleNumberFor(playDate),
    layout: layout as string[],
    groups,
    source: { provider: 'nyt', date: sourceDate, editor },
  }
}

/**
 * What kind of board a source document holds.
 *
 * Clusters runs `words` boards and nothing else. A full sweep of
 * 2023-06-12..2026-09-05 found eight days that are not:
 *
 *   - seven `images` boards, where every card is an SVG with
 *     `image_alt_text` and no `content` ("PIPS ON A DIE",
 *     "CURRENCY SYMBOLS", "EMOTICON MOUTHS");
 *   - one `mixed` board (2026-03-07), fifteen words plus a single image
 *     tile whose alt text is "THIS GAME".
 *
 * Substituting alt text would sometimes work and sometimes produce a
 * trivial or nonsense board, and nothing can tell the two apart
 * automatically. So the rule is the one that is always right: run a board
 * only when every card is a word. The rest are skipped at ingest and never
 * occupy a play date, so skipping costs a player nothing.
 */
export type SourceKind = 'words' | 'images' | 'mixed' | 'unknown'

export const SOURCE_KIND_REASON: Record<Exclude<SourceKind, 'words'>, string> = {
  images: 'image puzzle',
  mixed: 'mixed word and image board',
  unknown: 'unrecognized board shape',
}

export function classifySource(raw: unknown): SourceKind {
  const categories = (raw as RawPuzzle)?.categories
  if (!Array.isArray(categories) || categories.length === 0) return 'unknown'

  let words = 0
  let images = 0
  let total = 0
  for (const category of categories as RawCategory[]) {
    const cards = category?.cards
    if (!Array.isArray(cards)) return 'unknown'
    for (const card of cards as (RawCard & { image_url?: unknown })[]) {
      total++
      if (typeof card?.content === 'string' && card.content.trim()) words++
      else if (typeof card?.image_url === 'string' && card.image_url) images++
    }
  }
  if (total === 0) return 'unknown'
  if (words === total) return 'words'
  if (images === total) return 'images'
  if (words + images === total) return 'mixed'
  return 'unknown'
}

const RETRYABLE_ATTEMPTS = 3

/**
 * The archive is flaky at the edges: a full sweep turned up a 503, a
 * connection reset, and a spurious 404 on a date that serves fine on the
 * next request. Retrying matters because a skipped day is not a gap we can
 * come back for — sequential assignment would have moved past it.
 */
export async function fetchNytPuzzle(sourceDate: string, signal?: AbortSignal): Promise<unknown> {
  let lastError: unknown
  for (let attempt = 1; attempt <= RETRYABLE_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${NYT_ENDPOINT}/${sourceDate}.json`, {
        signal,
        headers: { accept: 'application/json' },
      })
      if (res.ok) return await res.json()
      lastError = new SourceParseError(`source fetch for ${sourceDate} returned ${res.status}`)
    } catch (err) {
      lastError = err
    }
    if (attempt < RETRYABLE_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 400 * attempt))
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new SourceParseError(`source fetch for ${sourceDate} failed`)
}
