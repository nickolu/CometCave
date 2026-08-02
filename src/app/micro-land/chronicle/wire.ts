/**
 * The chronicle on the wire.
 *
 * One definition of "what a chronicle looks like when it isn't in memory",
 * shared by the client backend that sends it and the route that stores it. The
 * server has to treat every byte as hostile — the payload is arbitrary JSON from
 * a browser — and the client has to keep itself under the size the server will
 * accept, so both ends need the same rules and neither should own them alone.
 *
 * Nothing here reaches into Firestore or `fetch`. It is pure enough to test,
 * which is the point: the interesting failures are all shape and size, and both
 * are much easier to get wrong than the transport around them.
 */
import { CHRONICLE_VERSION, type ChronicleData, emptyChronicle } from './types'

/**
 * The most a stored chronicle is allowed to weigh, in bytes of JSON.
 *
 * A Firestore field value caps at 1 MiB minus change. The headroom below that
 * is deliberate and generous: the same document carries a few small scalar
 * fields, and a chronicle that fails to write is one that silently stops
 * recording, which the player would only discover much later.
 *
 * For scale — the archive holds at most 80 summoned species (see
 * `MAX_ARCHIVED_SUMMONED`), and a big one runs a few kilobytes of pixel art. A
 * full archive lands around a third of this.
 */
export const MAX_CHRONICLE_BYTES = 700_000

/**
 * JSON byte length, which is what the limit is actually about.
 *
 * `TextEncoder` rather than `Buffer.byteLength`, because this module is imported
 * by the browser backend as well as the route and `Buffer` is not a thing there.
 * Length in characters would not do either — a creature named with an emoji, or
 * any of the accented names this game happily accepts, counts for more bytes
 * than characters, and the limit being defended is a byte limit.
 */
const encoder = new TextEncoder()

export function chronicleBytes(data: ChronicleData): number {
  return encoder.encode(JSON.stringify(data)).length
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Coerce untrusted input into a chronicle, or refuse it.
 *
 * Returns null rather than throwing, and rather than repairing: a payload this
 * far off shape is a bug or an attack, not a chronicle to be salvaged, and the
 * caller's fallback — "this player has no records yet" — is already correct for
 * both. Note the deliberate asymmetry with `migrate` in `chronicle.ts`, which
 * *does* repair: that one is reading our own storage, this one is reading a POST
 * body.
 *
 * The three collections are checked for shape but not for content. Their values
 * are game records that the player's own client wrote and only that player will
 * ever read back, so validating every field would be a large amount of code
 * defending a document against its only reader.
 */
export function validateChronicle(value: unknown): ChronicleData | null {
  if (!isPlainObject(value)) return null
  if (value.version !== CHRONICLE_VERSION) return null

  const { lands, species, milestones } = value
  if (!isPlainObject(lands) || !isPlainObject(species) || !isPlainObject(milestones)) {
    return null
  }

  return {
    version: CHRONICLE_VERSION,
    lands: lands as ChronicleData['lands'],
    species: species as ChronicleData['species'],
    milestones: milestones as ChronicleData['milestones'],
  }
}

/** Parse and validate in one step, for reading a stored JSON string back. */
export function decodeChronicle(raw: unknown): ChronicleData | null {
  if (typeof raw !== 'string') return null
  try {
    return validateChronicle(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * Shed archived species until the chronicle fits, oldest sighting first.
 *
 * The archive is already capped at 80 summoned species, so this should never
 * fire — it exists because "should never" and "cannot" are different, and the
 * failure it guards against is a write the server rejects, which stops the
 * chronicle recording anything at all. Losing the least recently seen creature
 * is a far better outcome than losing every future record.
 *
 * Built-in species are dropped only once no summoned one is left, since a
 * built-in can always be recovered by playing whereas a summoned one cannot.
 * Land records and milestones are never touched: they are small, and they are
 * the part of the chronicle the player actually earned.
 */
export function fitChronicle(data: ChronicleData): ChronicleData {
  if (chronicleBytes(data) <= MAX_CHRONICLE_BYTES) return data

  const trimmed: ChronicleData = {
    version: data.version,
    lands: data.lands,
    species: { ...data.species },
    milestones: data.milestones,
  }

  const order = Object.values(trimmed.species).sort((a, b) => {
    // Summoned creatures are the ones worth keeping, so they leave last.
    if (a.blueprint.summoned !== b.blueprint.summoned) {
      return a.blueprint.summoned ? 1 : -1
    }
    return a.lastSeen - b.lastSeen
  })

  for (const record of order) {
    if (chronicleBytes(trimmed) <= MAX_CHRONICLE_BYTES) break
    delete trimmed.species[record.blueprint.id]
  }

  // Even an empty archive can overflow if `lands` has been tampered with. The
  // caller gets something storable rather than something rejected.
  return chronicleBytes(trimmed) <= MAX_CHRONICLE_BYTES ? trimmed : emptyChronicle()
}
