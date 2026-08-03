/**
 * A saved world on the wire.
 *
 * The same job `chronicle/wire.ts` does for records, and for the same reason:
 * the browser has to keep itself under the size the server will accept, the
 * server has to treat every byte as hostile, and neither end should own the
 * rules alone.
 *
 * This one validates harder than the chronicle's does, and the asymmetry is
 * deliberate. A chronicle is a bag of records that only its author ever reads
 * back, so its fields are checked for shape and trusted for content. A world
 * save is *fed to the simulation* — the tile runs drive an allocation loop, the
 * creature list is spliced straight into the tick, and every coordinate is
 * indexed into a grid. So the run lengths are checked to sum to exactly one
 * grid, and every creature is coerced field by field before it can exist.
 *
 * Nothing here reaches into Firestore, `fetch` or `localStorage`. It is pure so
 * it can be tested, which is where the interesting failures are.
 */
import { MATERIAL_IDS } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { sanitizeTerrain } from '@/app/micro-land/domain/terrain'
import { SHADE_MAX, SHADE_MIN, TRAIT_MAX, TRAIT_MIN } from '@/app/micro-land/domain/traits'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

import {
  type SavedCreature,
  WORLD_SAVE_VERSION,
  type WorldSave,
  type WorldSnapshot,
  type WorldSummary,
} from './types'

/**
 * The most one stored world is allowed to weigh, in bytes of JSON.
 *
 * A Firestore field value caps just under 1 MiB. Measured against a full world —
 * three screens of dense terrain, the population cap reached, a roster of
 * summoned species carrying their pixel art — a save lands around 250 KB, so
 * this is roughly three times the worst case seen and still clear of the ceiling.
 *
 * A save that will not fit is refused rather than trimmed. There is no honest
 * way to shrink a world: dropping creatures or flattening terrain hands the
 * player back something that is not the place they saved.
 */
export const MAX_WORLD_BYTES = 800_000

/**
 * How many worlds one player may shelve.
 *
 * Small on purpose. The shelf is meant to hold the handful of worlds someone
 * actually cares about — a place you go back to, not an archive — and a list
 * long enough to need scrolling and searching is a different, worse feature. It
 * is also what keeps the browser-local copy inside a `localStorage` quota.
 */
export const MAX_SAVED_WORLDS = 8

const encoder = new TextEncoder()

export function worldSaveBytes(save: WorldSave): number {
  return encoder.encode(JSON.stringify(save)).length
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: unknown, lo: number, hi: number, fallback: number): number {
  return Math.min(hi, Math.max(lo, num(value, fallback)))
}

function str(value: unknown, fallback: string, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback
}

/** Ids are ours, and they end up as Firestore document ids and storage keys. */
export function isSaveId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]{6,48}$/.test(value)
}

/**
 * A world's name, as the player typed it.
 *
 * Trimmed and capped, never rejected: this is a text box a child types into, and
 * "that is not a valid name" is not an answer a game should ever give. An empty
 * one falls back rather than blocking the save.
 */
export function cleanWorldName(value: unknown, fallback = 'A world'): string {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 40) : ''
  return name.length > 0 ? name : fallback
}

/**
 * Check the run-length encoded grid covers exactly one world, and nothing more.
 *
 * Every part of this matters. A run length of zero would loop forever in a naive
 * decoder; a negative or fractional one would corrupt the write cursor; a total
 * under the grid leaves the tail as whatever the array was initialised to; a
 * total over it writes past the end. And a material index the table doesn't have
 * would render as garbage rather than fail, which is the worst of the four
 * because nobody would notice.
 */
function validRuns(runs: unknown, tileCount: number): number[] | null {
  if (!Array.isArray(runs)) return null
  if (runs.length % 2 !== 0) return null
  // Two entries per run, and a run can't be shorter than one tile.
  if (runs.length > tileCount * 2) return null

  let total = 0
  for (let i = 0; i < runs.length; i += 2) {
    const material = runs[i]
    const length = runs[i + 1]
    if (!Number.isInteger(material) || material < 0 || material >= MATERIAL_IDS.length) return null
    if (!Number.isInteger(length) || length < 1) return null
    total += length as number
    if (total > tileCount) return null
  }

  return total === tileCount ? (runs as number[]) : null
}

