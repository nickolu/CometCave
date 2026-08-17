/**
 * The blueprint contract.
 *
 * This file is the seam between "an LLM invented a creature" and "the world can
 * safely run it". The zod schema doubles as the tool-call schema handed to the
 * model — the `.describe()` calls are the model's only instructions about what
 * each field means, so they're written for the model to read.
 *
 * Everything that comes back gets pushed through `sanitizeBlueprint`, which
 * assumes the input is hostile: wrong types, absurd numbers, ragged pixel rows,
 * colors that aren't colors, 400 animation frames. The world only ever sees the
 * sanitized result.
 */
import { z } from 'zod'

import { BASE_MATERIAL_IDS, MATERIAL_IDS } from './config/materials'
import { TerrainSchema } from './terrain'

import type { BiomeZoneType, CreatureAura, CreatureBlueprint, LifeKind, LocomotionKind, MaterialId } from './types'

export const ART_MIN = 3
/**
 * Sprite bounds, in world tiles.
 *
 * Wider than tall, because the things that want to be big are long: dragons,
 * wyrms, whales, a tyrannosaur's tail. 28 is an eighth of the world's width,
 * which is the point at which a creature reads as a landmark rather than an
 * animal — go much past that and it can only exist in open sky.
 *
 * These were one shared 14 for a long time, and 14 is small enough that the
 * model would draw a leviathan at exactly the same scale as a beetle.
 */
export const ART_MAX_W = 28
export const ART_MAX_H = 24
export const MAX_FRAMES = 4
/** A 28x24 monster has room for shading a 6x6 bug never did. */
export const MAX_PALETTE = 12

/**
 * Size of a creature's *solid core*, beyond which the sprite stops counting as
 * a wall.
 *
 * A creature collides with its whole drawing, which is correct right up until
 * the drawing is mostly wings. A 28-wide dragon would need a 28-wide gap to
 * walk through and would wedge in the first cave it tried to enter — so past
 * this threshold, extra sprite is only 40% solid. Wingtips, tails and long
 * necks pass through rock; the body itself still doesn't.
 *
 * Set deliberately above the largest built-in creature (Grumblestone, 10x7) so
 * every creature that existed before this rule behaves exactly as it did.
 */
const CORE_W = 12
const CORE_H = 10
const CORE_SLOPE = 0.4

/**
 * Only the base materials are offered to the model.
 *
 * The tints ('plastic-red', 'crystal-blue' …) are a painting affordance, not
 * vocabulary — putting all of them in the enum would quadruple the schema and
 * invite a creature that digs through mauve plastic but not blue. Tints are
 * still *accepted* by the sanitizer, since they're perfectly valid materials.
 */
const materialEnum = z.enum([...BASE_MATERIAL_IDS] as [MaterialId, ...MaterialId[]])

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #ff8800')

export const BlueprintSchema = z.object({
  name: z.string().describe('Short display name, 1-3 words. Title Case. No emoji.'),
  blurb: z
    .string()
    .describe('One short sentence describing the creature, written for a curious kid. No emoji.'),
  size: z
    .number()
    .describe(
      'Relative size from 1 to 6. 1 = mite or seed, 2 = bug, 3 = cat-sized, 4 = wolf-sized, 5 = bear-sized, 6 = leviathan. Nothing can eat something LARGER than itself, so size is what sets its place in the food chain.'
    ),
  tags: z
    .array(z.string())
    .describe(
      'What this creature IS — other creatures hunt it by matching these. Always include exactly one of "plant", "meat", or "mineral". Then add 1-3 flavour tags like "bug", "fish", "bird", "glow", "fungus", "metal". Lowercase single words.'
    ),
  art: z
    .object({
      palette: z
        .record(z.string(), hexColor)
        .describe(
          'Map of SINGLE characters to hex colors, e.g. {"b":"#33dd88","e":"#ffffff"}. Max 10 entries. Never define "." — it is always transparent.'
        ),
      frames: z
        .array(z.array(z.string()))
        .describe(
          'Animation frames. Each frame is an array of equal-length row strings; each character is a palette key or "." for transparent. At least 3 wide and tall, at most 28 wide and 24 tall. SCALE THE DRAWING TO THE "size" FIELD: size 1 is 3-5 wide, size 3 about 9, size 6 is 20-28 wide. A size 6 dragon drawn 9 wide looks like an insect. Give 2 frames so it animates — make frame 2 a small change (a step, a blink, a wing beat), not a completely different drawing. Draw the creature FACING RIGHT.'
        ),
      frameMs: z.number().describe('Milliseconds each frame is shown. 90-400. Faster = twitchier.'),
      faceMotion: z
        .boolean()
        .describe(
          'True if the sprite should flip horizontally when moving left. True for anything with a clear front (animals). False for blobs, orbs and plants.'
        ),
    })
    .describe('How the creature looks and animates, as pixel art.'),
  body: z
    .object({
      mass: z.number().describe('Gravity multiplier. 0.2 = feather, 1 = normal, 3 = boulder.'),
      bounce: z.number().describe('Bounciness on impact, 0 = thud, 0.8 = rubber ball.'),
      drag: z.number().describe('Fraction of speed kept each second, 0.05-0.99. Low = sluggish.'),
      buoyancy: z.number().describe('Above 1 floats in water, below 1 sinks. 1 = neutral.'),
      immuneTo: z
        .array(materialEnum)
        .describe(
          'Materials that cannot hurt it. Use ["lava"] for fire creatures, [] for most things.'
        ),
    })
    .describe('Physical properties.'),
  move: z
    .object({
      kind: z
        .enum(['walk', 'fly', 'swim', 'crawl', 'drift', 'root'])
        .describe(
          'walk = ground animal that can jump. fly = free movement through air. swim = only moves in water, helpless on land. crawl = clings to walls and ceilings. drift = floats and bobs. root = never moves (plants, coral, eggs, mushrooms).'
        ),
      speed: z.number().describe('Top speed in tiles per second, 0.5-14.'),
      jump: z
        .number()
        .describe(
          'Jump strength for walkers, 0-20. Roughly a third of a tile of height per point, so 3 barely clears a kerb, 6 clears a boulder, 12 is a spring-loaded leap over a wall. Ignored otherwise.'
        ),
      hop: z
        .number()
        .describe(
          'How much of a walking creature travels by jumping, 0-1. 0 = runs along the ground, 0.3 = a frog that pauses between leaps, 1 = a grasshopper that bounces constantly. Use it for anything springy — frogs, fleas, rabbits, kangaroos, bouncing blobs. Ignored by everything that is not a walker.'
        ),
      restlessness: z
        .number()
        .describe('Chance per second of changing idle direction, 0-1. 0.2 is calm.'),
    })
    .describe('How it moves.'),
  diet: z
    .object({
      eats: z
        .array(z.string())
        .describe(
          'Tags it can eat. ["plant"] = herbivore, ["meat"] = predator, ["plant","meat"] = omnivore, [] = eats nothing and never gets hungry (use for plants and minerals). It can only eat creatures its own size or smaller.'
        ),
      fears: z
        .array(z.string())
        .describe(
          'Extra tags to run away from, beyond the creatures that naturally hunt it. Usually [].'
        ),
      hungerRate: z
        .number()
        .describe('How fast it gets hungry, 0-0.2 per second. 0.03 is typical.'),
      starveSeconds: z.number().describe('How long it survives once starving, 5-120 seconds.'),
      breedAt: z
        .number()
        .describe('How full it must be to reproduce, 0-1. Around 0.75 is typical.'),
      lifespanSeconds: z.number().describe('Dies of old age after this long, 20-900 seconds.'),
    })
    .describe('Hunger, hunting and reproduction — this is what drives the food chain.'),
  senses: z
    .object({
      sight: z.number().describe('How far it spots food and danger, in tiles. 4-50.'),
    })
    .describe('Perception.'),
  habitat: z
    .object({
      needs: z
        .array(materialEnum)
        .nullable()
        .describe(
          'If set, it is hurt anywhere it is NOT touching one of these. Use ["water"] for a fish. Use null for creatures that live anywhere.'
        ),
      drowns: z
        .boolean()
        .describe('True if being underwater kills it. False for fish and amphibians.'),
    })
    .describe('Where it can survive.'),
  death: z
    .object({
      becomes: materialEnum
        .nullable()
        .describe('Material left behind where it died, or null for nothing.'),
      particleColor: hexColor.describe('Color of the burst it leaves behind.'),
      particleCount: z.number().describe('How many particles, 0-30.'),
    })
    .describe('What happens when it dies.'),
  aura: z
    .object({
      radius: z.number().describe('How far the effect reaches, in tiles. 5-30.'),
      helps: z
        .array(z.string())
        .describe(
          'Tags of creatures that breed faster near this one. ["plant"] makes a pollinator. Use [] for no effect.'
        ),
      boost: z.number().describe('How much faster they breed, 1 to 4. 1 means no help.'),
      converts: z
        .object({
          from: materialEnum.describe('The material it changes.'),
          to: materialEnum.describe('What that material becomes.'),
        })
        .nullable()
        .describe(
          'Ground it slowly improves as it goes, e.g. {"from":"stone","to":"dirt"} for a worm that makes soil. Null for almost everything.'
        ),
      convertRate: z.number().describe('Tiles changed per second, 0.05-1. Keep it slow.'),
    })
    .nullable()
    .describe(
      'A special ability that changes the world around it — pollinating, or turning one material into another. Use null unless the description specifically calls for a helper creature; ordinary animals have no aura.'
    ),
  glow: z.number().describe('Light it casts into dark places, 0-1. 0 for most creatures.'),
})

