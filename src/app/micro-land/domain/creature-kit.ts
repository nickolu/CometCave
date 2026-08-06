/**
 * The hand-drawing kit.
 *
 * Summoning asks a model for a whole creature at once. This is the other door
 * into the same room: the player colours the pixels themselves, and everything
 * that isn't pixels comes from a handful of choices a seven-year-old can make —
 * how it moves, what it eats, whether it glows.
 *
 * The output is deliberately a *raw* object literal, the same shape the model
 * returns, so it goes through `sanitizeBlueprint` on exactly the same path. A
 * drawn creature and a summoned one are the same kind of thing, which is the
 * whole premise of this world.
 *
 * A `Draft` stores hex colours per pixel rather than palette keys. Keys are a
 * transport detail — they force a rename every time a colour is swapped, and
 * they cap you at twelve while you're still deciding. Quantising down to a real
 * palette happens once, at the end, in `draftToArt`.
 */
import { ART_MAX_H, ART_MAX_W, ART_MIN, MAX_PALETTE } from './blueprint'

import type { CreatureArt, CreatureBlueprint, LocomotionKind, MaterialId } from './types'

/** Matches `MAX_FRAMES` in the blueprint contract. */
export const MAX_DRAFT_FRAMES = 4

/** Palette keys, assigned in order of how much a colour is used. */
const PALETTE_KEYS = 'abcdefghijkl'.slice(0, MAX_PALETTE)

/**
 * A drawing in progress.
 *
 * `frames[f][y * w + x]` is a `#rrggbb` string, or null for transparent. Every
 * frame shares one size — animation that changes shape mid-loop reads as a
 * glitch, and the blueprint contract requires it anyway.
 */
export interface Draft {
  w: number
  h: number
  frames: (string | null)[][]
  frameMs: number
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export interface CanvasSize {
  id: string
  label: string
  w: number
  h: number
}

/**
 * Canvas presets, in the language of the thing being drawn rather than pixels.
 *
 * The top end is exactly the sprite cap, so a hand-drawn creature can be as big
 * as a summoned one — the point is that both doors lead to the same world.
 */
export const CANVAS_SIZES: CanvasSize[] = [
  { id: 'small', label: 'Small', w: 8, h: 8 },
  { id: 'medium', label: 'Medium', w: 14, h: 12 },
  { id: 'big', label: 'Big', w: 20, h: 18 },
  { id: 'huge', label: 'Huge', w: ART_MAX_W, h: ART_MAX_H },
]

/**
 * The starting ink pots.
 *
 * Two neutrals and white for outlines, shading and eyes — the three things that
 * make a sprite read at this scale — then a spread of hues wide enough that no
 * two sit next to each other. Any of them can be replaced with a custom colour.
 */
export const DEFAULT_INKS = [
  '#1b1b26',
  '#6b7280',
  '#ffffff',
  '#e04b4b',
  '#ff8f3f',
  '#ffd166',
  '#7ede4f',
  '#2e8b6b',
  '#5eead4',
  '#4a9df0',
  '#a06bff',
  '#ff7ab8',
]

/** Spoken names for the starting inks — swatches are unreadable without them. */
export const INK_NAMES: Record<string, string> = {
  '#1b1b26': 'shadow',
  '#6b7280': 'stone',
  '#ffffff': 'white',
  '#e04b4b': 'red',
  '#ff8f3f': 'orange',
  '#ffd166': 'yellow',
  '#7ede4f': 'leaf green',
  '#2e8b6b': 'deep green',
  '#5eead4': 'mint',
  '#4a9df0': 'blue',
  '#a06bff': 'purple',
  '#ff7ab8': 'pink',
}

/** Frame speeds, named for how the creature ends up feeling. */
export const FRAME_SPEEDS = [
  { id: 'calm', label: 'Calm', ms: 420 },
  { id: 'steady', label: 'Steady', ms: 200 },
  { id: 'quick', label: 'Quick', ms: 110 },
]

export function blankDraft(w: number, h: number, frames = 2): Draft {
  const size = w * h
  return {
    w,
    h,
    frames: Array.from({ length: frames }, () => new Array<string | null>(size).fill(null)),
    frameMs: 200,
  }
}

/** Open an existing creature — summoned, built-in or drawn — for editing. */
export function draftFromBlueprint(bp: CreatureBlueprint): Draft {
  const h = bp.art.frames[0].length
  const w = bp.art.frames[0][0].length

  return {
    w,
    h,
    frames: bp.art.frames.map(rows => {
      const cells = new Array<string | null>(w * h).fill(null)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const key = rows[y]?.[x]
          const hex = key && key !== '.' ? bp.art.palette[key] : undefined
          if (hex) cells[y * w + x] = hex
        }
      }
      return cells
    }),
    frameMs: bp.art.frameMs,
  }
}