/**
 * Coerce one stored creature into something the simulation can hold.
 *
 * Never throws and never refuses — every field falls back, in the same spirit as
 * `sanitizeBlueprint`. A creature with a nonsense hunger becomes a hungry
 * creature; one whose species has gone is dropped later, by the restore, which
 * is the only reason a creature is ever discarded.
 */
/**
 * Coerce stored inheritance back into the range the simulation was built for.
 *
 * Clamped to the same bounds `inherit` enforces rather than merely to something
 * finite, because these numbers multiply the blueprint on hot paths that were
 * tuned against it: a hand-edited save claiming a hopper is forty times its
 * species' speed would move it across a tile faster than collision samples one.
 * A save with no traits at all is a save written before any of this existed, and
 * neutral is the honest answer for it.
 */
function cleanTraits(raw: unknown): SavedCreature['traits'] {
  if (!isPlainObject(raw)) return undefined
  return {
    speed: clamp(raw.speed, TRAIT_MIN, TRAIT_MAX, 1),
    sight: clamp(raw.sight, TRAIT_MIN, TRAIT_MAX, 1),
    lifespan: clamp(raw.lifespan, TRAIT_MIN, TRAIT_MAX, 1),
    // Wrapped rather than clamped — hue is an angle, and 370° is 10°, not 360°.
    hue: ((clamp(raw.hue, -1e6, 1e6, 0) % 360) + 360) % 360,
    shade: clamp(raw.shade, SHADE_MIN, SHADE_MAX, 1),
  }
}

function cleanCreature(raw: unknown, index: number): SavedCreature | null {
  if (!isPlainObject(raw)) return null
  if (typeof raw.blueprintId !== 'string' || raw.blueprintId.length === 0) return null

  return {
    id: Math.max(1, Math.floor(num(raw.id, index + 1))),
    blueprintId: raw.blueprintId.slice(0, 120),
    x: clamp(raw.x, 0, WORLD_W, 0),
    y: clamp(raw.y, 0, WORLD_H, 0),
    vx: clamp(raw.vx, -200, 200, 0),
    vy: clamp(raw.vy, -200, 200, 0),
    facing: raw.facing === -1 ? -1 : 1,
    hunger: clamp(raw.hunger, 0, 1, 0.2),
    starving: clamp(raw.starving, 0, 1e6, 0),
    ageSeconds: clamp(raw.ageSeconds, 0, 1e7, 0),
    distress: clamp(raw.distress, 0, 1e6, 0),
    mood: str(raw.mood, 'wander', 16),
    targetId:
      typeof raw.targetId === 'number' && Number.isFinite(raw.targetId) ? raw.targetId : null,
    drift: clamp(raw.drift, -1, 1, 0),
    animMs: clamp(raw.animMs, 0, 1e9, 0),
    grounded: raw.grounded === true,
    breedCooldown: clamp(raw.breedCooldown, 0, 1e6, 0),
    mealsEaten: Math.floor(clamp(raw.mealsEaten, 0, 1e9, 0)),
    children: Math.floor(clamp(raw.children, 0, 1e9, 0)),
    digProgress: clamp(raw.digProgress, 0, 1, 0),
    tilesDug: Math.floor(clamp(raw.tilesDug, 0, 1e9, 0)),
    generation: Math.floor(clamp(raw.generation, 1, 1e6, 1)),
    traits: cleanTraits(raw.traits),
    name: typeof raw.name === 'string' ? raw.name.slice(0, 32) : null,
  }
}

