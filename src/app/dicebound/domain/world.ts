/**
 * The world: who is in it, how they are connected, and what time it is.
 *
 * Phase 1 said the story *was* the state — no map, no world model, the dungeon
 * master reconstructing the situation each turn by reading the transcript. That
 * held exactly as long as the only mechanical fact was a d20. It stops holding
 * the moment the DM says "you drop the lantern" and something other than prose
 * has to know.
 *
 * What replaces it is narrower than it sounds: **this graph is an index of the
 * transcript, not a replacement for it.** The fiction stays authoritative. The
 * graph holds only the facts that have to be checkable — who is owed what, where
 * the fire is, how long you have before the tide — and everything else stays
 * prose. The DM does not maintain a simulation; it touches the two or three
 * things that mattered this turn, and `condense` repairs the rest.
 *
 * Relationships are a flat edge list rather than fields on entities, because the
 * connections are many-to-many, they change constantly, and the fiction will
 * keep inventing kinds of connection that a field-per-relationship schema cannot
 * absorb without a migration every time.
 */
import { boundedInt, int, isPlainObject, oneOf, slug, str } from './validate'

export type EntityId = string

export type EntityKind = 'place' | 'actor' | 'thing' | 'thread'
export const ENTITY_KINDS: readonly EntityKind[] = ['place', 'actor', 'thing', 'thread']

/**
 * `dormant` is not `gone`. A dormant entity has left the relevance window and
 * is no longer sent to the DM, but it is still there to be pulled back — which
 * is how "wait, that's the man from the harbour" works twelve chapters later.
 */
export type EntityStatus = 'active' | 'dormant' | 'gone'
export const ENTITY_STATUSES: readonly EntityStatus[] = ['active', 'dormant', 'gone']

export type ThreadKind = 'promise' | 'debt' | 'threat' | 'mystery' | 'goal'
export const THREAD_KINDS: readonly ThreadKind[] = ['promise', 'debt', 'threat', 'mystery', 'goal']

/** `cold` is a thread that fired too often without being engaged — see `fireThreads`. */
export type Resolution = 'open' | 'kept' | 'broken' | 'cold'
export const RESOLUTIONS: readonly Resolution[] = ['open', 'kept', 'broken', 'cold']

export type Pressure = 'patient' | 'pressing' | 'urgent'
export const PRESSURES: readonly Pressure[] = ['patient', 'pressing', 'urgent']

/** The player, as an entity. Edges point at this like they point at anyone. */
export const PLAYER_ID: EntityId = 'you'

export const MIN_DISPOSITION = -3
export const MAX_DISPOSITION = 3

interface EntityBase {
  id: EntityId
  name: string
  /** One line of prose, the DM's. */
  note: string
  /** Short and mutable: "the bridge is burned", "hiding in the cellar". */
  state: string
  status: EntityStatus
  /** Clock minutes, not turn indices — the clock is what everything sorts by. */
  firstSeen: number
  lastSeen: number
}

export type PlaceEntity = EntityBase & { kind: 'place'; region: string }

export type ActorEntity = EntityBase & {
  kind: 'actor'
  /**
   * −3..+3, clamped here and never rendered as a number. A visible +2 turns a
   * person into a stat to farm, and a player optimising an NPC rather than
   * talking to one has lost the thing the game is for.
   */
  disposition: number
  /** A group is an actor so that "the Harbour Guard hates you" costs one entity, not forty. */
  scale: 'person' | 'group'
}

export type ThingEntity = EntityBase & { kind: 'thing'; portable: boolean }

export type ThreadEntity = EntityBase & {
  kind: 'thread'
  threadKind: ThreadKind
  resolution: Resolution
  /** Absolute clock minute at which this presses. Null for a thread with no fuse. */
  due: number | null
  pressure: Pressure
  /** How many times this has fired without the story engaging it. */
  firings: number
}

export type Entity = PlaceEntity | ActorEntity | ThingEntity | ThreadEntity

export type EdgeKind =
  // physical
  | 'at'
  | 'holds'
  | 'guards'
  // social structure
  | 'knows'
  | 'kin'
  | 'part-of'
  // pressure
  | 'owes'
  | 'wants'
  | 'fears'
  // threads and geography
  | 'involves'
  | 'leads-to'

