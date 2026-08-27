import { describe, it, expect } from 'vitest'
import { GhostDrafter, recordGhost, replayGhost } from '../draft/ghost'
import { HeuristicBot } from '../draft/drafter'
import { createPool, getAvailable } from '../draft/pool'

describe('GhostDrafter', () => {
  it('replays picks in order', () => {
    const log = { drafterId: 'test', seed: 42, picks: [1, 4, 7, null, 25, 133] }
    const ghost = new GhostDrafter(log)
    expect(ghost.pick([], [], 0)).toBe(1)
    expect(ghost.pick([], [], 0)).toBe(4)
    expect(ghost.pick([], [], 0)).toBe(7)
    expect(ghost.pick([], [], 0)).toBeNull()
    expect(ghost.pick([], [], 0)).toBe(25)
    expect(ghost.pick([], [], 0)).toBe(133)
  })

  it('returns null when log is exhausted', () => {
    const log = { drafterId: 'test', seed: 1, picks: [1] }
    const ghost = new GhostDrafter(log)
    ghost.pick([], [], 0) // consume the one pick
    expect(ghost.pick([], [], 0)).toBeNull()
  })
})

describe('recordGhost', () => {
  it('records exactly ROUNDS entries', () => {
    const bot = new HeuristicBot()
    const log = recordGhost('bot', 42, (shop, board, seed) => bot.pick(shop, board, seed))
    expect(log.picks).toHaveLength(6)
  })

  it('all recorded picks are valid dexIds or null', () => {
    const bot = new HeuristicBot()
    const log = recordGhost('bot', 99, (shop, board, seed) => bot.pick(shop, board, seed))
    for (const pick of log.picks) {
      if (pick !== null) {
        expect(typeof pick).toBe('number')
        expect(pick).toBeGreaterThan(0)
      }
    }
  })

  it('is deterministic for the same seed', () => {
    const bot1 = new HeuristicBot()
    const bot2 = new HeuristicBot()
    const log1 = recordGhost('bot', 7, (s, b, seed) => bot1.pick(s, b, seed))
    const log2 = recordGhost('bot', 7, (s, b, seed) => bot2.pick(s, b, seed))
    expect(log1.picks).toEqual(log2.picks)
  })
})

describe('replayGhost', () => {
  it('rebuilds the same board from the log', () => {
    const bot = new HeuristicBot()
    const log = recordGhost('bot', 42, (shop, board, seed) => bot.pick(shop, board, seed))
    const pool = createPool()
    const board = replayGhost(log, pool)
    // Board should have same dexIds as picks (minus nulls and failed contention)
    const expectedDexIds = log.picks.filter((p): p is number => p !== null)
    expect(board.map(u => u.dexId)).toEqual(expectedDexIds)
  })

  it('handles pool contention gracefully', () => {
    // Exhaust a unit from the pool before replaying
    const pool = createPool()
    const log = { drafterId: 'ghost', seed: 1, picks: [1] } // Bulbasaur (dexId=1)
    // Take all copies of Bulbasaur by setting available to 0
    pool.get(1)!.available = 0
    const board = replayGhost(log, pool)
    expect(board).toHaveLength(0) // contested pick failed
  })
})
