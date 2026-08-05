/**
 * Saved worlds — the shelf.
 *
 * The chronicle deliberately keeps a logbook and not a save file: close the tab
 * and the land is gone, and what survives is the *record* of it. That is still
 * true of the land you happen to be standing in. This is the other half — a
 * player can take a world they care about, give it a name, and put it on a
 * shelf, and opening it later drops them back into it mid-breath: same terrain,
 * same creatures, same hungers, same ages.
 *
 * Two things follow from that split and are worth stating up front:
 *
 * - A shelved world is a *copy*, not a link. Reopening one does not disturb the
 *   record of any other, and the world you were in when you opened it is simply
 *   left behind (its streak banked, like any other world change).
 * - The chronicle still owns species, records and milestones. A save carries
 *   only what a world is, never what the player has achieved — so deleting a
 *   world can never cost someone a record they earned in it.
 *
 * Everything here is plain JSON for the same reason the chronicle is: no `Map`,
 * no `Set`, no typed array, `null` rather than `undefined`. `Uint8Array` in
 * particular round-trips through `JSON.stringify` as an *object* keyed by index
 * — 88,704 keys — which is why the tile grid is run-length encoded on the way
 * out rather than handed over as-is.
 */
import type { SanitizedTerrain } from '@/app/micro-land/domain/terrain'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

/**
 * Bump when an old save would be *misread* rather than merely come up short.
 *
 * Unlike the chronicle there is no migration path here and there deliberately
 * isn't one: a save whose version we don't know is refused, and the player keeps
 * every other world on the shelf. Records, which are the part they earned, live
 * in the chronicle and are unaffected either way.
 */
export const WORLD_SAVE_VERSION = 1

/**
 * One creature, frozen.
 *
 * The whole runtime state, not a summary — hunger, age, breeding cooldown and
 * distress are what make a reopened world feel like it was paused rather than
 * restarted. `mood`, `targetId` and `animMs` are cosmetic and cost almost
 * nothing, and dropping them would make the first frame after a load look like
 * every creature had just been dropped in from nowhere.
 */
export interface SavedCreature {
  id: number
  blueprintId: string
  x: number
  y: number
  vx: number
  vy: number
  facing: 1 | -1
  hunger: number
  starving: number
  ageSeconds: number
  distress: number
  mood: string
  targetId: number | null
  drift: number
  animMs: number
  grounded: boolean
  breedCooldown: number
  mealsEaten: number
  children: number
  generation: number
  /**
   * What this one inherited, or absent for a world saved before creatures
   * inherited anything.
   *
   * Optional rather than required because an old save must thaw into neutral
   * creatures, which is exactly what the sanitizer does with a missing value —
   * and neutral is the right answer, not a lossy one: a world written before the
   * mechanic existed genuinely had no drift in it.
   */
  traits?: { speed: number; sight: number; lifespan: number; hue: number; shade: number }
  name: string | null
}

export interface WorldSnapshot {
  /**
   * How many materials existed when this grid was written.
   *
   * Tile values are indices into `MATERIAL_IDS`, and that order is load-bearing
   * (invariant 3): appending is safe, reordering is not. A save written against
   * a *longer* table may hold indices this build has no material for, so it is
   * refused rather than rendered as whatever now sits at that index. A shorter
   * one is fine, which is what makes adding a material a non-event for saves.
   */
  materials: number
  width: number
  height: number
  /** Regenerates `grain`; the tile grid itself is stored, not rebuilt from this. */
  seed: number
  elapsed: number
  flowPhase: number
  dormant: boolean
  nextCreatureId: number
  nextPlantSeed: number
  natives: string[]
  /** Run-length encoded: material, length, material, length, … See `snapshot.ts`. */
  tiles: number[]
  creatures: SavedCreature[]
  /**
   * Summoned blueprints referenced by this world, embedded whole.
   *
   * Redundant with the chronicle's archive on the device that made the save, and
   * not redundant at all anywhere else: the archive is capped and prunes by last
   * sighting, so a world left on the shelf for a month could otherwise reopen
   * with half its inhabitants missing. Built-ins are never stored — they are
   * config, and `createWorld` already has them.
   */
  blueprints: CreatureBlueprint[]
}

/**
 * Where the record-keeper was standing when the world was put away.
 *
 * Without this, reopening a world would bank its no-extinction streak and start
 * counting from zero — which would make the shelf a way to *lose* progress. The
 * streak's length is `elapsed - steadySince` and both travel together, so it
 * simply carries on. Records themselves stay monotonic high-water marks
 * (invariant 11); nothing here can lower one.
 */
export interface SavedLand {
  /** Record key, from `landId()`. */
  landId: string
  /** World-clock time the current no-extinction streak began. */
  steadySince: number
  /** Creature holding the longevity record, if it was still alive. */
  elderId: number | null
}

export interface WorldSave {
  version: number
  id: string
  name: string
  /** Epoch ms. */
  createdAt: number
  updatedAt: number
  themeId: string
  /**
   * The terrain the player summoned, if this land was one.
   *
   * The sanitized terrain rather than the `Theme` built from it, because a Theme
   * carries a `build` function and functions do not survive JSON. `terrainToTheme`
   * rebuilds it on load, which also means a summoned land can still be Reshaped
   * after it comes back off the shelf.
   */
  terrain: SanitizedTerrain | null
  /** Left edge of the view, in world tiles — reopen looking where you left off. */
  camX: number
  land: SavedLand
  world: WorldSnapshot
}

/**
 * What the shelf can show without reading a whole save.
 *
 * A save is a few hundred kilobytes; a shelf of eight is megabytes. Listing them
 * pulls only this, which is why the account backend keeps these as their own
 * fields alongside the blob rather than parsing it out on every list.
 */
export interface WorldSummary {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  themeId: string
  /** Name of the summoned land, when the theme is one. */
  landName: string | null
  creatures: number
  /** World-seconds this land has been running. */
  elapsed: number
}