export const EDGE_KINDS: readonly EdgeKind[] = [
  'at',
  'holds',
  'guards',
  'knows',
  'kin',
  'part-of',
  'owes',
  'wants',
  'fears',
  'involves',
  'leads-to',
]

export interface Edge {
  from: EntityId
  to: EntityId
  kind: EdgeKind
  /** Why, in the player's words: "for the boat he lost". */
  note: string
  /**
   * Clock minute the edge formed.
   *
   * Load-bearing, not bookkeeping: an edge may only grant a bonus once it is
   * older than the current turn. Without that, the DM could invent
   * `owes(guard → you)` and cash it in the same breath, which is situational
   * modifiers with extra steps. A relationship bonus is earned in past play or
   * it is not earned.
   */
  since: number
}

export interface Clock {
  /** Minutes of fiction since the story began. */
  elapsed: number
  /** Where on the day-cycle the story opened, 0–23. */
  startHour: number
}

export interface World {
  clock: Clock
  entities: Record<EntityId, Entity>
  edges: Edge[]
}

/**
 * Caps.
 *
 * Not tidiness — these are the reason a campaign four hundred turns deep still
 * fits in a Firestore document and still writes. Pruning is by `lastSeen`, so
 * what falls off the end is what the story stopped caring about.
 */
export const MAX_ENTITIES = 200
export const MAX_EDGES = 400

export const MAX_NAME = 80
export const MAX_NOTE = 240
export const MAX_STATE = 120
export const MAX_EDGE_NOTE = 120

/** The most fiction one turn may consume. A DM that skips a year breaks every fuse. */
export const MAX_TURN_MINUTES = 7 * 24 * 60

export function emptyClock(startHour = 9): Clock {
  return { elapsed: 0, startHour: boundedInt(startHour, 0, 23, 9) }
}

export function emptyWorld(): World {
  return { clock: emptyClock(), entities: {}, edges: [] }
}

// ---------------------------------------------------------------- the clock

const MINUTES_PER_DAY = 24 * 60

/** Day 1 is the day the story opened. */
export function dayOf(clock: Clock): number {
  return Math.floor((clock.startHour * 60 + clock.elapsed) / MINUTES_PER_DAY) + 1
}

export function minuteOfDay(clock: Clock): number {
  return (clock.startHour * 60 + clock.elapsed) % MINUTES_PER_DAY
}

const BANDS: readonly { until: number; label: string }[] = [
  { until: 4, label: 'deep night' },
  { until: 6, label: 'dawn' },
  { until: 11, label: 'morning' },
  { until: 13, label: 'midday' },
  { until: 17, label: 'afternoon' },
  { until: 19, label: 'dusk' },
  { until: 22, label: 'evening' },
  { until: 24, label: 'night' },
]

/**
 * Time of day as a phrase, never as a wall-clock reading.
 *
 * A world with digital precision is the wrong world. The player sees "Day 6,
 * late afternoon"; code holds an integer.
 */
export function timeOfDay(clock: Clock): string {
  const hour = minuteOfDay(clock) / 60
  return BANDS.find(band => hour < band.until)?.label ?? 'night'
}

export function describeClock(clock: Clock): string {
  return `Day ${dayOf(clock)}, ${timeOfDay(clock)}`
}

/** How long a thread of each pressure waits before it presses again. */
export const FUSE_WINDOWS: Record<Pressure, number> = {
  patient: 3 * 24 * 60,
  pressing: 8 * 60,
  urgent: 60,
}

const NEXT_PRESSURE: Record<Pressure, Pressure> = {
  patient: 'pressing',
  pressing: 'urgent',
  urgent: 'urgent',
}

/** Firings without engagement before a thread goes cold and stops nagging. */
export const MAX_FIRINGS = 3

export interface Advance {
  clock: Clock
  /** Threads whose fuse the clock ran into. The DM is told to make a move. */
  fired: EntityId[]
  /** True when a fuse cut the turn short. */
  interrupted: boolean
}