export type RawBlueprint = z.infer<typeof BlueprintSchema>

export const SceneSchema = z.object({
  title: z.string().describe('A short evocative name for this scene, 2-5 words.'),
  terrain: TerrainSchema.describe(
    'The land this scene lives in. Build somewhere these particular creatures can actually survive: water if anything swims, open air if anything flies, and fertile ground (dirt, grass, sand, ash or wood) wherever plants need to root.'
  ),
  note: z
    .string()
    .describe(
      'One friendly sentence telling the player what to watch for, e.g. "The glimmer-moths keep the vines down — until the stalkers arrive."'
    ),
  creatures: z
    .array(
      BlueprintSchema.extend({
        count: z.number().describe('How many of this creature to place in the world, 1-40.'),
      })
    )
    .describe(
      'The creatures in this scene, 2-5 of them. Build a working food chain: include something that eats plants and something that eats the plant-eater, so the population can rise and fall on its own.'
    ),
})

export type RawScene = z.infer<typeof SceneSchema>

// ---------------------------------------------------------------------------
// Sanitizing
// ---------------------------------------------------------------------------

function clamp(n: unknown, lo: number, hi: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(hi, Math.max(lo, v))
}

function cleanColor(c: unknown, fallback: string): string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : fallback
}

function cleanTags(input: unknown, fallback: string[]): string[] {
  if (!Array.isArray(input)) return fallback
  const out = input
    .filter((t): t is string => typeof t === 'string')
    .map(t =>
      t
        .trim()
        .toLowerCase()
        .replace(/[^a-z-]/g, '')
    )
    .filter(t => t.length > 0 && t.length <= 16)
  return Array.from(new Set(out)).slice(0, 6)
}

function cleanMaterials(input: unknown): MaterialId[] {
  if (!Array.isArray(input)) return []
  const valid = new Set<string>(MATERIAL_IDS)
  return Array.from(
    new Set(input.filter((m): m is MaterialId => typeof m === 'string' && valid.has(m)))
  )
}

function cleanMaterial(input: unknown): MaterialId | null {
  if (typeof input !== 'string') return null
  return (MATERIAL_IDS as readonly string[]).includes(input) ? (input as MaterialId) : null
}

/**
 * An aura is optional and easy to get subtly wrong, so anything that doesn't
 * resolve to a real effect collapses back to null — a creature with a broken
 * aura is just a creature.
 */
function cleanAura(raw: unknown): CreatureAura | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>

  const helps = cleanTags(a.helps, [])
  const boost = clamp(a.boost, 1, 4, 1)

  let converts: CreatureAura['converts'] = null
  const rawConverts = a.converts
  if (rawConverts && typeof rawConverts === 'object') {
    const from = cleanMaterial((rawConverts as Record<string, unknown>).from)
    const to = cleanMaterial((rawConverts as Record<string, unknown>).to)
    // Converting air into rock would let a creature wall the world in, and
    // converting something into itself is a no-op that still costs a tile scan.
    if (from && to && from !== to && from !== 'air') converts = { from, to }
  }

  const doesSomething = (helps.length > 0 && boost > 1) || converts !== null
  if (!doesSomething) return null

  return {
    radius: clamp(a.radius, 2, 40, 12),
    helps,
    boost,
    converts,
    convertRate: clamp(a.convertRate, 0.01, 2, 0.2),
  }
}

/**
 * Coerce whatever the model drew into a rectangular, in-bounds sprite.
 *
 * Ragged rows are the single most common malformed output, so rows are padded
 * or cropped to a common width rather than rejected — a slightly-wrong creature
 * is much better than an error message. If nothing usable survives, the caller
 * gets a visible fallback blob instead of an invisible creature.
 */
