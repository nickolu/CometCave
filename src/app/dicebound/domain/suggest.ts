/**
 * The three lines offered beside the composer, cleaned.
 *
 * A suggestion is not a mechanic. It never touches the dice, it is never
 * stored, and the campaign does not know it existed — the whole feature is a
 * string that lands in the text field for the player to edit or ignore. So the
 * only domain rule here is what makes a *usable* string, and it lives apart
 * from the route because that is the half worth testing.
 *
 * What this deliberately does not do is police voice. The prompt asks for first
 * person and an attempt rather than an outcome, and a line that comes back in
 * the wrong register is a prompt to fix, not a line to drop: dropping it leaves
 * the player with two chips and no idea why.
 */

/** How many are offered. Three fits one row on a phone and reads as a choice rather than a menu. */
export const SUGGESTION_COUNT = 3

/**
 * The longest a chip may be.
 *
 * Not a style rule — the prompt asks for about a dozen words and mostly gets
 * them. This is the guard against a model that answers with a paragraph, which
 * on a phone would push the composer off the screen.
 */
export const MAX_SUGGESTION = 120

/** Leading list furniture a model adds when it thinks it is writing a list. */
const FURNITURE = /^\s*(?:[-*•]|\d+[.)])\s*/

/** Matched pairs of quotes around the whole line, which come back often enough to be worth stripping. */
const WRAPPED = /^(["'“”‘’])(.*)\1$/

function tidy(value: unknown): string {
  if (typeof value !== 'string') return ''

  const flat = value.replace(FURNITURE, '').replace(/\s+/g, ' ').trim()
  const unwrapped = WRAPPED.exec(flat)?.[2]?.trim() ?? flat

  if (unwrapped.length <= MAX_SUGGESTION) return unwrapped

  // Cut back to a word boundary. A chip that ends mid-word reads as a bug,
  // and this string is about to be dropped into a field the player edits —
  // half a word is a worse starting point than a slightly shorter sentence.
  const cut = unwrapped.slice(0, MAX_SUGGESTION)
  const space = cut.lastIndexOf(' ')
  return (space > MAX_SUGGESTION / 2 ? cut.slice(0, space) : cut).trim()
}

/**
 * Whatever the model sent, turned into at most three offerable lines.
 *
 * Deduplication is case-insensitive and it matters more than it looks. The one
 * thing this feature must not do is offer the same move three times: three
 * chips that all say the obvious thing is worse than no chips, because it tells
 * the player the scene has one exit.
 */
export function cleanSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const out: string[] = []

  for (const entry of value) {
    const line = tidy(entry)
    if (!line) continue

    const key = line.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    out.push(line)
    if (out.length === SUGGESTION_COUNT) break
  }

  return out
}
