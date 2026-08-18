/**
 * A campaign — everything Dicebound remembers between visits.
 *
 * One campaign per player at a time: a premise, a character, the transcript of
 * everything that has happened, a world (version 2) and a body (version 3).
 *
 * The transcript is still the story and still authoritative. What `world` adds
 * is an *index* over it: the handful of facts that have to be checkable rather
 * than merely readable, because "you drop the lantern" and "the guard owes you
 * for the boat" now change numbers. See `domain/world.ts` for why that is a
 * graph rather than a set of fields.
 *
 * The transcript still outgrows a prompt, which is what `synopsis` is for: older
 * turns are compressed into prose and dropped, so a campaign fifty turns deep
 * still sends a bounded amount of context. What it drops is archived as a
 * `Chapter` rather than destroyed — the prompt stays small, the story survives.
 *
 * Everything here is plain JSON. It round-trips through Firestore as a single
 * string (see `lib/dicebound/campaign-store.ts`), so nothing may be a Map, a
 * Set, a Date or a class.
 */
import { ATTRIBUTE_IDS, isAttributeId, isSkillId } from './attributes'
import { type Body, undamagedBody, validateBody } from './body'
import { MAX_SKILL_RANK, blankAttributes, normalizeAttributes } from './character'
import { type Kit, emptyKit, validateKit } from './kit'
import { boundedInt, int, isPlainObject, str } from './validate'
import { type World, emptyWorld, validateWorld } from './world'

import type { AttributeId, SkillId } from './attributes'
import type { Character, SkillRecord } from './character'
import type { Modifier, OutcomeBand, RolledTwice } from './dice'

/**
 * Bump only when an old campaign would be *misread* by the current code, not
 * when a field is added.
 *
 * Version 2 added the world graph, the clock and the kit. It is a *migration*,
 * not a refusal: a version 1 campaign is read as a valid campaign with an empty
 * world, and the first reconciliation pass repopulates the graph from the
 * transcript it already has. Refusing it instead — which is what this file used
 * to do on any mismatch — would silently delete every story in existence and
 * show the player an empty game.
 *
 * Version 3 added the body: a condition track that can reach death. Same rule,
 * and the stakes of getting it wrong are now a step higher — a version 2
 * campaign reads as a valid campaign with an undamaged body, because the only
 * honest reading of "this save predates injury" is that nobody has been injured.
 */
export const CAMPAIGN_VERSION = 3

/** Versions this code can read. Anything else is genuinely not a campaign. */
export const SUPPORTED_VERSIONS: readonly number[] = [1, 2, 3]

export interface NarrationEntry {
  kind: 'narration'
  text: string
}

export interface PlayerEntry {
  kind: 'player'
  text: string
}

/** A resolved check, kept in full so the die card can be re-rendered on reload. */
export interface CheckEntry {
  kind: 'check'
  /** What the character was trying to do, in the DM's words. */
  attempt: string
  attribute: AttributeId
  skill: SkillId | null
  dc: number
  dcLabel: string
  roll: number
  modifiers: Modifier[]
  modifier: number
  total: number
  margin: number
  band: OutcomeBand
  /**
   * Present only when the die was thrown twice.
   *
   * Optional rather than nullable so that every check ever stored stays valid
   * without a version bump — and because nothing can set it yet. Nothing in
   * play grants advantage until `use_power` exists; the resolver and the card
   * are built first so that when it does, there is nowhere for a magnitude to
   * sneak in.
   */
  twice?: RolledTwice
}

/** The moment a skill becomes real. Rendered as a beat, not a toast. */
export interface EarnedEntry {
  kind: 'earned'
  skill: SkillId
  rank: number
}

export type TranscriptEntry = NarrationEntry | PlayerEntry | CheckEntry | EarnedEntry

export interface CampaignStats {
  turns: number
  checks: number
  successes: number
  naturalTwenties: number
  naturalOnes: number
}

