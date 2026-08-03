import { beforeEach, describe, expect, it } from 'vitest'

import type { ChronicleBackend } from '@/app/micro-land/chronicle/backend'
import {
  adoptAccount,
  archivedSpecies,
  claimMilestone,
  flushChronicle,
  forgetSpecies,
  initChronicle,
  landId,
  landRecord,
  mergeChronicles,
  noteSpeciesLife,
  readChronicle,
  rememberSpecies,
  restoreSpeciesRecord,
  setBackend,
  updateChronicle,
} from '@/app/micro-land/chronicle/chronicle'
import {
  CHRONICLE_VERSION,
  emptyChronicle,
  emptyLandRecord,
} from '@/app/micro-land/chronicle/types'
import type { ChronicleData, SpeciesRecord } from '@/app/micro-land/chronicle/types'
import { reserveSummonIds, sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'
import {
  CHRONICLE_SYNC_KEY,
  readSyncMark,
  setSyncStore,
  writeSyncMark,
} from '@/app/micro-land/sync-mark'

/**
 * A blueprint stub.
 *
 * Cast rather than filled in: the chronicle only ever reads `id`, `name` and
 * `summoned`, and spelling out forty fields of pixel art would obscure what each
 * test is actually about.
 */
function bp(id: string, summoned = false): CreatureBlueprint {
  return { id, name: id, summoned } as CreatureBlueprint
}

function memoryBackend(initial: ChronicleData | null = null) {
  const state = { saved: initial }
  const backend: ChronicleBackend = {
    async load() {
      return state.saved
    },
    async save(data) {
      state.saved = JSON.parse(JSON.stringify(data)) as ChronicleData
    },
  }
  return { backend, state }
}

/** Point the module singleton at a fresh backend and read it in. */
async function loadWith(stored: ChronicleData | null) {
  const mem = memoryBackend(stored)
  setBackend(mem.backend)
  await initChronicle()
  return mem
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

beforeEach(async () => {
  setSyncStore(memoryStore())
  await loadWith(null)
})

describe('landId', () => {
  it('files a built-in theme under its own id', () => {
    expect(landId('tidepool', null)).toBe('tidepool')
  })

  it('gives a summoned land its own key, so records follow the name', () => {
    expect(landId('summoned', 'The Drowned Cathedral')).toBe('summoned:the-drowned-cathedral')
  })

  it('falls back to the theme when a name slugs down to nothing', () => {
    expect(landId('summoned', '!!!')).toBe('summoned')
  })
})

describe('loading', () => {
  it('restores stored records', async () => {
    const stored = emptyChronicle()
    stored.lands.tidepool = { ...emptyLandRecord(), steadySeconds: 420 }
    await loadWith(stored)
    expect(landRecord('tidepool').steadySeconds).toBe(420)
  })

  it('starts fresh rather than misreading an unknown version', async () => {
    const stored = { ...emptyChronicle(), version: CHRONICLE_VERSION + 99 }
    stored.lands.tidepool = { ...emptyLandRecord(), steadySeconds: 420 }
    await loadWith(stored)
    expect(readChronicle().lands).toEqual({})
  })

  it('survives a corrupt payload without throwing', async () => {
    await loadWith({ version: CHRONICLE_VERSION } as ChronicleData)
    expect(readChronicle().species).toEqual({})
  })
})

describe('writing', () => {
  it('flushes pending changes through to the backend', async () => {
    const mem = await loadWith(null)
    updateChronicle(() => {
      landRecord('volcanic').steadySeconds = 99
    })
    await flushChronicle()
    expect(mem.state.saved?.lands.volcanic.steadySeconds).toBe(99)
  })

  it('does not write when nothing changed', async () => {
    const mem = await loadWith(null)
    await flushChronicle()
    expect(mem.state.saved).toBeNull()
  })
})

describe('the species archive', () => {
  it('keeps the most recent version of a blueprint that comes back', () => {
    rememberSpecies(bp('drifter'), 1000)
    const improved = { ...bp('drifter'), name: 'Drifter, redrawn' } as CreatureBlueprint
    rememberSpecies(improved, 2000)
    expect(archivedSpecies()).toHaveLength(1)
    expect(archivedSpecies()[0].blueprint.name).toBe('Drifter, redrawn')
    expect(archivedSpecies()[0].firstSeen).toBe(1000)
    expect(archivedSpecies()[0].lastSeen).toBe(2000)
  })

  it('only records a lifespan that beats the species best', () => {
    rememberSpecies(bp('hopper'), 1000)
    expect(noteSpeciesLife('hopper', 30)).toBe(true)
    expect(noteSpeciesLife('hopper', 12)).toBe(false)
    expect(archivedSpecies()[0].longestLife).toBe(30)
  })

  it('ignores a lifespan for a species it has never seen', () => {
    expect(noteSpeciesLife('ghost', 500)).toBe(false)
  })

  it('prunes the oldest summoned species but never a built-in', () => {
    rememberSpecies(bp('builtin-hopper'), 1)
    // One past the cap, oldest first, so the first summoned one is the victim.
    for (let i = 0; i < 81; i++) rememberSpecies(bp(`summoned-${i}`, true), 100 + i)

    const ids = new Set(archivedSpecies().map(s => s.blueprint.id))
    expect(ids.has('builtin-hopper')).toBe(true)
    expect(ids.has('summoned-0')).toBe(false)
    expect(ids.has('summoned-80')).toBe(true)
    expect(archivedSpecies().filter(s => s.blueprint.summoned)).toHaveLength(80)
  })
})

describe('milestones', () => {
  it('fires once and never again', () => {
    expect(claimMilestone('first-elder', 5000)).toBe(true)
    expect(claimMilestone('first-elder', 9000)).toBe(false)
    expect(readChronicle().milestones['first-elder']).toBe(5000)
  })
})

describe('adoptAccount', () => {
  /** Records set locally before the account was known must survive the move. */
  it('keeps what was played anonymously and what the account already knew', async () => {
    await loadWith(null)
    rememberSpecies(bp('drawn-by-hand', true), 500)
    landRecord('tidepool').steadySeconds = 60

    const stored = emptyChronicle()
    stored.species['from-the-phone'] = {
      blueprint: bp('from-the-phone', true),
      firstSeen: 1,
      lastSeen: 2,
      longestLife: 90,
    }
    stored.lands.tidepool = { ...emptyLandRecord(), steadySeconds: 200 }

    const account = memoryBackend(stored)
    await adoptAccount(account.backend, 'uid-1')

    const ids = new Set(archivedSpecies().map(s => s.blueprint.id))
    expect(ids.has('drawn-by-hand')).toBe(true)
    expect(ids.has('from-the-phone')).toBe(true)
    // High-water marks, so the better of the two wins with no prompt.
    expect(landRecord('tidepool').steadySeconds).toBe(200)
  })

  it('writes the merged result straight back, so the account gains the new creature', async () => {
    await loadWith(null)
    rememberSpecies(bp('drawn-by-hand', true), 500)

    const account = memoryBackend(emptyChronicle())
    await adoptAccount(account.backend, 'uid-1')

    expect(Object.keys(account.state.saved?.species ?? {})).toContain('drawn-by-hand')
  })

  it('writes back even when the account has nothing stored yet', async () => {
    await loadWith(null)
    rememberSpecies(bp('first-ever', true), 10)

    const account = memoryBackend(null)
    await adoptAccount(account.backend, 'uid-1')

    expect(account.state.saved).not.toBeNull()
    expect(Object.keys(account.state.saved?.species ?? {})).toContain('first-ever')
  })

  /**
   * The device copy has to keep moving after sign-in, or it freezes at that
   * moment and spends every later load arguing for putting back what has been
   * deleted since. That is the bug this whole mirror exists to close.
   */
  it('keeps the device copy in step behind the account', async () => {
    const local = await loadWith(null)
    const account = memoryBackend(null)
    await adoptAccount(account.backend, 'uid-1')

    rememberSpecies(bp('after-sign-in', true), 900)
    await flushChronicle()

    expect(Object.keys(account.state.saved?.species ?? {})).toContain('after-sign-in')
    expect(Object.keys(local.state.saved?.species ?? {})).toContain('after-sign-in')
  })

  it('marks the device as in step only once the account write has landed', async () => {
    await loadWith(null)
    const local = memoryBackend(null)
    setBackend(local.backend)
    await initChronicle()

    rememberSpecies(bp('made-offline', true), 900)
    await adoptAccount(
      {
        async load() {
          return null
        },
        async save() {
          throw new Error('offline')
        },
      },
      'uid-1'
    )

    // Nothing reached the account, so the device must not claim it did — the
    // next load has to merge, which is what carries this creature up.
    expect(readSyncMark(CHRONICLE_SYNC_KEY)).toBeNull()
  })

  /**
   * The reported bug, reduced: a creature deleted in the last session is gone
   * from the account and still sitting in this device's copy, because the
   * deletion was written to the account the device was mirroring.
   */
  it('lets the account drop a species the device copy still remembers', async () => {
    const stale = emptyChronicle()
    stale.species.wyrm = {
      blueprint: bp('wyrm', true),
      firstSeen: 1,
      lastSeen: 2,
      longestLife: 30,
    }
    await loadWith(stale)
    writeSyncMark(CHRONICLE_SYNC_KEY, 'uid-1')

    await adoptAccount(memoryBackend(emptyChronicle()).backend, 'uid-1')

    expect(archivedSpecies()).toHaveLength(0)
  })

  it('still merges when the device was last in step with a different account', async () => {
    const stale = emptyChronicle()
    stale.species.wyrm = {
      blueprint: bp('wyrm', true),
      firstSeen: 1,
      lastSeen: 2,
      longestLife: 30,
    }
    await loadWith(stale)
    writeSyncMark(CHRONICLE_SYNC_KEY, 'someone-else')

    await adoptAccount(memoryBackend(emptyChronicle()).backend, 'uid-1')

    // Nothing here says this account has ever seen the wyrm, so it is a
    // creature to carry up rather than one to let go of.
    expect(archivedSpecies()).toHaveLength(1)
  })

  it('keeps the device copy when the account cannot be read at all', async () => {
    const stale = emptyChronicle()
    stale.species.wyrm = {
      blueprint: bp('wyrm', true),
      firstSeen: 1,
      lastSeen: 2,
      longestLife: 30,
    }
    await loadWith(stale)
    writeSyncMark(CHRONICLE_SYNC_KEY, 'uid-1')

    // A dropped connection and a player who has never saved both read as null.
    await adoptAccount(memoryBackend(null).backend, 'uid-1')

    expect(archivedSpecies()).toHaveLength(1)
  })

  it('ignores a stored chronicle from an unknown version', async () => {
    await loadWith(null)
    rememberSpecies(bp('drawn-by-hand', true), 500)

    const stored = { ...emptyChronicle(), version: CHRONICLE_VERSION + 99 }
    stored.species.garbage = {
      blueprint: bp('garbage', true),
      firstSeen: 1,
      lastSeen: 2,
      longestLife: 0,
    }

    await adoptAccount(memoryBackend(stored).backend, 'uid-1')

    const ids = new Set(archivedSpecies().map(s => s.blueprint.id))
    expect(ids.has('garbage')).toBe(false)
    // The player's own session is not collateral damage.
    expect(ids.has('drawn-by-hand')).toBe(true)
  })

  it('does nothing when asked to adopt the backend already in use', async () => {
    const mem = memoryBackend(null)
    setBackend(mem.backend)
    await initChronicle()
    await adoptAccount(mem.backend, 'uid-1')
    expect(mem.state.saved).toBeNull()
  })

  /**
   * The race this guards: the game calls `initChronicle` on mount and auth
   * resolves a moment later, so both can be in flight at once. If the local read
   * lands after the merge, it overwrites the merged chronicle with its own half
   * and the account's creatures vanish for that session.
   */
  it('waits for a load already in flight instead of racing it', async () => {
    const stored = emptyChronicle()
    stored.species['on-the-device'] = {
      blueprint: bp('on-the-device', true),
      firstSeen: 1,
      lastSeen: 2,
      longestLife: 0,
    }

    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    setBackend({
      async load() {
        await gate
        return stored
      },
      async save() {},
    })

    const accountData = emptyChronicle()
    accountData.species['in-the-account'] = {
      blueprint: bp('in-the-account', true),
      firstSeen: 1,
      lastSeen: 2,
      longestLife: 0,
    }

    const init = initChronicle()
    const adopt = adoptAccount(memoryBackend(accountData).backend, 'uid-1')
    release()
    await Promise.all([init, adopt])

    const ids = new Set(archivedSpecies().map(s => s.blueprint.id))
    expect(ids.has('on-the-device')).toBe(true)
    expect(ids.has('in-the-account')).toBe(true)
  })
})

describe('forgetting a species', () => {
  it('removes it from the archive and hands back the record for undo', () => {
    rememberSpecies(bp('wyrm', true), 1000)
    noteSpeciesLife('wyrm', 42)

    const record = forgetSpecies('wyrm')
    expect(record?.blueprint.id).toBe('wyrm')
    expect(archivedSpecies()).toHaveLength(0)

    // The history is the part a blueprint alone cannot rebuild.
    expect(record?.firstSeen).toBe(1000)
    expect(record?.longestLife).toBe(42)
  })

  it('returns null for a species it never knew, so undo has nothing to offer', () => {
    expect(forgetSpecies('never-existed')).toBeNull()
  })

  it('restores the record exactly, not a creature discovered just now', () => {
    rememberSpecies(bp('wyrm', true), 1000)
    noteSpeciesLife('wyrm', 42)
    const record = forgetSpecies('wyrm')

    restoreSpeciesRecord(record as NonNullable<typeof record>)
    const back = archivedSpecies()[0]
    expect(back.firstSeen).toBe(1000)
    expect(back.longestLife).toBe(42)
  })

  it('writes the deletion through, so it does not come back on reload', async () => {
    const mem = await loadWith(null)
    rememberSpecies(bp('wyrm', true), 1000)
    await flushChronicle()
    expect(Object.keys(mem.state.saved?.species ?? {})).toContain('wyrm')

    forgetSpecies('wyrm')
    await flushChronicle()
    expect(Object.keys(mem.state.saved?.species ?? {})).not.toContain('wyrm')
  })
})

describe('summon id reservation', () => {
  /**
   * The bug: summoned ids carry a counter that resets with the page, so after a
   * reload restored a creature as `summon:wyrm:1`, the next creature summoned
   * was handed the same id and silently replaced it in the roster.
   */
  it('never reissues an id a restored creature is already using', () => {
    const restored = sanitizeBlueprint({ name: 'Wyrm' }, { summoned: true })
    reserveSummonIds([restored.id])
    const fresh = sanitizeBlueprint({ name: 'Wyrm' }, { summoned: true })
    expect(fresh.id).not.toBe(restored.id)
  })

  it('clears the whole archive, not just the highest-numbered name', () => {
    const ids = ['summon:a:41', 'summon:b:7', 'summon:c:12']
    reserveSummonIds(ids)
    const fresh = sanitizeBlueprint({ name: 'D' }, { summoned: true })
    expect(ids).not.toContain(fresh.id)
    expect(Number(fresh.id.slice(fresh.id.lastIndexOf(':') + 1))).toBeGreaterThan(41)
  })

  it('ignores ids with no trailing counter instead of resetting', () => {
    reserveSummonIds(['builtin-hopper', 'summon:x:nonsense'])
    const before = sanitizeBlueprint({ name: 'E' }, { summoned: true })
    const after = sanitizeBlueprint({ name: 'E' }, { summoned: true })
    expect(after.id).not.toBe(before.id)
  })
})

describe('mergeChronicles', () => {
  it('keeps the longer life, whichever side it came from', () => {
    const a = emptyChronicle()
    a.lands.tidepool = {
      ...emptyLandRecord(),
      elder: {
        seconds: 100,
        blueprintId: 'crab',
        speciesName: 'Crab',
        name: null,
        at: 1,
      },
    }
    const b = emptyChronicle()
    b.lands.tidepool = {
      ...emptyLandRecord(),
      elder: {
        seconds: 300,
        blueprintId: 'crab',
        speciesName: 'Crab',
        name: 'Steve',
        at: 2,
      },
    }
    expect(mergeChronicles(a, b).lands.tidepool.elder?.name).toBe('Steve')
    // Order must not matter — sign-in can merge either direction.
    expect(mergeChronicles(b, a).lands.tidepool.elder?.name).toBe('Steve')
  })

  it('takes the high-water mark of each record independently', () => {
    const a = emptyChronicle()
    a.lands.tidepool = {
      ...emptyLandRecord(),
      steadySeconds: 900,
      generations: 3,
      generationsBlueprintId: 'crab',
      generationsSpeciesName: 'Crab',
    }
    const b = emptyChronicle()
    b.lands.tidepool = {
      ...emptyLandRecord(),
      steadySeconds: 120,
      generations: 11,
      generationsBlueprintId: 'kelp',
      generationsSpeciesName: 'Kelp',
    }

    const merged = mergeChronicles(a, b).lands.tidepool
    expect(merged.steadySeconds).toBe(900)
    expect(merged.generations).toBe(11)
    // The species has to travel with the number it belongs to.
    expect(merged.generationsSpeciesName).toBe('Kelp')
  })

  it('unions the archive and keeps the earliest milestone', () => {
    const a = emptyChronicle()
    a.species.crab = {
      blueprint: bp('crab'),
      firstSeen: 50,
      lastSeen: 60,
      longestLife: 10,
    }
    a.milestones['first-elder'] = 900

    const b = emptyChronicle()
    b.species.kelp = {
      blueprint: bp('kelp'),
      firstSeen: 10,
      lastSeen: 20,
      longestLife: 5,
    }
    b.species.crab = {
      blueprint: bp('crab'),
      firstSeen: 5,
      lastSeen: 400,
      longestLife: 7,
    }
    b.milestones['first-elder'] = 100

    const merged = mergeChronicles(a, b)
    expect(Object.keys(merged.species).sort()).toEqual(['crab', 'kelp'])
    expect(merged.species.crab.firstSeen).toBe(5)
    expect(merged.species.crab.lastSeen).toBe(400)
    expect(merged.species.crab.longestLife).toBe(10)
    // A first is a first — the earlier timestamp wins.
    expect(merged.milestones['first-elder']).toBe(100)
  })

  it('carries over a land only one side has ever visited', () => {
    const a = emptyChronicle()
    a.lands.tidepool = { ...emptyLandRecord(), steadySeconds: 30 }
    const b = emptyChronicle()
    b.lands.volcanic = { ...emptyLandRecord(), steadySeconds: 70 }

    const merged = mergeChronicles(a, b)
    expect(merged.lands.tidepool.steadySeconds).toBe(30)
    expect(merged.lands.volcanic.steadySeconds).toBe(70)
  })

  it('merges each column on its own, so both devices keep what they held', () => {
    // The phone watched a hopper line get deep; the laptop grew old kelp.
    // Neither record should knock the other out on the way in.
    const a = emptyChronicle()
    a.lands.tidepool = {
      ...emptyLandRecord(),
      byKind: { plant: kelp(400, 9), animal: hopper(0, 0) },
    }
    const b = emptyChronicle()
    b.lands.tidepool = {
      ...emptyLandRecord(),
      byKind: { plant: kelp(20, 2), animal: hopper(90, 6) },
    }

    const merged = mergeChronicles(a, b).lands.tidepool
    expect(merged.byKind.plant.elder?.seconds).toBe(400)
    expect(merged.byKind.plant.generations).toBe(9)
    expect(merged.byKind.animal.elder?.seconds).toBe(90)
    expect(merged.byKind.animal.generations).toBe(6)
  })

  it('survives a side whose land record predates the split', () => {
    // `mergeChronicles` is exported and is handed records that never went
    // through `migrate` — it must not read `byKind` off a record without one.
    const a = emptyChronicle()
    const old = { ...emptyLandRecord(), steadySeconds: 30 }
    delete (old as Partial<typeof old>).byKind
    a.lands.tidepool = old
    const b = emptyChronicle()
    b.lands.tidepool = {
      ...emptyLandRecord(),
      byKind: { plant: kelp(0, 0), animal: hopper(75, 4) },
    }

    const merged = mergeChronicles(a, b).lands.tidepool
    expect(merged.steadySeconds).toBe(30)
    expect(merged.byKind.animal.generations).toBe(4)
  })
})

/**
 * Blueprint stubs that can actually be classified.
 *
 * `bp()` above is deliberately hollow, which is the right stub for everything
 * that only reads a name — but `lifeKind` reaches into `move`, `diet` and
 * `tags`, so anything testing the plant/animal split needs those present. The
 * hollow one still earns its keep here: it stands in for a species the archive
 * can no longer identify.
 */
function plantBp(id: string): CreatureBlueprint {
  return {
    id,
    name: id,
    move: { kind: 'root' },
    diet: { eats: [] },
    tags: [],
  } as unknown as CreatureBlueprint
}

function animalBp(id: string): CreatureBlueprint {
  return {
    id,
    name: id,
    move: { kind: 'walk' },
    diet: { eats: ['plant'] },
    tags: ['meat'],
  } as unknown as CreatureBlueprint
}

function archived(blueprint: CreatureBlueprint): SpeciesRecord {
  return { blueprint, firstSeen: 1, lastSeen: 2, longestLife: 0 }
}

function kelp(seconds: number, generations: number) {
  return column('kelp', 'Kelp', seconds, generations)
}

function hopper(seconds: number, generations: number) {
  return column('hopper', 'Hopper', seconds, generations)
}

function column(id: string, name: string, seconds: number, generations: number) {
  return {
    elder: seconds > 0 ? { seconds, blueprintId: id, speciesName: name, name: null, at: 1 } : null,
    generations,
    generationsBlueprintId: generations > 0 ? id : null,
    generationsSpeciesName: generations > 0 ? name : null,
  }
}

/** A land record as it was written before `byKind` existed. */
function preSplitLand(elderId: string, seconds: number, lineId: string, generations: number) {
  const record = {
    ...emptyLandRecord(),
    elder: { seconds, blueprintId: elderId, speciesName: elderId, name: null, at: 1 },
    generations,
    generationsBlueprintId: lineId,
    generationsSpeciesName: lineId,
  }
  delete (record as Partial<typeof record>).byKind
  return record
}

describe('the plant/animal split', () => {
  it('files a pre-split record into the column its holder belongs to', async () => {
    // Both old records were set by kelp, which is where a returning player
    // should still find them — not wiped, and not sitting under Animals.
    const stored = emptyChronicle()
    stored.species.kelp = archived(plantBp('kelp'))
    stored.lands.tidepool = preSplitLand('kelp', 400, 'kelp', 9)
    await loadWith(stored)

    const record = landRecord('tidepool')
    expect(record.byKind.plant.elder?.seconds).toBe(400)
    expect(record.byKind.plant.generations).toBe(9)
    expect(record.byKind.animal.elder).toBeNull()
    expect(record.byKind.animal.generations).toBe(0)
  })

  it('splits a pre-split record whose two holders were different kinds', async () => {
    const stored = emptyChronicle()
    stored.species.kelp = archived(plantBp('kelp'))
    stored.species.hopper = archived(animalBp('hopper'))
    stored.lands.tidepool = preSplitLand('kelp', 400, 'hopper', 6)
    await loadWith(stored)

    const record = landRecord('tidepool')
    expect(record.byKind.plant.elder?.seconds).toBe(400)
    expect(record.byKind.plant.generations).toBe(0)
    expect(record.byKind.animal.elder).toBeNull()
    expect(record.byKind.animal.generations).toBe(6)
  })

  it('leaves both columns empty when the holder can no longer be identified', async () => {
    // Pruned out of the archive, or deleted by the player. Guessing a column
    // would park the record there forever, since records only move upward.
    const stored = emptyChronicle()
    stored.lands.tidepool = preSplitLand('ghost', 400, 'ghost', 9)
    await loadWith(stored)

    const record = landRecord('tidepool')
    expect(record.byKind.plant.elder).toBeNull()
    expect(record.byKind.animal.elder).toBeNull()
    // The land-wide record it was filed from is untouched.
    expect(record.elder?.seconds).toBe(400)
    expect(record.generations).toBe(9)
  })

  it('does not classify off a half-written archive entry', async () => {
    // `bp()` has no `move` and no `diet`. Reaching into those out of `migrate`
    // would throw, and a chronicle that fails to parse must cost the player a
    // record rather than the game.
    const stored = emptyChronicle()
    stored.species.kelp = archived(bp('kelp'))
    stored.lands.tidepool = preSplitLand('kelp', 400, 'kelp', 9)
    await loadWith(stored)

    expect(landRecord('tidepool').byKind.plant.elder).toBeNull()
    expect(landRecord('tidepool').elder?.seconds).toBe(400)
  })

  it('leaves an already-split record alone', async () => {
    const stored = emptyChronicle()
    stored.species.hopper = archived(animalBp('hopper'))
    stored.lands.tidepool = {
      ...emptyLandRecord(),
      // The land-wide elder disagrees with both columns on purpose: a record
      // that already has columns is the truth, not something to re-derive.
      elder: { seconds: 400, blueprintId: 'kelp', speciesName: 'Kelp', name: null, at: 1 },
      byKind: { plant: kelp(0, 0), animal: hopper(90, 6) },
    }
    await loadWith(stored)

    const record = landRecord('tidepool')
    expect(record.byKind.plant.elder).toBeNull()
    expect(record.byKind.animal.elder?.seconds).toBe(90)
  })
})
