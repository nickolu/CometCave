/**
 * Freezing a world and thawing it again.
 *
 * The two functions here are inverses and are tested as such. Everything they
 * touch is either stored or *deliberately* not, and the "not" list is the
 * interesting half:
 *
 * - `grain` is per-tile colour jitter, one random byte per tile. Storing it
 *   would roughly triple the size of a save for something nobody can name, and
 *   random bytes are exactly the data run-length encoding cannot help with. It
 *   is regenerated from `seed` instead. The consequence is honest and small: a
 *   reopened world has the same terrain with slightly different speckle.
 * - `particles` are sparks that live under a second. Storing a world mid-burst
 *   and thawing it an hour later to a frozen puff would look like a bug.
 * - Built-in blueprints are config, not world state. `createWorld` has them.
 *
 * Neither function ever throws. `restoreSnapshot` in particular is handed data
 * that has been through `validateWorldSave`, but it still drops anything it
 * cannot resolve rather than trusting it — a creature whose species is missing
 * is left behind, not spawned as a hole in the simulation.
 */
import { reserveSummonIds } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_IDS } from '@/app/micro-land/domain/config/materials'
import { makeRng } from '@/app/micro-land/domain/sim/prng'
import { registerBlueprint } from '@/app/micro-land/domain/sim/world'
import { neutralTraits } from '@/app/micro-land/domain/traits'
import type { Creature, CreatureMood, WorldState } from '@/app/micro-land/domain/types'

import type { SavedCreature, WorldSnapshot } from './types'

const MOODS: CreatureMood[] = ['wander', 'hunt', 'flee', 'eat', 'rest', 'mate']

