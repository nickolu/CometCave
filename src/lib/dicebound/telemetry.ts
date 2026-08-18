/**
 * A seam for measuring what the dungeon master actually does.
 *
 * Two of the numbers phase 3 most needs — how often a check carries a severity
 * at all, and how often the DM reaches for `harm` instead of the die — are
 * choices the model makes inside a single turn, and neither survives into the
 * campaign. `CheckEntry` stores the band and the modifiers because the die card
 * re-renders from them; it has never stored what the DM said was *at stake*,
 * and a `harm` call leaves no entry behind at all. From outside the route the
 * only visible evidence is the body moving, which conflates "the DM never
 * called for anything dangerous" with "it did and the player kept passing".
 *
 * The obvious fix is to widen `CheckEntry` and give `harm` a transcript entry.
 * That was rejected, and the reason is worth keeping: **a measurement should
 * not change the thing it measures.** Fields added to `Campaign` for a script's
 * benefit are fields in every player's save, behind a version bump, migrated
 * forever, to serve a harness that runs a handful of times a month. This is
 * thirty lines and no stored bytes.
 *
 * Off by default and free when off — `recorder` is null in production and the
 * two call sites in `turn/route.ts` are a null check each. It is deliberately
 * not a general event bus: one narrow shape, two callers, no buffering, no
 * ordering guarantees beyond the order the route calls it in.
 *
 * Module-global rather than threaded through the route, because threading it
 * would mean a parameter on `playTurn`, `rollFor` and `harmFor` that exists for
 * no reason a reader of those functions could see. The cost is that it is not
 * safe across concurrent campaigns in one process; the harness plays one
 * campaign at a time, and production never turns it on.
 */
import type { Condition, Severity } from '@/app/dicebound/domain/body'
import type { OutcomeBand } from '@/app/dicebound/domain/dice'

/** One moment where the game decided what something cost. */
export interface DamageEvent {
  /** Which tool the DM reached for. This is the ratio the epic cares about. */
  tool: 'roll_check' | 'harm'
  /**
   * The row the DM named, or null on a check it did not flag as dangerous.
   *
   * Null is the *interesting* value here and the reason this is not simply
   * omitted: "most checks are not dangerous" is a claim in the prompt, and it
   * can only be checked against the checks that carried nothing.
   */
  severity: Severity | null
  /** Absent on `harm`, which has no die. */
  band: OutcomeBand | null
  from: Condition
  to: Condition
  steps: number
  /** False when a second `harm` in one turn was refused. */
  applied: boolean
}

export type DamageRecorder = (event: DamageEvent) => void

let recorder: DamageRecorder | null = null

/**
 * Start recording. Returns the function that stops it.
 *
 * A returned stopper rather than a matching `clear()` so a harness cannot leave
 * it on for the next thing that runs in the same process.
 */
export function recordDamage(next: DamageRecorder): () => void {
  recorder = next
  return () => {
    recorder = null
  }
}

/** Called by the turn route. A no-op unless a harness is listening. */
export function noteDamage(event: DamageEvent): void {
  recorder?.(event)
}
