import { beforeEach, describe, expect, it } from 'vitest'

import type { ChronicleBackend } from '@/app/micro-land/chronicle/backend'
import {
  archivedSpecies,
  claimMilestone,
  flushChronicle,
  initChronicle,
  landId,
  landRecord,
  mergeChronicles,
  noteSpeciesLife,
  readChronicle,
  rememberSpecies,
  setBackend,
  updateChronicle,
} from '@/app/micro-land/chronicle/chronicle'
import {
  CHRONICLE_VERSION,
  emptyChronicle,
  emptyLandRecord,
} from '@/app/micro-land/chronicle/types'
import type { ChronicleData } from '@/app/micro-land/chronicle/types'
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
    expect(landId('summoned', 'The Drowned Cathedral')).toBe(
      'summoned:the-drowned-cathedral'
    )
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

    const ids = new Set(archivedSpecies().map((s) => s.blueprint.id))
    expect(ids.has('builtin-hopper')).toBe(true)
    expect(ids.has('summoned-0')).toBe(false)
    expect(ids.has('summoned-80')).toBe(true)
    expect(archivedSpecies().filter((s) => s.blueprint.summoned)).toHaveLength(80)
  })
})

describe('milestones', () => {
  it('fires once and never again', () => {
    expect(claimMilestone('first-elder', 5000)).toBe(true)
    expect(claimMilestone('first-elder', 9000)).toBe(false)
    expect(readChronicle().milestones['first-elder']).toBe(5000)
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