/**
 * Unwrap a value the model handed back as a JSON string instead of an object.
 *
 * It does this occasionally on the deeply nested fields — `art` comes through as
 * `"{\"palette\":...}"` — and the difference is invisible until the creature
 * arrives as a featureless blob, because every field inside reads as missing and
 * quietly falls back. One `JSON.parse` is the whole fix.
 */
function unwrapJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text.startsWith('{') && !text.startsWith('[')) return value
  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

function sanitizeArt(raw: unknown, fallbackColor: string): CreatureBlueprint['art'] {
  const art = (unwrapJson(raw) ?? {}) as Record<string, unknown>

  // Palette: single-char keys → hex colors. '.' is reserved for transparent.
  const palette: Record<string, string> = {}
  const rawPalette = (unwrapJson(art.palette) ?? {}) as Record<string, unknown>
  if (rawPalette && typeof rawPalette === 'object') {
    for (const [key, value] of Object.entries(rawPalette)) {
      if (key.length !== 1 || key === '.') continue
      if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) continue
      palette[key] = value.toLowerCase()
      if (Object.keys(palette).length >= MAX_PALETTE) break
    }
  }
  if (Object.keys(palette).length === 0) palette.o = fallbackColor

  const known = new Set(Object.keys(palette))

  // Frames: drop anything non-string, normalize each row to the modal width.
  const unwrappedFrames = unwrapJson(art.frames)
  const rawFrames = Array.isArray(unwrappedFrames) ? unwrappedFrames : []
  let frames: string[][] = []
  for (const raw of rawFrames.slice(0, MAX_FRAMES)) {
    const frame = unwrapJson(raw)
    if (!Array.isArray(frame)) continue
    const rows = frame.filter((r): r is string => typeof r === 'string').slice(0, ART_MAX_H)
    if (rows.length === 0) continue
    frames.push(rows)
  }

  if (frames.length === 0) {
    // Nothing usable — a small blob so the creature is at least visible.
    const key = Object.keys(palette)[0]
    frames = [[`.${key}${key}.`, `${key}${key}${key}${key}`, `.${key}${key}.`]]
  }

  /**
   * Oversize art: slide the window onto where the drawing actually is.
   *
   * Rows wider than the cap used to be truncated with `row.slice(0, MAX)`,
   * keeping the leftmost columns. Creatures are drawn facing right, so on a
   * 44-wide dragon that throws away the head and keeps the tail — the one crop
   * guaranteed to destroy it. Trimming blank columns first usually gets it
   * under the cap on its own, since overshoot is mostly empty margin; if it is
   * still too wide the window centres on the ink instead of the origin.
   *
   * Only runs when the art is over the cap, so anything already in range keeps
   * its padding — and therefore its collision box — exactly as drawn.
   */
  const rawWidth = Math.max(...frames.map(f => Math.max(...f.map(r => r.length))))
  if (rawWidth > ART_MAX_W) {
    let first = Infinity
    let last = -1
    for (const rows of frames) {
      for (const row of rows) {
        for (let x = 0; x < row.length; x++) {
          if (row[x] === '.' || !known.has(row[x])) continue
          if (x < first) first = x
          if (x > last) last = x
        }
      }
    }
    if (last >= first) {
      const inkWidth = last - first + 1
      // Centre the window on the ink when even the trimmed drawing overflows.
      const start = inkWidth <= ART_MAX_W ? first : first + Math.floor((inkWidth - ART_MAX_W) / 2)
      frames = frames.map(rows => rows.map(row => row.slice(start, start + ART_MAX_W)))
    }
  }

  // Every frame must share one width and height, or animation would jitter.
  const width = clamp(
    Math.max(...frames.map(f => Math.max(...f.map(r => r.length)))),
    ART_MIN,
    ART_MAX_W,
    4
  )
  const height = clamp(Math.max(...frames.map(f => f.length)), ART_MIN, ART_MAX_H, 4)

  const normalized = frames.map(rows => {
    const out: string[] = []
    for (let y = 0; y < height; y++) {
      const row = rows[y] ?? ''
      let line = ''
      for (let x = 0; x < width; x++) {
        const ch = row[x] ?? '.'
        line += known.has(ch) ? ch : '.'
      }
      out.push(line)
    }
    return out
  })

  // An all-transparent sprite is an invisible creature — give it a body.
  const anyOpaque = normalized.some(f => f.some(r => /[^.]/.test(r)))
  if (!anyOpaque) {
    const key = Object.keys(palette)[0]
    const mid = Math.floor(height / 2)
    normalized[0][mid] = key.repeat(width)
  }

  return {
    palette,
    frames: normalized,
    frameMs: clamp(art.frameMs, 60, 1200, 200),
    faceMotion: art.faceMotion !== false,
  }
}

let summonCounter = 0

/**
 * Move the id counter past ids that already exist.
 *
 * Ids look like `summon:cinder-wyrm:3`, and the counter is module state that
 * resets with the page. That was harmless while summoned creatures evaporated
 * on refresh, but restoring them from the chronicle brings old ids back into a
 * world whose counter has restarted at zero — so the next creature summoned
 * would be handed `summon:cinder-wyrm:1` again and quietly replace the restored
 * one in `world.blueprints`, taking its art and its place in the food chain
 * with it.
 *
 * Only the trailing counter matters; the slug does not, because the counter is
 * global rather than per-name.
 */
export function reserveSummonIds(ids: string[]): void {
  for (const id of ids) {
    const n = Number(id.slice(id.lastIndexOf(':') + 1))
    if (Number.isFinite(n) && n > summonCounter) summonCounter = n
  }
}

/**
 * Turn arbitrary model output into a blueprint the world can run.
 * Never throws — every field falls back to something playable.
 */
