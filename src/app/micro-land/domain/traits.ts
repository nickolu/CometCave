/**
 * Heritable variation — where a line of creatures stops being its species.
 *
 * A blueprint is shared by every creature that has it, so a mutation cannot go
 * there without every hopper alive mutating at once. Instead each creature
 * carries a `Traits` object (see `types.ts`) of multipliers applied on top of
 * its species, and a child takes the midpoint of its two parents plus a small
 * random nudge. That is the whole mechanic. There is no fitness function and
 * nothing scores anything: the world already kills the slow, the short-sighted
 * and the unlucky, so pointing inheritance at numbers the world already tests is
 * enough to make selection happen on its own.
 *
 * Two consequences worth knowing before touching anything here.
 *
 * **Founders are identical.** Everything placed by hand, seeded by the ground or
 * dropped in by a theme is exactly neutral — 1.0 on every multiplier, 0 hue.
 * Every difference in a world was therefore made by `inherit`, one birth at a
 * time. That is a deliberate choice rather than an oversight: it is what makes
 * "this species died out and I placed another" mean the line genuinely started
 * over, and it is why `TRAIT_DRIFT` has to be big enough to carry the entire
 * spread by itself.
 *
 * **Blending loses variance.** Averaging two parents halves the population's
 * spread every generation, so without the nudge a species would converge on its
 * founders and stay there forever. The two settle at a standard deviation of
 * about `drift * sqrt(2/3)`; see `TRAIT_DRIFT` for what that buys.
 */
// Drift is read off `TUNING`, never off the constant it defaults to — the
// settings panel can move it while the world runs, and reading the constant here
// is exactly the mistake `constants.ts` warns about at the top of the file.
import { TUNING } from '@/app/micro-land/domain/tuning'
import type { Creature, CreatureBlueprint, Traits } from '@/app/micro-land/domain/types'

import type { Rng } from './sim/prng'

/**
 * How far the scaling traits may drift from the blueprint, in either direction.
 *
 * Wide enough that a line under real pressure can become visibly different, and
 * hard enough that it can't become absurd. The ceiling is the load-bearing end:
 * speed feeds `clampMag` on velocity and sight feeds the sense pass's search
 * window, and both were tuned against a world where the blueprint's number was
 * the final answer. A creature at four times its species' speed would cross a
 * tile faster than collision samples one; one at four times its sight would drag
 * the O(n²) neighbour walk back to the whole population it was rewritten to
 * avoid. 1.6 is a big animal, not a broken one.
 *
 * The floor matters less but still exists — a line drifting toward zero speed
 * stops being able to reach food, which is a slow death the player can't read as
 * anything but the game breaking.
 */
export const TRAIT_MIN = 0.6
export const TRAIT_MAX = 1.6

/** Lightness gets a much shorter leash — see `Traits.shade`. */
export const SHADE_MIN = 0.82
export const SHADE_MAX = 1.18

/**
 * How far hue may move in one birth, in degrees, relative to `TRAIT_DRIFT`.
 *
 * Scaled off the same knob so that turning drift off turns *all* of it off, and
 * so the panel has one honest control rather than one that stops half the
 * mechanic. 120° per unit of drift means the shipped 0.12 moves a child about
 * 14° from its parents — a step you can't see, in a walk you can: colour is the
 * one trait nothing selects on, so it wanders freely and a small population's
 * average can travel right around the wheel over a long session.
 */
const HUE_DRIFT_SCALE = 120

export const NEUTRAL_TRAITS: Traits = Object.freeze({
  speed: 1,
  sight: 1,
  lifespan: 1,
  hue: 0,
  shade: 1,
  roam: 1,
  territorial: 0.5,
  size: 1,
  camouflage: 0.2,
  toxicity: 0,
  cooperation: 0.3,
  diurnal: 0,
  immunity: 0.2,
  reproductionCooldown: 1,
})

/** A fresh set for a creature that wasn't born here. Always a copy — it's mutable state. */
export function neutralTraits(): Traits {
  return { ...NEUTRAL_TRAITS }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Uniform in [-amount, +amount]. */
function nudge(rng: Rng, amount: number): number {
  return (rng() * 2 - 1) * amount
}

/**
 * Average two hues the short way around the circle.
 *
 * Hue is the one trait that wraps, and a naive `(a + b) / 2` gets it exactly
 * backwards at the seam: two parents at 350° and 10° are the same colour to look
 * at, and their midpoint is 180° — the opposite one. A pair of nearly identical
 * red creatures would produce a cyan child, which reads as the mutation system
 * being random rather than heritable, and only near red, which makes it look
 * like a rendering bug rather than a maths one.
 */
function blendHue(a: number, b: number): number {
  const delta = ((b - a + 540) % 360) - 180
  return wrapHue(a + delta / 2)
}

function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360
}

/**
 * What a child inherits.
 *
 * `b` is null for anything that reproduces alone — which today means plants,
 * and means them for a reason (see the breeding block in `creature-sim.ts`).
 * A single parent passes on its own values rather than a blend, so a plant line
 * drifts as a pure random walk while an animal line is pulled toward whatever
 * its population's average happens to be.
 */
