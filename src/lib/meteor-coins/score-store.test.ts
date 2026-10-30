import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthClaims } from '@/lib/users/profile'

/**
 * A fake Firestore holding one map of path → data. Transactions read and
 * write straight through: the store runs one at a time, so that is enough
 * to check what a sequence of saves leaves behind.
 */
const docs = new Map<string, Record<string, unknown>>()

class FakeDocRef {
  constructor(public path: string) {}
  async get() {
    return snapOf(this.path)
  }
  async set(data: Record<string, unknown>) {
    docs.set(this.path, data)
  }
}

function snapOf(path: string) {
  const data = docs.get(path)
  return { exists: data !== undefined, data: () => data, ref: new FakeDocRef(path) }
}

const fakeDb = {
  doc: (path: string) => new FakeDocRef(path),
  collection: (name: string) => ({ doc: (id: string) => new FakeDocRef(`${name}/${id}`) }),
  getAll: async (...refs: FakeDocRef[]) => refs.map(r => snapOf(r.path)),
  runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
    fn({
      get: async (ref: FakeDocRef) => snapOf(ref.path),
      set: (ref: FakeDocRef, data: Record<string, unknown>) => docs.set(ref.path, data),
    }),
}

vi.mock('@/lib/firebase/server', () => ({ getFirestoreDb: () => fakeDb }))
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'server-time' },
}))

const { loadBoard, loadMyScores, recordResults } = await import('./score-store')

const anon: AuthClaims = { uid: 'anon-1', isAnonymous: true }
const ada: AuthClaims = { uid: 'ada', isAnonymous: false }

function profile(uid: string, nickname: string) {
  docs.set(`users/${uid}`, { nickname })
}

beforeEach(() => {
  docs.clear()
})

describe('recordResults', () => {
  it('records an anonymous player without listing them, and tells them their place', async () => {
    const mine = await recordResults(anon, [{ stage: 'penny-falls', value: 40, stars: 2 }])
    expect(mine.signedUp).toBe(false)
    expect(mine.stages['penny-falls']).toEqual({
      best: 40,
      stars: 2,
      rank: 1,
      players: 1,
      listed: false,
    })
    const board = await loadBoard('penny-falls', null)
    expect(board.players).toBe(1)
    expect(board.entries).toEqual([])
    expect(docs.get('meteor-coins-scores/penny-falls_anon-1')).toMatchObject({
      uid: 'anon-1',
      value: 40,
      stars: 2,
      plays: 1,
    })
  })

  it('lists a signed-up player with a nickname, ranked among listed players', async () => {
    await recordResults(anon, [{ stage: 'penny-falls', value: 40, stars: 2 }])
    profile('ada', 'Ada')
    const hers = await recordResults(ada, [{ stage: 'penny-falls', value: 30, stars: 1 }])
    expect(hers.stages['penny-falls']).toMatchObject({ rank: 1, players: 2, listed: true })
    // The save hands back the board, with her on it, for the result panel.
    expect(hers.boards['penny-falls']).toMatchObject({
      players: 2,
      entries: [{ uid: 'ada', name: 'Ada', value: 30, rank: 1 }],
      me: { rank: 1, listed: true },
    })

    const board = await loadBoard('penny-falls', ada)
    expect(board.entries).toEqual([{ uid: 'ada', name: 'Ada', value: 30, stars: 1, rank: 1 }])
    expect(board.me).toMatchObject({ best: 30, rank: 1, listed: true })

    // The anonymous player would take first place if listed.
    const theirs = await loadMyScores(anon)
    expect(theirs.stages['penny-falls']).toMatchObject({ rank: 1, players: 2, listed: false })
  })

  it('keeps the best score and the most stars, counting every play', async () => {
    profile('ada', 'Ada')
    await recordResults(ada, [{ stage: 'penny-falls', value: 50, stars: 2 }])
    const after = await recordResults(ada, [{ stage: 'penny-falls', value: 20, stars: 3 }])
    expect(after.stages['penny-falls']).toMatchObject({ best: 50, stars: 3, players: 1 })
    expect(docs.get('meteor-coins-scores/penny-falls_ada')).toMatchObject({ plays: 2 })
    const board = await loadBoard('penny-falls', null)
    expect(board.entries).toEqual([{ uid: 'ada', name: 'Ada', value: 50, stars: 3, rank: 1 }])
  })

  it('saves several stages at once and reports each', async () => {
    const mine = await recordResults(anon, [
      { stage: 'penny-falls', value: 40, stars: 2 },
      { stage: 'moonstone-porch', value: 6, stars: 1 },
    ])
    expect(Object.keys(mine.stages).sort()).toEqual(['moonstone-porch', 'penny-falls'])
    expect((await loadBoard('moonstone-porch', null)).players).toBe(1)
  })
})

describe('name refresh', () => {
  it('puts a player on the board once they sign up and pick a name', async () => {
    await recordResults(anon, [{ stage: 'penny-falls', value: 40, stars: 2 }])

    // Same uid, now signed up (the credential was linked) and named.
    const upgraded: AuthClaims = { uid: 'anon-1', isAnonymous: false }
    profile('anon-1', 'Nova')
    const before = await loadMyScores(upgraded)
    expect(before.nameStale).toBe(true)
    expect(before.stages['penny-falls'].listed).toBe(false)

    const refreshed = await recordResults(upgraded, [])
    expect(refreshed.stages['penny-falls']).toMatchObject({ best: 40, listed: true, rank: 1 })
    expect(refreshed.boards).toEqual({})
    expect(docs.get('meteor-coins-scores/penny-falls_anon-1')).toMatchObject({ plays: 1 })

    const after = await loadMyScores(upgraded)
    expect(after.nameStale).toBe(false)
    const board = await loadBoard('penny-falls', null)
    expect(board.entries.map(e => e.name)).toEqual(['Nova'])
    expect(board.players).toBe(1)
  })

  it('does nothing for a player with no record', async () => {
    const mine = await recordResults(ada, [])
    expect(mine.stages).toEqual({})
    expect(docs.size).toBe(0)
  })
})

describe('loadBoard', () => {
  it('leaves out the caller when they have not played', async () => {
    profile('ada', 'Ada')
    await recordResults(ada, [{ stage: 'penny-falls', value: 30, stars: 1 }])
    const board = await loadBoard('penny-falls', anon)
    expect(board.me).toBeNull()
    expect(board.entries).toHaveLength(1)
  })
})
