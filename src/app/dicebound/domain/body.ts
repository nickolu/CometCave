/**
 * The body — how much a character has left, and the last step off the end of it.
 *
 * Until this file existed a Dicebound character could not end. There was no hit
 * point, no wound and no death anywhere in the game, which is why "danger" was
 * an adjective in a prompt rather than a thing that could happen to anyone.
 *
 * Three decisions shape everything here, and all three were settled before a
 * line of it was written (#3769):
 *
 * **It is a track, not a pool.** A visible number of hit points turns a
 * storytelling game into a combat game — it hands the player a quantity to
 * optimise, and quantities get optimised. The track is a short ordered list of
 * states the fiction can describe and the sheet can name, and the bottom of it
 * is death.
 *
 * **The track never touches the die.** Nothing in this file returns a modifier,
 * and nothing that reads it may turn a rung into one. This is the opposite of
 * most systems and it is deliberate: a penalty on a track that only moves
 * downward is a death spiral, and permadeath makes a death spiral terminal —
 * two bad rolls and the game is decided while the player watches the rest of it
 * happen. The track counts down toward an ending; it does not make the ending
 * arrive faster.
 *
 * **The model says how much it hurt, before it knows whether it landed.** This
 * is the one place damage touches the invariant the whole game rests on, so it
 * borrows the split `roll_check` already uses. A fall from a roof and a barked
 * shin are genuinely not the same and no formula knows which is which — only
 * the fiction does. So the dungeon master picks a `Severity` from a fixed table
 * *in the same breath as it names the DC*, before the die exists, and every
 * number after that comes from here.
 *
 * The failure that split prevents is specific and would otherwise be certain: a
 * model that can see the player's current rung *and* choose the damage will
 * leave them one step above dead, forever. Not out of malice — it is agreeable
 * and the story is going well. That is permadeath quietly becoming something
 * else without anyone deciding it should.
 *
 * Pure, like everything else in `domain/`. No clock, no `Math.random`, nothing
 * read from ambient state — the danger setting arrives as an argument for the
 * same reason the rng does elsewhere.
 */
import { isPlainObject, oneOf } from './validate'

import type { OutcomeBand } from './dice'

// ------------------------------------------------------------------ the track

/**
 * Every state a body can be in, and the one it cannot come back from.
 *
 * Seven rungs, six steps end to end. The count is a design number and the thing
 * it buys is *room*: a character has to be hurt several distinguishable times
 * before dying is on the table, so the fiction gets to describe a decline rather
 * than announce a result. Fewer rungs and the middle of the track stops meaning
 * anything; more and the names stop being distinguishable in prose, which is the
 * only place the player meets them.
 *
 * **`dying` is a rung, not a synonym for `dead`.** It is the entire reason the
 * last step is something the story can spend a moment on instead of a light
 * switch — someone is on the ground and going, and what happens in the next
 * turn matters. It is deliberately climbable: nothing here marks it terminal,
 * and `worsen` will happily leave a body sitting there. Only `dead` is an
 * ending, and the only thing that cannot reach it is `bruising` — everything the
 * fiction called a real injury still finishes someone who is already down.
 */
export type Condition = 'unhurt' | 'grazed' | 'hurt' | 'bloodied' | 'broken' | 'dying' | 'dead'

/**
 * Best to worst, and the only ordering there is.
 *
 * The type is a union and unions have no order, so this array is what "one step
 * worse" means. Following `BAND_ORDER` in `domain/dice.ts`: a `readonly` array
 * plus `Record<Condition, …>` lookups, so adding a rung is a type error at every
 * table rather than a row that silently goes missing from one of them.
 */
export const CONDITION_ORDER: readonly Condition[] = [
  'unhurt',
  'grazed',
  'hurt',
  'bloodied',
  'broken',
  'dying',
  'dead',
]

/** How many steps there are from perfect health to the end. */
export const TRACK_LENGTH = CONDITION_ORDER.length - 1