/** Two decimals is a hundredth of a tile — far finer than a pixel can show. */
function round(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Run-length encode the tile grid.
 *
 * Terrain is made of long contiguous runs — a row of sky, a seam of stone — so
 * this is worth an order of magnitude on a real world and never costs more than
 * two entries per tile in the pathological case. Row-major order is kept as-is
 * because runs mostly *are* horizontal; encoding by column would break every one
 * of them.
 */
export function encodeTiles(tiles: Uint8Array): number[] {
  const runs: number[] = []
  if (tiles.length === 0) return runs

  let material = tiles[0]
  let length = 1
  for (let i = 1; i < tiles.length; i++) {
    if (tiles[i] === material) {
      length++
      continue
    }
    runs.push(material, length)
    material = tiles[i]
    length = 1
  }
  runs.push(material, length)
  return runs
}

/**
 * Write a run-length encoded grid back into an existing `Uint8Array`.
 *
 * In place rather than allocating, because the game instance already owns a
 * world and replacing its `tiles` reference would leave the renderer's cached
 * tile image pointing at the old one.
 *
 * Returns false if the runs don't cover the grid exactly. `validateWorldSave`
 * has already checked that, so this is the second lock on the same door — but it
 * is the door where getting it wrong means writing past the end of the world.
 *
 * Measured in full before a single tile is written, which is what lets the
 * caller promise that a save it cannot read costs the player nothing: a
 * one-pass decoder would leave half a world behind on the way to returning
 * false, and the land on screen would already be ruined.
 */
export function decodeTiles(runs: number[], into: Uint8Array): boolean {
  if (runs.length % 2 !== 0) return false

  let total = 0
  for (let i = 1; i < runs.length; i += 2) {
    const length = runs[i]
    if (!Number.isInteger(length) || length < 1) return false
    total += length
    if (total > into.length) return false
  }
  if (total !== into.length) return false

  let cursor = 0
  for (let i = 0; i < runs.length; i += 2) {
    const material = runs[i]
    const length = runs[i + 1]
    // Anything outside the table would render as a material this build cannot
    // name; air is the one value that is always safe and always means "nothing".
    const value =
      Number.isInteger(material) && material >= 0 && material < MATERIAL_IDS.length ? material : 0
    into.fill(value, cursor, cursor + length)
    cursor += length
  }

  return true
}

/**
 * Everything about this world that isn't the chronicle's business.
 *
 * Only summoned species with something alive are carried. The rest of the roster
 * comes back the way it always does, out of the chronicle's archive — embedding
 * all of it would put eighty creatures' pixel art into every save of every world
 * for the sake of a shelf the player can already see. What must be embedded is
 * the species standing in *this* land, because the archive prunes by last
 * sighting and a world left alone for a month would otherwise reopen half empty.
 */
export function snapshotWorld(w: WorldState): WorldSnapshot {
  const living = new Set(w.creatures.map(c => c.blueprintId))
  const blueprints = Object.values(w.blueprints).filter(bp => bp.summoned && living.has(bp.id))

  return {
    materials: MATERIAL_IDS.length,
    width: w.width,
    height: w.height,
    seed: w.seed,
    elapsed: round(w.elapsed),
    flowPhase: w.flowPhase,
    dormant: w.dormant,
    nextCreatureId: w.nextCreatureId,
    nextPlantSeed: round(w.nextPlantSeed),
    natives: [...w.natives],
    tiles: encodeTiles(w.tiles),
    creatures: w.creatures.map(c => ({
      id: c.id,
      blueprintId: c.blueprintId,
      x: round(c.x),
      y: round(c.y),
      vx: round(c.vx),
      vy: round(c.vy),
      facing: c.facing,
      hunger: round(c.hunger),
      starving: round(c.starving),
      ageSeconds: round(c.ageSeconds),
      distress: round(c.distress),
      mood: c.mood,
      targetId: c.targetId,
      drift: round(c.drift),
      animMs: Math.round(c.animMs),
      grounded: c.grounded,
      breedCooldown: round(c.breedCooldown),
      mealsEaten: c.mealsEaten,
      children: c.children,
      digProgress: round(c.digProgress),
      tilesDug: c.tilesDug,
      generation: c.generation,
      // Stored, and it has to be. A reopened world whose creatures came back as
      // their blueprints would quietly delete every line the player had grown —
      // and it would look like nothing had happened, because the animals would
      // all still be there.
      traits: {
        speed: round(c.traits.speed),
        sight: round(c.traits.sight),
        lifespan: round(c.traits.lifespan),
        hue: Math.round(c.traits.hue),
        shade: round(c.traits.shade),
      },
      name: c.name,
    })),
    blueprints,
  }
}

function thaw(saved: SavedCreature): Creature {
  return {
    id: saved.id,
    blueprintId: saved.blueprintId,
    x: saved.x,
    y: saved.y,
    vx: saved.vx,
    vy: saved.vy,
    facing: saved.facing,
    hunger: saved.hunger,
    starving: saved.starving,
    ageSeconds: saved.ageSeconds,
    distress: saved.distress,
    mood: (MOODS as string[]).includes(saved.mood) ? (saved.mood as CreatureMood) : 'wander',
    // Deliberately cleared rather than restored. A target is a *reference* to
    // another creature, and the one it pointed at may have been dropped for a
    // missing species — leaving the id would have a hunter chasing nothing until
    // the next re-target. They all re-acquire within a tick anyway.
    targetId: null,
    drift: saved.drift,
    animMs: saved.animMs,
    grounded: saved.grounded,
    breedCooldown: saved.breedCooldown,
    mealsEaten: saved.mealsEaten,
    children: saved.children,
    digProgress: saved.digProgress,
    tilesDug: saved.tilesDug,
    generation: saved.generation,
    traits: saved.traits ? { ...saved.traits } : neutralTraits(),
    name: saved.name,
    huntPassCount: 0,
  }
}

/**
 * Thaw a snapshot into an existing world, replacing everything in it.
 *
 * Mutates `w` rather than returning a new world, because the game instance holds
 * one for its whole life and the renderer caches against its arrays.
 *
 * Returns false only when the tile grid could not be decoded, which leaves the
 * world untouched — the caller keeps playing the land it already had rather than
 * being dropped into a half-written one.
 */
export function restoreSnapshot(w: WorldState, snap: WorldSnapshot): boolean {
  if (!decodeTiles(snap.tiles, w.tiles)) return false

  // Same sequence `createWorld` uses, so a world restored from a given seed
  // speckles the same way a fresh one from that seed would.
  const rng = makeRng(snap.seed)
  for (let i = 0; i < w.grain.length; i++) w.grain[i] = Math.floor(rng() * 256)

  for (const bp of snap.blueprints) registerBlueprint(w, bp)
  // Ids carry a counter that resets with the page. Without this, the next
  // creature summoned after opening a saved world could be handed an id one of
  // its inhabitants is already using and silently overwrite it in the roster.
  reserveSummonIds(snap.blueprints.map(bp => bp.id))

  w.creatures = snap.creatures.filter(c => w.blueprints[c.blueprintId]).map(thaw)
  w.particles.length = 0

  // A dangling id here would hand `undefined` to `isPlant` and break the soil's
  // seed bank, which is how a restored world would quietly stop being able to
  // grow its plants back.
  w.natives = snap.natives.filter(id => w.blueprints[id])

  w.seed = snap.seed
  w.elapsed = snap.elapsed
  w.flowPhase = snap.flowPhase
  w.dormant = snap.dormant
  w.nextPlantSeed = snap.nextPlantSeed
  // Never below anything already alive: ids are handed out by increment, and a
  // counter that starts underneath the population would issue duplicates, which
  // every `targetId` lookup and the inspector all resolve by id.
  let nextId = snap.nextCreatureId
  for (const c of w.creatures) if (c.id >= nextId) nextId = c.id + 1
  w.nextCreatureId = nextId

  return true
}