/**
 * Move the clock forward, stopping at the first fuse it would cross.
 *
 * The stopping is the whole point, and it reads better as fiction than as an
 * algorithm: the player says "we travel for a week", and four hours in, the
 * thing they have been ignoring catches up with them, and the week does not
 * happen. Time cannot be used to outrun consequences, and "it comes to find
 * you" falls out of the model instead of having to be prompted for.
 *
 * Pure, and does not mutate the world — `fireThreads` applies the consequences.
 */
export function advance(clock: Clock, minutes: unknown, world: World): Advance {
  const requested = Math.max(0, Math.min(MAX_TURN_MINUTES, int(minutes, 0)))
  const target = clock.elapsed + requested

  let stop = target
  const fired: EntityId[] = []

  for (const entity of Object.values(world.entities)) {
    if (entity.kind !== 'thread') continue
    if (entity.resolution !== 'open') continue
    if (entity.due === null) continue
    // Strictly after now, so a fuse cannot fire twice on the same minute.
    if (entity.due <= clock.elapsed || entity.due > target) continue

    if (entity.due < stop) {
      stop = entity.due
      fired.length = 0
    }
    if (entity.due === stop) fired.push(entity.id)
  }

  return {
    clock: { ...clock, elapsed: stop },
    fired,
    interrupted: fired.length > 0 && stop < target,
  }
}

/**
 * Apply the consequence of a fuse going off.
 *
 * A fired thread does not fail. It escalates and re-arms, so the story keeps
 * being pressed by it. After `MAX_FIRINGS` unengaged firings it goes cold —
 * dormant, no more fuses, revivable later as a surprise. Without that, a
 * forgotten promise nags forever, which is the one failure mode that would make
 * this system feel like a chore.
 */
export function fireThreads(world: World, fired: readonly EntityId[]): World {
  if (fired.length === 0) return world

  const entities = { ...world.entities }
  for (const id of fired) {
    const thread = entities[id]
    if (!thread || thread.kind !== 'thread') continue

    const firings = thread.firings + 1
    const cold = firings >= MAX_FIRINGS
    const pressure = NEXT_PRESSURE[thread.pressure]

    entities[id] = {
      ...thread,
      firings,
      pressure,
      resolution: cold ? 'cold' : 'open',
      status: cold ? 'dormant' : 'active',
      due: cold ? null : world.clock.elapsed + FUSE_WINDOWS[pressure],
      lastSeen: world.clock.elapsed,
    }
  }

  return { ...world, entities }
}

// ------------------------------------------------------------ housekeeping

/** Open threads, most pressing first. This is the player's "loose ends". */
export function openThreads(world: World): ThreadEntity[] {
  const order: Record<Pressure, number> = { urgent: 0, pressing: 1, patient: 2 }
  return Object.values(world.entities)
    .filter((e): e is ThreadEntity => e.kind === 'thread' && e.resolution === 'open')
    .sort(
      (a, b) => order[a.pressure] - order[b.pressure] || (a.due ?? Infinity) - (b.due ?? Infinity)
    )
}

/** Every edge touching an entity, in either direction. */
export function edgesFor(world: World, id: EntityId): Edge[] {
  return world.edges.filter(edge => edge.from === id || edge.to === id)
}

/**
 * Drop entities and edges the story has stopped caring about.
 *
 * Order matters: entities are pruned by `lastSeen`, then edges are pruned by
 * whether both endpoints survived. An edge pointing at a deleted entity is worse
 * than no edge — it renders as a relationship with a hole in it.
 *
 * The player is never pruned, and neither is anything still open.
 */
export function pruneWorld(world: World): World {
  const all = Object.values(world.entities)

  let entities = world.entities
  if (all.length > MAX_ENTITIES) {
    const keep = new Set(
      all
        .slice()
        .sort((a, b) => score(b) - score(a) || b.lastSeen - a.lastSeen)
        .slice(0, MAX_ENTITIES)
        .map(entity => entity.id)
    )
    keep.add(PLAYER_ID)
    entities = Object.fromEntries(
      Object.entries(world.entities).filter(([id]) => keep.has(id))
    ) as Record<EntityId, Entity>
  }

  let edges = world.edges.filter(edge => entities[edge.from] && entities[edge.to])
  if (edges.length > MAX_EDGES) edges = edges.slice(-MAX_EDGES)

  return { ...world, entities, edges }
}

