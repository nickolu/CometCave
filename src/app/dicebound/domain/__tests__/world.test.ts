import { describe, expect, it } from 'vitest'

import {
  type Entity,
  FUSE_WINDOWS,
  MAX_DISPOSITION,
  MAX_DISPOSITION_STEP,
  MAX_EDGES_PER_TURN,
  MAX_ENTITIES,
  MAX_FIRINGS,
  MAX_TOUCH_PER_TURN,
  MAX_TURN_MINUTES,
  PLAYER_ID,
  type ThreadEntity,
  type World,
  advance,
  applyWorldDelta,
  describeClock,
  emptyClock,
  emptyWorld,
  ensurePlayer,
  fireThreads,
  openThreads,
  pruneWorld,
  timeOfDay,
  validateEdge,
  validateEntity,
  validateWorld,
} from '@/app/dicebound/domain/world'

function thread(overrides: Partial<ThreadEntity> = {}): ThreadEntity {
  return {
    kind: 'thread',
    id: 'harbour-debt',
    name: 'The harbour debt',
    note: 'You owe Bosun Kell for the boat.',
    state: '',
    status: 'active',
    firstSeen: 0,
    lastSeen: 0,
    threadKind: 'debt',
    resolution: 'open',
    due: 600,
    pressure: 'patient',
    firings: 0,
    ...overrides,
  }
}

function world(entities: Entity[] = [], overrides: Partial<World> = {}): World {
  return {
    clock: emptyClock(9),
    entities: Object.fromEntries(entities.map(e => [e.id, e])),
    edges: [],
    ...overrides,
  }
}

describe('the clock', () => {
  it('reads as a phrase, never as a wall-clock time', () => {
    expect(describeClock({ elapsed: 0, startHour: 9 })).toBe('Day 1, morning')
    expect(describeClock({ elapsed: 6 * 60, startHour: 9 })).toBe('Day 1, afternoon')
    // Past midnight is the next day, and the day count is 1-based.
    expect(describeClock({ elapsed: 20 * 60, startHour: 9 })).toBe('Day 2, dawn')
  })

  it('bands the whole day without a gap', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(timeOfDay({ elapsed: hour * 60, startHour: 0 })).toBeTruthy()
    }
  })
})

describe('advance', () => {
  it('moves the clock forward by the minutes given', () => {
    const { clock, fired, interrupted } = advance(emptyClock(), 90, emptyWorld())
    expect(clock.elapsed).toBe(90)
    expect(fired).toEqual([])
    expect(interrupted).toBe(false)
  })

  it('refuses to skip a year, however the DM phrased it', () => {
    const { clock } = advance(emptyClock(), 500_000, emptyWorld())
    expect(clock.elapsed).toBe(MAX_TURN_MINUTES)
  })

  it('treats nonsense as no time passing rather than as NaN', () => {
    expect(advance(emptyClock(), 'a while', emptyWorld()).clock.elapsed).toBe(0)
    expect(advance(emptyClock(), -50, emptyWorld()).clock.elapsed).toBe(0)
  })

  it('stops at a fuse rather than stepping over it', () => {
    // "We travel for a week" — and four hours in, the debt catches up.
    const subject = world([thread({ due: 240 })])
    const { clock, fired, interrupted } = advance(subject.clock, 7 * 24 * 60, subject)

    expect(clock.elapsed).toBe(240)
    expect(fired).toEqual(['harbour-debt'])
    expect(interrupted).toBe(true)
  })

  it('stops at the earliest fuse and fires only that one', () => {
    const subject = world([thread({ id: 'later', due: 500 }), thread({ id: 'sooner', due: 120 })])
    const { clock, fired } = advance(subject.clock, 600, subject)

    expect(clock.elapsed).toBe(120)
    expect(fired).toEqual(['sooner'])
  })

  it('fires everything due on the same minute', () => {
    const subject = world([thread({ id: 'a', due: 300 }), thread({ id: 'b', due: 300 })])
    const { fired } = advance(subject.clock, 600, subject)
    expect(fired.sort()).toEqual(['a', 'b'])
  })

  it('ignores threads that are settled, cold, or have no fuse', () => {
    const subject = world([
      thread({ id: 'kept', resolution: 'kept', due: 10 }),
      thread({ id: 'cold', resolution: 'cold', due: 10 }),
      thread({ id: 'unfused', due: null }),
    ])
    const { clock, fired } = advance(subject.clock, 600, subject)

    expect(clock.elapsed).toBe(600)
    expect(fired).toEqual([])
  })

  it('does not fire the same fuse twice on the same minute', () => {
    const subject = world([thread({ due: 240 })])
    const stopped = { ...subject, clock: { ...subject.clock, elapsed: 240 } }
    expect(advance(stopped.clock, 60, stopped).fired).toEqual([])
  })
})

