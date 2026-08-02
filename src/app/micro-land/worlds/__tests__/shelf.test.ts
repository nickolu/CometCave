/**
 * The shelf's storage behaviour, and mostly one question: does letting go of a
 * world stick?
 *
 * It did not. Deleting removed the world from whichever backend was in use — the
 * account, once auth had resolved, which is every player — and left this
 * device's copy alone. The next visit read that copy, found a world the account
 * had never heard of, and helpfully uploaded it again. Every test below that
 * mentions a mark is about telling those two situations apart.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  WORLDS_SYNC_KEY,
  readSyncMark,
  setSyncStore,
  writeSyncMark,
} from '@/app/micro-land/sync-mark'
import type { WorldsBackend } from '@/app/micro-land/worlds/backend'
import {
  adoptWorldsAccount,
  initShelf,
  keepWorld,
  readShelf,
  removeWorld,
  resetShelf,
  setBackend,
} from '@/app/micro-land/worlds/shelf'
import type { WorldSave } from '@/app/micro-land/worlds/types'

/**
 * A save with nothing in it but its identity.
 *
 * The shelf never looks inside one — it stores the blob and reads `summarize`'s
 * eight fields off the top — so filling in a tile grid would only obscure what
 * these tests are about. `snapshot.test.ts` is where a real world is exercised.
 */
function save(id: string, updatedAt = 1000): WorldSave {
  return {
    version: 1,
    id,
    name: id,
    createdAt: 1,
    updatedAt,
    themeId: 'earth',
    terrain: null,
    camX: 0,
    land: { landId: 'earth', steadySince: 0, elderId: null },
    world: { creatures: [], elapsed: 0 },
  } as unknown as WorldSave
}

/** A backend that keeps saves in a Map, standing in for a device or an account. */
function memoryBackend(initial: WorldSave[] = []) {
  const saves = new Map(initial.map(s => [s.id, s]))
  const backend: WorldsBackend = {
    async list() {
      return [...saves.values()].map(s => ({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        themeId: s.themeId,
        landName: null,
        creatures: 0,
        elapsed: 0,
      }))
    },
    async load(id) {
      return saves.get(id) ?? null
    },
    async save(next) {
      saves.set(next.id, next)
    },
    async remove(id) {
      saves.delete(id)
    },
  }
  return { backend, saves }
}

/** Stands in for `localStorage`, which the sync marks live in. */
function memoryStore() {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  }
}

/** Open the shelf on a device that already has these worlds on it. */
async function deviceWith(worlds: WorldSave[]) {
  const device = memoryBackend(worlds)
  setBackend(device.backend)
  await initShelf()
  return device
}

beforeEach(() => {
  resetShelf()
  setSyncStore(memoryStore())
})

describe('adopting an account', () => {
  it('hands up a world kept before there was an account to keep it in', async () => {
    await deviceWith([save('made-anon')])
    const account = memoryBackend()

    await adoptWorldsAccount(account.backend, 'uid-1')

    expect(account.saves.has('made-anon')).toBe(true)
    expect(readShelf().worlds.map(w => w.id)).toEqual(['made-anon'])
    // Everything this device had is up there now, which is what lets the next
    // adoption trust the account's list.
    expect(readSyncMark(WORLDS_SYNC_KEY)).toBe('uid-1')
  })

  it('brings down a world kept on another device', async () => {
    await deviceWith([])
    const account = memoryBackend([save('from-the-phone')])

    await adoptWorldsAccount(account.backend, 'uid-1')

    expect(readShelf().worlds.map(w => w.id)).toEqual(['from-the-phone'])
  })

  /** The reported bug: forgetting a world, then finding it back after a refresh. */
  it('does not upload a world this device kept but the account has let go of', async () => {
    const device = await deviceWith([save('forgotten')])
    writeSyncMark(WORLDS_SYNC_KEY, 'uid-1')
    const account = memoryBackend()

    await adoptWorldsAccount(account.backend, 'uid-1')

    expect(account.saves.has('forgotten')).toBe(false)
    expect(readShelf().worlds).toHaveLength(0)
    // And the copy left behind goes, so it cannot argue again next time.
    expect(device.saves.has('forgotten')).toBe(false)
  })

  it('still uploads when the device was last in step with a different account', async () => {
    await deviceWith([save('mine')])
    writeSyncMark(WORLDS_SYNC_KEY, 'someone-else')
    const account = memoryBackend()

    await adoptWorldsAccount(account.backend, 'uid-1')

    expect(account.saves.has('mine')).toBe(true)
  })

  it('changes nothing when the account shelf cannot be read', async () => {
    const device = await deviceWith([save('kept')])
    writeSyncMark(WORLDS_SYNC_KEY, 'uid-1')

    await adoptWorldsAccount(
      {
        async list() {
          throw new Error('offline')
        },
        async load() {
          return null
        },
        async save() {},
        async remove() {},
      },
      'uid-1'
    )

    // An unreachable account lists nothing, and nothing is exactly what a shelf
    // whose every world was deleted elsewhere would list too.
    expect(device.saves.has('kept')).toBe(true)
    expect(readShelf().worlds.map(w => w.id)).toEqual(['kept'])
  })

  it('does not claim to be in step when a world would not upload', async () => {
    await deviceWith([save('too-big')])
    const account = memoryBackend()
    const refuses: WorldsBackend = {
      ...account.backend,
      async save() {
        throw new Error('that world is too big to keep')
      },
    }

    await adoptWorldsAccount(refuses, 'uid-1')

    // Claiming otherwise would delete this world on the next visit, having never
    // put it anywhere.
    expect(readSyncMark(WORLDS_SYNC_KEY)).toBeNull()
  })
})

describe('once the account has taken over', () => {
  /** Set up a device and an account that have already met. */
  async function signedIn(worlds: WorldSave[] = []) {
    const device = await deviceWith(worlds)
    const account = memoryBackend()
    await adoptWorldsAccount(account.backend, 'uid-1')
    return { device, account }
  }

  it('writes a kept world to both the account and this device', async () => {
    const { device, account } = await signedIn()

    await keepWorld(save('new-one'))

    expect(account.saves.has('new-one')).toBe(true)
    expect(device.saves.has('new-one')).toBe(true)
  })

  it('takes a forgotten world off both, so nothing is left to re-upload', async () => {
    const { device, account } = await signedIn([save('doomed')])

    await removeWorld('doomed')

    expect(account.saves.has('doomed')).toBe(false)
    expect(device.saves.has('doomed')).toBe(false)
    expect(readShelf().worlds).toHaveLength(0)
  })

  it('survives a reload without putting the forgotten world back', async () => {
    const { device, account } = await signedIn([save('doomed')])
    await removeWorld('doomed')

    // The page comes back: the device shelf is read first, then the account is
    // adopted a moment later, exactly as `MicroLandGame` sequences it.
    resetShelf()
    setBackend(device.backend)
    await initShelf()
    await adoptWorldsAccount(account.backend, 'uid-1')

    expect(readShelf().worlds).toHaveLength(0)
  })
})