/**
 * Change the canvas without losing the drawing.
 *
 * The art stays centred, so growing the canvas adds room on every side and
 * shrinking it eats the margins first. Anchoring top-left would be one line
 * shorter and would drag the creature into the corner every time.
 */
export function resizeDraft(draft: Draft, w: number, h: number): Draft {
  if (w === draft.w && h === draft.h) return draft
  const dx = Math.round((w - draft.w) / 2)
  const dy = Math.round((h - draft.h) / 2)

  return {
    ...draft,
    w,
    h,
    frames: draft.frames.map(cells => {
      const out = new Array<string | null>(w * h).fill(null)
      for (let y = 0; y < draft.h; y++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (let x = 0; x < draft.w; x++) {
          const nx = x + dx
          if (nx < 0 || nx >= w) continue
          out[ny * w + nx] = cells[y * draft.w + x]
        }
      }
      return out
    }),
  }
}

export interface InkBounds {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** The box the drawing actually occupies, across every frame. Null if empty. */
export function inkBounds(draft: Draft): InkBounds | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -1
  let y1 = -1

  for (const cells of draft.frames) {
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue
      const x = i % draft.w
      const y = (i / draft.w) | 0
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }

  return x1 < 0 ? null : { x0, y0, x1, y1 }
}

export function isDraftEmpty(draft: Draft): boolean {
  return inkBounds(draft) === null
}

/**
 * Crop the blank margin away before the creature enters the world.
 *
 * A sprite's dimensions *are* its collision box, so a six-pixel bug drawn in
 * the middle of the biggest canvas would otherwise barge around the world
 * inside an invisible 28-tile crate. The player never sees this happen — the
 * canvas they drew on keeps its full size.
 */
export function trimDraft(draft: Draft): Draft {
  const bounds = inkBounds(draft)
  if (!bounds) return draft

  // Grow the crop back out symmetrically if the drawing is under the floor the
  // blueprint contract sets, clamped so it can never run off the canvas.
  let { x0, y0, x1, y1 } = bounds
  while (x1 - x0 + 1 < ART_MIN && (x0 > 0 || x1 < draft.w - 1)) {
    if (x0 > 0) x0--
    else x1++
  }
  while (y1 - y0 + 1 < ART_MIN && (y0 > 0 || y1 < draft.h - 1)) {
    if (y0 > 0) y0--
    else y1++
  }

  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  if (w === draft.w && h === draft.h) return draft

  return {
    ...draft,
    w,
    h,
    frames: draft.frames.map(cells => {
      const out = new Array<string | null>(w * h).fill(null)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          out[y * w + x] = cells[(y + y0) * draft.w + (x + x0)]
        }
      }
      return out
    }),
  }
}

/** Paint bucket. Returns the same array when nothing changed. */
export function floodFill(
  cells: (string | null)[],
  w: number,
  h: number,
  start: number,
  color: string | null
): (string | null)[] {
  const target = cells[start]
  if (target === color) return cells

  const out = cells.slice()
  const stack = [start]
  out[start] = color

  while (stack.length > 0) {
    const i = stack.pop() as number
    const x = i % w
    const y = (i / w) | 0
    // Four-way only. Diagonal fill leaks through the single-pixel gaps that
    // pixel art is made of, which reads as the tool being broken.
    if (x > 0 && cells[i - 1] === target && out[i - 1] !== color) {
      out[i - 1] = color
      stack.push(i - 1)
    }
    if (x < w - 1 && cells[i + 1] === target && out[i + 1] !== color) {
      out[i + 1] = color
      stack.push(i + 1)
    }
    if (y > 0 && cells[i - w] === target && out[i - w] !== color) {
      out[i - w] = color
      stack.push(i - w)
    }
    if (y < h - 1 && cells[i + w] === target && out[i + w] !== color) {
      out[i + w] = color
      stack.push(i + w)
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Drawing → art
// ---------------------------------------------------------------------------

function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function nearest(hex: string, options: string[]): string {
  const [r, g, b] = rgb(hex)
  let best = options[0]
  let bestDistance = Infinity
  for (const option of options) {
    const [r2, g2, b2] = rgb(option)
    const distance = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = option
    }
  }
  return best
}

/**
 * Turn a drawing into the palette-and-rows form the world renders.
 *
 * The palette caps at twelve, and nothing in the editor stops a player from
 * reaching for a thirteenth colour — so the rarest colours are folded into
 * their nearest neighbour rather than dropped. Losing a colour is a smudge;
 * dropping it would punch transparent holes in the creature.
 */
export function draftToArt(draft: Draft, faceMotion: boolean): CreatureArt {
  const counts = new Map<string, number>()
  for (const cells of draft.frames) {
    for (const hex of cells) {
      if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1)
    }
  }

  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex)
  const kept = ordered.slice(0, MAX_PALETTE)

  const palette: Record<string, string> = {}
  const keyOf = new Map<string, string>()
  kept.forEach((hex, i) => {
    palette[PALETTE_KEYS[i]] = hex
    keyOf.set(hex, PALETTE_KEYS[i])
  })
  for (const hex of ordered.slice(MAX_PALETTE)) {
    keyOf.set(hex, keyOf.get(nearest(hex, kept)) as string)
  }
  // An empty drawing never reaches here from the UI, but the sanitizer wants a
  // palette with something in it either way.
  if (kept.length === 0) palette[PALETTE_KEYS[0]] = '#ffffff'

  const frames = draft.frames.map(cells => {
    const rows: string[] = []
    for (let y = 0; y < draft.h; y++) {
      let row = ''
      for (let x = 0; x < draft.w; x++) {
        const hex = cells[y * draft.w + x]
        row += hex ? (keyOf.get(hex) ?? '.') : '.'
      }
      rows.push(row)
    }
    return rows
  })

  return { palette, frames, frameMs: draft.frameMs, faceMotion }
}