export function inherit(a: Traits, b: Traits | null, rng: Rng): Traits {
  const drift = TUNING.traitDrift
  const hueDrift = drift * HUE_DRIFT_SCALE
  const mix = (key: 'speed' | 'sight' | 'lifespan' | 'shade' | 'roam' | 'territorial' | 'size' | 'camouflage' | 'toxicity' | 'cooperation' | 'diurnal' | 'immunity' | 'reproductionCooldown') =>
    b ? (a[key] + b[key]) / 2 : a[key]

  return {
    speed: clamp(mix('speed') + nudge(rng, drift), TRAIT_MIN, TRAIT_MAX),
    sight: clamp(mix('sight') + nudge(rng, drift), TRAIT_MIN, TRAIT_MAX),
    lifespan: clamp(mix('lifespan') + nudge(rng, drift), TRAIT_MIN, TRAIT_MAX),
    hue: wrapHue((b ? blendHue(a.hue, b.hue) : a.hue) + nudge(rng, hueDrift)),
    shade: clamp(mix('shade') + nudge(rng, drift), SHADE_MIN, SHADE_MAX),
    roam: clamp(mix('roam') + nudge(rng, drift), TRAIT_MIN, TRAIT_MAX),
    territorial: clamp(mix('territorial') + nudge(rng, drift), 0.1, 1.4),
    size: clamp(mix('size') + nudge(rng, drift), 0.8, 1.2),
    camouflage: clamp(mix('camouflage') + nudge(rng, drift), 0, 0.8),
    toxicity: clamp(mix('toxicity') + nudge(rng, drift), 0, 1),
    cooperation: clamp(mix('cooperation') + nudge(rng, drift), 0, 1),
    diurnal: clamp(mix('diurnal') + nudge(rng, drift), -1, 1),
    immunity: clamp(mix('immunity') + nudge(rng, drift), 0, 1),
    reproductionCooldown: clamp(mix('reproductionCooldown') + nudge(rng, drift), TRAIT_MIN, TRAIT_MAX),
  }
}

// ---------------------------------------------------------------------------
// What the simulation reads
// ---------------------------------------------------------------------------
//
// Three accessors rather than three multiplications scattered through the sim.
// The point is that there is exactly one place per trait where the blueprint's
// number turns into this creature's number, so a fourth read site added later
// can't quietly go on using the species value.

export function speedOf(c: Creature, bp: CreatureBlueprint): number {
  return bp.move.speed * c.traits.speed
}

export function sightOf(c: Creature, bp: CreatureBlueprint): number {
  return bp.senses.sight * c.traits.sight
}

/**
 * How long this one gets.
 *
 * Breeding age is a fifth of the lifespan, and it reads this rather than the
 * blueprint for a reason that took a while to see coming: if death scaled and
 * maturity didn't, a creature at the bottom of the lifespan range would reach a
 * maturity set by its species *after* it had already died of old age. Short life
 * would be perfectly heritable and perfectly sterile, so selection would delete
 * it in one generation — not because short-lived creatures do badly in the
 * world, but because they were never allowed to breed at all.
 */
export function lifespanOf(c: Creature, bp: CreatureBlueprint): number {
  return bp.diet.lifespanSeconds * c.traits.lifespan
}

/**
 * How far beyond its plain sight radius this creature will smell food.
 *
 * Old saves that predate the roam trait have `undefined` here; defaulting to 1
 * keeps them identical to freshly spawned creatures at the neutral value.
 */
export function roamOf(c: Creature): number {
  return c.traits.roam ?? 1
}

/** Body size multiplier. Defaults to 1 for old saves. */
export function sizeOf(c: Creature): number {
  return c.traits.size ?? 1
}

// ---------------------------------------------------------------------------
// Colour, as the sprite cache wants it
// ---------------------------------------------------------------------------

/**
 * Hue and shade are quantized before they reach the renderer.
 *
 * Sprites are rasterized once per blueprint and kept, because they are the same
 * handful of pixels every frame. A continuous per-creature colour would mean
 * either re-rasterizing a sprite every time anything moved or filtering a canvas
 * per draw, and both give back exactly the cost the cache exists to avoid.
 *
 * Bucketing keeps it a cache. Twelve hues by three shades is 36 possible
 * variants per species, most worlds touch a handful, and two hoppers thirty
 * degrees apart are still visibly different colours — which is all this has to
 * be, because nothing here is trying to render a gradient.
 */
export const HUE_BUCKETS = 12
export const SHADE_BUCKETS = 3

/** The bucket a neutral creature lands in. Anything else means a recolor. */
export const NEUTRAL_TINT = tintKey(NEUTRAL_TRAITS)