function validSnapshot(value: unknown): WorldSnapshot | null {
  if (!isPlainObject(value)) return null

  // The grid is a fixed size, and a save from a build with different dimensions
  // cannot be stretched to fit — the terrain would mean something else.
  if (value.width !== WORLD_W || value.height !== WORLD_H) return null

  const materials = num(value.materials, -1)
  // Written against a table longer than ours: it may hold indices we cannot
  // name. Shorter is fine — the list is only ever appended to (invariant 3).
  if (!Number.isInteger(materials) || materials < 1 || materials > MATERIAL_IDS.length) return null

  const tiles = validRuns(value.tiles, WORLD_W * WORLD_H)
  if (!tiles) return null

  if (!Array.isArray(value.creatures)) return null
  if (!Array.isArray(value.natives)) return null
  if (!Array.isArray(value.blueprints)) return null

  const creatures: SavedCreature[] = []
  for (let i = 0; i < value.creatures.length; i++) {
    const creature = cleanCreature(value.creatures[i], i)
    if (creature) creatures.push(creature)
  }

  const natives = value.natives.filter((id): id is string => typeof id === 'string')
  // Blueprints are passed through as stored, exactly as the chronicle's archived
  // ones are: they went through `sanitizeBlueprint` when the species was
  // invented, and re-sanitizing would mint a fresh id and orphan every creature
  // pointing at the old one. Shape is checked; content is the author's own.
  const blueprints = value.blueprints.filter(
    (bp): bp is CreatureBlueprint =>
      isPlainObject(bp) && typeof bp.id === 'string' && isPlainObject(bp.body)
  )

  return {
    materials,
    width: WORLD_W,
    height: WORLD_H,
    seed: Math.floor(clamp(value.seed, 0, 0xffffffff, 1337)),
    elapsed: clamp(value.elapsed, 0, 1e9, 0),
    flowPhase: num(value.flowPhase, 0),
    dormant: value.dormant === true,
    nextCreatureId: Math.max(1, Math.floor(num(value.nextCreatureId, 1))),
    // `nextSeedRain` used to live here, back when animals wandered back into a
    // world they had died out of. Worlds saved before that was removed still
    // carry the field; dropping it on the way in is all the migration needed.
    nextPlantSeed: clamp(value.nextPlantSeed, 0, 1e9, 0),
    natives,
    tiles,
    creatures,
    blueprints,
  }
}

/**
 * Coerce untrusted input into a world save, or refuse it.
 *
 * Returns null rather than throwing. A payload this far off shape is a bug or an
 * attack, not a world to be salvaged, and the caller's fallback — "that save is
 * unreadable, here are your others" — is already right for both.
 */
export function validateWorldSave(value: unknown): WorldSave | null {
  if (!isPlainObject(value)) return null
  if (value.version !== WORLD_SAVE_VERSION) return null
  if (!isSaveId(value.id)) return null

  const world = validSnapshot(value.world)
  if (!world) return null

  const land = isPlainObject(value.land) ? value.land : {}
  // Run back through the same sanitizer that produced it. It is deterministic
  // and idempotent, it never throws, and it is the guarantee `terrainToTheme`
  // relies on — a legend of real materials and a rectangular map. Trusting the
  // stored shape here would put a ragged map into the terrain painter.
  const terrain = isPlainObject(value.terrain) ? sanitizeTerrain(value.terrain) : null

  const now = num(value.updatedAt, 0)
  const themeId = str(value.themeId, 'earth', 48) || 'earth'
  return {
    version: WORLD_SAVE_VERSION,
    id: value.id,
    name: cleanWorldName(value.name),
    createdAt: Math.max(0, Math.floor(num(value.createdAt, now))),
    updatedAt: Math.max(0, Math.floor(now)),
    themeId,
    terrain,
    camX: clamp(value.camX, 0, WORLD_W, 0),
    land: {
      landId: str(land.landId, themeId, 120) || themeId,
      steadySince: clamp(land.steadySince, 0, world.elapsed, 0),
      elderId:
        typeof land.elderId === 'number' && Number.isFinite(land.elderId)
          ? Math.floor(land.elderId)
          : null,
    },
    world,
  }
}

/** Parse and validate in one step, for reading a stored JSON string back. */
export function decodeWorldSave(raw: unknown): WorldSave | null {
  if (typeof raw !== 'string') return null
  try {
    return validateWorldSave(JSON.parse(raw))
  } catch {
    return null
  }
}

/** The row the shelf shows. Derived rather than stored, so it cannot drift. */
export function summarize(save: WorldSave): WorldSummary {
  return {
    id: save.id,
    name: save.name,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    themeId: save.themeId,
    landName: save.terrain?.name ?? null,
    creatures: save.world.creatures.length,
    elapsed: save.world.elapsed,
  }
}

/**
 * A fresh id for a world about to be shelved.
 *
 * Random rather than sequential because ids are minted on two backends that
 * cannot see each other — a world saved on a phone while signed out and one
 * saved on a laptop must not collide when the account merges them. The alphabet
 * is deliberately the one `isSaveId` accepts, which is also what Firestore is
 * happy to use as a document id.
 */
export function newSaveId(): string {
  let id = 'w-'
  for (let i = 0; i < 12; i++)
    id += 'abcdefghijklmnopqrstuvwxyz0123456789'[(Math.random() * 36) | 0]
  return id
}