/** The word on the sheet. One of these, never a number. */
export const CONDITION_LABEL: Record<Condition, string> = {
  unhurt: 'Unhurt',
  grazed: 'Grazed',
  hurt: 'Hurt',
  bloodied: 'Bloodied',
  broken: 'Broken',
  dying: 'Dying',
  dead: 'Dead',
}

/**
 * What the rung feels like, for the dungeon master to narrate from.
 *
 * A second string rather than reusing the label, for the reason `BAND_BRIEF`
 * sits beside `BAND_LABEL` in `dice.ts`: they answer different questions. The
 * sheet wants a word the player can read at a glance; the DM wants to be told
 * what state the character is actually in, because a model handed only the word
 * "Broken" will invent its own severity for it and the prose will drift away
 * from the track underneath.
 *
 * Written in the game's voice. These are player-facing text — the DM quotes
 * their sense back in narration — not debug labels.
 */
export const CONDITION_PHRASE: Record<Condition, string> = {
  unhurt: 'Whole. Whatever the day has cost so far, it has not cost them this.',
  grazed:
    'Scrapes and a shallow cut or two. Nothing that slows them; everything that reminds them.',
  hurt: 'It is going to be a bad night. They favour one side, and they know they are doing it.',
  bloodied:
    'Bleeding in a way that is not going to simply stop. Whatever comes next comes through it.',
  broken: 'Something in them has given out. They are upright by decision rather than by strength.',
  dying: 'On the ground and going. Minutes, if nothing changes — and something has to change.',
  dead: 'Gone. The story does not continue from here.',
}

/** Where a rung sits on the track. `unhurt` is 0; `dead` is `TRACK_LENGTH`. */
export function conditionIndex(condition: Condition): number {
  const index = CONDITION_ORDER.indexOf(condition)
  // An unrecognised rung reads as unhurt rather than throwing. Nothing should
  // be able to hand this an off-track value — `validateBody` is the wire and it
  // clamps — but a body is the one thing in this game a parse error must never
  // be allowed to cost the player.
  return index === -1 ? 0 : index
}

export function isDead(body: Body): boolean {
  return body.condition === 'dead'
}

// -------------------------------------------------------------- the body

/**
 * Everything the game knows about the character's physical state.
 *
 * One field today. It is an object rather than a bare `Condition` because the
 * next two issues in this epic hang things off it — statuses (#3774) and
 * whatever healing turns out to need — and a field added to an object is a
 * migration nobody notices, while widening a stored string is not.
 */
export interface Body {
  condition: Condition
}

export function undamagedBody(): Body {
  return { condition: 'unhurt' }
}

/**
 * Read a body off the wire.
 *
 * Follows `validateWorld` rather than `validateCampaign`: it never refuses,
 * because there is no such thing as a campaign that is unreadable *only* in its
 * body. An unreadable body is an undamaged body. That direction is not
 * arbitrary — repairing toward `unhurt` can at worst hand a player back some
 * health they had lost, while repairing toward the middle of the track could
 * kill a character over a dropped key, and one of those failures is recoverable.
 *
 * A campaign saved before this file existed has no `body` at all, which lands in
 * exactly the same place. That is the whole of the version 2 → 3 migration.
 */
export function validateBody(value: unknown): Body {
  if (!isPlainObject(value)) return undamagedBody()
  return { condition: oneOf(value.condition, CONDITION_ORDER, 'unhurt') }
}

// ----------------------------------------------------------- the severity table

/**
 * How badly a thing hurts, independent of whether it landed.
 *
 * Four rows, deliberately few. The DM picks one when it proposes a check, and a
 * table it has to choose from is the mechanism that keeps this from becoming a
 * free-text number — there is no row for "8".
 */
export type Severity = 'bruising' | 'bloody' | 'grievous' | 'lethal'

export const SEVERITY_ORDER: readonly Severity[] = ['bruising', 'bloody', 'grievous', 'lethal']

