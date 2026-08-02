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
import type { ChronicleData } from '@/app/micro-land/chronicle/types'
import { reserveSummonIds, sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

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

beforeEach(async () => {
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
    await adoptAccount(account.backend)

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
    await adoptAccount(account.backend)

    expect(Object.keys(account.state.saved?.species ?? {})).toContain('drawn-by-hand')
  })

  it('writes back even when the account has nothing stored yet', async () => {
    await loadWith(null)
    rememberSpecies(bp('first-ever', true), 10)

    const account = memoryBackend(null)
    await adoptAccount(account.backend)

    expect(account.state.saved).not.toBeNull()
    expect(Object.keys(account.state.saved?.species ?? {})).toContain('first-ever')
  })

  it('sends later records to the account rather than the device', async () => {
    const local = await loadWith(null)
    const account = memoryBackend(null)
    await adoptAccount(account.backend)

    rememberSpecies(bp('after-sign-in', true), 900)
    await flushChronicle()

    expect(Object.keys(account.state.saved?.species ?? {})).toContain('after-sign-in')
    // The local backend was only ever written by the pre-adoption flush.
    expect(Object.keys(local.state.saved?.species ?? {})).not.toContain('after-sign-in')
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

    await adoptAccount(memoryBackend(stored).backend)

    const ids = new Set(archivedSpecies().map(s => s.blueprint.id))
    expect(ids.has('garbage')).toBe(false)
    // The player's own session is not collateral damage.
    expect(ids.has('drawn-by-hand')).toBe(true)
  })

  it('does nothing when asked to adopt the backend already in use', async () => {
    const mem = memoryBackend(null)
    setBackend(mem.backend)
    await initChronicle()
    await adoptAccount(mem.backend)
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
    const adopt = adoptAccount(memoryBackend(accountData).backend)
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
})