/** Pruning priority. Open business outranks recency; the player outranks everything. */
function score(entity: Entity): number {
  if (entity.id === PLAYER_ID) return 3
  if (entity.kind === 'thread' && entity.resolution === 'open') return 2
  if (entity.status === 'gone') return 0
  return 1
}

// -------------------------------------------------------------- validation

export function validateClock(value: unknown): Clock {
  if (!isPlainObject(value)) return emptyClock()
  return {
    elapsed: Math.max(0, int(value.elapsed)),
    startHour: boundedInt(value.startHour, 0, 23, 9),
  }
}

/**
 * Coerce one stored entity, or drop it.
 *
 * Dropped rather than repaired when the id or name is missing, because both are
 * how everything else refers to it. An entity with no id is unreachable by any
 * edge, and an entity with no name cannot be shown to the player or described to
 * the DM — there is nothing there to save.
 */
export function validateEntity(value: unknown): Entity | null {
  if (!isPlainObject(value)) return null

  const id = slug(value.id)
  const name = str(value.name, MAX_NAME).trim()
  if (!id || !name) return null

  const base = {
    id,
    name,
    note: str(value.note, MAX_NOTE),
    state: str(value.state, MAX_STATE),
    status: oneOf(value.status, ENTITY_STATUSES, 'active'),
    firstSeen: Math.max(0, int(value.firstSeen)),
    lastSeen: Math.max(0, int(value.lastSeen)),
  }

  switch (oneOf(value.kind, ENTITY_KINDS, 'thing')) {
    case 'place':
      return { ...base, kind: 'place', region: str(value.region, MAX_NAME) }
    case 'actor':
      return {
        ...base,
        kind: 'actor',
        disposition: boundedInt(value.disposition, MIN_DISPOSITION, MAX_DISPOSITION),
        scale: oneOf(value.scale, ['person', 'group'] as const, 'person'),
      }
    case 'thread': {
      const due =
        typeof value.due === 'number' && Number.isFinite(value.due) ? int(value.due) : null
      return {
        ...base,
        kind: 'thread',
        threadKind: oneOf(value.threadKind, THREAD_KINDS, 'goal'),
        resolution: oneOf(value.resolution, RESOLUTIONS, 'open'),
        due: due === null ? null : Math.max(0, due),
        pressure: oneOf(value.pressure, PRESSURES, 'patient'),
        firings: boundedInt(value.firings, 0, MAX_FIRINGS),
      }
    }
    default:
      return { ...base, kind: 'thing', portable: value.portable === true }
  }
}

export function validateEdge(value: unknown): Edge | null {
  if (!isPlainObject(value)) return null

  const from = slug(value.from)
  const to = slug(value.to)
  // Self-edges are always a model slip and never mean anything on the die card.
  if (!from || !to || from === to) return null

  return {
    from,
    to,
    kind: oneOf(value.kind, EDGE_KINDS, 'knows'),
    note: str(value.note, MAX_EDGE_NOTE),
    since: Math.max(0, int(value.since)),
  }
}

/**
 * Coerce a whole stored world.
 *
 * Never returns null: an unreadable world is an empty world, and an empty world
 * is a state the game already knows how to play from — the graph repopulates
 * itself from the transcript on the next reconciliation pass. Losing the index
 * must never cost the player the story.
 */
export function validateWorld(value: unknown): World {
  if (!isPlainObject(value)) return emptyWorld()

  const entities: Record<EntityId, Entity> = {}
  if (isPlainObject(value.entities)) {
    for (const raw of Object.values(value.entities)) {
      const entity = validateEntity(raw)
      if (entity) entities[entity.id] = entity
    }
  }

  const edges = Array.isArray(value.edges)
    ? (value.edges.map(validateEdge).filter(Boolean) as Edge[])
        // Dangling edges are dropped here as well as in `pruneWorld`, because a
        // save can arrive with an edge whose entity never validated.
        .filter(edge => entities[edge.from] && entities[edge.to])
    : []

  return pruneWorld({ clock: validateClock(value.clock), entities, edges })
}
