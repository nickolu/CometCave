/**
 * Status afflictions — timed conditions that wrong the player.
 *
 * Statuses are the DM's own words for what is happening to a character right
 * now: "toad venom sickness", "arrow-grazed shoulder", "rattled from the
 * fall". They live until the clock passes their `until`, and they are
 * afflictions only — no blessings, no boons.
 *
 * That constraint is deliberate. A model biased toward helping will eventually
 * write `effect: "you are unusually lucky"`. It cannot touch the die directly
 * (effect is a string, there is no numeric field), but it goes into the prompt.
 * Constraining to things wrong with you means an invented status can only ever
 * cost the player something. Enforced in the prompt and tool description — a
 * string field cannot be type-checked for tone.
 *
 * Timed afflictions are statuses; open-ended ones are threads. ThreadEntity
 * already handles expiry with fuses, so an NPC who hates you for a season is
 * a thread, not a status.
 *
 * Pure, like everything else in `domain/`. No `Math.random`, no `Date.now`,
 * no `new Date()`. All time arrives as an argument.
 */
import { int, isPlainObject, slug, str } from '@/app/dicebound/domain/validate'
import { MAX_TURN_MINUTES } from '@/app/dicebound/domain/world'

export interface Status {
  /** Slug of `name`. The key. */
  id: string
  /** The DM's own words: 'toad venom sickness', not 'poisoned'. */
  name: string
  /** What it does to you, in prose. Never a number. */
  effect: string
  /** Clock minute this expires at. Stamped by the server from `expires`. */
  until: number
}

/** Cap on live statuses at once. */
export const MAX_STATUSES = 5

/**
 * The longest a status may run.
 *
 * Same as MAX_TURN_MINUTES from world.ts — one week of fiction. A status
 * that outlives this becomes a thread instead, because what it represents is
 * an ongoing situation the story has to decide what to do with, not a
 * ticking clock.
 */
export const MAX_STATUS_DURATION = MAX_TURN_MINUTES

// ------------------------------------------------------------------ applying

/**
 * Apply a status to the list.
 *
 * Rules (see issue #3774):
 * 1. id = slug(name). A name that slugs to nothing is dropped.
 * 2. If same id already exists: refresh (update until), leave rest unchanged.
 * 3. Duration is clamped to MAX_STATUS_DURATION.
 * 4. until = now + clampedDuration.
 * 5. If adding past MAX_STATUSES cap: drop the one expiring soonest.
 *    Reason: soonest-expiring is the least valuable to keep; it is almost gone
 *    anyway. The player still accumulates new afflictions naturally without
 *    getting stuck behind an artificial refusal.
 */
export function applyStatus(
  statuses: readonly Status[],
  name: string,
  effect: string,
  durationMinutes: number,
  now: number,
): readonly Status[] {
  const id = slug(name, 60)
  // A name that slugs to nothing cannot be keyed, referenced, or displayed.
  // Drop it rather than adding a status nobody can identify.
  if (!id) return statuses

  const clampedDuration = Math.min(Math.max(0, durationMinutes), MAX_STATUS_DURATION)
  const until = now + clampedDuration

  // Rule 2: refresh an existing status with the same id.
  const existingIndex = statuses.findIndex(s => s.id === id)
  if (existingIndex !== -1) {
    const refreshed = statuses.map((s, i) => (i === existingIndex ? { ...s, until } : s))
    return refreshed
  }

  const incoming: Status = { id, name, effect, until }

  // Rule 5: if at cap, drop the one expiring soonest to make room.
  if (statuses.length >= MAX_STATUSES) {
    let soonestIndex = 0
    for (let i = 1; i < statuses.length; i++) {
      if (statuses[i].until < statuses[soonestIndex].until) soonestIndex = i
    }
    const pruned = statuses.filter((_, i) => i !== soonestIndex)
    return [...pruned, incoming]
  }

  return [...statuses, incoming]
}

// ------------------------------------------------------------------ expiring

/**
 * Remove statuses whose until has been reached or passed.
 *
 * Pure — takes the clock minute. Called wherever the clock advances.
 * Including the case where one turn skips the entire span.
 */
export function expire(statuses: readonly Status[], now: number): readonly Status[] {
  return statuses.filter(s => s.until > now)
}

// ---------------------------------------------------------------- validation

/**
 * Read a statuses list off the wire.
 *
 * Never throws and repairs rather than refuses — an unreadable status list
 * is an empty one. Each entry is validated individually; bad entries are
 * dropped rather than failing the whole list.
 *
 * Note: Statuses are afflictions only. No blessings, no boons. A model
 * biased toward helping will eventually write effect: "you are unusually
 * lucky". It cannot touch the die directly (effect is a string, there is no
 * numeric field), but it goes into the prompt. Constraining to things wrong
 * with you means an invented status can only ever cost the player something.
 * Enforced in the prompt and tool description — a string field cannot be
 * type-checked for tone. Timed afflictions are statuses; open-ended ones are
 * threads (ThreadEntity already handles expiry with fuses).
 */
export function validateStatuses(value: unknown): readonly Status[] {
  if (!Array.isArray(value)) return []

  const validated: Status[] = []
  for (const element of value) {
    if (!isPlainObject(element)) continue

    // id is derived from id or name, slugged to 60 chars.
    const id = slug(element.id ?? element.name, 60)
    if (!id) continue

    const name = str(element.name, 120)
    const effect = str(element.effect, 600)
    const until = int(element.until)

    validated.push({ id, name, effect, until })

    // Cap the validated list at MAX_STATUSES — keep first valid ones.
    if (validated.length >= MAX_STATUSES) break
  }

  return validated
}
