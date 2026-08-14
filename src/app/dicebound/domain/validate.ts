/**
 * Coercion primitives for reading untrusted saves.
 *
 * Everything in `domain/` that parses stored or wire data uses these rather
 * than its own copy, because the rule they encode has to be the same
 * everywhere: **never throw, always return something the renderer can draw.**
 *
 * A campaign that fails to parse is a player who opens the cave and finds their
 * story gone. So a bad field becomes a default, a bad entry is dropped, and only
 * a campaign missing something genuinely load-bearing — a character, a
 * recognisable version — is refused outright.
 */

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function str(value: unknown, max: number, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback
}

export function int(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** An integer read from untrusted data and forced into range. */
export function boundedInt(value: unknown, min: number, max: number, fallback = 0): number {
  return clamp(int(value, fallback), min, max)
}

export function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** One of a fixed set of string literals, or the fallback. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

/**
 * A stable, safe id from arbitrary text.
 *
 * Entity ids are written by a model and then used as edge endpoints and as
 * object keys, so they are normalised once on the way in. Anything that
 * normalises to nothing is rejected by the caller rather than silently given a
 * generated id — an entity nobody can name is an entity no edge can point at.
 */
export function slug(value: unknown, max = 60): string {
  if (typeof value !== 'string') return ''
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
}