describe('fireThreads', () => {
  it('escalates pressure and re-arms rather than failing the thread', () => {
    const subject = world([thread({ pressure: 'patient', due: 240 })])
    const after = fireThreads({ ...subject, clock: { elapsed: 240, startHour: 9 } }, [
      'harbour-debt',
    ])
    const updated = after.entities['harbour-debt'] as ThreadEntity

    expect(updated.resolution).toBe('open')
    expect(updated.pressure).toBe('pressing')
    expect(updated.due).toBe(240 + FUSE_WINDOWS.pressing)
    expect(updated.firings).toBe(1)
  })

  it('goes cold after enough unengaged firings, and stops nagging', () => {
    let subject = world([thread({ pressure: 'patient' })])
    for (let i = 0; i < MAX_FIRINGS; i++) {
      subject = fireThreads(subject, ['harbour-debt'])
    }
    const updated = subject.entities['harbour-debt'] as ThreadEntity

    expect(updated.resolution).toBe('cold')
    expect(updated.due).toBeNull()
    expect(updated.status).toBe('dormant')
    // And a cold thread never interrupts a turn again.
    expect(advance(subject.clock, MAX_TURN_MINUTES, subject).fired).toEqual([])
  })

  it('does not mutate the world it was given', () => {
    const subject = world([thread()])
    fireThreads(subject, ['harbour-debt'])
    expect((subject.entities['harbour-debt'] as ThreadEntity).firings).toBe(0)
  })
})

describe('openThreads', () => {
  it('puts the most pressing business first', () => {
    const subject = world([
      thread({ id: 'patient-one', pressure: 'patient' }),
      thread({ id: 'urgent-one', pressure: 'urgent' }),
      thread({ id: 'settled', resolution: 'kept', pressure: 'urgent' }),
    ])
    expect(openThreads(subject).map(t => t.id)).toEqual(['urgent-one', 'patient-one'])
  })
})

describe('pruneWorld', () => {
  it('keeps the player and open threads over merely recent things', () => {
    const crowd: Entity[] = Array.from({ length: MAX_ENTITIES + 20 }, (_, i) => ({
      kind: 'thing',
      id: `thing-${i}`,
      name: `Thing ${i}`,
      note: '',
      state: '',
      status: 'active',
      firstSeen: 0,
      lastSeen: 10_000 + i,
      portable: true,
    }))
    const subject = world([
      ...crowd,
      { ...thread({ id: 'old-promise', lastSeen: 0 }) },
      {
        kind: 'actor',
        id: PLAYER_ID,
        name: 'You',
        note: '',
        state: '',
        status: 'active',
        firstSeen: 0,
        lastSeen: 0,
        disposition: 0,
        scale: 'person',
      },
    ])

    const pruned = pruneWorld(subject)
    expect(Object.keys(pruned.entities).length).toBeLessThanOrEqual(MAX_ENTITIES + 1)
    expect(pruned.entities[PLAYER_ID]).toBeDefined()
    expect(pruned.entities['old-promise']).toBeDefined()
  })

  it('drops edges whose endpoints did not survive', () => {
    const subject = world([thread({ id: 'a' })], {
      edges: [{ from: 'a', to: 'ghost', kind: 'involves', note: '', since: 0 }],
    })
    expect(pruneWorld(subject).edges).toEqual([])
  })
})

describe('validateEntity', () => {
  it('drops an entity with nothing to refer to it by', () => {
    expect(validateEntity({ name: 'Nameless', kind: 'actor' })).toBeNull()
    expect(validateEntity({ id: 'x', kind: 'actor' })).toBeNull()
  })

  it('clamps disposition into range', () => {
    const entity = validateEntity({ id: 'kell', name: 'Kell', kind: 'actor', disposition: 99 })
    expect(entity).toMatchObject({ kind: 'actor', disposition: 3 })
  })

  it('normalises an id written by a model', () => {
    expect(validateEntity({ id: 'Bosun  Kell!', name: 'Kell', kind: 'actor' })?.id).toBe(
      'bosun-kell'
    )
  })

  it('falls back to a known kind rather than refusing', () => {
    expect(validateEntity({ id: 'x', name: 'X', kind: 'wormhole' })?.kind).toBe('thing')
  })
})

describe('validateEdge', () => {
  it('drops a self-edge — it never means anything on the die card', () => {
    expect(validateEdge({ from: 'kell', to: 'kell', kind: 'knows' })).toBeNull()
  })

  it('falls back to a known kind', () => {
    expect(validateEdge({ from: 'a', to: 'b', kind: 'haunts' })?.kind).toBe('knows')
  })
})