export function sanitizeBlueprint(
  raw: unknown,
  opts: { idPrefix?: string; summoned?: boolean } = {}
): CreatureBlueprint {
  const b = (raw ?? {}) as Record<string, unknown>
  const body = (b.body ?? {}) as Record<string, unknown>
  const move = (b.move ?? {}) as Record<string, unknown>
  const diet = (b.diet ?? {}) as Record<string, unknown>
  const senses = (b.senses ?? {}) as Record<string, unknown>
  const phenology = (b.phenology ?? {}) as Record<string, unknown>
  const habitat = (b.habitat ?? {}) as Record<string, unknown>
  const death = (b.death ?? {}) as Record<string, unknown>

  const name =
    typeof b.name === 'string' && b.name.trim().length > 0 ? b.name.trim().slice(0, 32) : 'Whatsit'

  const prefix = opts.idPrefix ?? 'summon'
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const id = `${prefix}:${slug || 'creature'}:${++summonCounter}`

  const kindRaw = typeof move.kind === 'string' ? move.kind : 'walk'
  const kind = (['walk', 'fly', 'swim', 'crawl', 'drift', 'root'] as const).includes(
    kindRaw as never
  )
    ? (kindRaw as CreatureBlueprint['move']['kind'])
    : 'walk'

  const particleColor = cleanColor(death.particleColor, '#ffd166')
  const art = sanitizeArt(b.art, particleColor)

  // Keep exactly one "what am I made of" tag so the food chain always resolves.
  let tags = cleanTags(b.tags, ['meat'])
  if (!tags.some(t => t === 'plant' || t === 'meat' || t === 'mineral')) {
    tags = [kind === 'root' ? 'plant' : 'meat', ...tags].slice(0, 6)
  }

  const becomes = typeof death.becomes === 'string' ? death.becomes : null
  const validBecomes =
    becomes && (MATERIAL_IDS as readonly string[]).includes(becomes)
      ? (becomes as MaterialId)
      : null

  const needsRaw = habitat.needs
  const needs = needsRaw === null || needsRaw === undefined ? null : cleanMaterials(needsRaw)

  return {
    id,
    name,
    blurb:
      typeof b.blurb === 'string' && b.blurb.trim().length > 0
        ? b.blurb.trim().slice(0, 160)
        : 'Nobody has written this one up yet.',
    size: Math.round(clamp(b.size, 1, 6, 2)),
    tags,
    art,
    body: {
      mass: clamp(body.mass, 0, 6, 1),
      bounce: clamp(body.bounce, 0, 0.95, 0.1),
      drag: clamp(body.drag, 0.01, 0.99, 0.4),
      buoyancy: clamp(body.buoyancy, 0, 3, 0.9),
      immuneTo: cleanMaterials(body.immuneTo),
    },
    move: {
      kind,
      speed: clamp(move.speed, 0, 16, 3),
      jump: clamp(move.jump, 0, 24, 8),
      // Defaults to 0 — running is the ordinary way to be a walker, and every
      // blueprint written before hopping existed means to run.
      hop: clamp(move.hop, 0, 1, 0),
      restlessness: clamp(move.restlessness, 0, 1, 0.25),
    },
    diet: {
      eats: cleanTags(diet.eats, []),
      /**
       * Nothing is afraid of its own kind.
       *
       * A model asked for "a timid glowing bug" reasonably enough writes
       * `tags: ['meat', 'bug']` and `fears: ['bug']`, and before breeding needed
       * a partner that only made the species skittish around itself — odd, but
       * it lived. Now it is sterile: the sense pass sees its own kind, the fear
       * check fires first, and it flees the one creature it needs to stand next
       * to. Every other species in the world breeds and this one silently never
       * does, which is precisely the kind of broken summon a kid cannot debug.
       *
       * Filtered here rather than in the sense pass because it is a statement
       * about what a coherent creature *is*, and this file is where an incoherent
       * one is quietly made playable. No built-in trips it.
       */
      fears: cleanTags(diet.fears, []).filter(t => !tags.includes(t)),
      hungerRate: clamp(diet.hungerRate, 0, 0.3, 0.03),
      starveSeconds: clamp(diet.starveSeconds, 3, 300, 30),
      breedAt: clamp(diet.breedAt, 0.1, 1, 0.75),
      lifespanSeconds: clamp(diet.lifespanSeconds, 10, 1800, 240),
    },
    senses: {
      sight: clamp(senses.sight, 1, 60, 14),
      ...(senses.chemoreception !== undefined && {
        chemoreception: Math.max(0, senses.chemoreception as number),
      }),
    },
    habitat: {
      needs: needs && needs.length > 0 ? needs : null,
      drowns: habitat.drowns !== false,
    },
    death: {
      becomes: validBecomes,
      particleColor,
      particleCount: Math.round(clamp(death.particleCount, 0, 30, 6)),
    },
    aura: cleanAura(b.aura),
    glow: clamp(b.glow, 0, 1, 0),
    summoned: opts.summoned ?? false,
    soilEngineer: b.soilEngineer === true,
    decomposer: b.decomposer === true,
    cryptic: b.cryptic === true,
    disruptivePattern: b.disruptivePattern === true,
    clearingMaintainer: b.clearingMaintainer === true,
    eyespots: b.eyespots === true,
    countershaded: b.countershaded === true,
    activeChromatophores: b.activeChromatophores === true,
    bioturbator: b.bioturbator === true,
    rootBankStabilizer: b.rootBankStabilizer === true,
    polluter: b.polluter === true,
    caveBat: b.caveBat !== undefined ? !!b.caveBat : undefined,
    carnivorousPlant: b.carnivorousPlant === true,
    trapType: b.trapType === 'snap' ? 'snap'
      : b.trapType === 'pitfall' ? 'pitfall'
      : b.trapType === 'sticky' ? 'sticky'
      : undefined,
    salinityTolerance: b.salinityTolerance && typeof (b.salinityTolerance as Record<string, unknown>).min === 'number' && typeof (b.salinityTolerance as Record<string, unknown>).max === 'number'
      ? { min: Math.max(0, (b.salinityTolerance as { min: number; max: number }).min), max: Math.min(1, (b.salinityTolerance as { min: number; max: number }).max) }
      : undefined,
    heatSensitive: b.heatSensitive !== undefined ? !!b.heatSensitive : undefined,
    aerialRoots: b.aerialRoots !== undefined ? !!b.aerialRoots : undefined,
    slowMetabolism: b.slowMetabolism === true,
    invasive: b.invasive === true,
    allelopathic: b.allelopathic === true,
    novelCompoundResistant: b.novelCompoundResistant === true,
    competitiveAbility:
      typeof b.competitiveAbility === 'number' && b.competitiveAbility > 0
        ? b.competitiveAbility
        : 1,
    electroreceptive: b.electroreceptive === true,
    warmBlooded: b.warmBlooded === true,
    infraredVision: b.infraredVision === true,
    lateralLine: b.lateralLine === true,
    polarizedVision: b.polarizedVision === true,
    polarizedSkin: !!b.polarizedSkin,
    uvNectar: b.uvNectar !== undefined ? !!b.uvNectar : undefined,
    uvSensitive: b.uvSensitive !== undefined ? !!b.uvSensitive : undefined,
    bioluminescent: b.bioluminescent !== undefined ? !!b.bioluminescent : undefined,
    canDrift: b.canDrift !== undefined ? !!b.canDrift : undefined,
    anadromous: b.anadromous !== undefined ? !!b.anadromous : undefined,
    breedingPhotoperiod: b.breedingPhotoperiod === 'long' || b.breedingPhotoperiod === 'short'
      ? b.breedingPhotoperiod
      : undefined,
    dormancyPhotoperiod: b.dormancyPhotoperiod !== undefined ? !!b.dormancyPhotoperiod : undefined,
    requiresStratification: b.requiresStratification !== undefined ? !!b.requiresStratification : undefined,
    seedLongevity: typeof b.seedLongevity === 'number' && b.seedLongevity > 0 ? b.seedLongevity : undefined,
    flowZonePreference: b.flowZonePreference === 'riffle' || b.flowZonePreference === 'run' || b.flowZonePreference === 'pool'
      ? b.flowZonePreference
      : undefined,
    migratory: b.migratory !== undefined ? !!b.migratory : undefined,
    magnetoreceptive: b.magnetoreceptive !== undefined ? !!b.magnetoreceptive : undefined,
    fireGerminator: b.fireGerminator !== undefined ? !!b.fireGerminator : undefined,
    fireAdapted: b.fireAdapted !== undefined ? !!b.fireAdapted : undefined,
    lightGapGerminator: b.lightGapGerminator !== undefined ? !!b.lightGapGerminator : undefined,
    biomeRequirements: Array.isArray(b.biomeRequirements)
      ? (b.biomeRequirements as unknown[]).filter((z): z is BiomeZoneType =>
          ['tropical-rainforest','tropical-savanna','desert','temperate-grassland','temperate-forest','boreal','tundra','ice-cap'].includes(z as string)
        )
      : undefined,
    mycorrhizalPartner: b.mycorrhizalPartner !== undefined ? !!b.mycorrhizalPartner : undefined,
    obligateMycorrhizal: b.obligateMycorrhizal !== undefined ? !!b.obligateMycorrhizal : undefined,
    biocontrolTargets: Array.isArray(b.biocontrolTargets)
      ? (b.biocontrolTargets as unknown[]).filter((s): s is string => typeof s === 'string')
      : undefined,
    biocontrolAgent: b.biocontrolAgent !== undefined ? !!b.biocontrolAgent : undefined,
    acidSensitive: typeof b.acidSensitive === 'boolean' ? b.acidSensitive : undefined,
    holometabolous: b.holometabolous !== undefined ? !!b.holometabolous : undefined,
    larvaeBlueprint: typeof b.larvaeBlueprint === 'string' ? b.larvaeBlueprint : undefined,
    metamorphosesInto: typeof b.metamorphosesInto === 'string' ? b.metamorphosesInto : undefined,
    metamorphosisAge: typeof b.metamorphosisAge === 'number' && b.metamorphosisAge > 0 ? b.metamorphosisAge : undefined,
    pupalDuration: typeof b.pupalDuration === 'number' && b.pupalDuration > 0 ? b.pupalDuration : undefined,
    larvalTrophicLevel: ['plant','meat','scavenger'].includes(b.larvalTrophicLevel as string) ? b.larvalTrophicLevel as 'plant'|'meat'|'scavenger' : undefined,
    adultTrophicLevel: ['plant','meat','nectar','none'].includes(b.adultTrophicLevel as string) ? b.adultTrophicLevel as 'plant'|'meat'|'nectar'|'none' : undefined,
    pupalVulnerability: typeof b.pupalVulnerability === 'number' ? Math.max(0, Math.min(1, b.pupalVulnerability)) : undefined,
    hemimetabolous: typeof b.hemimetabolous === 'boolean' ? b.hemimetabolous : undefined,
    nymphBlueprint: typeof b.nymphBlueprint === 'string' ? b.nymphBlueprint : undefined,
    instarCount: typeof b.instarCount === 'number' ? Math.max(1, Math.floor(b.instarCount)) : undefined,
    instarDuration: typeof b.instarDuration === 'number' ? Math.max(1, b.instarDuration) : undefined,
    moultVulnerability: typeof b.moultVulnerability === 'number' ? Math.max(0, b.moultVulnerability) : undefined,
    webSpinner: typeof b.webSpinner === 'boolean' ? b.webSpinner : undefined,
    webRange: typeof b.webRange === 'number' ? Math.max(1, Math.floor(b.webRange)) : undefined,
    webBuildInterval: typeof b.webBuildInterval === 'number' ? Math.max(0.5, b.webBuildInterval) : undefined,
    objectManipulator: typeof b.objectManipulator === 'boolean' ? b.objectManipulator : undefined,
    nestBuilder: typeof b.nestBuilder === 'boolean' ? b.nestBuilder : undefined,
    nestMaterials: Array.isArray(b.nestMaterials) ? (b.nestMaterials as string[]) : undefined,
    nestCompleteAt: typeof b.nestCompleteAt === 'number' ? Math.max(1, Math.floor(b.nestCompleteAt)) : undefined,
    nestHatchBonus: typeof b.nestHatchBonus === 'number' ? Math.max(0.1, Math.min(1, b.nestHatchBonus)) : undefined,
    nestRadius: typeof b.nestRadius === 'number' ? Math.max(1, b.nestRadius) : undefined,
    burrowDigger: typeof b.burrowDigger === 'boolean' ? b.burrowDigger : undefined,
    burrowCacheSize: typeof b.burrowCacheSize === 'number' ? Math.max(0, Math.min(1, b.burrowCacheSize)) : undefined,
    termiteWorker: typeof b.termiteWorker === 'boolean' ? b.termiteWorker : undefined,
    moundCommensal: typeof b.moundCommensal === 'boolean' ? b.moundCommensal : undefined,
    moundDestroyer: typeof b.moundDestroyer === 'boolean' ? b.moundDestroyer : undefined,
    anvilUser: typeof b.anvilUser === 'boolean' ? b.anvilUser : undefined,
    hardShelled: typeof b.hardShelled === 'boolean' ? b.hardShelled : undefined,
    stickProber: typeof b.stickProber === 'boolean' ? b.stickProber : undefined,
    stickProbeDamage: typeof b.stickProbeDamage === 'number' ? Math.max(0, Math.min(1, b.stickProbeDamage)) : undefined,
    secondaryColonizer: typeof b.secondaryColonizer === 'boolean' ? b.secondaryColonizer : undefined,
    colonizedStructure: Array.isArray(b.colonizedStructure) ? (b.colonizedStructure as string[]) : undefined,
    damBuilder: typeof b.damBuilder === 'boolean' ? b.damBuilder : undefined,
    landmarkMemory: typeof b.landmarkMemory === 'boolean' ? b.landmarkMemory : undefined,
    populationCap: typeof b.populationCap === 'number' ? Math.max(1, Math.floor(b.populationCap)) : undefined,
    alleeThreshold: typeof b.alleeThreshold === 'number' ? Math.max(1, Math.floor(b.alleeThreshold)) : undefined,
    bodyMass: typeof b.bodyMass === 'number' ? Math.max(0.01, b.bodyMass) : undefined,
    kestrelKingdom: typeof b.kestrelKingdom === 'boolean' ? b.kestrelKingdom : undefined,
    otterOligarchy: typeof b.otterOligarchy === 'boolean' ? b.otterOligarchy : undefined,
    squirrelSocialism: typeof b.squirrelSocialism === 'boolean' ? b.squirrelSocialism : undefined,
    voleVoting: typeof b.voleVoting === 'boolean' ? b.voleVoting : undefined,
    weaselTribunal: typeof b.weaselTribunal === 'boolean' ? b.weaselTribunal : undefined,
    venomous: typeof b.venomous === 'boolean' ? b.venomous : undefined,
    venomPotency: typeof b.venomPotency === 'number' ? Math.max(0, Math.min(1, b.venomPotency)) : undefined,
    venomResistance: typeof b.venomResistance === 'number' ? Math.max(0, Math.min(1, b.venomResistance)) : undefined,
    territorialBlueprintFlag: typeof b.territorialBlueprintFlag === 'boolean' ? b.territorialBlueprintFlag : undefined,
    territoryRadius: typeof b.territoryRadius === 'number' ? Math.max(1, b.territoryRadius) : undefined,
    deepWaterSpecialist: typeof b.deepWaterSpecialist === 'boolean' ? b.deepWaterSpecialist : undefined,
    shallowWaterSpecialist: typeof b.shallowWaterSpecialist === 'boolean' ? b.shallowWaterSpecialist : undefined,
    parentalCare: typeof b.parentalCare === 'boolean' ? b.parentalCare : undefined,
    parentalRadius: typeof b.parentalRadius === 'number' ? Math.max(1, b.parentalRadius) : undefined,
    broodProtection: typeof b.broodProtection === 'number' ? Math.max(0.1, Math.min(1, b.broodProtection)) : undefined,
    broodParasite: typeof b.broodParasite === 'boolean' ? b.broodParasite : undefined,
    broodParasiteHost: Array.isArray(b.broodParasiteHost) ? (b.broodParasiteHost as string[]) : undefined,
    platypusPhilosophy: typeof b.platypusPhilosophy === 'boolean' ? b.platypusPhilosophy : undefined,
    toadTaxation: typeof b.toadTaxation === 'boolean' ? b.toadTaxation : undefined,
    urchinUnion: typeof b.urchinUnion === 'boolean' ? b.urchinUnion : undefined,
    minViablePopulation: typeof b.minViablePopulation === 'number' ? Math.max(1, Math.floor(b.minViablePopulation)) : undefined,
    lemmingLegislature: typeof b.lemmingLegislature === 'boolean' ? b.lemmingLegislature : undefined,
    rK: typeof b.rK === 'number' ? Math.max(0, Math.min(1, b.rK)) : undefined,
    matingSystem: ['monogamy', 'polygyny', 'polyandry', 'promiscuity'].includes(b.matingSystem as string) ? b.matingSystem as 'monogamy' | 'polygyny' | 'polyandry' | 'promiscuity' : undefined,
    semelparous: typeof b.semelparous === 'boolean' ? b.semelparous : undefined,
    ageReproductionCurve: ['peak-early', 'peak-middle', 'peak-late'].includes(b.ageReproductionCurve as string) ? b.ageReproductionCurve as 'peak-early' | 'peak-middle' | 'peak-late' : undefined,
    earthwormElevator: typeof b.earthwormElevator === 'boolean' ? b.earthwormElevator : undefined,
    frogFundamentalism: typeof b.frogFundamentalism === 'boolean' ? b.frogFundamentalism : undefined,
    gopherGovernment: typeof b.gopherGovernment === 'boolean' ? b.gopherGovernment : undefined,
    beetleInternet: typeof b.beetleInternet === 'boolean' ? b.beetleInternet : undefined,
    moleMailCarrier: typeof b.moleMailCarrier === 'boolean' ? b.moleMailCarrier : undefined,
    newtNewspaper: typeof b.newtNewspaper === 'boolean' ? b.newtNewspaper : undefined,
    winteringX: typeof b.winteringX === 'number' ? Math.round(b.winteringX) : undefined,
    summerX: typeof b.summerX === 'number' ? Math.round(b.summerX) : undefined,
    stopoverHabitat: Array.isArray(b.stopoverHabitat)
      ? (b.stopoverHabitat as unknown[]).filter((s): s is string => typeof s === 'string')
      : undefined,
    canLearnFoodWashing: !!b.canLearnFoodWashing,
    canInnovateTechniques: b.canInnovateTechniques !== undefined ? !!b.canInnovateTechniques : undefined,
    elderWisdom: !!b.elderWisdom,
    // Narrowed by `typeof` rather than tested against `undefined`: `raw` is
    // hostile input, and a `breedingGdd` of "soon" passes an !== undefined check
    // and then comes out of Math.min as NaN — which, on a gate that decides
    // whether a species may breed at all, is a species that never breeds again.
    phenology:
      typeof phenology.breedingGdd === 'number' && Number.isFinite(phenology.breedingGdd)
        ? { breedingGdd: Math.max(0, Math.min(1000, phenology.breedingGdd)) }
        : undefined,
    brainSize:
      typeof b.brainSize === 'number' && b.brainSize >= 0 && b.brainSize <= 1
        ? b.brainSize
        : 0,
    socialLearningRate:
      typeof b.socialLearningRate === 'number' && b.socialLearningRate >= 0 && b.socialLearningRate <= 1
        ? b.socialLearningRate
        : 0.5,
    traitDefaults:
      b.traitDefaults && typeof b.traitDefaults === 'object'
        ? {
            ...((b.traitDefaults as Record<string, unknown>).roam !== undefined && {
              roam: Number((b.traitDefaults as Record<string, unknown>).roam),
            }),
            ...((b.traitDefaults as Record<string, unknown>).hue !== undefined && {
              hue: Number((b.traitDefaults as Record<string, unknown>).hue),
            }),
            ...((b.traitDefaults as Record<string, unknown>).camouflage !== undefined && {
              camouflage: clamp(
                Number((b.traitDefaults as Record<string, unknown>).camouflage),
                0,
                1,
                0.2
              ),
            }),
          }
        : undefined,
    patchDependent: b.patchDependent === true,
    // Coevolution features (#3263–#3267)
    predatorEscalation: b.predatorEscalation !== undefined ? !!b.predatorEscalation : undefined,
    preyEscalation: b.preyEscalation !== undefined ? !!b.preyEscalation : undefined,
    pollinatorSpecialist: b.pollinatorSpecialist !== undefined ? !!b.pollinatorSpecialist : undefined,
    flowerTubeDepth:
      typeof b.flowerTubeDepth === 'number'
        ? clamp(b.flowerTubeDepth, 0, 1, 0.5)
        : undefined,
    tongueLength:
      typeof b.tongueLength === 'number'
        ? clamp(b.tongueLength, 0, 1, 0.5)
        : undefined,
    hostParasiteAttacker: b.hostParasiteAttacker !== undefined ? !!b.hostParasiteAttacker : undefined,
    hostParasite: b.hostParasite !== undefined ? !!b.hostParasite : undefined,
    obligatePartner:
      typeof b.obligatePartner === 'string' && b.obligatePartner.length > 0
        ? b.obligatePartner
        : undefined,
    toxic: b.toxic !== undefined ? !!b.toxic : undefined,
    toxicMimic: b.toxicMimic !== undefined ? !!b.toxicMimic : undefined,
    // The four polity flags are set once, above. They were duplicated here
    // verbatim — harmless, since both copies computed the same value, but the
    // second silently shadowed the first.
    lunarBreedingPhase:
      typeof b.lunarBreedingPhase === 'number'
        ? Math.max(0, Math.min(27, Math.round(b.lunarBreedingPhase)))
        : undefined,
    intertidal: b.intertidal !== undefined ? !!b.intertidal : undefined,
    fixesNitrogen: 'fixesNitrogen' in b ? !!b.fixesNitrogen : undefined,
    // Succession stage: gate seed germination on soil maturity (issue #3123)
    successionStage: typeof b.successionStage === 'number'
      ? Math.max(1, Math.min(4, Math.floor(b.successionStage)))
      : undefined,
    // Trophic level: inferred from diet when not explicitly set (issue #3119)
    trophicLevel: (() => {
      if (typeof b.trophicLevel === 'number') {
        return Math.max(1, Math.min(5, Math.floor(b.trophicLevel)))
      }
      const moveKind = typeof move.kind === 'string' ? move.kind : 'walk'
      const eatsArr = Array.isArray(diet.eats) ? diet.eats as string[] : []
      if (moveKind === 'root' || eatsArr.length === 0) return 1  // producer
      if (eatsArr.some((e: string) => ['plant', 'seed', 'algae'].includes(e))) return 2  // herbivore
      if (eatsArr.some((e: string) => ['meat', 'animal', 'fish', 'insect', 'bug'].includes(e))) return 3  // carnivore
      return 2  // default herbivore
    })(),
    dominanceHierarchy: typeof b.dominanceHierarchy === 'boolean' ? b.dominanceHierarchy : undefined,
    kinSelection: typeof b.kinSelection === 'boolean' ? b.kinSelection : undefined,
    alarmCaller: typeof b.alarmCaller === 'boolean' ? b.alarmCaller : undefined,
    aposematic: typeof b.aposematic === 'boolean' ? b.aposematic : undefined,
    otterOligarchy: typeof b.otterOligarchy === 'boolean' ? b.otterOligarchy : undefined,
    squirrelSocialism: typeof b.squirrelSocialism === 'boolean' ? b.squirrelSocialism : undefined,
    voleVoting: typeof b.voleVoting === 'boolean' ? b.voleVoting : undefined,
    weaselTribunal: typeof b.weaselTribunal === 'boolean' ? b.weaselTribunal : undefined,
    playBehavior: typeof b.playBehavior === 'boolean' ? b.playBehavior : undefined,
    maturityAge: typeof b.maturityAge === 'number' ? Math.max(0, b.maturityAge) : undefined,
    matingCaller: typeof b.matingCaller === 'boolean' ? b.matingCaller : undefined,
    matingCallRange: typeof b.matingCallRange === 'number' ? Math.max(1, b.matingCallRange) : undefined,
    dawnChorus: typeof b.dawnChorus === 'boolean' ? b.dawnChorus : undefined,
    dawnChorusRange: typeof b.dawnChorusRange === 'number' ? Math.max(1, b.dawnChorusRange) : undefined,
    maxDepth: typeof b.maxDepth === 'number' ? Math.max(1, b.maxDepth) : undefined,
    echolocates: typeof b.echolocates === 'boolean' ? b.echolocates : undefined,
    stressSignaler: typeof b.stressSignaler === 'boolean' ? b.stressSignaler : undefined,
    stressReceiver: typeof b.stressReceiver === 'boolean' ? b.stressReceiver : undefined,
    packHunting: typeof b.packHunting === 'boolean' ? b.packHunting : undefined,
    coordinationRange: typeof b.coordinationRange === 'number' ? Math.max(1, b.coordinationRange) : undefined,
    packSizeThreshold: typeof b.packSizeThreshold === 'number' ? Math.max(0.1, b.packSizeThreshold) : undefined,
    venomous: typeof b.venomous === 'boolean' ? b.venomous : undefined,
    venomPotency: typeof b.venomPotency === 'number' ? Math.max(0, Math.min(1, b.venomPotency)) : undefined,
    venomResistance: typeof b.venomResistance === 'number' ? Math.max(0, Math.min(1, b.venomResistance)) : undefined,
    territorialBlueprintFlag: typeof b.territorialBlueprintFlag === 'boolean' ? b.territorialBlueprintFlag : undefined,
    territoryRadius: typeof b.territoryRadius === 'number' ? Math.max(1, b.territoryRadius) : undefined,
    deepWaterSpecialist: typeof b.deepWaterSpecialist === 'boolean' ? b.deepWaterSpecialist : undefined,
    shallowWaterSpecialist: typeof b.shallowWaterSpecialist === 'boolean' ? b.shallowWaterSpecialist : undefined,
    // Lineage, food web, and succession features (#3121, #3126, #3167)
    derivedFrom: typeof b.derivedFrom === 'string' && b.derivedFrom.length > 0 ? b.derivedFrom : undefined,
    trophicLevel: typeof b.trophicLevel === 'number' && b.trophicLevel >= 1 ? Math.round(b.trophicLevel) : undefined,
    successionStage: typeof b.successionStage === 'number' && b.successionStage >= 1 && b.successionStage <= 4 ? Math.round(b.successionStage) : undefined,
    antTheater: typeof b.antTheater === 'boolean' ? b.antTheater : undefined,
    bearBanking: typeof b.bearBanking === 'boolean' ? b.bearBanking : undefined,
    quailQuarantine: typeof b.quailQuarantine === 'boolean' ? b.quailQuarantine : undefined,
    raccoonRealEstate: typeof b.raccoonRealEstate === 'boolean' ? b.raccoonRealEstate : undefined,
  }
}

