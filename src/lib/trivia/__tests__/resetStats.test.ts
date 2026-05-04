import { beforeEach, describe, expect, it, vi } from 'vitest'

interface FakeDoc {
  data: Record<string, unknown>
}

class FakeStore {
  docs = new Map<string, FakeDoc>()

  set(path: string, data: Record<string, unknown>): void {
    this.docs.set(path, { data })
  }

  has(path: string): boolean {
    return this.docs.has(path)
  }

  get(path: string): FakeDoc | undefined {
    return this.docs.get(path)
  }

  delete(path: string): void {
    this.docs.delete(path)
  }

  listCollection(collectionPath: string): Array<{ id: string; path: string; data: Record<string, unknown> }> {
    const prefix = `${collectionPath}/`
    const results: Array<{ id: string; path: string; data: Record<string, unknown> }> = []
    for (const [path, doc] of this.docs) {
      if (!path.startsWith(prefix)) continue
      const remainder = path.slice(prefix.length)
      if (remainder.includes('/')) continue
      results.push({ id: remainder, path, data: doc.data })
    }
    return results
  }
}

const store = new FakeStore()

class FakeDocRef {
  constructor(
    public path: string,
    private s: FakeStore
  ) {}

  async get() {
    const doc = this.s.get(this.path)
    return {
      exists: doc !== undefined,
      data: () => doc?.data,
      ref: this,
    }
  }

  async delete() {
    this.s.delete(this.path)
  }
}

class FakeQuerySnap {
  constructor(public docs: Array<{ id: string; ref: FakeDocRef; data: () => Record<string, unknown> }>) {}
  get empty() {
    return this.docs.length === 0
  }
  get size() {
    return this.docs.length
  }
}

class FakeCollectionRef {
  constructor(
    public path: string,
    private s: FakeStore,
    private _limit: number | null = null
  ) {}

  limit(n: number): FakeCollectionRef {
    return new FakeCollectionRef(this.path, this.s, n)
  }

  async get(): Promise<FakeQuerySnap> {
    const all = this.s.listCollection(this.path)
    const slice = this._limit !== null ? all.slice(0, this._limit) : all
    return new FakeQuerySnap(
      slice.map((d) => ({
        id: d.id,
        ref: new FakeDocRef(d.path, this.s),
        data: () => d.data,
      }))
    )
  }
}

class FakeBatch {
  private ops: Array<() => void> = []
  constructor(private s: FakeStore) {}
  delete(ref: FakeDocRef) {
    this.ops.push(() => this.s.delete(ref.path))
  }
  async commit() {
    for (const op of this.ops) op()
    this.ops = []
  }
}

class FakeFirestore {
  constructor(private s: FakeStore) {}
  doc(path: string): FakeDocRef {
    return new FakeDocRef(path, this.s)
  }
  collection(path: string): FakeCollectionRef {
    return new FakeCollectionRef(path, this.s)
  }
  batch(): FakeBatch {
    return new FakeBatch(this.s)
  }
}

vi.mock('@/lib/firebase/server', () => ({
  getFirestoreDb: () => new FakeFirestore(store),
}))

import { resetDailyStats, resetInfiniteStats } from '@/lib/trivia/resetStats'

const UID = 'user-1'
const OTHER_UID = 'user-2'

beforeEach(() => {
  store.docs.clear()
})

