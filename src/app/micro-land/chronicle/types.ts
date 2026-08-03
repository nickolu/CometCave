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
import type { CreatureBlueprint, LifeKind } from '@/app/micro-land/domain/types'

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
 * The records one kind of life holds in one land.
 *
 * Split out because a single set of them is a plant leaderboard wearing a
 * neutral label. A rooted thing is never chased, never has to find its next
 * meal, and is restocked by the soil itself, so it outlives and out-breeds every
 * animal in the world by an order of magnitude — "longest life" and "deepest
 * family line" were being won by moss on every land, every session, and the
 * animals the player actually watches could not compete for either. Two columns
 * gives each half of the food web a record it can plausibly take.
 */
export interface KindRecord {
  elder: ElderRecord | null
  /** Deepest unbroken family line this kind has reached here, in generations. */
  generations: number
  generationsBlueprintId: string | null
  generationsSpeciesName: string | null
}

/**
 * What one land remembers.
 *
 * Kept per land rather than globally because these numbers only mean something
 * relative to their world — six minutes alive in a tidepool and six minutes in a
 * volcanic field are not the same achievement.
 */
export interface LandRecord {
  /**
   * The single oldest thing this land has ever held, of any kind.
   *
   * Kept alongside `byKind` rather than replaced by it because this one is not
   * only a statistic: it is what the crown is drawn on and what `nameElder`
   * writes into, and there is one crown. The panel shows the split; the world
   * shows this.
   */
  elder: ElderRecord | null
  /** Longest stretch, in world-seconds, that passed without an extinction. */
  steadySeconds: number
  /** Deepest unbroken family line ever reached here, in generations. */
  generations: number
  generationsBlueprintId: string | null
  generationsSpeciesName: string | null
  /**
   * The same records again, kept apart for plants and for animals.
   *
   * Added after version 1 shipped, which is why `normalizeLandRecord` exists —
   * an old chronicle has no `byKind` at all, and every path that can produce a
   * `LandRecord` runs it through there so nothing downstream has to ask.
   */
  byKind: Record<LifeKind, KindRecord>
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

export function emptyKindRecord(): KindRecord {
  return {
    elder: null,
    generations: 0,
    generationsBlueprintId: null,
    generationsSpeciesName: null,
  }
}

export function emptyLandRecord(): LandRecord {
  return {
    elder: null,
    steadySeconds: 0,
    generations: 0,
    generationsBlueprintId: null,
    generationsSpeciesName: null,
    byKind: { plant: emptyKindRecord(), animal: emptyKindRecord() },
  }
}