// ---------------------------------------------------------------------------
// Food chain
// ---------------------------------------------------------------------------

/**
 * The entire predator/prey rule: you can eat it if you eat one of its tags and
 * it isn't bigger than you. Every relationship in the world falls out of this,
 * including ones between a built-in creature and one invented five seconds ago.
 */
export function canEat(hunter: CreatureBlueprint, prey: CreatureBlueprint): boolean {
  if (hunter.id === prey.id) return false
  if (prey.size > hunter.size) return false
  return hunter.diet.eats.some(tag => prey.tags.includes(tag))
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * How each way of moving is said out loud.
 *
 * Verbs rather than the schema's nouns — a kid reading the field guide meets
 * "climbs", not "crawl". Lives here beside `CREATURE_GROUPS` because this file
 * already owns the player-facing vocabulary for the roster, and because the
 * field guide and the creature filter must never drift into calling the same
 * locomotion two different things.
 */
export const MOVE_WORDS: Record<LocomotionKind, string> = {
  walk: 'walks',
  fly: 'flies',
  swim: 'swims',
  crawl: 'climbs',
  drift: 'floats',
  root: 'stays put',
}

/**
 * What one particular creature is doing, rather than what its kind is called.
 *
 * A springy walker is a hopper first — bouncing is the thing you notice about
 * it long before you notice it has legs. The filter still files it under
 * "walks" with every other ground animal, which is right: hopping is a way of
 * walking, not a seventh way of being alive.
 */
export function moveWord(bp: CreatureBlueprint): string {
  if (bp.move.kind === 'walk' && bp.move.hop >= 0.25) return 'hops'
  return MOVE_WORDS[bp.move.kind] ?? bp.move.kind
}

export type CreatureGroup = 'yours' | 'plants' | 'grazers' | 'hunters' | 'giants' | 'helpers'

/** Tab order, and the labels the player sees. Plain words, not taxonomy. */
export const CREATURE_GROUPS: { id: CreatureGroup; label: string }[] = [
  { id: 'yours', label: 'Yours' },
  { id: 'plants', label: 'Plants' },
  { id: 'grazers', label: 'Plant Eaters' },
  { id: 'hunters', label: 'Hunters' },
  { id: 'giants', label: 'Giants' },
  { id: 'helpers', label: 'Helpers' },
]

/** Anything that photosynthesises rather than hunts — moss, coral, a sky flower. */
export function isPlantLike(bp: CreatureBlueprint): boolean {
  return bp.move.kind === 'root' || (bp.diet.eats.length === 0 && bp.tags.includes('plant'))
}

/**
 * Which side of the record book a creature keeps its numbers in.
 *
 * The same `isPlantLike` the creature menu files by, said as the two-way split
 * the chronicle uses, so a species can never be a plant in one place and an
 * animal in the other. Derived rather than stored for the usual reason: a
 * creature invented thirty seconds ago has to file itself.
 */
export function lifeKind(bp: CreatureBlueprint): LifeKind {
  return isPlantLike(bp) ? 'plant' : 'animal'
}

/**
 * Which drawer of the creature menu this belongs in.
 *
 * Worked out from the blueprint rather than a hand-kept list, for the same
 * reason the field guide derives its "eats / eaten by": a creature summoned
 * thirty seconds ago has to file itself correctly, and a list in the UI would
 * silently drop every one of them into "other". Summoned creatures land in
 * their natural species tab; the pink border on the chip is how you tell
 * them apart from the world's own natives.
 *
 * `roster` is every creature in the world; a hunter is defined as something
 * that can actually eat one of them, which is the same rule the simulation uses.
 */
export function creatureGroup(bp: CreatureBlueprint, roster: CreatureBlueprint[]): CreatureGroup {
  if (isPlantLike(bp)) return 'plants'
  if (bp.size >= 5) return 'giants'
  if (bp.aura) return 'helpers'
  if (roster.some(other => canEat(bp, other) && !isPlantLike(other))) return 'hunters'
  return 'grazers'
}

/** True if `prey` should run from `hunter`. */
export function fears(prey: CreatureBlueprint, hunter: CreatureBlueprint): boolean {
  if (prey.diet.fears.some(tag => hunter.tags.includes(tag))) return true
  return canEat(hunter, prey)
}

/** Sprite dimensions in tiles. */
export function artSize(bp: CreatureBlueprint): { w: number; h: number } {
  const frame = bp.art.frames[0]
  return { w: frame[0].length, h: frame.length }
}

/** The part of a sprite that actually collides, offset from its top-left. */
export interface BodyBox {
  dx: number
  dy: number
  w: number
  h: number
}

const bodyBoxCache = new Map<string, BodyBox>()

/**
 * The solid core of a creature — what terrain collision and drowning use.
 *
 * For anything up to CORE_W x CORE_H this is just the sprite, so every creature
 * that shipped before big monsters existed is untouched. Past that, each extra
 * tile of drawing only counts 40% solid.
 *
 * The core sits centred horizontally and flush with the *bottom* of the sprite.
 * Bottom-aligned matters: the inset has to come off the top, where the wings,
 * horns and long neck are, or a walker's drawn feet would sink into the floor
 * while its actual box rested a few tiles higher.
 */
export function bodyBox(bp: CreatureBlueprint): BodyBox {
  const cached = bodyBoxCache.get(bp.id)
  if (cached) return cached

  const { w, h } = artSize(bp)
  const cw = w <= CORE_W ? w : CORE_W + (w - CORE_W) * CORE_SLOPE
  const ch = h <= CORE_H ? h : CORE_H + (h - CORE_H) * CORE_SLOPE

  const box: BodyBox = {
    dx: (w - cw) / 2,
    dy: h - ch,
    w: cw,
    h: ch,
  }
  bodyBoxCache.set(bp.id, box)
  return box
}

/**
 * Forget one creature's collision box, because its art changed under its id.
 *
 * Same broken assumption as the sprite cache, with worse consequences. A stale
 * sprite is a creature that looks wrong; a stale body box is a creature that is
 * *drawn* at its new size while terrain collision, drowning and spawn-fitting
 * all still answer for the old one — so a hand-drawn wing gets to overlap solid
 * rock, and shrinking a creature leaves it wedged in a hole it no longer fills.
 */
export function forgetBodyBox(id: string): void {
  bodyBoxCache.delete(id)
}
