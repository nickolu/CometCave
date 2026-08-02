/**
 * Shared formatting for record read-outs.
 *
 * Lives outside the components because the same duration is spoken three times
 * — in a notice, in the inspector, in the field guide — and they have to agree.
 */

/**
 * Durations as a person would say them: "48s", "3m 12s", "1h 04m".
 *
 * Seconds are dropped above an hour, kept everywhere below it. A creature that
 * lived four minutes and two seconds beat one that lived four minutes flat, and
 * rounding that away would hide the thing the record is about.
 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes < 60) return `${minutes}m ${String(rest).padStart(2, '0')}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
}