// ---------------------------------------------------------------------------
// Size
// ---------------------------------------------------------------------------

/**
 * Size, read off the drawing rather than asked for.
 *
 * Size is the one number that decides a creature's place in the food chain, and
 * it is also the one thing a drawing already tells you. The thresholds are the
 * same table the summoning prompt gives the model, so a hand-drawn creature and
 * a summoned one of the same width land on the same rung.
 */
export function sizeForWidth(width: number): number {
  if (width <= 5) return 1
  if (width <= 8) return 2
  if (width <= 11) return 3
  if (width <= 16) return 4
  if (width <= 22) return 5
  return 6
}

/** Plain-language sizes, for showing the player what their drawing means. */
export const SIZE_WORDS: Record<number, string> = {
  1: 'speck-sized',
  2: 'bug-sized',
  3: 'cat-sized',
  4: 'wolf-sized',
  5: 'bear-sized',
  6: 'enormous',
}

// ---------------------------------------------------------------------------
// Body plans
// ---------------------------------------------------------------------------

/**
 * The chips on the drawing panel.
 *
 * Mostly the locomotion kinds, plus `hop` — which is not a seventh way of
 * moving but a walker with `move.hop` turned up. It gets its own chip because
 * "it bounces" is the difference a child sees, and asking them to pick Walker
 * and then find a slider would be asking them to know how the simulation is
 * put together.
 */
export type PlanId = LocomotionKind | 'hop'

interface BodyPlan {
  id: PlanId
  label: string
  hint: string
  /** Flavour tags used when there's no seed creature to inherit them from. */
  flavour: string[]
  move: CreatureBlueprint['move']
  body: Omit<CreatureBlueprint['body'], 'immuneTo'>
  habitat: CreatureBlueprint['habitat']
  hungerRate: number
  starveSeconds: number
  breedAt: number
  lifespanSeconds: number
  faceMotion: boolean
}

/**
 * The six ways of being alive here.
 *
 * Numbers are lifted off the starter roster rather than invented — a Walker is
 * a Hopper, a Swimmer is a Finling — so a drawn creature drops into an existing
 * food chain and behaves like it belongs there.
 */
