import { emptyProgress, recordResult } from './progress'
import {
  type Board,
  type BoardEntry,
  MAX_ENTRIES,
  type Placement,
  SHOWN_ENTRIES,
  boardView,
  emptyBoard,
  mergeEntry,
  parseResults,
  placeText,
  placementOn,
  rankOn,
  unsentResults,
} from './scoreboard'

const entry = (over: Partial<BoardEntry> & { uid: string; value: number }): BoardEntry => ({
  name: over.uid,
  named: true,
  stars: 1,
  at: 0,
  ...over,
})

function boardOf(...entries: BoardEntry[]): Board {
  let board = emptyBoard('penny-falls')
  for (const e of entries) board = mergeEntry(board, e)
  return { ...board, players: entries.length }
}

describe('parseResults', () => {
  it('reads valid results and drops the whole body on anything off', () => {
    expect(parseResults({ results: [{ stage: 'penny-falls', value: 40, stars: 2 }] })).toEqual([
      { stage: 'penny-falls', value: 40, stars: 2 },
    ])
    expect(parseResults({ results: [] })).toEqual([])
    expect(parseResults(null)).toBeNull()
    expect(parseResults({})).toBeNull()
    expect(parseResults({ results: [{ stage: 'not-a-stage', value: 1, stars: 1 }] })).toBeNull()
    expect(parseResults({ results: [{ stage: 'penny-falls', value: 1.5, stars: 1 }] })).toBeNull()
    expect(parseResults({ results: [{ stage: 'penny-falls', value: -1, stars: 1 }] })).toBeNull()
    expect(parseResults({ results: [{ stage: 'penny-falls', value: 99999, stars: 1 }] })).toBeNull()
    expect(parseResults({ results: [{ stage: 'penny-falls', value: 1, stars: 4 }] })).toBeNull()
  })

  it('keeps the best when a stage repeats', () => {
    expect(
      parseResults({
        results: [
          { stage: 'penny-falls', value: 40, stars: 1 },
          { stage: 'penny-falls', value: 30, stars: 2 },
        ],
      })
    ).toEqual([{ stage: 'penny-falls', value: 40, stars: 2 }])
  })
})

describe('mergeEntry', () => {
  it('sorts best first, earlier first on a tie, and replaces a player', () => {
    const board = boardOf(
      entry({ uid: 'a', value: 10, at: 5 }),
      entry({ uid: 'b', value: 20 }),
      entry({ uid: 'c', value: 10, at: 1 })
    )
    expect(board.entries.map(e => e.uid)).toEqual(['b', 'c', 'a'])
    const again = mergeEntry(board, entry({ uid: 'a', value: 25, at: 9 }))
    expect(again.entries.map(e => e.uid)).toEqual(['a', 'b', 'c'])
    expect(again.entries).toHaveLength(3)
  })

  it('caps the board', () => {
    let board = emptyBoard('penny-falls')
    for (let i = 0; i < MAX_ENTRIES + 5; i++)
      board = mergeEntry(board, entry({ uid: `p${i}`, value: i }))
    expect(board.entries).toHaveLength(MAX_ENTRIES)
    expect(board.entries[0].value).toBe(MAX_ENTRIES + 4)
    expect(board.entries.at(-1)?.value).toBe(5)
  })
})