export interface DamageRow {
  severity: Severity
  label: string
  /**
   * Concrete things that hurt this much. Not decoration — see the table.
   */
  example: string
  /**
   * Whether this row is allowed to take the last step onto `dead`.
   *
   * Kept on the row rather than in a list somewhere else, because it is a fact
   * about the row and the two would drift apart the first time anyone added a
   * severity.
   */
  fatal: boolean
}

/**
 * The dungeon master's own table, the way `DC_TABLE` is.
 *
 * **The examples are the whole safety mechanism here, and they are the reason
 * this table has prose in it at all.** The risk it exists to manage is precise:
 * a model assigning `lethal` to something the fiction never signalled was
 * lethal. The player writes "I climb down into the ravine", the DM reaches for
 * the most dramatic row, and a character forty turns old is gone over a sentence
 * that read like ordinary movement. No amount of clamping downstream fixes that,
 * because by then the severity has already been chosen.
 *
 * So each row is anchored the way `DC_TABLE` anchors difficulty — with things a
 * reader can picture — and the `lethal` row carries its own guard in its text.
 * A row the model has to match against a concrete example is a row it reaches
 * for less freely than one labelled only "lethal".
 */
export const DAMAGE_TABLE: readonly DamageRow[] = [
  {
    severity: 'bruising',
    label: 'bruising',
    example:
      'a bad landing, a thrown fist, a door caught on the way through — it hurts and they will feel it tomorrow',
    fatal: false,
  },
  {
    severity: 'bloody',
    label: 'bloody',
    example:
      'a knife that got through, a fall down a short flight of stairs, a dog that meant it — real injury, nothing that ends anyone today',
    fatal: true,
  },
  {
    severity: 'grievous',
    label: 'grievous',
    example:
      'a spear, a fall from a roof, fire they had to walk through — the kind of wound the rest of the scene is spent dealing with',
    fatal: true,
  },
  {
    severity: 'lethal',
    label: 'lethal',
    example:
      'the scene already told them this could kill them: the ravine, the flooded shaft, the thing in the dark that has killed someone before. If the player could not have known, this is not the row.',
    fatal: true,
  },
]

/** The row for a severity, for anything rendering the table or one line of it. */
export function damageRow(severity: Severity): DamageRow {
  return DAMAGE_TABLE.find(row => row.severity === severity) ?? DAMAGE_TABLE[0]
}

/** A severity read off a model's tool call. Anything unrecognised is the mildest. */
export function validateSeverity(value: unknown): Severity {
  return oneOf(value, SEVERITY_ORDER, 'bruising')
}

// ------------------------------------------------------------- the danger dial

/**
 * How lethal this player wants their world to be.
 *
 * Same fiction, different arithmetic. It is a parameter to `damageFor` rather
 * than anything ambient, so the mapping stays a pure function of things that
 * were written down — and so this file could land before the dial that sets it
 * (#3777) exists.
 *
 * It governs lethality and nothing else. It is emphatically **not** a content
 * setting: the all-ages line in the turn prompt is a baseline constraint of this
 * app and is not on a slider.
 */
export type Danger = 'gentle' | 'ordinary' | 'perilous'

export const DANGER_ORDER: readonly Danger[] = ['gentle', 'ordinary', 'perilous']

/** What `damageFor` was tuned against, and what a campaign with no dial reads as. */
export const DEFAULT_DANGER: Danger = 'ordinary'

export function validateDanger(value: unknown): Danger {
  return oneOf(value, DANGER_ORDER, DEFAULT_DANGER)
}

// ---------------------------------------------------------------- the mapping

/** The half of the band union that can cost anything. */
type FailureBand = Extract<OutcomeBand, 'failure' | 'strong-failure' | 'critical-failure'>

const FAILURE_BANDS: readonly FailureBand[] = ['failure', 'strong-failure', 'critical-failure']