export function tintKey(t: Traits): number {
  const hue = Math.floor(wrapHue(t.hue) / (360 / HUE_BUCKETS)) % HUE_BUCKETS
  const span = (SHADE_MAX - SHADE_MIN) / SHADE_BUCKETS
  const shade = Math.min(SHADE_BUCKETS - 1, Math.max(0, Math.floor((t.shade - SHADE_MIN) / span)))
  return hue * SHADE_BUCKETS + shade
}

/** The colour a bucket stands for: the middle of the range it covers. */
export function tintFromKey(key: number): { hue: number; shade: number } {
  const hueStep = 360 / HUE_BUCKETS
  const shadeStep = (SHADE_MAX - SHADE_MIN) / SHADE_BUCKETS
  return {
    hue: Math.floor(key / SHADE_BUCKETS) * hueStep,
    shade: SHADE_MIN + ((key % SHADE_BUCKETS) + 0.5) * shadeStep,
  }
}

// ---------------------------------------------------------------------------
// Saying it out loud
// ---------------------------------------------------------------------------

/**
 * How far from its species a trait has to be before it's worth mentioning.
 *
 * Set at roughly the population's own standard deviation, so a phrase means
 * "unusual for its kind" rather than "not exactly average". Below this every
 * creature born would carry a label and the labels would stop meaning anything.
 */
const NOTABLE = 0.1

/**
 * What makes this one different, in words a child can read.
 *
 * The inspector shows these above the numbers rather than instead of them —
 * "quicker than most" is what the trait *is*, and 1.24 is the evidence. Colour
 * is left out on purpose: it's already on screen.
 */
export function traitPhrases(t: Traits): string[] {
  const phrases: string[] = []
  if (t.speed >= 1 + NOTABLE) phrases.push('quicker than most')
  else if (t.speed <= 1 - NOTABLE) phrases.push('slower than most')
  if (t.sight >= 1 + NOTABLE) phrases.push('sharp-eyed')
  else if (t.sight <= 1 - NOTABLE) phrases.push('short-sighted')
  if (t.lifespan >= 1 + NOTABLE) phrases.push('long-lived')
  else if (t.lifespan <= 1 - NOTABLE) phrases.push('short-lived')
  if ((t.roam ?? 1) >= 1 + NOTABLE) phrases.push('wide-ranging')
  else if ((t.roam ?? 1) <= 1 - NOTABLE) phrases.push('stay-close')
  if ((t.territorial ?? 0.5) >= 0.5 + NOTABLE) phrases.push('territorial')
  else if ((t.territorial ?? 0.5) <= 0.5 - NOTABLE) phrases.push('wandering')
  if ((t.size ?? 1) >= 1 + NOTABLE) phrases.push('larger than most')
  else if ((t.size ?? 1) <= 1 - NOTABLE) phrases.push('smaller than most')
  if ((t.camouflage ?? 0.2) >= 0.3) phrases.push('hard to spot')
  else if ((t.camouflage ?? 0.2) <= 0.1) phrases.push('easy to spot')
  if ((t.toxicity ?? 0) >= 0.4) phrases.push('venomous')
  if ((t.cooperation ?? 0.3) >= 0.5 + NOTABLE) phrases.push('shares food with kin')
  else if ((t.cooperation ?? 0.3) <= 0.3 - NOTABLE) phrases.push('solitary')
  if ((t.diurnal ?? 0) >= 0.5) phrases.push('diurnal')
  else if ((t.diurnal ?? 0) <= -0.5) phrases.push('nocturnal')
  if ((t.immunity ?? 0.2) >= 0.6) phrases.push('disease-resistant')
  else if ((t.immunity ?? 0.2) <= 0.05) phrases.push('susceptible')
  if ((t.reproductionCooldown ?? 1) <= 1 - NOTABLE) phrases.push('breeds quickly')
  else if ((t.reproductionCooldown ?? 1) >= 1 + NOTABLE) phrases.push('breeds slowly')
  return phrases
}

/**
 * The same traits as numbers, for the panel to print under the phrases.
 *
 * Shares `NOTABLE` with `traitPhrases` rather than restating it, so the two can
 * never disagree about which traits are worth mentioning — a creature described
 * as quicker than most and then shown no speed to back it up reads as the panel
 * being broken.
 */
export function notableTraits(t: Traits): { label: string; value: number }[] {
  const base = [
    { label: 'Own speed', value: t.speed },
    { label: 'Own sight', value: t.sight },
    { label: 'Own lifespan', value: t.lifespan },
    { label: 'Own roam', value: t.roam ?? 1 },
    { label: 'Own size', value: t.size ?? 1 },
    { label: 'Own breed cooldown', value: t.reproductionCooldown ?? 1 },
  ].filter(entry => Math.abs(entry.value - 1) >= NOTABLE)
  // Camouflage uses a custom threshold: notable when it meaningfully affects
  // detection (>0.4), not when it deviates from 1 (neutral is 0.2, not 1).
  if ((t.camouflage ?? 0.2) > 0.4) base.push({ label: 'Own camouflage', value: t.camouflage ?? 0.2 })
  return base
}
