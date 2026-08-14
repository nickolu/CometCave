import { describe, expect, it } from 'vitest'

import {
  DORMANT_AFTER,
  type Edge,
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
  WINDOW_EDGES,
  WINDOW_ENTITIES,
  type World,
  advance,
  applyWorldDelta,
  currentPlace,
  describeClock,
  describeDisposition,
  emptyClock,
  emptyWorld,
  ensurePlayer,
  findEntities,
  fireThreads,
  openThreads,
  pruneWorld,
  reconcileWorld,
  relevanceWindow,
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

describe('reconcileWorld', () => {
  const actor = (id: string, lastSeen: number): Entity => ({
    id,
    kind: 'actor',
    name: id,
    note: '',
    state: '',
    status: 'active',
    disposition: 0,
    scale: 'person',
    firstSeen: 0,
    lastSeen,
  })

  function worldOf(now: number, ...entities: Entity[]): World {
    return {
      clock: { elapsed: now, startHour: 9 },
      entities: Object.fromEntries(entities.map(e => [e.id, e])),
      edges: [],
    }
  }

  it('lets someone who walked out of the story go dormant', () => {
    const now = DORMANT_AFTER * 2
    const world = reconcileWorld(worldOf(now, actor('ferryman', 0)), now)
    expect(world.entities.ferryman.status).toBe('dormant')
  })

  it('keeps someone who was just here active', () => {
    const now = DORMANT_AFTER * 2
    const world = reconcileWorld(worldOf(now, actor('bel', now - 10)), now)
    expect(world.entities.bel.status).toBe('active')
  })

  it('never lets the player go dormant in their own story', () => {
    const now = DORMANT_AFTER * 5
    const world = reconcileWorld(worldOf(now, actor(PLAYER_ID, 0)), now)
    expect(world.entities[PLAYER_ID].status).toBe('active')
  })

  it('keeps an unmentioned open thread in front of the DM', () => {
    // A debt nobody has spoken of for a week is exactly the thing that should
    // still be pressing. Going dormant would quietly forgive it.
    const now = DORMANT_AFTER * 3
    const world = reconcileWorld(
      worldOf(now, thread({ id: 'debt', resolution: 'open', lastSeen: 0 })),
      now
    )
    expect(world.entities.debt.status).toBe('active')
  })

  it('retires a thread that fired its allowance without ever being engaged', () => {
    const now = 100
    const world = reconcileWorld(
      worldOf(now, thread({ id: 'old-promise', resolution: 'cold', due: 500, lastSeen: now })),
      now
    )
    const after = world.entities['old-promise'] as ThreadEntity
    expect(after.status).toBe('dormant')
    expect(after.due).toBeNull()
  })

  it('drops an edge whose endpoint did not survive the pass', () => {
    const now = 0
    const base = worldOf(now, actor('bel', 0))
    const world = reconcileWorld(
      { ...base, edges: [{ from: 'bel', to: 'ghost', kind: 'knows', note: '', since: 0 }] },
      now
    )
    expect(world.edges).toEqual([])
  })

  it('does not mutate the world it was given', () => {
    const now = DORMANT_AFTER * 2
    const before = worldOf(now, actor('ferryman', 0))
    reconcileWorld(before, now)
    expect(before.entities.ferryman.status).toBe('active')
  })
})

describe('the relevance window', () => {
  function person(id: string, over: Partial<Entity> = {}): Entity {
    return {
      id,
      kind: 'actor',
      name: id,
      note: '',
      state: '',
      status: 'active',
      disposition: 0,
      scale: 'person',
      firstSeen: 0,
      lastSeen: 0,
      ...over,
    } as Entity
  }

  function place(id: string): Entity {
    return {
      id,
      kind: 'place',
      name: id,
      region: '',
      note: '',
      state: '',
      status: 'active',
      firstSeen: 0,
      lastSeen: 0,
    }
  }

  function build(entities: Entity[], edges: Edge[] = []): World {
    return {
      clock: { elapsed: 100, startHour: 9 },
      entities: Object.fromEntries(entities.map(e => [e.id, e])),
      edges,
    }
  }

  it('stays bounded no matter how large the graph gets', () => {
    // The whole reason this exists: a campaign four hundred turns deep must
    // send the same amount of world as one twenty turns deep.
    const crowd = Array.from({ length: 200 }, (_, i) => person(`p${i}`, { lastSeen: i }))
    const edges: Edge[] = crowd.slice(0, 150).map((p, i) => ({
      from: p.id,
      to: crowd[(i + 1) % 150].id,
      kind: 'knows',
      note: '',
      since: i,
    }))

    const window = relevanceWindow(build(crowd, edges))
    expect(window.entities.length).toBeLessThanOrEqual(WINDOW_ENTITIES)
    expect(window.edges.length).toBeLessThanOrEqual(WINDOW_EDGES)
  })

  it('always carries the player', () => {
    const crowd = Array.from({ length: 100 }, (_, i) => person(`p${i}`, { lastSeen: 999 }))
    const window = relevanceWindow(build([person(PLAYER_ID, { lastSeen: 0 }), ...crowd]))
    expect(window.entities.map(e => e.id)).toContain(PLAYER_ID)
  })

  it('carries something the player just named, however long ago it mattered', () => {
    const crowd = Array.from({ length: 100 }, (_, i) => person(`p${i}`, { lastSeen: 999 }))
    const old = person('the-ferryman', { lastSeen: 0, name: 'The Ferryman' })
    const window = relevanceWindow(build([old, ...crowd]), ['ferryman'])
    expect(window.entities.map(e => e.id)).toContain('the-ferryman')
  })

  it('keeps every open thread ahead of a bystander', () => {
    const crowd = Array.from({ length: 100 }, (_, i) => person(`p${i}`, { lastSeen: 999 }))
    const debt = thread({ id: 'debt', resolution: 'open', pressure: 'urgent', lastSeen: 0 })
    const window = relevanceWindow(build([debt, ...crowd]))
    expect(window.entities.map(e => e.id)).toContain('debt')
  })

  it('leaves dormant entities out unless they were named', () => {
    const asleep = person('the-ferryman', { status: 'dormant', name: 'The Ferryman' })
    expect(relevanceWindow(build([asleep])).entities).toEqual([])
    expect(relevanceWindow(build([asleep]), ['ferryman']).entities.map(e => e.id)).toEqual([
      'the-ferryman',
    ])
  })

  it('finds where the player is standing from the newest at-edge', () => {
    const world = build(
      [person(PLAYER_ID), place('quay'), place('tavern')],
      [
        { from: PLAYER_ID, to: 'quay', kind: 'at', note: '', since: 10 },
        { from: PLAYER_ID, to: 'tavern', kind: 'at', note: '', since: 90 },
      ]
    )
    // Walking somewhere new does not delete having been somewhere old, so the
    // most recent edge is the answer rather than the only one.
    expect(currentPlace(world)?.id).toBe('tavern')
  })

  it('drops an edge whose other end did not make the window', () => {
    const crowd = Array.from({ length: 100 }, (_, i) => person(`p${i}`, { lastSeen: 999 }))
    const asleep = person('asleep', { status: 'dormant' })
    const world = build(
      [person(PLAYER_ID), asleep, ...crowd],
      [{ from: PLAYER_ID, to: 'asleep', kind: 'knows', note: '', since: 1 }]
    )
    expect(relevanceWindow(world).edges).toEqual([])
  })
})

describe('findEntities', () => {
  const ferryman: Entity = {
    id: 'the-ferryman',
    kind: 'actor',
    name: 'Old Cassa',
    note: 'The man who works the harbour crossing.',
    state: '',
    status: 'dormant',
    disposition: 0,
    scale: 'person',
    firstSeen: 0,
    lastSeen: 5,
  }
  const world: World = {
    clock: { elapsed: 0, startHour: 9 },
    entities: { [ferryman.id]: ferryman },
    edges: [],
  }

  it('reaches things that have gone quiet — that is the whole point', () => {
    // "Wait, that's the man from the harbour", twelve chapters later. Searching
    // only active entities would return what the DM could already see.
    expect(findEntities(world, 'harbour').map(e => e.id)).toEqual(['the-ferryman'])
  })

  it('matches on the name as well as the note', () => {
    expect(findEntities(world, 'Cassa').map(e => e.id)).toEqual(['the-ferryman'])
  })

  it('returns nothing rather than inventing a near miss', () => {
    // A lookup that guesses is worse than one that admits it has none: the DM
    // narrates a stranger as an old friend and only the player notices.
    expect(findEntities(world, 'the queen of thieves')).toEqual([])
    expect(findEntities(world, '')).toEqual([])
    expect(findEntities(world, undefined)).toEqual([])
  })

  it('offers a candidate on one significant word rather than nothing', () => {
    // Deliberately loose. "The man from the harbour" has exactly one word worth
    // matching, and handing back nothing tells the DM to invent someone who
    // already exists. A candidate can be looked at and rejected; an empty
    // result has already made the decision.
    expect(findEntities(world, 'harbour').map(e => e.id)).toEqual(['the-ferryman'])
    expect(findEntities(world, 'the man from the harbour').map(e => e.id)).toEqual(['the-ferryman'])
  })

  it('ranks a name match above a description match', () => {
    const other: Entity = {
      ...ferryman,
      id: 'harbour-gate',
      name: 'Harbour Gate',
      kind: 'place',
      region: '',
      note: '',
    } as Entity
    const two: World = { ...world, entities: { [ferryman.id]: ferryman, [other.id]: other } }
    expect(findEntities(two, 'harbour').map(e => e.id)[0]).toBe('harbour-gate')
  })

  it('strips punctuation before searching', () => {
    // The first live run searched for `cassa,` with the comma still attached,
    // found nothing, and told the DM to invent someone who already existed.
    expect(findEntities(world, 'Old Cassa, the harbour crossing').map(e => e.id)).toEqual([
      'the-ferryman',
    ])
  })

  it('is not carried by common words alone', () => {
    expect(findEntities(world, 'the man from the place')).toEqual([])
  })
})

describe('describeDisposition', () => {
  it('says nothing at all about someone the story has no opinion of', () => {
    // Not "neutral" — a label saying there is nothing to say is still a label,
    // and it fills the sheet with rows that mean nothing.
    expect(describeDisposition(0)).toBeNull()
  })

  it('gives words rather than a number, in both directions', () => {
    // A visible +2 turns a person into a stat to farm: the player optimises the
    // NPC instead of talking to them.
    expect(describeDisposition(2)).toBe('on your side')
    expect(describeDisposition(-2)).toBe('wants nothing to do with you')
  })

  it('holds at the ends rather than falling through to nothing', () => {
    expect(describeDisposition(99)).toBe('would take a risk for you')
    expect(describeDisposition(-99)).toBe('would see you suffer')
  })
})