function isFailureBand(band: OutcomeBand): band is FailureBand {
  return (FAILURE_BANDS as readonly OutcomeBand[]).includes(band)
}

/**
 * Steps down the track, by severity and by how badly the check went.
 *
 * Written out in full rather than derived from a base row plus a shift, because
 * these thirty-six numbers *are* the design and a formula would hide which of
 * them were chosen and which fell out. The properties they have to hold — worse
 * band costs at least as much, worse severity costs at least as much, higher
 * danger costs at least as much — are asserted exhaustively in the tests rather
 * than guaranteed by construction, so a typo here fails a run instead of quietly
 * making `grievous` cheaper than `bloody`.
 *
 * Two numbers in the table are worth pointing at:
 *
 * `lethal` on a `critical-failure` is the full length of the track — a healthy
 * character dies. That is intended and it is the point of the row. It needs two
 * things to line up at once: a scene the fiction already flagged as deadly, and
 * a natural 1. Making it survivable would mean nothing in this game can ever
 * kill you on the day it happens, which is a different game.
 *
 * `bruising` on an ordinary `failure` costs nothing at all. Most failed checks
 * are not injuries, and a track that ticked on every miss would walk a talkative
 * character to death through a series of arguments.
 */
const STEPS: Record<Danger, Record<Severity, Record<FailureBand, number>>> = {
  gentle: {
    bruising: { failure: 0, 'strong-failure': 0, 'critical-failure': 1 },
    bloody: { failure: 0, 'strong-failure': 1, 'critical-failure': 1 },
    grievous: { failure: 1, 'strong-failure': 1, 'critical-failure': 2 },
    lethal: { failure: 1, 'strong-failure': 2, 'critical-failure': 4 },
  },
  ordinary: {
    bruising: { failure: 0, 'strong-failure': 1, 'critical-failure': 1 },
    bloody: { failure: 1, 'strong-failure': 1, 'critical-failure': 2 },
    grievous: { failure: 1, 'strong-failure': 2, 'critical-failure': 3 },
    lethal: { failure: 2, 'strong-failure': 3, 'critical-failure': TRACK_LENGTH },
  },
  perilous: {
    bruising: { failure: 0, 'strong-failure': 1, 'critical-failure': 2 },
    bloody: { failure: 1, 'strong-failure': 2, 'critical-failure': 3 },
    grievous: { failure: 2, 'strong-failure': 3, 'critical-failure': 4 },
    lethal: { failure: 3, 'strong-failure': 4, 'critical-failure': TRACK_LENGTH },
  },
}

/**
 * How many rungs a blow costs.
 *
 * **A success costs nothing, at every severity.** The check was made; the thing
 * the severity described did not happen to them. Charging for a success would
 * punish people for winning and would make the safest play refusing to roll,
 * which is the opposite of what the game is asking for.
 */
export function damageFor(
  severity: Severity,
  band: OutcomeBand,
  danger: Danger = DEFAULT_DANGER
): number {
  if (!isFailureBand(band)) return 0
  return STEPS[danger][severity][band]
}

// ------------------------------------------------------------ moving the track

/**
 * What happened to a body, in the shape the DM has to be told it.
 *
 * `from` and `to` are both here because "what is wrong with you" and "what just
 * changed" are different sentences, and a model given only the destination
 * narrates the state rather than the moment. `steps` is the count *after* the
 * floor below, so it is what actually happened rather than what the table asked
 * for — the DM being told a wound cost three rungs when it cost one is exactly
 * the kind of quiet disagreement between prose and sheet this codebase keeps
 * running into.
 */
export interface BodyChange {
  body: Body
  from: Condition
  to: Condition
  /** Rungs actually descended. Zero when the blow did nothing. */
  steps: number
  /** True only on the step that ends the run. */
  died: boolean
}