export interface Campaign {
  version: number
  /** The player's one-line answer to "where does your story begin?". */
  premise: string
  /** The DM's title for the story, set on the opening turn. */
  title: string
  character: Character
  /** Where the character is on the condition track. Added in version 3. */
  body: Body
  /** Places, people, things and threads, plus the clock. Added in version 2. */
  world: World
  /** Carried items, powers, species and the discovered class. Added in version 2. */
  kit: Kit
  transcript: TranscriptEntry[]
  /** Compressed prose covering transcript entries already dropped. */
  synopsis: string
  /** How many chapters have been archived — the next index to write. */
  chapters: number
  stats: CampaignStats
  /** Local-day keys, for the visit streak. Run-loop games count days, not runs. */
  lastPlayedDay: string | null
  currentStreak: number
  longestStreak: number
  startedAt: number
  updatedAt: number
}

/**
 * How much transcript is kept verbatim before older turns are condensed.
 *
 * Sized so a player who plays for twenty minutes never sees the seam, and a
 * player fifty turns deep still gets a prompt that fits comfortably. The
 * condense pass leaves this many entries behind.
 */
export const TRANSCRIPT_WINDOW = 40

/** Condensing starts once the transcript grows past this. */
export const CONDENSE_AT = 60

export const MAX_PREMISE = 200
export const MAX_CONCEPT = 200
export const MAX_ACTION = 500

/**
 * The most a stored campaign may weigh, in bytes of JSON.
 *
 * Well under Firestore's ~1 MiB field ceiling. A campaign that fails to write
 * is one that silently stops saving, and the player only finds out on their
 * next visit, so the headroom is deliberate.
 */
export const MAX_CAMPAIGN_BYTES = 700_000

const encoder = new TextEncoder()

export function campaignBytes(campaign: Campaign): number {
  return encoder.encode(JSON.stringify(campaign)).length
}

export function emptyStats(): CampaignStats {
  return { turns: 0, checks: 0, successes: 0, naturalTwenties: 0, naturalOnes: 0 }
}

/**
 * A campaign on its first turn.
 *
 * One factory rather than an object literal at each call site, because every
 * field added from here on is a field some other constructor would have
 * forgotten — `world` and `kit` each broke two of them the moment they landed.
 */
export function newCampaign(
  premise: string,
  character: Character,
  now: number,
  today: string | null
): Campaign {
  return {
    version: CAMPAIGN_VERSION,
    premise,
    title: 'An Untitled Story',
    character,
    body: undamagedBody(),
    world: emptyWorld(),
    kit: emptyKit(),
    transcript: [],
    synopsis: '',
    chapters: 0,
    stats: emptyStats(),
    lastPlayedDay: today,
    currentStreak: today ? 1 : 0,
    longestStreak: today ? 1 : 0,
    startedAt: now,
    updatedAt: now,
  }
}

/**
 * A slice of transcript that has been condensed out of the live campaign.
 *
 * `condense` used to compress old entries into the synopsis and drop them, which
 * made it the only lossy thing in the game. It already runs every twenty turns
 * and already pays for a slow model call, so it writes what it drops here on the
 * way past: one extra document per twenty turns, and the story stops being
 * destroyed to keep the prompt small.
 *
 * Chapters are never read during a turn. They exist for the player, and later
 * for share pages and whatever a finished story leaves behind.
 */
export interface Chapter {
  index: number
  entries: TranscriptEntry[]
  /** The synopsis as it stood when this was archived. */
  synopsis: string
  /** Clock minute at which the archive happened. */
  archivedAt: number
}

/**
 * Coerce untrusted input into a campaign, or refuse it.
 *
 * This reads a POST body, so it assumes hostility: wrong types, missing keys,
 * a transcript of a hundred thousand entries. It repairs what it can and
 * refuses what it cannot, and it never throws — a save that fails validation
 * becomes "this player has no campaign", which is a state the client already
 * knows how to render.
 *
 * The asymmetry with the client's own in-memory state is intentional. The
 * client is trusted to hold a well-formed campaign; the wire is not.
 */
