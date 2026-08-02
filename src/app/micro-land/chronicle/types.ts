/**
 * The chronicle — everything Micro Land remembers between visits.
 *
 * The world itself stays deliberately forgetful: close the tab and the land is
 * gone. What survives is the *record* of it — who lived longest, how long a food
 * web held together, every species you ever saw. That split is the whole design.
 * You are not keeping a save file, you are keeping a logbook.
 *
 * Every type here is plain JSON on purpose: no `Map`, no `Set`, no class, and
 * `null` rather than `undefined` anywhere a field can be absent. Today this
 * round-trips through `localStorage`; the plan is for it to round-trip through a
 * Firebase document keyed by user id instead, and when that happens the only
 * thing that should have to change is the backend (see `backend.ts`). Anything
 * that isn't serializable breaks that promise.
 */
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

/**
 * Bump only when a shape change would make an old chronicle *misread* rather
 * than merely come up short. Adding an optional field is not a version bump;
 * changing what an existing field means is. See `migrate` in `chronicle.ts`.
 */
export const CHRONICLE_VERSION = 1

/** The single longest life a land has ever held. */
export interface ElderRecord {
  /** Age reached, in world-seconds. */
  seconds: number
  blueprintId: string
  /**
   * Species name copied at the time of the record.
   *
   * Denormalized on purpose: a summoned species can fall out of the archive
   * (see `MAX_ARCHIVED` in `chronicle.ts`) and a record that renders as
   * "unknown creature" is worse than one that carries its own name.
   */
  speciesName: string
  /** What the player called it, if they named it. */
  name: string | null
  /** Epoch ms the record was set. */
  at: number
}

/**
 * What one land remembers.
 *
 * Kept per land rather than globally because these numbers only mean something
 * relative to their world — six minutes alive in a tidepool and six minutes in a
 * volcanic field are not the same achievement.
 */
export interface LandRecord {
  elder: ElderRecord | null
  /** Longest stretch, in world-seconds, that passed without an extinction. */
  steadySeconds: number
  /** Deepest unbroken family line ever reached here, in generations. */
  generations: number
  generationsBlueprintId: string | null
  generationsSpeciesName: string | null
}

/**
 * A species the player has seen alive at least once, in any land.
 *
 * The blueprint is archived *in full*, which is the entire point: a summoned
 * creature currently evaporates on refresh, and this is where it stops doing
 * that. Blueprints are small — a palette and a few rows of characters — so
 * carrying them costs little.
 */
export interface SpeciesRecord {
  blueprint: CreatureBlueprint
  /** Epoch ms of the first sighting. */
  firstSeen: number
  /** Epoch ms of the most recent sighting. Drives archive pruning. */
  lastSeen: number
  /** Longest one of these has ever lived, in world-seconds. */
  longestLife: number
}

export interface ChronicleData {
  version: number
  /** Land id → what that land remembers. Ids come from `landId()`. */
  lands: Record<string, LandRecord>
  /** Blueprint id → the archived species. */
  species: Record<string, SpeciesRecord>
  /** Milestone id → epoch ms first reached. Milestones fire once, ever. */
  milestones: Record<string, number>
}

export function emptyChronicle(): ChronicleData {
  return { version: CHRONICLE_VERSION, lands: {}, species: {}, milestones: {} }
}

export function emptyLandRecord(): LandRecord {
  return {
    elder: null,
    steadySeconds: 0,
    generations: 0,
    generationsBlueprintId: null,
    generationsSpeciesName: null,
  }
}