describe('validateWorld', () => {
  it('never refuses — an unreadable world is an empty one', () => {
    expect(validateWorld(null)).toEqual(emptyWorld())
    expect(validateWorld('a graph')).toEqual(emptyWorld())
    expect(validateWorld({ entities: 'lots', edges: 7 })).toEqual(emptyWorld())
  })

  it('keeps what parses and drops what does not', () => {
    const parsed = validateWorld({
      clock: { elapsed: 300, startHour: 9 },
      entities: {
        kell: { id: 'kell', name: 'Bosun Kell', kind: 'actor' },
        broken: { name: 'no id' },
      },
      edges: [
        { from: 'kell', to: 'you', kind: 'owes' },
        { from: 'kell', to: 'nobody', kind: 'owes' },
      ],
    })

    expect(Object.keys(parsed.entities)).toEqual(['kell'])
    // The second edge points at an entity that never validated, so it goes too.
    expect(parsed.edges).toEqual([])
    expect(parsed.clock.elapsed).toBe(300)
  })
})

describe('applyWorldDelta', () => {
  function worldWith(...entities: Entity[]): World {
    return {
      ...emptyWorld(),
      entities: Object.fromEntries(entities.map(e => [e.id, e])),
    }
  }

  const innkeeper: Entity = {
    id: 'innkeeper',
    name: 'Bel',
    kind: 'actor',
    disposition: 0,
    scale: 'person',
    note: '',
    state: '',
    status: 'active',
    firstSeen: 0,
    lastSeen: 0,
  }

  it('survives a turn where the model returned nothing but text', () => {
    // The commonest delta in practice. Nothing said is nothing changed, not an
    // emptied world.
    const before = worldWith(innkeeper)
    const { world, fired, interrupted } = applyWorldDelta(before, {})

    expect(world.entities.innkeeper).toEqual(innkeeper)
    expect(fired).toEqual([])
    expect(interrupted).toBe(false)
  })

  it('does not skip a year when the model asks for one', () => {
    const { world } = applyWorldDelta(emptyWorld(), { elapsed: 525_600 })
    expect(world.clock.elapsed).toBe(MAX_TURN_MINUTES)
  })

  it('stops the clock at a fuse and names the thread that caught up', () => {
    const before: World = {
      ...emptyWorld(),
      entities: {
        debt: thread({ id: 'debt', due: 240, pressure: 'pressing', resolution: 'open' }),
      },
    }
    // "We travel for a week" — four hours in, the thing being ignored arrives.
    const { world, fired, interrupted } = applyWorldDelta(before, { elapsed: MAX_TURN_MINUTES })

    expect(world.clock.elapsed).toBe(240)
    expect(fired).toEqual(['debt'])
    expect(interrupted).toBe(true)
  })

  it('stamps Edge.since from the clock, never from the model', () => {
    // The rule this protects: an edge must predate a turn to grant a bonus.
    // Reading `since` from the model would let the DM invent a debt and cash it
    // in the same breath.
    const before = worldWith(innkeeper, { ...innkeeper, id: 'you', name: 'You' })
    const { world } = applyWorldDelta(before, {
      elapsed: 60,
      edges: [{ from: 'innkeeper', to: 'you', kind: 'owes', note: 'for the boat', since: 0 }],
    })

    expect(world.edges).toHaveLength(1)
    expect(world.edges[0].since).toBe(60)
  })

  it('keeps the original since when an edge is mentioned again', () => {
    // Restamping would silently withdraw a bonus the player had already earned
    // just because the DM brought the relationship up a second time.
    const before = worldWith(innkeeper, { ...innkeeper, id: 'you', name: 'You' })
    const first = applyWorldDelta(before, {
      elapsed: 60,
      edges: [{ from: 'innkeeper', to: 'you', kind: 'owes', note: 'for the boat' }],
    })
    const second = applyWorldDelta(first.world, {
      elapsed: 600,
      edges: [{ from: 'innkeeper', to: 'you', kind: 'owes', note: 'for the boat, still' }],
    })

    expect(second.world.edges).toHaveLength(1)
    expect(second.world.edges[0].since).toBe(60)
  })

  it('drops an edge pointing at an entity that does not exist', () => {
    // Worse than no edge: it renders as a relationship with a hole in it.
    const { world } = applyWorldDelta(worldWith(innkeeper), {
      edges: [{ from: 'innkeeper', to: 'nobody', kind: 'knows' }],
    })
    expect(world.edges).toEqual([])
  })

  it('moves disposition one step at a time, however far the model reached', () => {
    // The model proposes a nudge; code applies it. A stranger does not become a
    // sworn ally in one sentence, and the DM cannot hand itself a relationship
    // bonus to spend on the next roll.
    let world = worldWith(innkeeper)
    world = applyWorldDelta(world, { touch: [{ id: 'innkeeper', disposition: 3 }] }).world

    const after = world.entities.innkeeper
    expect(after.kind === 'actor' && after.disposition).toBe(MAX_DISPOSITION_STEP)
  })

  it('takes several turns of warming to reach the ceiling, and stops there', () => {
    let world = worldWith(innkeeper)
    for (let i = 0; i < 10; i++) {
      world = applyWorldDelta(world, { touch: [{ id: 'innkeeper', disposition: 3 }] }).world
    }
    const after = world.entities.innkeeper
    expect(after.kind === 'actor' && after.disposition).toBe(MAX_DISPOSITION)
  })

  it('caps how much of the world one turn may touch', () => {
    const touch = Array.from({ length: 20 }, (_, i) => ({
      id: `place-${i}`,
      name: `Place ${i}`,
      kind: 'place',
    }))
    const { world } = applyWorldDelta(emptyWorld(), { touch })
    expect(Object.keys(world.entities)).toHaveLength(MAX_TOUCH_PER_TURN)
  })

  it('caps how many edges one turn may draw', () => {
    const touch = Array.from({ length: MAX_TOUCH_PER_TURN }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      kind: 'place',
    }))
    const edges = Array.from({ length: 20 }, (_, i) => ({
      from: 'p0',
      to: `p${(i % (MAX_TOUCH_PER_TURN - 1)) + 1}`,
      kind: 'leads-to',
    }))
    const { world } = applyWorldDelta(emptyWorld(), { touch, edges })
    expect(world.edges.length).toBeLessThanOrEqual(MAX_EDGES_PER_TURN)
  })

  it('drops an entity whose id normalises to nothing rather than inventing one', () => {
    // An entity nobody can name is an entity no edge can point at, and a
    // generated id would be a different name every turn.
    const { world } = applyWorldDelta(emptyWorld(), {
      touch: [{ id: '!!!', name: 'The Nameless', kind: 'place' }],
    })
    expect(Object.keys(world.entities)).toEqual([])
  })

  it('keeps the name an entity already had when a touch only updates its state', () => {
    const { world } = applyWorldDelta(worldWith(innkeeper), {
      touch: [{ id: 'innkeeper', state: 'behind the bar, wary' }],
    })
    expect(world.entities.innkeeper.name).toBe('Bel')
    expect(world.entities.innkeeper.state).toBe('behind the bar, wary')
  })

  it('takes the fuse off a thread the story has finished with', () => {
    // A kept promise that keeps its due time is how a resolved story goes on
    // interrupting the one being told now.
    const before: World = {
      ...emptyWorld(),
      entities: { debt: thread({ id: 'debt', due: 500, resolution: 'open' }) },
    }
    const { world } = applyWorldDelta(before, { threads: [{ id: 'debt', resolution: 'kept' }] })

    const after = world.entities.debt as ThreadEntity
    expect(after.resolution).toBe('kept')
    expect(after.due).toBeNull()
  })

  it('re-arms the fuse when a thread is made more pressing', () => {
    const before: World = {
      ...emptyWorld(),
      entities: {
        debt: thread({ id: 'debt', due: 5000, pressure: 'patient', resolution: 'open' }),
      },
    }
    const { world } = applyWorldDelta(before, {
      elapsed: 30,
      threads: [{ id: 'debt', pressure: 'urgent' }],
    })

    const after = world.entities.debt as ThreadEntity
    expect(after.pressure).toBe('urgent')
    expect(after.due).toBe(30 + FUSE_WINDOWS.urgent)
  })

  it('ignores a thread update naming something that is not a thread', () => {
    const { world } = applyWorldDelta(worldWith(innkeeper), {
      threads: [{ id: 'innkeeper', resolution: 'kept' }],
    })
    expect(world.entities.innkeeper).toEqual(innkeeper)
  })
})

describe('ensurePlayer', () => {
  it('puts the player in the world so edges have somewhere to land', () => {
    // Without this every owes/fears/wants edge aimed at the player is dropped
    // for a missing endpoint, and the graph fills with NPCs connected to
    // nobody.
    const world = ensurePlayer(emptyWorld(), 'Sir Pellam Crumb')
    expect(world.entities[PLAYER_ID]?.name).toBe('Sir Pellam Crumb')
  })

  it('does not overwrite the player once they exist', () => {
    const first = ensurePlayer(emptyWorld(), 'Bel')
    const withState = {
      ...first,
      entities: {
        ...first.entities,
        [PLAYER_ID]: { ...first.entities[PLAYER_ID], state: 'bleeding' },
      },
    }
    expect(ensurePlayer(withState, 'Bel').entities[PLAYER_ID].state).toBe('bleeding')
  })

  it('falls back to a name rather than an entity nobody can address', () => {
    expect(ensurePlayer(emptyWorld(), '   ').entities[PLAYER_ID]?.name).toBe('You')
  })
})