export const BODY_PLANS: BodyPlan[] = [
  {
    id: 'walk',
    label: 'Walker',
    hint: 'Runs along the ground. Jumps when it has to.',
    flavour: ['beast'],
    move: { kind: 'walk', speed: 5, jump: 10, hop: 0, restlessness: 0.3 },
    body: { mass: 1, bounce: 0.15, drag: 0.4, buoyancy: 0.85 },
    habitat: { needs: null, drowns: true },
    hungerRate: 0.027,
    starveSeconds: 30,
    breedAt: 0.78,
    lifespanSeconds: 240,
    faceMotion: true,
  },
  {
    // A Walker with its speed moved into the leap — same numbers off the same
    // starter (the Hopper), so a drawn hopper drops into the food chain in the
    // place the built-in one already holds.
    id: 'hop',
    label: 'Hopper',
    hint: 'Bounces along in leaps.',
    flavour: ['beast'],
    move: { kind: 'walk', speed: 5, jump: 12, hop: 1, restlessness: 0.35 },
    body: { mass: 1, bounce: 0.2, drag: 0.4, buoyancy: 0.85 },
    habitat: { needs: null, drowns: true },
    hungerRate: 0.026,
    starveSeconds: 28,
    breedAt: 0.8,
    lifespanSeconds: 200,
    faceMotion: true,
  },
  {
    id: 'fly',
    label: 'Flyer',
    hint: 'Goes anywhere in the air.',
    flavour: ['bug'],
    move: { kind: 'fly', speed: 4.5, jump: 0, hop: 0, restlessness: 0.55 },
    body: { mass: 0.12, bounce: 0.1, drag: 0.5, buoyancy: 1.4 },
    habitat: { needs: null, drowns: true },
    hungerRate: 0.03,
    starveSeconds: 26,
    breedAt: 0.75,
    lifespanSeconds: 190,
    faceMotion: true,
  },
  {
    id: 'swim',
    label: 'Swimmer',
    hint: 'Needs water. Gasps on dry land.',
    flavour: ['fish'],
    move: { kind: 'swim', speed: 5, jump: 0, hop: 0, restlessness: 0.4 },
    body: { mass: 0.4, bounce: 0.1, drag: 0.45, buoyancy: 1 },
    habitat: { needs: ['water'], drowns: false },
    hungerRate: 0.03,
    starveSeconds: 30,
    breedAt: 0.72,
    lifespanSeconds: 220,
    faceMotion: true,
  },
  {
    id: 'crawl',
    label: 'Crawler',
    hint: 'Sticks to walls and ceilings.',
    flavour: ['bug'],
    move: { kind: 'crawl', speed: 3, jump: 0, hop: 0, restlessness: 0.35 },
    body: { mass: 1, bounce: 0.05, drag: 0.35, buoyancy: 0.8 },
    habitat: { needs: null, drowns: true },
    hungerRate: 0.028,
    starveSeconds: 32,
    breedAt: 0.75,
    lifespanSeconds: 220,
    faceMotion: true,
  },
  {
    id: 'drift',
    label: 'Floater',
    hint: 'Bobs about wherever it likes.',
    flavour: [],
    // Buoyancy a hair over 1 keeps it at the waterline instead of climbing out
    // of the sea and sailing off the top of the world.
    move: { kind: 'drift', speed: 1.8, jump: 0, hop: 0, restlessness: 0.5 },
    body: { mass: 0.15, bounce: 0.3, drag: 0.55, buoyancy: 1.03 },
    habitat: { needs: null, drowns: false },
    hungerRate: 0.02,
    starveSeconds: 55,
    breedAt: 0.85,
    lifespanSeconds: 300,
    faceMotion: false,
  },
  {
    id: 'root',
    label: 'Plant',
    hint: 'Never moves. Feeds everything else.',
    flavour: [],
    move: { kind: 'root', speed: 0, jump: 0, hop: 0, restlessness: 0 },
    body: { mass: 1, bounce: 0, drag: 0.2, buoyancy: 0.6 },
    habitat: { needs: null, drowns: false },
    hungerRate: 0,
    starveSeconds: 999,
    breedAt: 0.2,
    lifespanSeconds: 280,
    faceMotion: false,
  },
]

const PLAN_BY_ID = new Map(BODY_PLANS.map(plan => [plan.id, plan]))

export function planById(id: PlanId): BodyPlan {
  return PLAN_BY_ID.get(id) ?? BODY_PLANS[0]
}

export type DietId = 'plant' | 'meat' | 'none'

export const DIET_CHOICES: { id: DietId; label: string; hint: string }[] = [
  { id: 'plant', label: 'Plants', hint: 'Grazes on anything rooted.' },
  { id: 'meat', label: 'Creatures', hint: 'Hunts anything its own size or smaller.' },
  { id: 'none', label: 'Nothing', hint: 'Never gets hungry.' },
]

/**
 * Which chip should be lit when an existing creature is opened for editing.
 *
 * A walker that spends a fair share of its travel airborne is a Hopper as far
 * as the panel is concerned, so opening a summoned frog lights the chip that
 * describes what the player can see it doing. The threshold is deliberately low:
 * anything with a real bounce reads as a hopper, and only a token amount of
 * jumping comes back as a plain Walker.
 */
export function planOf(bp: CreatureBlueprint): PlanId {
  if (bp.move.kind === 'walk' && bp.move.hop >= 0.25) return 'hop'
  return PLAN_BY_ID.has(bp.move.kind) ? bp.move.kind : 'walk'
}