describe('rankOn', () => {
  const board = boardOf(
    entry({ uid: 'top', value: 50 }),
    entry({ uid: 'anon', value: 40, named: false, name: '' }),
    entry({ uid: 'mid', value: 30 }),
    entry({ uid: 'low', value: 10 })
  )

  it('places listed players by their position among listed players', () => {
    expect(rankOn(board, 'top', 50)).toBe(1)
    // The unlisted player above doesn't count.
    expect(rankOn(board, 'mid', 30)).toBe(2)
    expect(rankOn(board, 'low', 10)).toBe(3)
  })

  it('tells an unlisted player the place they would take, ties going to the player there', () => {
    expect(rankOn(board, 'anon', 40)).toBe(2)
    expect(rankOn(board, 'new', 60)).toBe(1)
    expect(rankOn(board, 'new', 30)).toBe(3)
    expect(rankOn(board, 'new', 0)).toBe(4)
  })

  it('has no place for a score below a full board', () => {
    let full = emptyBoard('penny-falls')
    for (let i = 0; i < MAX_ENTRIES; i++)
      full = mergeEntry(full, entry({ uid: `p${i}`, value: i + 100 }))
    expect(rankOn(full, 'new', 5)).toBeNull()
    expect(rankOn(full, 'new', 100)).toBeNull()
    expect(rankOn(full, 'new', 101)).toBe(MAX_ENTRIES)
  })
})

describe('placementOn and placeText', () => {
  const board = boardOf(
    entry({ uid: 'top', value: 50 }),
    entry({ uid: 'anon', value: 40, named: false })
  )

  it('reports listing, rank and the player count', () => {
    expect(placementOn(board, 'top', 50, 2)).toEqual({
      best: 50,
      stars: 2,
      rank: 1,
      players: 2,
      listed: true,
    })
    expect(placementOn(board, 'anon', 40, 1)).toEqual({
      best: 40,
      stars: 1,
      rank: 2,
      players: 2,
      listed: false,
    })
  })

  it('words each case plainly', () => {
    expect(placeText({ best: 50, stars: 2, rank: 1, players: 1, listed: true })).toBe(
      'First on the board.'
    )
    expect(placeText({ best: 50, stars: 2, rank: 3, players: 12, listed: true })).toBe(
      '#3 on the board · 12 players'
    )
    expect(placeText({ best: 40, stars: 1, rank: 2, players: 12, listed: false })).toBe(
      "You'd be #2 on the board."
    )
    expect(placeText({ best: 1, stars: 0, rank: null, players: 300, listed: false })).toBe(
      '300 players have scored here.'
    )
  })
})

describe('boardView', () => {
  it('shows listed players only, numbered, and at most the shown count', () => {
    let board = emptyBoard('penny-falls')
    for (let i = 0; i < SHOWN_ENTRIES + 3; i++) {
      board = mergeEntry(board, entry({ uid: `p${i}`, value: i, named: i % 2 === 0 }))
    }
    const view = boardView(board, null)
    expect(view.entries.every(e => e.rank === view.entries.indexOf(e) + 1)).toBe(true)
    expect(view.entries.length).toBeLessThanOrEqual(SHOWN_ENTRIES)
    expect(view.entries.map(e => e.uid)).not.toContain('p1')
    expect(view.me).toBeNull()
  })
})

describe('unsentResults', () => {
  it('sends local bests the server lacks or trails, and nothing else', () => {
    let p = recordResult(emptyProgress(), 'penny-falls', 60, 2)
    p = recordResult(p, 'moonstone-porch', 8, 1)
    p = recordResult(p, 'the-cairn', 12, 1)
    const server: Record<string, Placement> = {
      'penny-falls': { best: 60, stars: 2, rank: 1, players: 1, listed: true },
      'moonstone-porch': { best: 5, stars: 1, rank: 1, players: 1, listed: true },
    }
    expect(unsentResults(p, server)).toEqual([
      { stage: 'moonstone-porch', value: 8, stars: 1 },
      { stage: 'the-cairn', value: 12, stars: 1 },
    ])
    expect(unsentResults(emptyProgress(), server)).toEqual([])
  })

  it('sends a star the server lacks even at the same score', () => {
    const p = recordResult(emptyProgress(), 'penny-falls', 60, 3)
    const server: Record<string, Placement> = {
      'penny-falls': { best: 60, stars: 2, rank: 1, players: 1, listed: true },
    }
    expect(unsentResults(p, server)).toEqual([{ stage: 'penny-falls', value: 60, stars: 3 }])
  })
})