export function validateCampaign(value: unknown): Campaign | null {
  if (!isPlainObject(value)) return null
  if (typeof value.version !== 'number' || !SUPPORTED_VERSIONS.includes(value.version)) return null

  const character = validateCharacter(value.character)
  if (!character) return null

  const transcript = Array.isArray(value.transcript)
    ? (value.transcript.map(validateEntry).filter(Boolean) as TranscriptEntry[])
    : []

  const rawStats = isPlainObject(value.stats) ? value.stats : {}

  // The whole of the version 1 → 2 migration. A campaign that predates the
  // world graph gets an empty one and a clock at zero, and reconciliation fills
  // it in from the transcript on the next condense. Nothing is lost, because
  // there was never anything in these fields to lose.
  const migrating = value.version < 2

  return {
    version: CAMPAIGN_VERSION,
    premise: str(value.premise, MAX_PREMISE),
    title: str(value.title, 120, 'An Untitled Story'),
    character,
    // No `migrating` guard, unlike the two below it. `validateBody` already
    // reads an absent body as an undamaged one, so the version 2 → 3 migration
    // is the ordinary path through it rather than a branch that has to be
    // remembered — and a branch nobody has to remember is a branch that cannot
    // be forgotten at the next bump.
    body: validateBody(value.body),
    world: migrating ? emptyWorld() : validateWorld(value.world),
    kit: migrating ? emptyKit() : validateKit(value.kit),
    transcript: transcript.slice(-CONDENSE_AT * 2),
    synopsis: str(value.synopsis, 8000),
    chapters: Math.max(0, int(value.chapters)),
    stats: {
      turns: int(rawStats.turns),
      checks: int(rawStats.checks),
      successes: int(rawStats.successes),
      naturalTwenties: int(rawStats.naturalTwenties),
      naturalOnes: int(rawStats.naturalOnes),
    },
    lastPlayedDay:
      typeof value.lastPlayedDay === 'string' ? value.lastPlayedDay.slice(0, 10) : null,
    currentStreak: Math.max(0, int(value.currentStreak)),
    longestStreak: Math.max(0, int(value.longestStreak)),
    startedAt: int(value.startedAt),
    updatedAt: int(value.updatedAt),
  }
}

export function validateCharacter(value: unknown): Character | null {
  if (!isPlainObject(value)) return null

  const rawAttributes = isPlainObject(value.attributes) ? value.attributes : {}
  const attributes = normalizeAttributes(
    Object.fromEntries(ATTRIBUTE_IDS.map(id => [id, rawAttributes[id]])) as Partial<
      Record<AttributeId, unknown>
    >
  )

  const skills: Partial<Record<SkillId, SkillRecord>> = {}
  if (isPlainObject(value.skills)) {
    for (const [key, record] of Object.entries(value.skills)) {
      if (!isSkillId(key) || !isPlainObject(record)) continue
      skills[key] = {
        uses: Math.max(0, int(record.uses)),
        // Negative ranks are legal and must survive the wire. An innate Size of
        // −2 is subtracted from every Size check, and clamping the floor to 0
        // here — as this did — quietly repealed that on the first round-trip:
        // the character was still described as very small, the sheet still said
        // so, and the die stopped agreeing with both of them.
        rank: boundedInt(record.rank, -MAX_SKILL_RANK, MAX_SKILL_RANK),
        // Absent stays absent rather than becoming `seeded: false`. A character
        // saved before this marker existed has to keep the level they already
        // had, so unmarked reads as earned — see `earnedRanks`. Writing the key
        // only when it is true also keeps it out of every campaign blob that
        // has no seeded skills.
        ...(record.seeded === true ? { seeded: true as const } : {}),
        // Same treatment, and for the same reason: absent stays absent. A
        // character stored before windows existed has no matured skills rather
        // than one that matured at minute zero and closed before anyone looked.
        ...(typeof record.maturedAt === 'number' && Number.isFinite(record.maturedAt)
          ? { maturedAt: Math.max(0, Math.round(record.maturedAt)) }
          : {}),
      }
    }
  }

  const name = str(value.name, 60)
  if (!name) return null

  return {
    name,
    concept: str(value.concept, MAX_CONCEPT),
    reading: str(value.reading, 400),
    attributes: attributes ?? blankAttributes(),
    skills,
  }
}