export function dietOf(bp: CreatureBlueprint): DietId {
  if (bp.diet.eats.length === 0) return 'none'
  return bp.diet.eats.includes('plant') ? 'plant' : 'meat'
}

// ---------------------------------------------------------------------------
// Drawing → creature
// ---------------------------------------------------------------------------

/** Tags that answer "what am I made of". Exactly one belongs on a creature. */
const STRUCTURAL = new Set(['plant', 'meat', 'mineral'])

export interface BuildOptions {
  name: string
  draft: Draft
  planId: PlanId
  dietId: DietId
  glows: boolean
  fireproof: boolean
  /**
   * The creature this drawing started from, if any.
   *
   * Anything that makes a creature *itself* rather than a category — its
   * description, what it leaves behind, its aura — is carried across, because
   * none of it is expressible on this canvas and throwing it away would punish
   * the player for opening a summoned dragon and changing two pixels.
   */
  seed: CreatureBlueprint | null
}

/**
 * Assemble the raw blueprint literal.
 *
 * Deliberately returns loose data rather than a `CreatureBlueprint`: the caller
 * hands it to `introduce`, which runs it through `sanitizeBlueprint` like any
 * other untrusted input. There is no privileged path into the world.
 */
export function buildRawCreature(options: BuildOptions): Record<string, unknown> {
  const { draft, planId, dietId, glows, fireproof, seed } = options

  const plan = planById(planId)
  // A plant that hunts is a contradiction the food chain can't resolve.
  const diet = planId === 'root' ? 'none' : dietId

  const trimmed = trimDraft(draft)
  const art = draftToArt(trimmed, plan.faceMotion)
  const size = sizeForWidth(trimmed.w)

  /**
   * A seed whose plan and diet are untouched keeps its own tuning.
   *
   * The presets are a good generic Walker; a summoned creature's numbers were
   * chosen *for that creature*. Recolouring a Cinder Wyrm shouldn't quietly
   * turn it into a stock quadruped, but switching it to a Swimmer should.
   */
  const keepSeedTuning = seed !== null && planOf(seed) === planId && dietOf(seed) === diet

  const structural = planId === 'root' ? 'plant' : 'meat'
  const flavour = seed
    ? seed.tags.filter(tag => !STRUCTURAL.has(tag) && tag !== 'glow').slice(0, 3)
    : plan.flavour
  const tags = [structural, ...flavour, ...(glows ? ['glow'] : [])]

  const eats = diet === 'none' ? [] : diet === 'meat' ? ['meat'] : ['plant']

  const immuneTo = new Set<MaterialId>(seed?.body.immuneTo ?? [])
  if (fireproof) immuneTo.add('lava')
  else immuneTo.delete('lava')

  // The colour it bursts into should be the colour it mostly is.
  const dominant = Object.values(art.palette)[0] ?? '#ffd166'

  const name = options.name.trim().slice(0, 32) || seed?.name || 'My Creature'
  const blurb = seed && seed.name === name ? seed.blurb : 'Drawn by hand, one pixel at a time.'

  return {
    name,
    blurb,
    size,
    tags,
    art,
    body: {
      ...(keepSeedTuning
        ? {
            mass: seed.body.mass,
            bounce: seed.body.bounce,
            drag: seed.body.drag,
            buoyancy: seed.body.buoyancy,
          }
        : plan.body),
      immuneTo: [...immuneTo],
    },
    move: keepSeedTuning ? seed.move : plan.move,
    diet: {
      eats,
      fears: seed?.diet.fears ?? [],
      ...(keepSeedTuning
        ? {
            hungerRate: seed.diet.hungerRate,
            starveSeconds: seed.diet.starveSeconds,
            breedAt: seed.diet.breedAt,
            lifespanSeconds: seed.diet.lifespanSeconds,
          }
        : {
            hungerRate: diet === 'none' ? 0 : plan.hungerRate,
            starveSeconds: diet === 'none' ? 999 : plan.starveSeconds,
            breedAt: diet === 'none' ? 0.2 : plan.breedAt,
            lifespanSeconds: plan.lifespanSeconds,
          }),
    },
    // Hunters need to see further than the things they are chasing.
    senses: { sight: keepSeedTuning ? seed.senses.sight : diet === 'meat' ? 32 : 20 },
    habitat: keepSeedTuning ? seed.habitat : plan.habitat,
    death: {
      becomes: seed?.death.becomes ?? null,
      particleColor: dominant,
      particleCount: Math.min(14, 4 + size * 2),
    },
    aura: seed?.aura ?? null,
    glow: glows ? 0.7 : 0,
  }
}