describe('resetDailyStats', () => {
  it('deletes profile, games, daily, and weekly entries for the user', async () => {
    store.set(`users/${UID}/triviaProfile/current`, { gamesPlayed: 7 })
    store.set(`users/${UID}/triviaGames/2026-04-30`, { score: 100 })
    store.set(`users/${UID}/triviaGames/2026-05-01`, { score: 200 })
    store.set(`users/${UID}/triviaDaily/2026-04-30`, { score: 100 })
    store.set(`users/${UID}/triviaDaily/2026-05-01`, { score: 200 })
    store.set(`users/${UID}/triviaWeekly/2026-W18`, { weekKey: '2026-W18', totalScore: 300 })

    const res = await resetDailyStats(UID)

    expect(res.deletedDocs).toBe(6)
    expect(store.has(`users/${UID}/triviaProfile/current`)).toBe(false)
    expect(store.listCollection(`users/${UID}/triviaGames`)).toHaveLength(0)
    expect(store.listCollection(`users/${UID}/triviaDaily`)).toHaveLength(0)
    expect(store.listCollection(`users/${UID}/triviaWeekly`)).toHaveLength(0)
  })

  it('revokes only crowns where winnerUid matches the user', async () => {
    store.set(`users/${UID}/triviaWeekly/2026-W18`, { weekKey: '2026-W18', totalScore: 300 })
    store.set(`users/${UID}/triviaWeekly/2026-W19`, { weekKey: '2026-W19', totalScore: 200 })
    store.set(`weeklyCrowns/2026-W18`, { weekKey: '2026-W18', winnerUid: UID, winnerScore: 300 })
    store.set(`weeklyCrowns/2026-W19`, { weekKey: '2026-W19', winnerUid: OTHER_UID, winnerScore: 250 })

    const res = await resetDailyStats(UID)

    expect(res.crownsRevoked).toBe(1)
    expect(store.has(`weeklyCrowns/2026-W18`)).toBe(false)
    expect(store.has(`weeklyCrowns/2026-W19`)).toBe(true)
  })

  it('does not touch another user\'s data', async () => {
    store.set(`users/${UID}/triviaGames/2026-05-01`, { score: 100 })
    store.set(`users/${OTHER_UID}/triviaGames/2026-05-01`, { score: 999 })
    store.set(`users/${OTHER_UID}/triviaProfile/current`, { gamesPlayed: 99 })

    await resetDailyStats(UID)

    expect(store.listCollection(`users/${OTHER_UID}/triviaGames`)).toHaveLength(1)
    expect(store.has(`users/${OTHER_UID}/triviaProfile/current`)).toBe(true)
  })

  it('is idempotent — second call deletes nothing and reports zeros', async () => {
    store.set(`users/${UID}/triviaProfile/current`, { gamesPlayed: 1 })
    await resetDailyStats(UID)
    const second = await resetDailyStats(UID)
    expect(second.deletedDocs).toBe(0)
    expect(second.crownsRevoked).toBe(0)
  })
})

describe('resetInfiniteStats', () => {
  it('deletes aggregate, runs, and category stats — but preserves seenQuestions', async () => {
    store.set(`users/${UID}/triviaStats/aggregate`, { runsPlayed: 10 })
    store.set(`users/${UID}/triviaInfinite/run-a`, { runId: 'run-a', score: 500 })
    store.set(`users/${UID}/triviaInfinite/run-b`, { runId: 'run-b', score: 700 })
    store.set(`users/${UID}/triviaCategoryStats/9`, { categoryId: 9, correctCount: 50 })
    store.set(`users/${UID}/seenQuestions/q-123`, { at: 1, correct: true })
    store.set(`users/${UID}/seenQuestions/q-456`, { at: 2, correct: false })

    const res = await resetInfiniteStats(UID)

    expect(res.deletedDocs).toBe(4)
    expect(store.has(`users/${UID}/triviaStats/aggregate`)).toBe(false)
    expect(store.listCollection(`users/${UID}/triviaInfinite`)).toHaveLength(0)
    expect(store.listCollection(`users/${UID}/triviaCategoryStats`)).toHaveLength(0)
    expect(store.listCollection(`users/${UID}/seenQuestions`)).toHaveLength(2)
  })

  it('does not touch aiQuestions analytics breadcrumbs', async () => {
    store.set(`users/${UID}/triviaInfinite/run-a`, { runId: 'run-a' })
    store.set(`aiQuestions/q-123/answeredBy/${UID}_run-a`, { uid: UID, correct: true })

    await resetInfiniteStats(UID)

    expect(store.has(`aiQuestions/q-123/answeredBy/${UID}_run-a`)).toBe(true)
  })

  it('does not touch another user\'s data', async () => {
    store.set(`users/${UID}/triviaInfinite/run-a`, { runId: 'run-a' })
    store.set(`users/${OTHER_UID}/triviaInfinite/run-x`, { runId: 'run-x' })
    store.set(`users/${OTHER_UID}/triviaStats/aggregate`, { runsPlayed: 5 })

    await resetInfiniteStats(UID)

    expect(store.listCollection(`users/${OTHER_UID}/triviaInfinite`)).toHaveLength(1)
    expect(store.has(`users/${OTHER_UID}/triviaStats/aggregate`)).toBe(true)
  })

  it('deletes in-progress runs (endedAt: null) too', async () => {
    store.set(`users/${UID}/triviaInfinite/in-progress`, {
      runId: 'in-progress',
      endedAt: null,
      score: 0,
    })

    await resetInfiniteStats(UID)

    expect(store.listCollection(`users/${UID}/triviaInfinite`)).toHaveLength(0)
  })

  it('also wipes per-topic custom-category medal stats', async () => {
    store.set(`users/${UID}/triviaCustomCategoryStats/norse%20mythology`, {
      topic: 'norse mythology',
      correctCount: 25,
    })
    store.set(`users/${UID}/triviaCustomCategoryStats/the%20office`, {
      topic: 'the office',
      correctCount: 8,
    })

    const res = await resetInfiniteStats(UID)

    expect(res.deletedDocs).toBe(2)
    expect(store.listCollection(`users/${UID}/triviaCustomCategoryStats`)).toHaveLength(0)
  })
})