/**
 * Walk a body down the track.
 *
 * `fatal` is whether this particular source of damage is allowed to take the
 * last step. It is not a safety valve bolted on afterwards — it is what makes
 * `bruising` mean something. A row that can kill from any rung is just a smaller
 * `lethal`, and without this a character on `dying` could be finished by a
 * scraped elbow, which reads as an accident rather than an ending.
 *
 * A non-fatal blow floors at `dying` instead. That leaves `dying` genuinely
 * dangerous — anything the fiction called a real injury still finishes it — while
 * keeping the last step something the story had to earn.
 *
 * Healing, when it arrives, is this function with the sign flipped and one extra
 * rule: `dead` does not move. It is deliberately not here. How a character gets
 * better — rest, a check, time off the clock, an item — is a real design question
 * and answering it badly makes the whole track meaningless, so it gets its own
 * decision once death has actually been played.
 */
export function worsen(condition: Condition, steps: number, fatal: boolean): Condition {
  if (steps <= 0) return condition
  if (condition === 'dead') return 'dead'

  const ceiling = fatal ? TRACK_LENGTH : TRACK_LENGTH - 1
  const next = Math.min(ceiling, conditionIndex(condition) + Math.round(steps))
  // A non-fatal blow that lands on someone already past its ceiling leaves them
  // where they are rather than pulling them back up the track.
  return CONDITION_ORDER[Math.max(conditionIndex(condition), next)]
}

/**
 * The band an uncontested harm is resolved at, and why it is the mildest one.
 *
 * `damageFor` is written against outcome bands, and some damage has no die
 * behind it at all — a fuse fires, an ambush starts, a fever that was applied
 * five turns ago finally does what it said it would. None of those are a check
 * the player lost, so one of the six bands has to stand in for "no check
 * happened".
 *
 * It is `failure`, the mildest band that costs anything, and the choice is a
 * safety property rather than a taste. `harm` is *easier to reach for* than
 * `roll_check` — no DC, no attribute, no clause about what could go wrong — and
 * the failure mode of the whole tool is a dungeon master that drifts toward it
 * because it is simpler, draining a character without ever throwing a die.
 * Pinning it to the cheapest row means the shortcut is also the weakest move on
 * the board: a real failed check is always at least as bad as an uncontested
 * harm at the same severity, so nothing is ever gained by skipping the roll.
 *
 * It buys one more guarantee for free. At `failure`, the worst row at the worst
 * danger setting is three steps, and the track is six — so **harm can never
 * kill a healthy character**, whatever the DM names. Something has to have hurt
 * them first, which means a die was thrown somewhere along the way.
 */
export const UNCONTESTED_BAND: OutcomeBand = 'failure'

/**
 * Damage with nothing rolled against it.
 *
 * A separate export rather than making callers remember to pass
 * `UNCONTESTED_BAND` themselves, for the same reason `applyDamage` exists
 * beside `damageFor` and `worsen`: the interesting rule is in the argument, and
 * an argument a caller assembles by hand is an argument a caller gets wrong.
 */
export function applyHarm(
  body: Body,
  severity: Severity,
  danger: Danger = DEFAULT_DANGER
): BodyChange {
  return applyDamage(body, severity, UNCONTESTED_BAND, danger)
}

/**
 * The whole of taking a hit: table, floor, and the record of what moved.
 *
 * This is the function routes and tools should call. `damageFor` and `worsen`
 * are exported beside it because they are separately testable and separately
 * meaningful, not because anything upstream should be assembling them by hand —
 * a caller that forgets to pass `fatal` from the row has silently deleted the
 * rule that `bruising` cannot kill.
 */
export function applyDamage(
  body: Body,
  severity: Severity,
  band: OutcomeBand,
  danger: Danger = DEFAULT_DANGER
): BodyChange {
  const from = body.condition
  const to = worsen(from, damageFor(severity, band, danger), damageRow(severity).fatal)

  return {
    body: to === from ? body : { ...body, condition: to },
    from,
    to,
    steps: conditionIndex(to) - conditionIndex(from),
    died: to === 'dead' && from !== 'dead',
  }
}
