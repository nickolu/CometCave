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

import { MATERIAL_IDS } from './config/materials'
import { TerrainSchema } from './terrain'

import type { CreatureBlueprint, MaterialId } from './types'

export const ART_MIN = 3
export const ART_MAX = 14
export const MAX_FRAMES = 4
export const MAX_PALETTE = 10

// z.enum wants a mutable tuple; MATERIAL_IDS is `as const`.
const materialEnum = z.enum([...MATERIAL_IDS] as [MaterialId, ...MaterialId[]])

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #ff8800')

export const BlueprintSchema = z.object({
  name: z
    .string()
    .describe('Short display name, 1-3 words. Title Case. No emoji.'),
  blurb: z
    .string()
    .describe(
      'One short sentence describing the creature, written for a curious kid. No emoji.'
    ),
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
          'Animation frames. Each frame is an array of equal-length row strings; each character is a palette key or "." for transparent. Between 3 and 14 characters wide and tall. Give 2 frames so it animates — make frame 2 a small change (a step, a blink, a wing beat), not a completely different drawing. Draw the creature FACING RIGHT.'
        ),
      frameMs: z
        .number()
        .describe('Milliseconds each frame is shown. 90-400. Faster = twitchier.'),
      faceMotion: z
        .boolean()
        .describe(
          'True if the sprite should flip horizontally when moving left. True for anything with a clear front (animals). False for blobs, orbs and plants.'
        ),
    })
    .describe('How the creature looks and animates, as pixel art.'),
  body: z
    .object({
      mass: z
        .number()
        .describe('Gravity multiplier. 0.2 = feather, 1 = normal, 3 = boulder.'),
      bounce: z.number().describe('Bounciness on impact, 0 = thud, 0.8 = rubber ball.'),
      drag: z
        .number()
        .describe('Fraction of speed kept each second, 0.05-0.99. Low = sluggish.'),
      buoyancy: z
        .number()
        .describe('Above 1 floats in water, below 1 sinks. 1 = neutral.'),
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
      jump: z.number().describe('Jump strength for walkers, 0-20. Ignored otherwise.'),
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
      starveSeconds: z
        .number()
        .describe('How long it survives once starving, 5-120 seconds.'),
      breedAt: z
        .number()
        .describe('How full it must be to reproduce, 0-1. Around 0.75 is typical.'),
      lifespanSeconds: z
        .number()
        .describe('Dies of old age after this long, 20-900 seconds.'),
    })
    .describe('Hunger, hunting and reproduction — this is what drives the food chain.'),
  senses: z
    .object({
      sight: z
        .number()
        .describe('How far it spots food and danger, in tiles. 4-50.'),
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
  dig: z
    .object({
      through: z
        .array(materialEnum)
        .describe(
          'Materials this creature can tunnel through, leaving a real tunnel behind it. [] for almost everything — digging is a special ability, not a default. A mole might use ["dirt","sand","grass"]; a rock-borer ["stone","obsidian"]; a scrap-eating machine ["metal","glass"]. Never include water or lava; those are liquids, not walls.'
        ),
      speed: z
        .number()
        .describe(
          'Tiles chewed through per second, 0.2 to 6. Slow digging through hard rock looks like effort; fast digging through loose sand looks right.'
        ),
    })
    .describe('Tunnelling ability. Most creatures cannot dig.'),
  death: z
    .object({
      becomes: materialEnum
        .nullable()
        .describe('Material left behind where it died, or null for nothing.'),
      particleColor: hexColor.describe('Color of the burst it leaves behind.'),
      particleCount: z.number().describe('How many particles, 0-30.'),
    })
    .describe('What happens when it dies.'),
  glow: z
    .number()
    .describe('Light it casts into dark places, 0-1. 0 for most creatures.'),
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
        count: z
          .number()
          .describe('How many of this creature to place in the world, 1-40.'),
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
    .map((t) => t.trim().toLowerCase().replace(/[^a-z-]/g, ''))
    .filter((t) => t.length > 0 && t.length <= 16)
  return Array.from(new Set(out)).slice(0, 6)
}

function cleanMaterials(input: unknown): MaterialId[] {
  if (!Array.isArray(input)) return []
  const valid = new Set<string>(MATERIAL_IDS)
  return Array.from(
    new Set(input.filter((m): m is MaterialId => typeof m === 'string' && valid.has(m)))
  )
}

/**
 * Coerce whatever the model drew into a rectangular, in-bounds sprite.
 *
 * Ragged rows are the single most common malformed output, so rows are padded
 * or cropped to a common width rather than rejected — a slightly-wrong creature
 * is much better than an error message. If nothing usable survives, the caller
 * gets a visible fallback blob instead of an invisible creature.
 */
function sanitizeArt(raw: unknown, fallbackColor: string): CreatureBlueprint['art'] {
  const art = (raw ?? {}) as Record<string, unknown>

  // Palette: single-char keys → hex colors. '.' is reserved for transparent.
  const palette: Record<string, string> = {}
  const rawPalette = (art.palette ?? {}) as Record<string, unknown>
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
  const rawFrames = Array.isArray(art.frames) ? art.frames : []
  let frames: string[][] = []
  for (const frame of rawFrames.slice(0, MAX_FRAMES)) {
    if (!Array.isArray(frame)) continue
    const rows = frame.filter((r): r is string => typeof r === 'string').slice(0, ART_MAX)
    if (rows.length === 0) continue
    frames.push(rows)
  }

  if (frames.length === 0) {
    // Nothing usable — a small blob so the creature is at least visible.
    const key = Object.keys(palette)[0]
    frames = [[`.${key}${key}.`, `${key}${key}${key}${key}`, `.${key}${key}.`]]
  }

  // Every frame must share one width and height, or animation would jitter.
  const width = clamp(
    Math.max(...frames.map((f) => Math.max(...f.map((r) => r.length)))),
    ART_MIN,
    ART_MAX,
    4
  )
  const height = clamp(
    Math.max(...frames.map((f) => f.length)),
    ART_MIN,
    ART_MAX,
    4
  )

  const normalized = frames.map((rows) => {
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
  const anyOpaque = normalized.some((f) => f.some((r) => /[^.]/.test(r)))
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
  const habitat = (b.habitat ?? {}) as Record<string, unknown>
  const death = (b.death ?? {}) as Record<string, unknown>
  const dig = (b.dig ?? {}) as Record<string, unknown>

  const name =
    typeof b.name === 'string' && b.name.trim().length > 0
      ? b.name.trim().slice(0, 32)
      : 'Whatsit'

  const prefix = opts.idPrefix ?? 'summon'
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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
  if (!tags.some((t) => t === 'plant' || t === 'meat' || t === 'mineral')) {
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
      restlessness: clamp(move.restlessness, 0, 1, 0.25),
    },
    diet: {
      eats: cleanTags(diet.eats, []),
      fears: cleanTags(diet.fears, []),
      hungerRate: clamp(diet.hungerRate, 0, 0.3, 0.03),
      starveSeconds: clamp(diet.starveSeconds, 3, 300, 30),
      breedAt: clamp(diet.breedAt, 0.1, 1, 0.75),
      lifespanSeconds: clamp(diet.lifespanSeconds, 10, 1800, 240),
    },
    senses: { sight: clamp(senses.sight, 1, 60, 14) },
    dig: {
      // Liquids aren't walls — letting them be "dug" would delete oceans.
      through: cleanMaterials(dig.through).filter(
        (m) => m !== 'water' && m !== 'lava' && m !== 'air'
      ),
      speed: clamp(dig.speed, 0.05, 8, 1),
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
    glow: clamp(b.glow, 0, 1, 0),
    summoned: opts.summoned ?? false,
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
  return hunter.diet.eats.some((tag) => prey.tags.includes(tag))
}

/** True if `prey` should run from `hunter`. */
export function fears(prey: CreatureBlueprint, hunter: CreatureBlueprint): boolean {
  if (prey.diet.fears.some((tag) => hunter.tags.includes(tag))) return true
  return canEat(hunter, prey)
}

/** Sprite dimensions in tiles. */
export function artSize(bp: CreatureBlueprint): { w: number; h: number } {
  const frame = bp.art.frames[0]
  return { w: frame[0].length, h: frame.length }
}
