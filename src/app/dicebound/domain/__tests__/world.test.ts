import { describe, expect, it } from 'vitest'

import {
  type Entity,
  FUSE_WINDOWS,
  MAX_ENTITIES,
  MAX_FIRINGS,
  MAX_TURN_MINUTES,
  PLAYER_ID,
  type ThreadEntity,
  type World,
  advance,
  describeClock,
  emptyClock,
  emptyWorld,
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