function validateEntry(value: unknown): TranscriptEntry | null {
  if (!isPlainObject(value)) return null

  switch (value.kind) {
    case 'narration':
    case 'player': {
      const text = str(value.text, 6000)
      return text ? { kind: value.kind, text } : null
    }
    case 'earned': {
      if (!isSkillId(value.skill)) return null
      return {
        kind: 'earned',
        skill: value.skill,
        rank: Math.max(1, Math.min(3, int(value.rank, 1))),
      }
    }
    case 'check': {
      if (!isAttributeId(value.attribute)) return null
      const modifiers = Array.isArray(value.modifiers)
        ? value.modifiers
            .filter(isPlainObject)
            .map(m => ({ label: str(m.label, 80), value: int(m.value) }))
            .slice(0, 8)
        : []
      return {
        kind: 'check',
        attempt: str(value.attempt, 300),
        attribute: value.attribute,
        skill: isSkillId(value.skill) ? value.skill : null,
        dc: int(value.dc, 10),
        dcLabel: str(value.dcLabel, 60, 'medium'),
        roll: int(value.roll, 1),
        modifiers,
        modifier: int(value.modifier),
        total: int(value.total),
        margin: int(value.margin),
        band: isBand(value.band) ? value.band : 'failure',
        ...validateTwice(value.twice),
      }
    }
    default:
      return null
  }
}

/**
 * Read back the record of a die thrown twice, or nothing at all.
 *
 * Spread into the entry rather than assigned, so a check that was rolled once
 * has no `twice` key rather than an explicit undefined — which keeps it out of
 * every stored blob and out of the way of `toEqual` in the tests that already
 * describe a plain check.
 *
 * A malformed one is dropped rather than repaired. There is no sensible default
 * for "which die did we throw away": inventing one would put a number on the
 * die card that never came off a die.
 */
function validateTwice(value: unknown): { twice: RolledTwice } | Record<string, never> {
  if (!isPlainObject(value)) return {}
  if (value.direction !== 'advantage' && value.direction !== 'disadvantage') return {}

  // Checked before clamping rather than after: `boundedInt` would turn a
  // missing die into a 1, and a 1 is a number a player would read as a real
  // roll they got lucky to escape.
  if (typeof value.discarded !== 'number' || !Number.isFinite(value.discarded)) return {}

  return {
    twice: {
      direction: value.direction,
      reason: str(value.reason, 120),
      discarded: boundedInt(value.discarded, 1, 20),
    },
  }
}

/** A chapter read back out of the archive. Empty chapters are not chapters. */
export function validateChapter(value: unknown): Chapter | null {
  if (!isPlainObject(value)) return null

  const entries = Array.isArray(value.entries)
    ? (value.entries.map(validateEntry).filter(Boolean) as TranscriptEntry[])
    : []
  if (entries.length === 0) return null

  return {
    index: Math.max(0, int(value.index)),
    entries,
    synopsis: str(value.synopsis, 8000),
    archivedAt: Math.max(0, int(value.archivedAt)),
  }
}

const BANDS: readonly string[] = [
  'critical-success',
  'strong-success',
  'success',
  'failure',
  'strong-failure',
  'critical-failure',
]

function isBand(value: unknown): value is OutcomeBand {
  return typeof value === 'string' && BANDS.includes(value)
}

/**
 * Fold today's visit into the streak.
 *
 * Streaks count *days visited*, not runs — a run-loop game where the streak
 * broke because you only played once today would be punishing the wrong thing
 * (interaction models, "Session shapes"). Pure so the day boundary can be
 * tested without mocking a clock.
 */
export function withVisit(campaign: Campaign, today: string, yesterday: string): Campaign {
  if (campaign.lastPlayedDay === today) return campaign

  const current = campaign.lastPlayedDay === yesterday ? campaign.currentStreak + 1 : 1
  return {
    ...campaign,
    lastPlayedDay: today,
    currentStreak: current,
    longestStreak: Math.max(campaign.longestStreak, current),
  }
}

/** Trim a campaign to fit the storage ceiling, oldest turns first. */
export function trimToFit(campaign: Campaign): Campaign {
  let trimmed = campaign
  while (campaignBytes(trimmed) > MAX_CAMPAIGN_BYTES && trimmed.transcript.length > 4) {
    trimmed = {
      ...trimmed,
      transcript: trimmed.transcript.slice(Math.ceil(trimmed.transcript.length / 4)),
    }
  }
  return trimmed
}
