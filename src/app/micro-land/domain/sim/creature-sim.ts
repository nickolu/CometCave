/**
 * Creature behavior — hunger, hunting, fleeing, breeding, dying.
 *
 * Nothing in here knows about any specific creature. Every decision reads the
 * blueprint, which is why a creature invented at runtime behaves as completely
 * as one that shipped with the game.
 *
 * The sense pass (who can I eat, who is about to eat me) is O(n²), so it runs
 * at 10Hz with creatures staggered across ticks rather than every frame.
 */
import {
  ART_MAX_W,
  artSize,
  bodyBox,
  canEat,
  fears,
  isPlantLike,
} from '@/app/micro-land/domain/blueprint'
import type { BodyBox } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_BY_INDEX, MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import {
  BREATH_SECONDS,
  FORAGE_HUNGER,
  GRAVITY,
  HUNGER_REACH,
  JUMP_TILES_PER_STRENGTH,
  MAX_FALL,
  MAX_PARTICLES,
  NEST_BUILD_TIME,
  NEST_DECAY_SECONDS,
  PARTICLE_LIFE,
  WORLD_H,
  WORLD_W,
} from '@/app/micro-land/domain/constants'
import {
  inherit,
  lifespanOf,
  roamOf,
  sightOf,
  sizeOf,
  speedOf,
} from '@/app/micro-land/domain/traits'
import { TUNING } from '@/app/micro-land/domain/tuning'
import type { Creature, CreatureBlueprint, Scent, WorldState } from '@/app/micro-land/domain/types'
import { deltaX, distX, wrapCol, wrapX } from '@/app/micro-land/domain/wrap'

import {
  boxDeadlyMaterial,
  boxDrownFraction,
  boxHitsSolid,
  boxLiquidFraction,
  boxViscosity,
  inBounds,
  liquidAt,
  runWorldGenerators,
  setTile,
  settleOnGround,
  solidAt,
  spawnCreature,
  tickMoisture,
  tileAt,
} from './world'

import type { Rng } from './prng'

/** How often each creature looks around, in sim ticks. */
const SENSE_EVERY = 6

/**
 * How many consecutive sense passes a hunter can spend chasing the same
 * unreachable prey before it gives up. At 10 Hz this is about 1.2 seconds.
 * Long enough for legitimate pursuit of a fleeing target; short enough to
 * escape a wall.
 */
const STUCK_SENSE_PASSES = 12

/**
 * Sense passes the creature can't lock onto a specific target after getting
 * stuck. Stored as a negative value in `huntPassCount` so no new field is
 * needed: negative means cooldown, zero or positive means the normal counter.
 *
 * Without this, a creature pressed against an obstacle clears its target for
 * exactly one tick then immediately re-locks on the same blocked prey — so the
 * "try a different angle" comment in the stuck block never actually happens.
 * Six passes (0.6s) of free foraging is enough to clear a typical obstacle.
 */
const STUCK_COOLDOWN_PASSES = 6

/**
 * How much the two bodies have to overlap to count as a bite, in tiles.
 *
 * This is deliberately a box-overlap test rather than a distance between
 * centres. Centre-to-centre punishes big creatures for being big: a Stalker is
 * 8x6, so its own centre sits ~4 tiles behind its nose, and a fixed radius small
 * enough to look like "touching" for a Mite meant a Stalker had to be almost
 * perfectly superimposed on its prey to land a bite. Stationary plants still got
 * eaten — grazers walk onto them and linger — so the food chain looked like it
 * worked while predation on anything that moved almost never fired.
 */
const BITE_PAD = 0.5

/**
 * Probability per tick that a soil-engineering creature converts the dirt tile
 * it is standing on into mud. At 60Hz this gives a ~12% chance per second,
 * meaning a typical tile takes roughly 8 seconds of contact to enrich.
 */
const SOIL_ENRICH_PROB = 0.002

/**
 * Probability per tick that a bioturbating creature converts the infertile tile
 * it is standing on (sand, stone, ash, bone) into dirt. At 60Hz this gives
 * a ~6% chance per second — slower than soil enrichment because bringing
 * barren substrate to productive soil is a larger physical transformation.
 */
const BIOTURBATION_PROB = 0.001

/**
 * Probability per tick per adjacent tile that a root-bank-stabilizing plant
 * binds a loose sand tile into dirt. At 60Hz and a 5-tile sweep this gives
 * ~18% per second per tile — fast enough to be visible in tests within 60 s.
 */
const ROOT_STABILIZE_PROB = 0.0005

/**
 * Probability per tick that a polluter creature converts the tile it is
 * standing on (dirt or grass) into ash. At 60Hz this gives a ~6% chance
 * per second — slower than soil enrichment because soot requires sustained
 * exposure to build up. Ash has 0.7× fertility, creating selection pressure
 * for dark-hued cryptic variants (industrial melanism).
 */
const POLLUTION_PROB = 0.001

/**
 * Seconds between chromatophore hue updates. At 5 s the creature adapts
 * roughly twice a minute — fast enough to matter ecologically, slow enough
 * to be visible in the field guide.
 */
const CHROMATO_INTERVAL = 5

/**
 * Seconds the chromatophore is in an incoherent intermediate state after
 * updating its hue. At 2/60 s ≈ 33 ms (two physics ticks) the creature is
 * briefly exposed — models the real latency in pigment-cell rearrangement.
 * During this window camouflage is zero, matching the issue spec.
 */
const CHROMATO_FADE_S = 2 / 60

/**
 * Within this many tiles, disruptive patterns give no detection benefit —
 * the outline is legible at close range regardless of the pattern.
 */
const DISRUPTION_NEAR_TILES = 4

/**
 * Beyond DISRUPTION_NEAR_TILES, a disruptive-pattern creature is only
 * detectable at this fraction of the predator's normal detection radius.
 * 0.65 means 65% of range — roughly 42% of the area.
 */
const DISRUPTION_FAR_FACTOR = 0.65

/**
 * Plant creatures younger than this (in seconds) count as seedlings.
 * Clearing maintainers eat seedlings even when sated — casual grazing that
 * prevents young plants establishing before they can reproduce.
 */
const SEEDLING_MAX_AGE = 30

/**
 * Probability that a predator's killing blow hits an eyespot (wing edge, tail tip)
 * rather than the prey's body. The prey escapes; the predator gets almost nothing.
 * 0.4 = 40% deflection, matching real-world eyespot attack-diversion research.
 */
const EYESPOT_DEFLECT_CHANCE = 0.4

/**
 * Speed (|vx| + |vy|) below which a non-root animal counts as still.
 *
 * Still animals are harder to spot — camouflage. A creature pressed against a
 * wall or resting between hops reads as effectively motionless even though it
 * isn't at literal zero, so the threshold is a small positive rather than zero.
 */
const CAMOUFLAGE_STILL = 1.5

/** Extract hue (0–360) from a CSS hex color. Returns -1 for achromatic (gray/white/black). */
export function hexHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d < 0.05) return -1 // achromatic — too gray to have a meaningful hue
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return h
}

/**
 * Camouflage score for a cryptic creature standing on a tile.
 *
 * creature.traits.hue is treated as the creature's dominant color (0–360).
 * tileHue is the tile material's hue, or -1 if achromatic.
 * Achromatic tiles (stone, metal, ice) give a flat 0.3 — some concealment but not great.
 * A perfect hue match gives 1.0 (fully camouflaged); 90° away gives 0 (no colour benefit).
 */
export function crypticCamouflage(creatureHue: number, tileHue: number): number {
  if (tileHue < 0) return 0.3
  const diff = Math.abs((((creatureHue - tileHue) % 360) + 360) % 360)
  const angular = Math.min(diff, 360 - diff) // 0–180
  return Math.max(0, 1 - angular / 90) // 1 at 0°, 0 at ≥90°
}

/**
 * How fertile the soil is at a world position — a multiplier on plant spread rate.
 *
 * Range: 0.2 (barren rock) to 1.5 (rich soil next to water). Derived from the
 * tile material and a small adjacency check for nearby water, so no extra storage
 * is needed. Called once per plant per breed cycle, so the 25-tile scan is cheap.
 */
function fertilityAt(w: WorldState, x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const matId = MATERIAL_BY_INDEX[tileAt(w, xi, yi)]?.id ?? 'dirt'

  let f: number
  switch (matId) {
    case 'mud':
      f = 1.3
      break
    case 'dirt':
    case 'grass':
    case 'moss':
      f = 1.0
      break
    case 'wood':
    case 'sap':
      f = 0.9
      break
    case 'ash':
      f = 0.7
      break
    case 'bone':
    case 'sand':
    case 'snow':
      f = 0.5
      break
    case 'ice':
      f = 0.4
      break
    case 'stone':
    case 'obsidian':
    case 'marble':
      f = 0.3
      break
    case 'metal':
    case 'iron':
    case 'glass':
    case 'gold':
    case 'gem':
      f = 0.2
      break
    default:
      f = 1.0
  }

  // Proximity bonus: a plant within 2 tiles of fresh water or ice gets +0.3.
  const waterIdx = MATERIAL_INDEX.water
  const iceIdx = MATERIAL_INDEX.ice
  outer: for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const t = tileAt(w, xi + dx, yi + dy)
      if (t === waterIdx || t === iceIdx) {
        f = Math.min(1.5, f + 0.3)
        break outer
      }
    }
  }

  return Math.max(0.2, f)
}

export interface SimEvent {
  /**
   * `eaten` is from the victim's side (this species lost one); `ate` is from the
   * hunter's side and carries who it caught. Both fire for a single kill — the
   * UI wants the hunter's framing, the extinction check wants the victim's.
   */
  kind: 'born' | 'eaten' | 'ate' | 'starved' | 'drowned' | 'burned' | 'aged' | 'diseased' | 'sick'
  blueprintId: string
  /** Only set on `ate`: the blueprint id of what was caught. */
  victimId?: string
  x: number
  y: number
  /** Only set on death events: how long the creature lived. */
  ageSeconds?: number
  /** Only set on death events: how many children the creature had. */
  children?: number
  /** Only set on death events: the player-given name of the creature that died, if any. */
  creatureName?: string | null
}

let tickCount = 0

/** Append a life event to a creature's log (max 20 entries). */
function logLife(c: Creature, elapsed: number, text: string): void {
  if (!c.lifeLog) c.lifeLog = []
  if (c.lifeLog.length >= 20) return
  c.lifeLog.push({ elapsed, text })
}

/**
 * The population sorted left to right, reused between ticks.
 *
 * `look` used to walk the entire population to find the handful of things within
 * an 18-tile line of sight. That was tolerable when the world was one screen
 * wide, and stops being tolerable at three: the population cap scales with the
 * area, so the all-pairs cost scales with its *square* while the number of
 * creatures actually near you doesn't change at all.
 *
 * Sorting by x and walking only the slice within reach makes the cost track the
 * local crowd instead of the headcount. The array is nearly sorted every tick —
 * nothing moves far in 1/60th of a second — which is the case sort is fastest
 * at, and it is kept around rather than rebuilt so a busy world isn't handing
 * the collector a thousand-element array sixty times a second.
 */
const byX: Creature[] = []

/**
 * Slack on the sight window, in tiles — and it is not the same on both sides.
 *
 * Sorting is on the sprite's *left* edge while sight is measured between the
 * two sprites' *nearest* edges, so the two bounds are asking different
 * questions. To the right, a creature's left edge is the near edge, and half
 * our own width is the whole correction. To the left, its left edge can be a
 * full sprite-width further out than the edge that matters, so the widest
 * sprite there could be has to be added on.
 *
 * Worth splitting rather than padding both sides by the larger figure: the pass
 * is the hot loop of the whole simulation, and a symmetric pad made every
 * creature walk an extra `ART_MAX_W` of neighbours to its right for nothing.
 */
const SIGHT_PAD_RIGHT = 0
const SIGHT_PAD_LEFT = ART_MAX_W

function compareX(a: Creature, b: Creature): number {
  return a.x - b.x
}

/**
 * How old something has to be before it can make another of itself.
 *
 * Plants get a flat few seconds; everything else gets a fifth of its own
 * lifespan, so a mayfly and a dragon are both "grown" at the same point in
 * their own story rather than at the same wall-clock moment.
 *
 * A fifth of *this creature's* lifespan, not its species' — a short-lived line
 * that matured on the species clock would die before it was ever allowed to
 * breed. See `lifespanOf`.
 */
function breedingAge(c: Creature, bp: CreatureBlueprint): number {
  return bp.move.kind === 'root'
    ? TUNING.plantMaturity
    : lifespanOf(c, bp) * TUNING.lifespanScale * 0.2
}

/**
 * Whether this thing has to find a partner at all.
 *
 * Deliberately a *different* question from `move.kind === 'root'`, which is what
 * the breeding block uses for the plant economics — no hunger cost, plant
 * cooldowns, plant caps — and which must keep meaning exactly what it always
 * meant. Rooted-ness is about how a thing pays for a child. This is about
 * whether it needs anyone else to have one, and the honest answer is "not if it
 * photosynthesises", however it happens to get around.
 *
 * The harness is what taught this. Skybloom is a flower that never landed: it
 * has `tags: ['plant']`, eats nothing, and *flies*. Told to find a partner it
 * went from a steady 65 to extinct in every run on earth, because it also has
 * two tiles of sight and therefore cannot see another one of itself, ever. It
 * was not a balance problem — it was a flower being asked to court.
 */
function needsPartner(bp: CreatureBlueprint): boolean {
  return !isPlantLike(bp)
}

/**
 * Everything about *one* creature that has to be true before it can breed.
 *
 * Split out because it is now asked twice about two different animals: once by
 * the creature itself, and once about the partner it is standing next to.
 * "Both of them have to be well fed" is exactly this predicate holding on each,
 * so it must be a single definition — two copies would drift, and the way they
 * would drift is one animal quietly breeding off a partner that is starving.
 *
 * Deliberately says nothing about the world: caps, crowding and whether there is
 * anywhere to put a baby are the caller's business, because they are questions
 * about the population rather than about this animal.
 */
function readyToBreed(c: Creature, bp: CreatureBlueprint): boolean {
  return (
    c.breedCooldown <= 0 &&
    1 - c.hunger >= bp.diet.breedAt &&
    c.hunger + TUNING.breedCost < 1 &&
    c.ageSeconds > breedingAge(c, bp)
  )
}

/**
 * The partner this creature is standing close enough to breed with, if any.
 *
 * Reads the target the sense pass already picked rather than searching again.
 * That is what keeps the mechanic affordable: pairing is decided at 10Hz inside
 * a loop that was already walking the neighbours, and all this has to do every
 * tick is confirm the two are still willing and have finally closed the gap.
 *
 * Re-checks readiness instead of trusting the target because up to six ticks
 * have passed since it was chosen — long enough to have bred with something
 * else, been eaten, or gone hungry on the walk over.
 */
function findMate(
  w: WorldState,
  c: Creature,
  bp: CreatureBlueprint,
  dead: Set<number>
): Creature | null {
  if (c.mood !== 'mate' || c.targetId === null) return null
  const other = findCreature(w, c.targetId)
  if (!other || dead.has(other.id)) return null
  // Same species means same sprite, so top-left distance is centre distance and
  // there is no need to ask `artSize` about either of them.
  if (other.blueprintId !== c.blueprintId) return null
  if (!readyToBreed(other, bp)) return null
  const dx = deltaX(c.x, other.x)
  const dy = other.y - c.y
  return dx * dx + dy * dy <= TUNING.mateRadius * TUNING.mateRadius ? other : null
}

/** First index whose x is not less than `x`. The array must be sorted. */
function lowerBound(list: Creature[], x: number): number {
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (list[mid].x < x) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Neighbours found by the last `gather`. Module scope for the same reason `byX`
 * is: this is refilled several times per creature per sense pass and handing the
 * collector a fresh array each time would cost more than the search does.
 */
const found: Creature[] = []

/**
 * Everything whose left edge lies within `reach` of column `cx`, the short way
 * round, left in `found`. Returns how many.
 *
 * A sight window used to be one contiguous slice of the x-sorted population, and
 * on a cylinder it is two: a creature standing at 670 with eighteen tiles of
 * sight can see something at 5, and the slice it needs runs off the end of the
 * array and continues at the start. Hence the buffer — the four scans in `look`
 * have quite different bodies, one of which returns out of `look` mid-loop, and
 * a two-range iteration open-coded four times is four chances to get the second
 * range subtly wrong.
 *
 * The seam case is rare by construction: only creatures within roughly a sight
 * radius of column zero straddle it at all, so the overwhelming majority of the
 * population still takes one binary search and one walk, exactly as before.
 *
 * **One buffer, so callers must be done before gathering again.** The scans in
 * `look` run strictly one after another today. Nesting one inside another would
 * corrupt the outer loop's view of the world without any error being raised.
 */
function gather(cx: number, reach: number): number {
  found.length = 0
  const span = reach + SIGHT_PAD_LEFT + SIGHT_PAD_RIGHT

  /**
   * A window wider than the world sees everything, and asking for it as two
   * ranges would double-count the overlap. A starving migrator on four times
   * its normal sight is the realistic way to get here.
   */
  if (span >= WORLD_W) {
    for (let i = 0; i < byX.length; i++) found.push(byX[i])
    return found.length
  }

  const lo = wrapX(cx - reach - SIGHT_PAD_LEFT)
  const hi = wrapX(cx + reach + SIGHT_PAD_RIGHT)

  if (lo <= hi) {
    for (let i = lowerBound(byX, lo); i < byX.length && byX[i].x <= hi; i++) found.push(byX[i])
  } else {
    // Straddling the seam: [lo, WORLD_W) then [0, hi]. Disjoint because the
    // whole-world case above has already been dealt with.
    for (let i = lowerBound(byX, lo); i < byX.length; i++) found.push(byX[i])
    for (let i = 0; i < byX.length && byX[i].x <= hi; i++) found.push(byX[i])
  }
  return found.length
}

export function tickCreatures(
  w: WorldState,
  dt: number,
  rng: Rng,
  gravityScale: number,
  events: SimEvent[]
): void {
  tickCount++

  // Migration: worlds saved before carcasses or tombstones were added won't have these fields.
  w.carcasses ??= []
  w.nextCarcassId ??= 1
  w.tombstones ??= []
  w.nextTombstoneId ??= 1
  w.scents ??= []
  w.moisture ??= new Float32Array(WORLD_W * WORLD_H)
  tickMoisture(w, tickCount, dt, rng)
  w.eggs ??= []
  w.nextEggId ??= 1

  // Seasonal factor — a slow sine wave that modulates plant growth and seeding.
  // 1.0 at both the start (t=0) and equinoxes; peaks in summer, troughs in winter.
  // When `seasonAmplitude` is 0 (default), this is always exactly 1.
  const seasonFactor =
    TUNING.seasonAmplitude > 0
      ? Math.max(
          0.05,
          1 + TUNING.seasonAmplitude * Math.sin((2 * Math.PI * w.elapsed) / TUNING.seasonPeriod)
        )
      : 1

  const creatures = w.creatures
  const dead = new Set<number>()

  // Plants are capped as a share of the population so they can't carpet the map.
  let plantCount = 0
  for (const c of creatures) {
    if (w.blueprints[c.blueprintId]?.move.kind === 'root') plantCount++
  }
  // Tracked live rather than snapshotted: every eligible plant breeds in the
  // same tick, so a snapshot taken up here lets 150 plants become 300 before
  // the cap is ever re-read.
  let plantsAlive = plantCount

  // Per-species headcount, so no single animal can eat the world on its own.
  const speciesCount: Record<string, number> = {}
  for (const c of creatures) {
    speciesCount[c.blueprintId] = (speciesCount[c.blueprintId] ?? 0) + 1
  }

  // Helpers — bees, worms, anything with an aura. Gathered once per tick
  // because the breeding check below asks "is one of these near me", and there
  // are normally none at all.
  const helpers: Creature[] = []
  for (const c of creatures) {
    if (w.blueprints[c.blueprintId]?.aura) helpers.push(c)
  }

  // Rebuilt in place, then sorted, once for every creature that looks this tick.
  byX.length = creatures.length
  for (let i = 0; i < creatures.length; i++) byX[i] = creatures[i]
  byX.sort(compareX)

  for (const c of creatures) {
    if (dead.has(c.id)) continue
    const bp = w.blueprints[c.blueprintId]
    if (!bp) {
      dead.add(c.id)
      continue
    }

    // `bw`/`bh` are what the creature *looks* like — used for sight, biting and
    // anything the player can see. `body` is what it collides with. For all but
    // the largest creatures the two are identical.
    const { w: bw, h: bh } = artSize(bp)
    const body = bodyBox(bp)

    c.ageSeconds += dt
    c.animMs += dt * 1000
    if (c.breedCooldown > 0) c.breedCooldown -= dt
    // Migration: creatures saved before toxicity was added won't have poisoned.
    if (c.poisoned === undefined) c.poisoned = 0
    if ((c as { sinking?: number }).sinking === undefined) c.sinking = 0
    if (c.poisoned > 0) c.poisoned = Math.max(0, c.poisoned - dt)
    if ((c as { homeX?: number }).homeX === undefined) {
      c.homeX = Math.round(c.x)
      c.homeY = Math.round(c.y)
    }
    if ((c as { migrateTimer?: number }).migrateTimer === undefined) c.migrateTimer = 0
    if ((c as { packTimer?: number }).packTimer === undefined) c.packTimer = 0
    if (c.packTimer > 0) c.packTimer = Math.max(0, c.packTimer - dt)
    // Home drift: territory gradually shifts toward wherever the creature
    // has been thriving. A hungry creature stays anchored; a well-fed one
    // slowly claims the area it's actually living in.
    const hdt = c as { homeDriftTimer?: number }
    if (hdt.homeDriftTimer === undefined) hdt.homeDriftTimer = 30
    hdt.homeDriftTimer = Math.max(0, hdt.homeDriftTimer - dt)
    if (hdt.homeDriftTimer <= 0) {
      const wellFed = Math.max(0, 0.5 - c.hunger) // 0 when hungry, up to 0.5 when stuffed
      const pull = wellFed * 0.3 // at most 15% shift per 30s tick
      // Drift toward where it has actually been living, the short way round — an
      // animal that crossed the seam has not moved six hundred tiles from home,
      // and a plain subtraction here would haul its territory back across the
      // entire world one 15% step at a time.
      c.homeX = wrapX(c.homeX + deltaX(c.homeX, c.x) * pull)
      c.homeY += (c.y - c.homeY) * pull
      hdt.homeDriftTimer = 30
    }
    if ((c as { stunTimer?: number }).stunTimer === undefined) c.stunTimer = 0
    if (c.stunTimer > 0) c.stunTimer = Math.max(0, c.stunTimer - dt)
    if ((c as { symbiosisTimer?: number }).symbiosisTimer === undefined) c.symbiosisTimer = 0
    if (c.symbiosisTimer > 0) c.symbiosisTimer = Math.max(0, c.symbiosisTimer - dt)
    if ((c as { sick?: number }).sick === undefined) c.sick = 0
    if ((c as { carryingSeed?: unknown }).carryingSeed === undefined) {
      c.carryingSeed = null
      c.seedTimer = 0
    }
    if (c.sick > 0) {
      c.sick -= dt
      if (c.sick <= 0) {
        c.sick = 0
        const rawImmunity = (c.traits as { immunity?: number }).immunity ?? 0.2
        const immunity = bp.invasive ? Math.min(1, rawImmunity + 0.56) : rawImmunity
        if (rng() >= immunity * 0.8 + 0.2) {
          kill(w, c, bp, dead, events, 'diseased')
          continue
        }
      }
    }
    // Migrate timer: counts seconds hungry with no food found.
    if (c.hunger > FORAGE_HUNGER && c.targetId === null) {
      c.migrateTimer += dt
    } else {
      c.migrateTimer = Math.max(0, c.migrateTimer - dt)
    }

    // Quicksand: walkers progressively slow and die after 12 s if they can't escape.
    if (bp.body.locomotion === 'walk') {
      const qs_fx = Math.floor(c.x + body.dx + body.w / 2)
      const qs_fy = Math.floor(c.y + body.dy + body.h)
      if (MATERIAL_BY_INDEX[tileAt(w, qs_fx, qs_fy)]?.id === 'quicksand') {
        c.sinking += dt
        if (c.sinking > 12) {
          kill(w, c, bp, dead, events, 'drowned')
          continue
        }
      } else {
        c.sinking = Math.max(0, c.sinking - dt * 2)
      }
    }

    // --- hunger ---------------------------------------------------------
    // Resting creatures aren't running or hunting, so they burn energy more slowly.
    const restSlowdown = c.mood === 'rest' ? 0.5 : 1

    const symbiosisFed = c.symbiosisTimer > 0 ? 0.8 : 1
    const metabolicRate = bp.slowMetabolism ? 0.1 : 1
    c.hunger = Math.min(
      1,
      c.hunger + bp.diet.hungerRate * TUNING.hungerRateScale * restSlowdown * symbiosisFed * metabolicRate * dt
    )
    if (c.hunger >= 1) {
      c.starving += dt
      if (c.starving >= bp.diet.starveSeconds) {
        kill(w, c, bp, dead, events, 'starved')
        continue
      }
    } else {
      c.starving = Math.max(0, c.starving - dt * 2)
    }

    // --- parasitism: drain host, stay fed, detach when host dies ----------
    if (c.hostId != null) {
      const host = findCreature(w, c.hostId)
      if (!host || dead.has(host.id)) {
        c.hostId = null // host is dead, detach
      } else {
        host.hunger = Math.min(1, host.hunger + 0.018 * dt)
        if (host.mood === 'wander' || host.mood === 'rest') {
          host.mood = 'flee'
          host.targetId = c.id
        }
        c.hunger = Math.max(0, c.hunger - 0.015 * dt)
        c.starving = 0
      }
    }

    // --- old age --------------------------------------------------------
    if (c.ageSeconds >= lifespanOf(c, bp) * TUNING.lifespanScale) {
      kill(w, c, bp, dead, events, 'aged')
      continue
    }

    // --- environment ----------------------------------------------------
    const px = c.x + body.dx
    const py = c.y + body.dy
    const wet = boxLiquidFraction(w, px, py, body.w, body.h)
    const deadlyMat = boxDeadlyMaterial(w, px, py, body.w, body.h)
    if (deadlyMat !== null) {
      const immune = bp.body.immuneTo.some(m => MATERIAL_INDEX[m] === deadlyMat)
      if (!immune) {
        kill(w, c, bp, dead, events, 'burned')
        continue
      }
    }

    // One timer, two ways to be in the wrong place.
    let inTrouble = false
    if (bp.habitat.needs && bp.habitat.needs.length > 0) {
      const needsWater = bp.habitat.needs.includes('water')
      if (needsWater && wet < 0.25) inTrouble = true
    }
    // Drowning asks specifically about water, not "any liquid" — sap holds you
    // fast but you can still breathe in it.
    if (bp.habitat.drowns && boxDrownFraction(w, px, py, body.w, body.h) > 0.7) {
      inTrouble = true
    }

    if (inTrouble) {
      c.distress += dt
      if (c.distress >= BREATH_SECONDS) {
        kill(w, c, bp, dead, events, 'drowned')
        continue
      }
    } else {
      c.distress = Math.max(0, c.distress - dt * 1.5)
    }

    // --- senses ---------------------------------------------------------
    if ((tickCount + c.id) % SENSE_EVERY === 0) {
      look(w, c, bp, bw, bh, dead, events, rng)
    }

    // --- movement -------------------------------------------------------
    if (bp.move.kind !== 'root') {
      steer(w, c, bp, dt, rng)
      integrate(w, c, bp, bw, bh, dt, wet, gravityScale)
    } else if (!hasFooting(w, c, body)) {
      /**
       * A plant whose ground went away falls to the next one down.
       *
       * Rooting is permanent — `settleOnGround` places a seedling on fertile
       * ground and nothing ever looks at that ground again — but the ground
       * itself is not: lava drains, ash and sand settle, ice melts, acid eats
       * through. On the volcanic theme a fifth of the flora ended up hanging in
       * mid-air within the first minute, which reads as green pixels stuck to
       * the sky. Everything else in the world falls when it has nothing under
       * it, so a stranded plant falls too — through `integrate`, which is the
       * one piece of code that knows how to land a body on a tile. `steer` is
       * still skipped, and a rooted creature has no `vx`, so this is a straight
       * drop rather than the plant learning to walk.
       */
      c.vy = Math.max(0, c.vy)
      integrate(w, c, bp, bw, bh, dt, wet, gravityScale)
    }

    // --- fatigue --------------------------------------------------------
    if (bp.move.kind !== 'root') {
      const fatigue = c.fatigue ?? 0
      const isExerting = c.mood === 'hunt' || c.mood === 'flee'
      const isResting = c.mood === 'rest' || c.mood === 'eat'
      // Larger creatures have more stamina — high size trait slows fatigue build.
      const stamina = c.traits.size ?? 1
      if (isExerting) {
        c.fatigue = Math.min(1, fatigue + (dt * 0.15) / stamina)
      } else if (isResting) {
        c.fatigue = Math.max(0, fatigue - dt * 0.2)
      } else {
        c.fatigue = Math.max(0, fatigue - dt * 0.1)
      }
      // Enter rest when exhausted; exit when sufficiently recovered.
      if ((c.fatigue ?? 0) >= 0.9 && c.mood !== 'rest') {
        c.mood = 'rest'
        c.targetId = null
      } else if (c.mood === 'rest' && (c.fatigue ?? 0) < 0.2) {
        c.mood = 'wander'
      }
    }

    // --- nest building --------------------------------------------------------
    // A well-fed, grounded, territorial creature digs a burrow at its home
    // while resting. The nest builds over NEST_BUILD_TIME seconds of rest and
    // decays in NEST_DECAY_SECONDS once the owner stops visiting.
    w.nests ??= []
    w.nextNestId ??= 1
    if (
      c.mood === 'rest' &&
      (c.traits.territorial ?? 0.5) >= 0.4 &&
      c.hunger < 0.25 &&
      bp.move.kind !== 'root'
    ) {
      let nest = w.nests.find(n => n.creatureId === c.id)
      if (!nest) {
        nest = {
          id: w.nextNestId++,
          creatureId: c.id,
          x: wrapCol(Math.round(c.homeX)),
          y: Math.round(c.homeY),
          progress: 0,
          decaySeconds: NEST_DECAY_SECONDS,
        }
        w.nests.push(nest)
      }
      // Advance build progress; a completed nest stays at 1.
      if (nest.progress < 1) nest.progress = Math.min(1, nest.progress + dt / NEST_BUILD_TIME)
      // Track the creature's current home (it drifts slightly over time).
      nest.x = wrapCol(Math.round(c.homeX))
      nest.y = Math.round(c.homeY)
      // Refresh decay: the owner is here, so the burrow doesn't collapse.
      nest.decaySeconds = NEST_DECAY_SECONDS
    }

    // --- pollination: seed carrying ----------------------------------------
    //
    // Pollinators (aura.helps contains 'plant') pick up a seed when they
    // brush past a plant, carry it for up to pollinationCarrySeconds, then
    // drop it wherever they land. Flying creatures drop on landing; all
    // pollinators drop when the timer expires.
    if (bp.aura?.helps.includes('plant') && bp.move.kind !== 'root') {
      if (c.carryingSeed) {
        // Carrying — count down and check drop conditions.
        c.seedTimer -= dt
        // A 2-second minimum carry time prevents dropping at the pickup spot.
        const canDrop =
          c.seedTimer <= 0 ||
          (c.grounded && bp.move.kind === 'fly' && c.seedTimer < TUNING.pollinationCarrySeconds - 2)
        if (canDrop) {
          const seedBp = w.blueprints[c.carryingSeed]
          if (
            seedBp &&
            plantsAlive < TUNING.maxPlants &&
            (speciesCount[seedBp.id] ?? 0) < TUNING.plantSpeciesCap
          ) {
            const { w: sw, h: sh } = artSize(seedBp)
            const seedling = reproduce(w, seedBp, c.x, c.y + bh, sw, sh, rng)
            if (seedling) {
              plantsAlive++
              speciesCount[seedBp.id] = (speciesCount[seedBp.id] ?? 0) + 1
              events.push({ kind: 'born', blueprintId: seedBp.id, x: seedling.x, y: seedling.y })
              // A small pollen burst at the drop point.
              for (let p = 0; p < 3; p++) {
                if (w.particles.length >= 600) break
                w.particles.push({
                  x: c.x + (rng() - 0.5) * 4,
                  y: c.y - rng() * 2,
                  vx: (rng() - 0.5) * 0.6,
                  vy: -(0.3 + rng() * 0.5),
                  life: 1.5 + rng() * 1.5,
                  maxLife: 2.5,
                  color: '#fde68a',
                })
              }
            }
          }
          c.carryingSeed = null
          c.seedTimer = 0
        }
      } else {
        // Not carrying — look for a nearby plant to pick up on the SENSE_EVERY interval.
        if ((tickCount + c.id) % SENSE_EVERY === 0) {
          const cx = c.x + bw / 2
          const cy = c.y + bh / 2
          for (const other of w.creatures) {
            if (other === c || dead.has(other.id)) continue
            const obp = w.blueprints[other.blueprintId]
            if (!obp || obp.move.kind !== 'root') continue
            const { w: ow, h: oh } = artSize(obp)
            const dx = deltaX(other.x + ow / 2, cx)
            const dy = cy - (other.y + oh / 2)
            if (dx * dx + dy * dy < 9) {
              // within ~3 tiles
              c.carryingSeed = other.blueprintId
              c.seedTimer = TUNING.pollinationCarrySeconds
              break
            }
          }
        }
      }
    }

    // --- what it does to the world around it -----------------------------
    if (bp.aura?.converts) applyConversion(w, c, bp, bw, bh, dt, rng)

    // Soil engineering: creatures with soilEngineer flag slowly enrich dirt
    // tiles to mud as they walk through them (the "earthworm effect").
    // Mud has 1.3× plant fertility vs dirt's 1.0×, so the enrichment persists
    // in saves because it is a real tile-material change.
    // Uses the foot tile (same as the quicksand check) because a walking
    // creature's centre of mass is in the air above the ground.
    if (bp.soilEngineer) {
      const scx = Math.floor(c.x + body.dx + body.w / 2)
      const scy = Math.floor(c.y + body.dy + body.h)
      if (tileAt(w, scx, scy) === MATERIAL_INDEX.dirt && Math.random() < SOIL_ENRICH_PROB) {
        setTile(w, scx, scy, MATERIAL_INDEX.mud)
      }
    }

    // Bioturbation: digging creatures mix infertile substrate (sand, stone, ash,
    // bone) into productive soil (dirt) by physically breaking up and turning
    // over the ground beneath them. Models the earthworm / mole / ant effect:
    // subsoil material is brought to the surface where plants can use it.
    // Complements soil engineering — bioturbation reclaims barren areas while
    // soil engineering enriches existing soil.
    if (bp.bioturbator) {
      const scx = Math.floor(c.x + body.dx + body.w / 2)
      const scy = Math.floor(c.y + body.dy + body.h)
      const foot = tileAt(w, scx, scy)
      if (
        (foot === MATERIAL_INDEX.sand ||
          foot === MATERIAL_INDEX.stone ||
          foot === MATERIAL_INDEX.ash ||
          foot === MATERIAL_INDEX.bone) &&
        Math.random() < BIOTURBATION_PROB
      ) {
        setTile(w, scx, scy, MATERIAL_INDEX.dirt)
      }
    }

    // Root bank stabilization: riparian plants bind loose soil by slowly
    // converting adjacent sand tiles into stable dirt within their root zone.
    // Models willows and alders locking in riverbank soil with their roots.
    // Works only for rooted plants — walkers don't hold soil in place.
    if (bp.rootBankStabilizer && bp.move.kind === 'root') {
      const rx = Math.floor(c.x + body.dx + body.w / 2)
      const ry = Math.floor(c.y + body.dy + body.h)
      for (let dx = -2; dx <= 2; dx++) {
        const tx = wrapX(rx + dx)
        if (tileAt(w, tx, ry) === MATERIAL_INDEX.sand && Math.random() < ROOT_STABILIZE_PROB) {
          setTile(w, tx, ry, MATERIAL_INDEX.dirt)
        }
      }
    }

    // Industrial pollution: creatures with polluter flag deposit soot (ash) on
    // the tiles they walk through, darkening the substrate and creating selection
    // pressure for cryptic variants with ash-hue colouring (industrial melanism).
    // Converts dirt and grass to ash (fertility 0.7×); does not affect other
    // tile types so the effect is concentrated on vegetation-bearing ground.
    if (bp.polluter) {
      const scx = Math.floor(c.x + body.dx + body.w / 2)
      const scy = Math.floor(c.y + body.dy + body.h)
      const foot = tileAt(w, scx, scy)
      if (
        (foot === MATERIAL_INDEX.dirt || foot === MATERIAL_INDEX.grass) &&
        Math.random() < POLLUTION_PROB
      ) {
        setTile(w, scx, scy, MATERIAL_INDEX.ash)
      }
    }

    // Active chromatophores: update hue to match the current tile every
    // CHROMATO_INTERVAL seconds. For 2 physics ticks after the update the
    // creature is in transition (chromatophoreFade > 0) and its camouflage
    // is zero — pigment cells are incoherent between the two states.
    // The updated hue persists in traits and is inherited by offspring,
    // driving substrate-adaptive lineages on variable terrain.
    if (bp.activeChromatophores) {
      const chdt = c as {
        chromatophoreTimer?: number
        chromatophoreFade?: number
      }
      if (chdt.chromatophoreTimer === undefined) chdt.chromatophoreTimer = 0
      if (chdt.chromatophoreFade === undefined) chdt.chromatophoreFade = 0

      chdt.chromatophoreTimer += dt
      if (chdt.chromatophoreFade > 0)
        chdt.chromatophoreFade = Math.max(0, chdt.chromatophoreFade - dt)

      if (chdt.chromatophoreTimer >= CHROMATO_INTERVAL) {
        chdt.chromatophoreTimer = 0
        const footX = Math.floor(c.x + body.dx + body.w / 2)
        const footY = Math.floor(c.y + body.dy + body.h)
        const mat = MATERIAL_BY_INDEX[tileAt(w, footX, footY)]
        if (mat) {
          const newHue = hexHue(mat.color)
          const t = c.traits as { hue?: number }
          // Only start a transition if the hue actually changes (avoids
          // false-positive exposure when the creature stays on the same tile).
          if (newHue !== -1 && t.hue !== newHue) {
            t.hue = newHue
            chdt.chromatophoreFade = CHROMATO_FADE_S
          }
        }
      }
    }

    // --- breeding -------------------------------------------------------
    const isPlant = bp.move.kind === 'root'
    if (
      readyToBreed(c, bp) &&
      creatures.length < TUNING.maxCreatures &&
      !(isPlant && plantsAlive >= TUNING.maxPlants) &&
      !(isPlant && TUNING.pollinationOnly) &&
      (speciesCount[bp.id] ?? 0) < (isPlant ? TUNING.plantSpeciesCap : TUNING.speciesSoftCap)
    ) {
      /**
       * An animal needs a partner; a plant does not.
       *
       * Plants spread rather than breed, and the asymmetry is not squeamishness
       * — it is what keeps a stripped world recoverable. The ground's seed bank
       * puts as few as three sprouts back across three screens of bare soil, and
       * if each of those needed a neighbour of its own kind within a few tiles
       * they would stand there sterile forever. Plants are the one rung of the
       * food chain with nothing above it to restock it, so they are the one rung
       * that is allowed to make more of itself alone.
       */
      const wantsMate = needsPartner(bp)
      const mate = wantsMate ? findMate(w, c, bp, dead) : null
      if (!wantsMate || mate) {
        // Born between the two of them, which is the whole point of having made
        // them walk to each other.
        //
        // Half the *wrapped* gap, not half the sum. A pair that met across the
        // seam — one at 5, one at 670 — averages to 337, which is the far side
        // of the world from either parent: the child would be born alone in the
        // middle of nowhere, and `reproduce` would spend all twelve of its
        // attempts failing to find ground there.
        const ox = mate ? wrapX(c.x + deltaX(c.x, mate.x) / 2) : c.x
        const oy = mate ? (c.y + mate.y) / 2 : c.y
        if (bp.egglayer && !isPlant) {
          // Egg-layer: drop an egg with inherited traits rather than spawning live.
          const childTraits = inherit(c.traits, mate?.traits ?? null, rng)
          const generation = Math.max(c.generation, mate?.generation ?? 0) + 1
          w.eggs.push({
            id: w.nextEggId++,
            x: ox,
            y: oy,
            blueprintId: bp.id,
            traits: childTraits,
            generation,
            hatchIn: TUNING.eggHatchSeconds,
          })
          c.children++
          if (c.children === 1) logLife(c, w.elapsed, 'First offspring')
          else if (c.children % 10 === 0) logLife(c, w.elapsed, `${c.children} offspring`)
          speciesCount[bp.id] = (speciesCount[bp.id] ?? 0) + 1
          c.breedCooldown =
            TUNING.breedCooldown *
            ((c.traits as { reproductionCooldown?: number }).reproductionCooldown ?? 1) *
            (bp.slowMetabolism ? 2 : 1) *
            (bp.invasive ? 0.67 : 1)
          payForChild(w, c, bp, bw, bh, helpers)
          if (mate) {
            mate.children++
            if (mate.children === 1) logLife(mate, w.elapsed, 'First offspring')
            else if (mate.children % 10 === 0)
              logLife(mate, w.elapsed, `${mate.children} offspring`)
            payForChild(w, mate, bp, bw, bh, helpers)
          }
          events.push({ kind: 'born', blueprintId: bp.id, x: ox, y: oy })
        } else {
          const child = reproduce(w, bp, ox, oy, bw, bh, rng)
          if (child) {
            // Set here rather than inside `reproduce`, which returns through two
            // different paths and would need both parents threaded into each. The
            // deeper of the two lines is the one the child inherits — generation
            // counts ancestry, so a bloodline shouldn't get shallower by marrying
            // into a newer one.
            child.generation = Math.max(c.generation, mate?.generation ?? 0) + 1
            // Set here for the same reason as the generation above, and from the
            // same two parents. `spawnCreature` gave the child its species'
            // neutral values; this is the only place in the game that ever
            // replaces them, which is what makes "born here" and "put here" two
            // genuinely different things.
            child.traits = inherit(c.traits, mate?.traits ?? null, rng)
            child.lifeLog = [{ elapsed: w.elapsed, text: `Born (gen ${child.generation})` }]
            c.children++
            if (c.children === 1) logLife(c, w.elapsed, 'First offspring')
            else if (c.children % 10 === 0) logLife(c, w.elapsed, `${c.children} offspring`)
            speciesCount[bp.id] = (speciesCount[bp.id] ?? 0) + 1
            if (isPlant) {
              plantsAlive++
              // Plants photosynthesise: spreading costs them nothing. Charging
              // them the usual hunger cost would sterilise them permanently —
              // their hungerRate is 0, so the debt could never be paid back and
              // each plant would breed twice in its entire life.
              //
              // Soil fertility (0.2 on bare stone → 1.5 in waterside mud) scales
              // the cooldown inversely: richer soil means a shorter wait, so
              // plants cluster in patches rather than carpeting the map evenly.
              // Seasons multiply the same way: summer doubles spread, winter halves it.
              // A plant surrounded by its own kind competes for light and soil —
              // the more same-species neighbours within range, the longer it waits
              // before spreading again. This is what breaks up monoculture clusters
              // without any hard cap: a lone pioneer spreads freely, a dense patch
              // slows itself down naturally.
              const crowdRadius = 12
              let crowdCount = 0
              for (const other of w.creatures) {
                if (other === c || other.blueprintId !== bp.id) continue
                const cdx = deltaX(c.x, other.x)
                const cdy = other.y - c.y
                if (cdx * cdx + cdy * cdy < crowdRadius * crowdRadius) crowdCount++
              }
              const crowdingPenalty = 1 + crowdCount * TUNING.plantCrowdingStrength

              // Soil fertility scales breed cooldown inversely: richer soil →
              // shorter wait. The foot tile (one row below the body) is the
              // substrate the plant is actually rooted in; the body centre is
              // in the air above it and always returns the default 'dirt' value.
              const footX = Math.floor(c.x + body.dx + body.w / 2)
              const footY = Math.floor(c.y + body.dy + body.h)
              // Carnivorous plants invert the fertility curve: they breed faster
              // on nutrient-poor tiles (stone, sand, ash) and slower on rich
              // soil, out-competing normal flora on barren ground.
              const plantFertilityFactor = bp.carnivorousPlant
                ? Math.max(0.1, 2.0 - fertilityAt(w, footX, footY))
                : fertilityAt(w, footX, footY)
              c.breedCooldown =
                (TUNING.plantSpreadCooldown * crowdingPenalty) /
                (auraBoost(w, c, bp, bw, bh, helpers) *
                  plantFertilityFactor *
                  seasonFactor)
            } else {
              // Both of them paid to be here, so both of them pay for it. Charging
              // only the one whose turn it happened to be would make a baby cost a
              // pair half of what it used to cost a single animal, which is a
              // *cheapening* of breeding dressed up as a restriction.
              payForChild(w, c, bp, bw, bh, helpers)
              if (mate) {
                mate.children++
                if (mate.children === 1) logLife(mate, w.elapsed, 'First offspring')
                else if (mate.children % 10 === 0)
                  logLife(mate, w.elapsed, `${mate.children} offspring`)
                payForChild(w, mate, bp, bw, bh, helpers)
              }
            }
            events.push({ kind: 'born', blueprintId: bp.id, x: child.x, y: child.y })
          } else {
            // Nowhere to put it — wait a bit before trying again. The partner
            // waits too, or it spends the next tick re-finding a creature that is
            // now on cooldown and failing at exactly the same spot.
            c.breedCooldown = 3
            if (mate) mate.breedCooldown = 3
          }
        }
      }
    }
  }

  if (dead.size > 0) {
    w.creatures = creatures.filter(c => !dead.has(c.id))
  }

  // Egg hatching: decrement timers and hatch ready eggs.
  w.eggs ??= []
  const hatchedEggIds = new Set<number>()
  for (const egg of w.eggs) {
    egg.hatchIn -= dt
    if (egg.hatchIn <= 0) {
      const ebp = w.blueprints[egg.blueprintId]
      if (ebp && w.creatures.length < TUNING.maxCreatures) {
        const { w: ew, h: eh } = artSize(ebp)
        const hatchling = spawnCreature(w, ebp, egg.x - ew / 2, egg.y - eh / 2)
        if (hatchling) {
          hatchling.generation = egg.generation
          hatchling.traits = egg.traits
          hatchling.lifeLog = [{ elapsed: w.elapsed, text: `Born (gen ${egg.generation})` }]
          events.push({ kind: 'born', blueprintId: ebp.id, x: egg.x, y: egg.y })
        }
      }
      hatchedEggIds.add(egg.id)
    }
  }
  if (hatchedEggIds.size > 0) {
    w.eggs = w.eggs.filter(e => !hatchedEggIds.has(e.id))
  }

  // --- pollination --------------------------------------------------------
  //
  // A fraction of plant meals scatter a seed near the eating spot. This gives
  // plants a secondary spread vector that does not require them to be near
  // fertile ground — a grazer browsing one patch carries pollen to wherever it
  // wanders next, seeding plants in areas they would never self-spread into and
  // adding gentle variety to where each species ends up.
  //
  // The `events` array carries `ate` events emitted by `look()` this tick.
  // The eaten blueprint's id (`victimId`) tells us which plant to scatter; the
  // position is where the creature was at the moment it ate. The actual seed is
  // scattered 20–60 tiles away — far enough to cross the gap between one cluster
  // and the next, close enough that local terrain still determines viability.
  for (const ev of events) {
    if (ev.kind !== 'ate' || !ev.victimId) continue
    const victimBp = w.blueprints[ev.victimId]
    if (!victimBp || victimBp.move.kind !== 'root') continue
    if (plantsAlive >= TUNING.maxPlants) continue
    if ((speciesCount[victimBp.id] ?? 0) >= TUNING.plantSpeciesCap) continue
    // Roughly 1 in 12 plant meals scatters a seed.
    if (rng() > 1 / 12) continue
    const { w: vw, h: vh } = artSize(victimBp)
    const angle = rng() * Math.PI * 2
    const dist = 20 + rng() * 40
    const ox = ev.x + Math.cos(angle) * dist
    const oy = ev.y + Math.sin(angle) * dist
    const seedling = reproduce(w, victimBp, ox, oy, vw, vh, rng)
    if (seedling) {
      plantsAlive++
      speciesCount[victimBp.id] = (speciesCount[victimBp.id] ?? 0) + 1
      events.push({ kind: 'born', blueprintId: victimBp.id, x: seedling.x, y: seedling.y })
      // A few pollen motes drift upward where the grazer ate.
      const pollenCount = 2 + Math.floor(rng() * 2)
      for (let p = 0; p < pollenCount; p++) {
        if (w.particles.length >= 600) break
        const spread = (rng() - 0.5) * 6
        const upward = 0.4 + rng() * 0.6
        w.particles.push({
          x: ev.x + spread,
          y: ev.y - rng() * 2,
          vx: spread * 0.15,
          vy: -upward,
          life: 2 + rng() * 2,
          maxLife: 3,
          color: '#fde68a',
        })
      }
    }
  }

  // The only thing the world regrows on its own. Animals that die out stay
  // dead — see `runWorldGenerators`.
  runWorldGenerators(w, dt, rng)

  // Decay carcasses and remove expired ones.
  for (const car of w.carcasses) {
    car.decaySeconds -= dt
  }
  if (w.carcasses.some(car => car.decaySeconds <= 0)) {
    w.carcasses = w.carcasses.filter(car => car.decaySeconds > 0)
  }

  // Nests decay when their owner is absent or dead; remove fully decayed ones.
  if (w.nests?.length) {
    const livingIds = new Set(w.creatures.map(c => c.id))
    for (const nest of w.nests) {
      if (!livingIds.has(nest.creatureId)) {
        nest.decaySeconds -= dt
      }
    }
    if (w.nests.some(n => n.decaySeconds <= 0)) {
      w.nests = w.nests.filter(n => n.decaySeconds > 0)
    }
  }

  // Scent decay
  for (const s of w.scents) s.decaySeconds -= dt
  w.scents = w.scents.filter(s => s.decaySeconds > 0)

  // Disease outbreak: roughly every 3 sim-minutes, infect one random non-plant.
  if (Math.floor(w.elapsed / 180) > Math.floor((w.elapsed - dt) / 180)) {
    const animals = w.creatures.filter(
      c => !dead.has(c.id) && w.blueprints[c.blueprintId]?.move.kind !== 'root'
    )
    if (animals.length > 0) {
      const victim = animals[Math.floor(rng() * animals.length)]
      const victimBp = w.blueprints[victim.blueprintId]
      const rawImmunity = (victim.traits as { immunity?: number }).immunity ?? 0.2
      const immunity = victimBp?.invasive ? Math.min(1, rawImmunity + 0.56) : rawImmunity
      if (rng() > immunity) {
        victim.sick = TUNING.diseaseDuration
      }
    }
  }

  tickParticles(w, dt, gravityScale)
}

// ---------------------------------------------------------------------------
// Senses
// ---------------------------------------------------------------------------

function look(
  w: WorldState,
  c: Creature,
  bp: CreatureBlueprint,
  bw: number,
  bh: number,
  dead: Set<number>,
  events: SimEvent[],
  rng: Rng
): void {
  const cx = c.x + bw / 2
  const cy = c.y + bh / 2
  const hungry = c.hunger > 0.3

  // This creature's sight, not its species' — everything downstream, including
  // the foraging reach and the window the loop below walks, is measured off it.
  const diurnal = (c.traits as { diurnal?: number }).diurnal ?? 0
  const nightFactor =
    TUNING.dayLengthSeconds > 0
      ? (1 - Math.cos((2 * Math.PI * w.elapsed) / TUNING.dayLengthSeconds)) / 2
      : 0
  const diurnalPenalty =
    Math.max(0, diurnal > 0 ? diurnal * nightFactor : -diurnal * (1 - nightFactor)) * 0.5
  const sight = sightOf(c, bp) * (1 - diurnalPenalty)
  const sight2 = sight * sight

  /**
   * How far it can find something to eat, which is not how far it can see.
   *
   * Ramps from plain sight at the moment it starts feeling hungry up to
   * `1 + HUNGER_REACH * roam` times that by the time it is nearly starving.
   * The `roam` trait multiplies the extension, so a wide-ranging line smells
   * food further out and a stay-close line hunts at shorter range. Food only:
   * `sight2` above still decides what counts as a threat, so getting hungry
   * makes an animal bolder and further-ranging without also making it better at
   * noticing what is stalking it.
   */
  const desperation = Math.max(0, Math.min(1, (c.hunger - 0.3) / 0.6))
  // A creature that has been hungry with nothing in sight for 30 s expands its
  // search to 4× normal range — enough to detect patches across the world.
  const migrating = c.migrateTimer > 30
  const foodSight = migrating ? sight * 4 : sight * (1 + HUNGER_REACH * desperation * roamOf(c))
  const foodSight2 = foodSight * foodSight

  /**
   * Whether it is worth noticing its own kind this pass.
   *
   * Mate-finding is folded into the sense pass rather than given a search of its
   * own, because this loop is already walking every neighbour inside the sight
   * window and the answer costs one more comparison per neighbour. A separate
   * pass would have re-paid the whole binary-search-and-scan for a question that
   * was already open.
   *
   * Plants are excluded — they spread alone, so a partner is nothing to them
   * but a reason to stop wandering.
   */
  const seeking = needsPartner(bp) && readyToBreed(c, bp)

  let threat: Creature | null = null
  let threatDist = Infinity
  let prey: Creature | null = null
  let preyDist = Infinity
  let preyDir: 1 | -1 = 1
  let preyCx = 0
  let preyCy = 0
  let mate: Creature | null = null
  let mateDist = Infinity

  // --- Carcass eating (touch-based opportunistic scavenging) ---
  // A hungry carnivore that stumbles over a carcass eats it immediately.
  // No active pursuit — the creature's normal hunt/wander brings it close enough.
  if (hungry && bp.move.kind !== 'root') {
    for (const car of w.carcasses) {
      const carBp = w.blueprints[car.blueprintId]
      if (!carBp || !canEat(bp, carBp)) continue
      const dx = deltaX(cx, car.x)
      const dy = car.y - cy
      // Gap between creature sprite edge and the carcass point.
      const gapX = Math.max(0, Math.abs(dx) - bw / 2)
      const gapY = Math.max(0, Math.abs(dy) - bh / 2)
      if (gapX <= BITE_PAD && gapY <= BITE_PAD) {
        c.hunger = Math.max(0, c.hunger - mealFill(c, bp, carBp))
        c.starving = 0
        c.huntBlockedId = null
        c.mealsEaten++
        if (c.mealsEaten === 1) logLife(c, w.elapsed, 'First meal')
        // Cooperative creatures signal food location to kin.
        if (
          ((c.traits as { cooperation?: number }).cooperation ?? 0.3) > 0.5 &&
          w.scents.length < 200
        ) {
          w.scents.push({ x: c.x, y: c.y, blueprintId: c.blueprintId, decaySeconds: 10 })
        }
        c.mood = 'eat'
        c.targetId = null
        car.decaySeconds = 0 // mark for removal at end of tick
        events.push({ kind: 'ate', blueprintId: bp.id, victimId: car.blueprintId, x: c.x, y: c.y })
        return
      }
    }
  }

  // Egg eating: a hungry carnivore that stumbles over an egg eats it.
  if (hungry && bp.move.kind !== 'root' && w.eggs.length > 0) {
    for (const egg of w.eggs) {
      if (egg.hatchIn <= 0) continue // already eaten or hatched
      const eggBp = w.blueprints[egg.blueprintId]
      if (!eggBp || !canEat(bp, eggBp)) continue
      const dx = deltaX(cx, egg.x)
      const dy = egg.y - cy
      const gapX = Math.max(0, Math.abs(dx) - bw / 2)
      const gapY = Math.max(0, Math.abs(dy) - bh / 2)
      if (gapX <= BITE_PAD && gapY <= BITE_PAD) {
        c.hunger = Math.max(0, c.hunger - mealFill(c, bp, eggBp) * 0.6) // eggs are smaller meals
        c.starving = 0
        c.huntBlockedId = null
        c.mealsEaten++
        if (c.mealsEaten === 1) logLife(c, w.elapsed, 'First meal')
        c.mood = 'eat'
        c.targetId = null
        egg.hatchIn = -1 // mark for removal by the hatching block
        events.push({ kind: 'ate', blueprintId: bp.id, victimId: eggBp.id, x: c.x, y: c.y })
        return
      }
    }
  }

  // Only the creatures whose left edge falls in the window can possibly be in
  // range; everything beyond it is skipped without being touched. Sized off the
  // *food* reach, which is the larger of the two whenever the creature is hungry
  // enough for it to matter — so a fed animal pays exactly what it always did.
  const reach = Math.max(sight, foodSight) + bw / 2
  const nearby = gather(cx, reach)
  for (let i = 0; i < nearby; i++) {
    const other = found[i]
    if (other.id === c.id || dead.has(other.id)) continue
    const obp = w.blueprints[other.blueprintId]
    if (!obp) continue

    const { w: ow, h: oh } = artSize(obp)
    // The short way round, so a creature by the seam hunts across it rather than
    // reading its neighbour as six hundred tiles away and ignoring it. The sign
    // is also the direction `preyDir` sets off in below.
    const dx = deltaX(cx, other.x + ow / 2)
    const dy = other.y + oh / 2 - cy

    /**
     * Distance between the two sprites' nearest edges, not between their
     * centres — zero whenever they overlap.
     *
     * Centre-to-centre is the same mistake `BITE_PAD` was already written to
     * avoid, one step earlier in the same function: it charges a creature for
     * its own size *and* its neighbour's before either of them has moved. Kelp
     * is six tiles tall, so a fish resting against one was carrying three tiles
     * of made-up distance; a snail with fourteen tiles of sight standing on a
     * Grumblestone could not see it at all. Anything that could be bitten is now
     * guaranteed to be in range to be noticed, because a bite is a gap of zero.
     */
    const gapX = Math.max(0, Math.abs(dx) - (bw + ow) / 2)
    const gapY = Math.max(0, Math.abs(dy) - (bh + oh) / 2)
    const d2 = gapX * gapX + gapY * gapY

    if (fears(bp, obp)) {
      if (d2 <= sight2 && d2 < threatDist) {
        threatDist = d2
        threat = other
      }
      continue
    }

    // Its own kind. Nothing eats its own kind — `canEat` refuses a matching
    // blueprint id outright — so a creature that gets here can only ever be a
    // partner, and there is no case below worth falling through to.
    if (other.blueprintId === c.blueprintId) {
      if (seeking && d2 <= sight2 && readyToBreed(other, obp) && d2 < mateDist) {
        mateDist = d2
        mate = other
      }
      continue
    }

    // Symbiosis: skip attack against declared partner species.
    const isPartner = bp.symbiosisPartnerId && obp.id === bp.symbiosisPartnerId
    if (isPartner) {
      // Partner is near — grant bonus and skip attack.
      if (d2 <= sight2) {
        c.symbiosisTimer = Math.max(c.symbiosisTimer, (SENSE_EVERY / 60) * 2.5)
      }
      continue
    }

    const wantToEat =
      hungry ||
      (bp.clearingMaintainer === true &&
        obp.move.kind === 'root' &&
        other.ageSeconds < SEEDLING_MAX_AGE)
    if (wantToEat && canEat(bp, obp) && sizeOf(other) / sizeOf(c) < 1.8) {
      // Bodies touching? Eat now, don't bother pathing — camouflage can't save
      // something once the predator is already on top of it.
      const touching = gapX <= BITE_PAD && gapY <= BITE_PAD
      if (touching && bp.parasite) {
        // Parasites attach rather than kill — drain the host over time.
        c.hostId = other.id
        c.mood = 'eat'
        c.targetId = null
        if (other.mood === 'wander' || other.mood === 'rest') {
          other.mood = 'flee'
          other.targetId = c.id
        }
        return
      }
      if (touching) {
        // Eyespot deflection: false-eye markings redirect 40% of killing blows to
        // a non-vital region. The prey escapes with a burst of speed; the predator
        // lands a wing-tip bite and gains almost nothing from the missed kill.
        if (obp.eyespots === true && Math.random() < EYESPOT_DEFLECT_CHANCE) {
          other.vx = (other.x < c.x ? -1 : 1) * 150
          other.vy = -60
          other.mood = 'flee'
          other.targetId = c.id
          c.hunger = Math.max(0, c.hunger - mealFill(c, bp, obp, sizeOf(other)) * 0.05)
          c.mood = 'wander'
          c.targetId = null
          return
        }
        devour(w, other, obp, dead, events)
        c.hunger = Math.max(0, c.hunger - mealFill(c, bp, obp, sizeOf(other)))
        c.starving = 0
        c.huntBlockedId = null
        c.mealsEaten++
        if (c.mealsEaten === 1) logLife(c, w.elapsed, 'First meal')
        // Cooperative creatures signal food location to kin.
        if (
          ((c.traits as { cooperation?: number }).cooperation ?? 0.3) > 0.5 &&
          w.scents.length < 200
        ) {
          w.scents.push({ x: c.x, y: c.y, blueprintId: c.blueprintId, decaySeconds: 10 })
        }
        c.mood = 'eat'
        c.targetId = null
        // Toxic plants slow the eater — the meal lands, but at a cost.
        if (obp.toxicity) {
          c.poisoned = Math.max(c.poisoned, obp.toxicity * 5)
        }
        // Trait-level toxicity: venomous prey stuns the predator and cuts the meal.
        // High immunity in the predator reduces both effects — this is the arms-race
        // mechanic: toxic lineages and immune lineages co-evolve under mutual pressure.
        const preyToxicity = (other.traits as { toxicity?: number }).toxicity ?? 0
        if (preyToxicity > 0.5) {
          const eatImmunity = (c.traits as { immunity?: number }).immunity ?? 0.2
          const toxMod = Math.max(0, 1 - eatImmunity * 0.7)
          c.hunger = Math.min(1, c.hunger + TUNING.mealValue * preyToxicity * 0.5 * toxMod)
          c.stunTimer = Math.max((c as { stunTimer?: number }).stunTimer ?? 0, 1.5 * toxMod)
        }
        events.push({
          kind: 'ate',
          blueprintId: bp.id,
          victimId: obp.id,
          x: c.x,
          y: c.y,
        })
        return
      }
      // A still non-root animal blends in — detected at a shorter range.
      // Plants are exempt: the whole food chain depends on grazers finding them,
      // and roots never move anyway so they'd always benefit without this guard.
      const still =
        obp.move.kind !== 'root' && Math.abs(other.vx) + Math.abs(other.vy) < CAMOUFLAGE_STILL
      // Camouflage: trait scales how hard this creature is to spot.
      // Still creatures benefit most; moving gives most of it away.
      // For the tile lookup, read the tile the creature is standing on (the row
      // at its feet) rather than its vertical centre. Centre is always air for a
      // walking creature, which would make the colour match meaningless — the
      // relevant substrate is always the one the creature is resting against.
      // Chromatophore transition: for 2 ticks after a hue update the prey
      // is fully exposed (pigment cells incoherent). Override camouflage to 0.
      const chromaFade = (other as { chromatophoreFade?: number }).chromatophoreFade ?? 0
      const baseCamouflage =
        chromaFade > 0
          ? 0 // transitioning — briefly exposed
          : obp.cryptic
            ? Math.max(
                other.traits.camouflage,
                crypticCamouflage(
                  ((other.traits.hue % 360) + 360) % 360,
                  hexHue(
                    MATERIAL_BY_INDEX[tileAt(w, Math.floor(other.x + ow / 2), Math.floor(other.y + oh))]
                      ?.color ?? '#808080'
                  )
                )
              )
            : other.traits.camouflage
      // Countershading: dark-top/pale-belly structure eliminates shadow depth cues,
      // making the body appear flat and harder to resolve at any angle.
      // A fixed structural bonus — it does not depend on tile colour or evolution.
      const camouflage = obp.countershaded === true ? Math.min(1, baseCamouflage + 0.25) : baseCamouflage
      const detFactor = still
        ? Math.max(0.15, 0.5 - camouflage * 0.375) // 0.5 (camo=0) → 0.2 (camo=0.8)
        : 1 - camouflage * 0.3 // 1.0 (camo=0) → 0.76 (camo=0.8)
      const efs2 = foodSight2 * detFactor * detFactor
      // Disruptive coloration: at range the outline breaks into false edges.
      // The effect only applies beyond DISRUPTION_NEAR_TILES — up close, the body
      // registers as a coherent object regardless of the pattern.
      const disrupted =
        obp.disruptivePattern === true && d2 > DISRUPTION_NEAR_TILES * DISRUPTION_NEAR_TILES
      const finalEfs2 = disrupted ? efs2 * DISRUPTION_FAR_FACTOR * DISRUPTION_FAR_FACTOR : efs2
      if (d2 <= finalEfs2 && d2 < preyDist) {
        preyDist = d2
        prey = other
        preyDir = dx >= 0 ? 1 : -1
        preyCx = other.x + ow / 2
        preyCy = other.y + oh / 2
      }
    }

    // Territorial: well-fed creature drives non-prey non-predator intruders away.
    if (
      !hungry &&
      (c.traits.territorial ?? 0.5) > 0.4 &&
      other.blueprintId !== c.blueprintId &&
      !canEat(bp, obp) && // not our prey
      !canEat(obp, bp) && // not our predator
      obp.move.kind !== 'root' // not a plant
    ) {
      const territoryR = (c.traits.territorial ?? 0.5) * 10
      const intruderChromaFade = (other as { chromatophoreFade?: number }).chromatophoreFade ?? 0
      const intruderCamoBase =
        intruderChromaFade > 0
          ? 0
          : obp.cryptic
            ? Math.max(
                other.traits.camouflage,
                crypticCamouflage(
                  ((other.traits.hue % 360) + 360) % 360,
                  hexHue(
                    MATERIAL_BY_INDEX[tileAt(w, Math.floor(other.x + ow / 2), Math.floor(other.y + oh))]
                      ?.color ?? '#808080'
                  )
                )
              )
            : other.traits.camouflage
      const intruderCamo = obp.countershaded === true
        ? Math.min(1, intruderCamoBase + 0.25)
        : intruderCamoBase
      const effectiveTerritoryR = territoryR * (1 - intruderCamo * 0.5)
      if (d2 < effectiveTerritoryR * effectiveTerritoryR && d2 < preyDist) {
        preyDist = d2
        prey = other
        preyDir = dx >= 0 ? 1 : -1
        preyCx = other.x + ow / 2
        preyCy = other.y + oh / 2
      }
    }
  }

  // Scent following: cooperative creatures follow food beacons left by kin.
  // Only when wandering and hungry — not while actively fleeing or hunting a
  // visible target. High cooperation → stronger pull (weight = cooperation × 0.3).
  const cooperationVal = (c.traits as { cooperation?: number }).cooperation ?? 0.3
  ;(c as { followingScent?: boolean }).followingScent = false
  if (
    hungry &&
    !prey &&
    !threat &&
    c.mood === 'wander' &&
    w.scents.length > 0 &&
    cooperationVal > 0.5
  ) {
    const scentReach2 = sight * sight * 4
    const midX = cx
    const midY = c.y + bh / 2
    let nearestD2 = Infinity
    let nearestScent: Scent | null = null
    for (const s of w.scents) {
      if (s.blueprintId !== c.blueprintId) continue
      const sdx = deltaX(midX, s.x)
      const sdy = s.y - midY
      const d2 = sdx * sdx + sdy * sdy
      if (d2 < nearestD2 && d2 < scentReach2) {
        nearestD2 = d2
        nearestScent = s
      }
    }
    if (nearestScent) {
      // Softer than direct food following: a gentle bias rather than full
      // commitment. Cooperation scales the strength — a barely-cooperative
      // creature barely follows, a highly cooperative one follows reliably.
      const weight = cooperationVal * 0.3
      c.drift = deltaX(midX, nearestScent.x) > 0 ? weight : -weight
      ;(c as { followingScent?: boolean }).followingScent = true
    }
  }

  // Stuck detection — if this creature has been locked on the same prey for
  // too many consecutive passes without eating, the path is likely blocked.
  //
  // `huntPassCount` doubles as a post-stuck cooldown when negative. During the
  // cooldown the creature can't lock onto a specific target, which forces it to
  // forage freely and gives it a genuine chance to find a different angle or a
  // different meal, rather than immediately re-locking on the obstacle it just
  // bounced off.
  if (c.huntPassCount < 0) {
    // Still in cooldown: count up toward 0 and suppress target-locking.
    c.huntPassCount++
    prey = null
  } else if (prey !== null) {
    if (c.mood === 'hunt' && c.targetId === prey.id) {
      c.huntPassCount++
      if (c.huntPassCount >= STUCK_SENSE_PASSES) {
        // Record the blocked target so the mood block below treats it as
        // "smelled, not seen" after the cooldown — preventing the creature
        // from immediately re-locking and oscillating.
        c.huntBlockedId = prey.id
        prey = null
        // Reverse the committed direction so the next foraging leg actively
        // moves away from the obstacle rather than pressing back against it.
        c.drift = -Math.sign(c.drift || 1) as 1 | -1
        c.huntPassCount = -STUCK_COOLDOWN_PASSES
      }
    } else {
      c.huntPassCount = 0
    }
  } else if (c.mood !== 'hunt') {
    c.huntPassCount = 0
  }

  // Disease spread: an infected creature spreads to non-plant neighbours within 4 tiles.
  if (c.sick > 0 && bp.move.kind !== 'root') {
    const spreadReach = 4
    const sickNearby = gather(cx, spreadReach + bw / 2)
    for (let i = 0; i < sickNearby; i++) {
      const other = found[i]
      if (other.id === c.id || dead.has(other.id)) continue
      if ((other as { sick?: number }).sick) continue // already sick
      const obp = w.blueprints[other.blueprintId]
      if (!obp || obp.move.kind === 'root') continue
      const { w: ow, h: oh } = artSize(obp)
      const gdx = Math.max(0, Math.abs(deltaX(cx, other.x + ow / 2)) - (bw + ow) / 2)
      const gdy = Math.max(0, Math.abs(other.y + oh / 2 - (c.y + bh / 2)) - (bh + oh) / 2)
      if (gdx * gdx + gdy * gdy > spreadReach * spreadReach) continue
      const otherBp = w.blueprints[other.blueprintId]
      const rawOtherImmunity = (other.traits as { immunity?: number }).immunity ?? 0.2
      const otherImmunity = otherBp?.invasive ? Math.min(1, rawOtherImmunity + 0.56) : rawOtherImmunity
      if (rng() < TUNING.diseaseSpreadChance * (1 - otherImmunity)) {
        if (!other.sick) {
          events.push({ kind: 'sick', blueprintId: other.blueprintId, x: other.x, y: other.y })
        }
        other.sick = TUNING.diseaseDuration
      }
    }
  }

  // Spore infection: sporecap plants within 3 tiles have a 1% chance per tick
  // to give passing animals a brief fungal sickness (5 s, not the full 20 s of a
  // disease — enough to slow them, not kill them outright).
  if (bp.move.kind !== 'root') {
    const sporeReach = 3
    const sporeNearby = gather(cx, sporeReach)
    for (let si = 0; si < sporeNearby; si++) {
      const plant = found[si]
      if (plant.blueprintId !== 'sporecap') continue
      const pbp = w.blueprints[plant.blueprintId]
      if (!pbp || pbp.move.kind !== 'root') continue
      const { w: pw, h: ph } = artSize(pbp)
      const gdx = Math.max(0, Math.abs(deltaX(cx, plant.x + pw / 2)) - (bw + pw) / 2)
      const gdy = Math.max(0, Math.abs(plant.y + ph / 2 - (c.y + bh / 2)) - (bh + ph) / 2)
      if (gdx * gdx + gdy * gdy > sporeReach * sporeReach) continue
      if (rng() < TUNING.diseaseSpreadChance * 0.2) {
        if (!c.sick) events.push({ kind: 'sick', blueprintId: c.blueprintId, x: c.x, y: c.y })
        c.sick = Math.max(c.sick ?? 0, 5)
      }
      break // one nearby sporecap is enough per tick
    }
  }

  // Pack hunting: scan for same-species neighbours targeting the same prey.
  //
  // Cooperation gates participation: creatures with cooperation < 0.2 are
  // loners and never join. For the rest, count how many pack members share
  // this target and redirect idle kin with high cooperation toward it.
  const packCooperation = (c.traits as { cooperation?: number }).cooperation ?? 0.3
  if (prey !== null && packCooperation >= 0.2) {
    const packReach = sight + bw / 2
    const packNearby = gather(cx, packReach)
    let packCount = 0
    for (let pi = 0; pi < packNearby; pi++) {
      const pk = found[pi]
      if (pk.id === c.id) continue
      if (pk.blueprintId !== c.blueprintId) continue
      const pkCoop = (pk.traits as { cooperation?: number }).cooperation ?? 0.3
      if (pk.targetId === prey.id) {
        packCount++
      } else if (pkCoop >= 0.4 && pk.targetId === null && pk.mood === 'wander' && packCount > 0) {
        // Recruit idle, cooperative kin to the pack's target.
        pk.targetId = prey.id
        pk.mood = 'hunt'
      }
    }
    // Grant one sense-interval of bonus (plus a little buffer) so it persists
    // until the next pass rather than dropping between ticks.
    const inPack = packCount > 0
    c.packTimer = inPack ? (SENSE_EVERY / 60) * 2.5 : 0
    c.packSize = inPack ? packCount + 1 : 0
  } else {
    c.packTimer = 0
    c.packSize = 0
  }

  // A starving creature ignores threats — the instinct to eat overrides the
  // instinct to survive. Hunger >= 1 means the starvation timer is already
  // running, so the animal has nothing left to lose by charging toward food.
  if (threat && c.hunger < 1) {
    c.mood = 'flee'
    c.targetId = threat.id
  } else if (
    prey &&
    prey.id !== c.huntBlockedId &&
    (preyDist <= sight2 || clearRun(w, bp, cx, cy, preyCx, preyCy))
  ) {
    // Lock onto reachable prey. Clearing huntBlockedId here means the creature
    // gets a clean slate whenever it finds a *different* target — it only
    // ignores the specific prey it recently bounced off.
    c.huntBlockedId = null
    c.mood = 'hunt'
    c.targetId = prey.id
  } else if (prey) {
    /**
     * Smelled, not seen — food inside the hunger reach but past plain sight.
     * Also used when the prey is the one we last got stuck on (huntBlockedId):
     * steer toward it via drift rather than hard-locking, so the hazard check
     * still applies and the creature turns at walls instead of pressing against
     * them forever.
     *
     * A bearing to set off on, not a thing to lock onto. Locking on is what the
     * first cut of this did, and it was worse than not finding the food at all:
     * a Finling with sixty tiles of hunger reach picked kelp on the far side of
     * a spit of sand and spent the rest of its short life pressed against the
     * shore swimming at it, while the kelp in its own pool went unbitten. There
     * is no pathfinding here and there should not be — a creature that cannot
     * see a thing has no business knowing how to get to it.
     *
     * Handing it to `drift` means steering treats this as ordinary wandering,
     * so the hazard check still applies and the animal will still turn at a
     * wall. What it buys is a direction better than a coin flip.
     */
    c.mood = 'hunt'
    c.targetId = null
    c.drift = preyDir
  } else if (mate) {
    // Below hunting, above wandering. A creature well fed enough to breed is by
    // definition not hungry enough to have picked prey, so in practice these two
    // almost never compete — but where they do, dinner comes first.
    c.mood = 'mate'
    c.targetId = mate.id
  } else {
    // A well-fed grounded non-root creature rests. Roots are excluded — they
    // don't call steer anyway, and the 'wander' default keeps their inspector
    // line reading as 'Growing quietly' rather than 'Resting'.
    if (c.hunger < 0.25 && c.grounded && bp.move.kind !== 'root') {
      c.mood = 'rest'
    } else {
      c.mood = c.hunger > 0.75 ? 'hunt' : 'wander'
    }
    c.targetId = null
  }
}

/**
 * Is there a straight run between here and there that this creature could
 * actually take?
 *
 * Only asked about food found past plain sight, and only about the one nearest
 * thing, so it costs a couple of dozen tile reads per hungry creature per sense
 * pass and nothing at all for a fed one.
 *
 * This is what decides whether smelling something distant becomes a target or
 * only a bearing, and the split matters in both directions. A Glimmer Moth
 * pointed at a flower forty tiles across open air should simply go to it — that
 * is what having wings is. A Finling pointed at kelp on the far side of a sand
 * bar should not, and when it did, it spent its life pressed against the shore
 * while the kelp in its own pool went unbitten.
 *
 * Deliberately a straight line and deliberately coarse: it is a check on
 * whether the animal is fooling itself, not a route. Sampling every couple of
 * tiles will miss a one-tile gap in a wall, which is the right kind of wrong —
 * the creature walks over, finds the wall, and turns like it would have anyway.
 */
function clearRun(
  w: WorldState,
  bp: CreatureBlueprint,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  const needsWater = bp.move.kind === 'swim' || !!bp.habitat.needs?.includes('water')
  // The run is sampled along the shorter way round; the tile reads below wrap on
  // their own, so a line that leaves the right edge carries on from the left.
  const dx = deltaX(fromX, toX)
  const dy = toY - fromY
  const steps = Math.min(24, Math.max(2, Math.ceil(Math.hypot(dx, dy) / 2)))
  for (let i = 1; i < steps; i++) {
    const x = Math.floor(fromX + (dx * i) / steps)
    const y = Math.floor(fromY + (dy * i) / steps)
    if (solidAt(w, x, y)) return false
    // Air is a wall to a fish, exactly as much as rock is.
    if (needsWater && !liquidAt(w, x, y)) return false
  }
  return true
}

/**
 * How much eating one prey item reduces the eater's hunger.
 * - Base: TUNING.mealValue
 * - Size ratio: prey mass / eater mass, clamped [0.3, 3.0]
 *   A mite eating a sunleaf gets a fraction; a gulper eating a hopper gets a bonus.
 * - Plant penalty: plants have low caloric density (−15% of base)
 */
function mealFill(
  eater: Creature,
  eaterBp: CreatureBlueprint,
  preyBp: CreatureBlueprint,
  preyTraitSize = 1
): number {
  const preyMass = preyBp.size * preyTraitSize
  const eaterMass = eaterBp.size * sizeOf(eater)
  const sizeFactor = Math.max(0.3, Math.min(3.0, preyMass / eaterMass))
  let fill = TUNING.mealValue * sizeFactor
  if (preyBp.move.kind === 'root') fill -= TUNING.mealValue * 0.15
  return Math.max(0, fill)
}

function devour(
  w: WorldState,
  victim: Creature,
  victimBp: CreatureBlueprint,
  dead: Set<number>,
  events: SimEvent[]
): void {
  if (dead.has(victim.id)) return
  dead.add(victim.id)
  const { w: vw, h: vh } = artSize(victimBp)
  // Animals leave a carcass. Plants vanish cleanly — grazers find them alive.
  if (victimBp.move.kind !== 'root') {
    w.carcasses.push({
      id: w.nextCarcassId++,
      // Wrapped, like every stored x — half a sprite past the last column is
      // column zero, not column 673, and `deltaX` is entitled to assume it.
      x: wrapX(victim.x + vw / 2),
      y: victim.y + vh / 2,
      decaySeconds: 15,
      blueprintId: victim.blueprintId,
    })
  }
  emitParticles(
    w,
    victim.x + vw / 2,
    victim.y + vh / 2,
    victimBp.death.particleColor,
    victimBp.death.particleCount
  )
  events.push({
    kind: 'eaten',
    blueprintId: victimBp.id,
    x: victim.x,
    y: victim.y,
  })
}

/**
 * What one animal gives up for a child it just had a share in.
 *
 * Called once per parent. Both are charged the same, and each is asked about
 * helpers separately: a pollinator standing over one of them but not the other
 * genuinely only helps the one it is standing over, and averaging that away
 * would make the aura's radius mean nothing.
 *
 * Clearing the target matters more than it looks. Both are on cooldown now, so
 * neither can breed — but steering runs every tick while the sense pass only
 * re-decides every sixth, and without this the pair spends those ticks still
 * walking determinedly towards each other for no reason anyone can see.
 */
function payForChild(
  w: WorldState,
  parent: Creature,
  bp: CreatureBlueprint,
  bw: number,
  bh: number,
  helpers: Creature[]
): void {
  parent.hunger = Math.min(1, parent.hunger + TUNING.breedCost)
  parent.breedCooldown =
    (TUNING.breedCooldown *
      ((parent.traits as { reproductionCooldown?: number }).reproductionCooldown ?? 1) *
      (bp.slowMetabolism ? 2 : 1) *
      (bp.invasive ? 0.67 : 1)) /
    auraBoost(w, parent, bp, bw, bh, helpers)
  if (parent.mood === 'mate') {
    parent.mood = 'wander'
    parent.targetId = null
  }
}

// ---------------------------------------------------------------------------
// Auras — creatures that change the world instead of only living in it
// ---------------------------------------------------------------------------

/**
 * How much faster this creature breeds thanks to helpers standing nearby.
 *
 * Returns 1 when nothing is helping, which is the overwhelmingly common case —
 * hence the early exit on an empty helper list, so a world with no bees in it
 * pays nothing for the feature.
 */
function auraBoost(
  w: WorldState,
  c: Creature,
  bp: CreatureBlueprint,
  bw: number,
  bh: number,
  helpers: Creature[]
): number {
  if (helpers.length === 0) return 1
  const cx = c.x + bw / 2
  const cy = c.y + bh / 2

  let best = 1
  for (const helper of helpers) {
    if (helper.id === c.id) continue
    const aura = w.blueprints[helper.blueprintId]?.aura
    if (!aura || aura.helps.length === 0) continue
    if (!aura.helps.some(tag => bp.tags.includes(tag))) continue

    const hbp = w.blueprints[helper.blueprintId]
    if (!hbp) continue
    const { w: hw, h: hh } = artSize(hbp)
    const dx = deltaX(cx, helper.x + hw / 2)
    const dy = helper.y + hh / 2 - cy
    if (dx * dx + dy * dy > aura.radius * aura.radius) continue
    // Best helper wins rather than stacking — twenty bees in one flowerbed
    // shouldn't make it breed twenty times as fast.
    if (aura.boost > best) best = aura.boost
  }
  return best
}

/**
 * Slowly turn the ground into something else — a worm making soil out of rock.
 *
 * Only one tile at a time, and only tiles that already match `from`, so this
 * enriches a world rather than rewriting it. A single loamworm takes minutes to
 * make a visible patch, which is the point: you notice it after you stop
 * watching it.
 */
function applyConversion(
  w: WorldState,
  c: Creature,
  bp: CreatureBlueprint,
  bw: number,
  bh: number,
  dt: number,
  rng: Rng
): void {
  const aura = bp.aura
  if (!aura?.converts) return
  if (rng() > aura.convertRate * dt) return

  const from = MATERIAL_INDEX[aura.converts.from]
  const to = MATERIAL_INDEX[aura.converts.to]
  if (from === undefined || to === undefined) return

  const cx = c.x + bw / 2
  const cy = c.y + bh / 2
  for (let attempt = 0; attempt < 6; attempt++) {
    const tx = Math.floor(cx + (rng() * 2 - 1) * aura.radius)
    const ty = Math.floor(cy + (rng() * 2 - 1) * aura.radius)
    if (!inBounds(tx, ty)) continue
    if (tileAt(w, tx, ty) !== from) continue
    setTile(w, tx, ty, to)
    return
  }
}

// ---------------------------------------------------------------------------
// Steering
// ---------------------------------------------------------------------------

/**
 * How many tiles of ledge a walker's legs can take without jumping.
 *
 * One tile per five of body height. Everything that existed before big
 * creatures did is under ten tall, so they all get exactly the one tile they
 * always had — but a tyrannosaur steps over a boulder instead of wedging
 * against it, which is what it was doing.
 *
 * Shared rather than restated because `steer` decides whether to jump and
 * `integrate` decides whether the step actually happened, and the one thing
 * that must never be true is that they disagree: a walker told it is not
 * blocked, by collision that then blocks it, grinds against the tile forever.
 */
function stepHeight(body: BodyBox): number {
  return Math.max(1, Math.floor(body.h / 5))
}

/**
 * How far this creature would have to rise to get past whatever is directly
 * ahead of it, in tiles. Zero means clear walking.
 *
 * Scans the one column past its leading edge from the top of the body down and
 * measures from the *highest* solid tile in it, so an overhang at head height
 * reads as impassable rather than as a one-tile ledge — which it is, for
 * something trying to walk under it.
 *
 * This replaced a single lookup at mid-body height, and the single lookup was
 * most of why creatures got stuck on small things. It could only see obstacles
 * taller than half the creature, so anything from one tile up to half a body
 * height was invisible to the jump decision and impassable to the legs at the
 * same time. The taller the animal, the wider that dead band: a tyrannosaur
 * could be stopped indefinitely by a six-tile rock it never knew was there.
 */
function riseAhead(w: WorldState, c: Creature, body: BodyBox, dir: number): number {
  const col =
    dir > 0 ? Math.floor(c.x + body.dx + body.w - 0.001) + 1 : Math.floor(c.x + body.dx) - 1
  const top = Math.floor(c.y + body.dy)
  const bottom = Math.floor(c.y + body.dy + body.h - 0.001)
  for (let ty = top; ty <= bottom; ty++) {
    if (solidAt(w, col, ty)) return bottom - ty + 1
  }
  return 0
}

/**
 * Is the way it is wandering somewhere it cannot survive?
 *
 * Two tiles ahead, no further. This is an animal noticing the heat off the lava
 * or the edge of the water, not pathfinding — it has no idea what is past that,
 * and giving it one would make the world stop feeling like animals in it.
 *
 * Asked only while wandering, which is what makes it affordable and also what
 * makes it right: an animal *hunting* something should be allowed to take a
 * risk for it, and one fleeing should be allowed to run somewhere stupid. This
 * only governs where it drifts when it has nothing better to do.
 *
 * It earns its place off the committed-heading change above. Picking a
 * direction and keeping it is a large improvement for anything that can go
 * anywhere and a death sentence for anything that cannot: measured on tidepool,
 * committed Finlings swam straight out of the pond and the habitat timer killed
 * them in nine seconds, costing more fish than the wider search saved.
 */
function unliveableAhead(
  w: WorldState,
  c: Creature,
  bp: CreatureBlueprint,
  body: BodyBox,
  dir: number
): boolean {
  const x = dir > 0 ? c.x + body.dx + body.w + 1 : c.x + body.dx - 2
  const y = c.y + body.dy

  const mat = boxDeadlyMaterial(w, x, y, 1, body.h)
  if (mat !== null && !bp.body.immuneTo.some(m => MATERIAL_INDEX[m] === mat)) return true

  // The same question, and the same threshold, that the environment check up in
  // `tickCreatures` is about to kill it for getting wrong.
  const needsWater = bp.move.kind === 'swim' || !!bp.habitat.needs?.includes('water')
  if (needsWater && boxLiquidFraction(w, x, y, 1, body.h) < 0.25) return true

  return false
}

/**
 * Whether moving in the normalised direction (dx, dy) would walk into a solid
 * tile within the next step — the obstacle detector for the steering layer.
 *
 * Uses a short look-ahead along the *leading edge* of the body box rather than
 * the centre, so the check fires before the collision engine would, giving the
 * creature time to steer clear instead of bouncing. Only called for locomotion
 * that cares about terrain (walk/crawl); flyers and swimmers skip it.
 */
function solidAhead(w: WorldState, c: Creature, body: BodyBox, dx: number, dy: number): boolean {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return false
  const lookDist = 1.5
  const tx = c.x + body.dx + (dx > 0 ? body.w : 0) + dx * lookDist
  const ty = c.y + body.dy + (dy > 0 ? body.h / 2 : 0)
  return boxHitsSolid(w, tx, ty, body.w * 0.6, body.h * 0.6)
}

/**
 * Launch velocity for a creature that means to clear `move.jump` worth of
 * height — see `JUMP_TILES_PER_STRENGTH` for why `jump` stopped being a
 * velocity in the first place.
 *
 * Solved against base `GRAVITY` and the creature's own mass, and deliberately
 * *not* against the theme's gravity multiplier. A leap is then worth the same
 * number of tiles in every world the player builds, so a creature that clears
 * its own garden wall on earth still clears it in a volcano — while the station
 * at 0.35g sends the very same push nearly three times as high, which is the
 * whole point of the station.
 */
function jumpSpeed(bp: CreatureBlueprint): number {
  if (bp.move.jump <= 0) return 0
  return Math.sqrt(2 * GRAVITY * bp.body.mass * bp.move.jump * JUMP_TILES_PER_STRENGTH)
}

function steer(w: WorldState, c: Creature, bp: CreatureBlueprint, dt: number, rng: Rng): void {
  const { w: bw, h: bh } = artSize(bp)
  const body = bodyBox(bp)
  const cx = c.x + bw / 2
  const cy = c.y + bh / 2

  // Attached parasite: snap to host position and return — no other steering.
  if (c.hostId != null) {
    const host = findCreature(w, c.hostId)
    if (host) {
      c.x = host.x + 0.5 // small offset so they're not perfectly overlapping
      c.y = host.y - 0.3
      c.vx = 0
      c.vy = 0
      return
    }
    c.hostId = null // host gone, detach
  }

  let wantX = 0
  let wantY = 0

  const target = c.targetId !== null ? findCreature(w, c.targetId) : null
  if (target) {
    const tbp = w.blueprints[target.blueprintId]
    const size = tbp ? artSize(tbp) : { w: 1, h: 1 }
    // Chase (or flee) by the shorter route. This is the line that makes a hunter
    // step across the seam after its prey instead of turning round and running
    // the long way to the same place.
    const dx = deltaX(cx, target.x + size.w / 2)
    const dy = target.y + size.h / 2 - cy
    const len = Math.hypot(dx, dy) || 1
    const sign = c.mood === 'flee' ? -1 : 1
    wantX = (dx / len) * sign
    wantY = (dy / len) * sign
  } else if (c.mood === 'rest') {
    // Resting — no active movement. `wantX` and `wantY` stay at 0, so physics
    // runs without any locomotion drive: gravity keeps walkers grounded, drag
    // bleeds off any residual velocity, and the creature sits still.
    c.targetId = null
  } else {
    /**
     * Nothing worth going to. Either mill about, or go looking.
     *
     * Idle wander re-rolls the heading at a rate set by `restlessness`, which is
     * a random walk — and a random walk covers ground like the *square root* of
     * time. That is the right shape for an animal browsing a patch it is already
     * standing in and completely the wrong one for an animal that has to find
     * the next patch, which is the situation every grazer in the harness died
     * in: food a median of two to four sight-radii away, and a search pattern
     * that mostly returned it to where it started.
     *
     * Past `FORAGE_HUNGER` the re-rolls slow to a fifth and the heading snaps to
     * full magnitude, so it picks a way and commits. Committed travel covers
     * ground linearly, which over the minute or so an animal has between full
     * and dead is the difference between crossing twenty tiles and crossing two
     * hundred. It still turns at walls and at the edge of the world — that is
     * what keeps "commit" from meaning "walk into a corner and stay there".
     */
    const searching = c.hunger > FORAGE_HUNGER
    if (rng() < bp.move.restlessness * dt * 4 * (searching ? 0.2 : 1)) {
      c.drift = searching ? (rng() < 0.5 ? -1 : 1) : rng() * 2 - 1
    } else if (searching && Math.abs(c.drift) < 1) {
      // Got hungry mid-amble. Straighten up now rather than dawdling at a
      // quarter speed until the next re-roll, which at this rate is a long way
      // off — that wait was itself worth several seconds of starving.
      c.drift = c.drift >= 0 ? 1 : -1
    }
    // Committing to a heading is only an improvement if the heading isn't fatal.
    // If both directions are lethal (trapped between two hazards), stop rather
    // than flip every tick — oscillating between two walls looks broken.
    if (c.drift !== 0 && unliveableAhead(w, c, bp, body, c.drift > 0 ? 1 : -1)) {
      const opposite = -c.drift as 1 | -1
      if (!unliveableAhead(w, c, bp, body, opposite > 0 ? 1 : -1)) {
        c.drift = opposite
      } else {
        c.drift = 0
      }
    }
    // Pull toward home when far away — but not when starving. A creature that
    // has exhausted its local food must be free to range until it finds more.
    // Roam multiplies the leash so wide-ranging creatures drift further.
    if (
      (c.traits.territorial ?? 0.5) > 0.2 &&
      c.hunger <= 0.6 &&
      distX(c.homeX, c.x) > 15 * (c.traits.roam ?? 1)
    ) {
      // Head home the short way. Straight comparison would send an animal that
      // wandered a few tiles past the seam marching away from a home it is
      // standing almost on top of.
      c.drift = deltaX(c.x, c.homeX) > 0 ? 1 : -1
    }
    // Migration: when hunger has gone unmet for long enough, steer toward
    // plant-richer terrain instead of wandering or returning home.
    // Rate-limited via rng() so the tile scan fires ~once per second
    // rather than every tick — about 0.017 per tick at 60 Hz.
    if (c.migrateTimer > TUNING.migrationThreshold && bp.move.kind !== 'root' && rng() < 0.017) {
      const grassIdx = MATERIAL_INDEX.grass
      const mossIdx = MATERIAL_INDEX.moss
      let leftScore = 0
      let rightScore = 0
      const baseX = Math.round(c.x)
      const baseY = Math.round(c.y)
      for (let dy = -20; dy <= 20; dy += 10) {
        const sy = Math.max(0, Math.min(WORLD_H - 1, baseY + dy))
        for (let dx = 12; dx <= 160; dx += 12) {
          // No clamping any more: the scan runs off either side and comes back
          // in on the other. Clamping used to pile every sample past the edge
          // onto the same column, so an animal near the end of the world scored
          // one tile fourteen times and migrated on the strength of it.
          const lMat = tileAt(w, baseX - dx, sy)
          const rMat = tileAt(w, baseX + dx, sy)
          if (lMat === grassIdx || lMat === mossIdx) leftScore++
          if (rMat === grassIdx || rMat === mossIdx) rightScore++
        }
      }
      if (leftScore !== rightScore) {
        c.drift = leftScore > rightScore ? -1 : 1
      }
    }
    wantX = c.drift
    wantY = bp.move.kind === 'fly' || bp.move.kind === 'swim' ? (rng() - 0.5) * 0.6 : 0
    c.targetId = null
  }

  // Obstacle avoidance: walk and crawl locomotion steer around solid walls.
  // Flyers and swimmers are free to move through/over terrain so skip this.
  if (bp.move.kind === 'walk' || bp.move.kind === 'crawl') {
    const len = Math.hypot(wantX, wantY)
    if (len > 0.01 && solidAhead(w, c, body, wantX / len, wantY / len)) {
      const angle = Math.atan2(wantY, wantX)
      const tries = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]
      let cleared = false
      for (const delta of tries) {
        const a = angle + delta
        const tx = Math.cos(a)
        const ty = Math.sin(a)
        if (!solidAhead(w, c, body, tx, ty)) {
          wantX = tx
          wantY = ty
          cleared = true
          break
        }
      }
      if (!cleared) {
        wantX = 0
        wantY = 0
      }
    }
  }

  // Poison from a toxic plant halves movement speed for its duration.
  // Larger creatures are slower: size is a denominator, not a multiplier.
  const diurnal = (c.traits as { diurnal?: number }).diurnal ?? 0
  const nightFactor =
    TUNING.dayLengthSeconds > 0
      ? (1 - Math.cos((2 * Math.PI * w.elapsed) / TUNING.dayLengthSeconds)) / 2
      : 0
  const diurnalPenalty =
    Math.max(0, diurnal > 0 ? diurnal * nightFactor : -diurnal * (1 - nightFactor)) * 0.5
  const speed =
    ((speedOf(c, bp) *
      (c.poisoned > 0 ? 0.5 : 1) *
      (c.packTimer > 0 ? 1.2 : 1) *
      (c.stunTimer > 0 ? 0.2 : 1) *
      (c.sick > 0 ? 0.7 : 1) *
      (c.symbiosisTimer > 0 ? 1.15 : 1) *
      (1 - Math.max(0, (c.fatigue ?? 0) - 0.5))) /
      sizeOf(c)) *
    (1 - diurnalPenalty)
  const accel = speed * 6

  switch (bp.move.kind) {
    case 'walk': {
      // Mud slows walkers to 50%; quicksand slows progressively toward 0.
      const footX = Math.floor(c.x + body.dx + body.w / 2)
      const footY = Math.floor(c.y + body.dy + body.h)
      const groundId = MATERIAL_BY_INDEX[tileAt(w, footX, footY)]?.id
      const groundMult =
        groundId === 'mud' ? 0.5 : groundId === 'quicksand' ? Math.max(0.05, 1 - c.sinking / 8) : 1
      c.vx += wantX * accel * dt
      c.vx = clampMag(c.vx, speed * groundMult)

      /**
       * Jump when there's something in the way its legs can't take, or when the
       * target is overhead.
       *
       * `ahead` is where it *wants* to go, not where it is going. Reading the
       * sign of `c.vx` looked equivalent and was the opposite: a walker that has
       * just hit a wall has had its velocity reversed by the bounce, so the very
       * tick it most needs to jump, the probe is pointed back the way it came
       * and reports clear ground. It would then accelerate into the wall again,
       * bounce again, and check behind itself again, indefinitely.
       */
      const ahead = wantX !== 0 ? Math.sign(wantX) : c.facing
      const blocked = riseAhead(w, c, body, ahead) > stepHeight(body)
      const wantsUp = wantY < -0.4

      /**
       * How badly it wants to be off the ground, in launches per second.
       *
       * Fleeing is the case that earns this. A walker that only ever runs
       * sideways is caught by anything faster than it, so every chase had the
       * same ending; going *over* the thing chasing you is the one answer a
       * pursuer can't match by simply being quicker. Reaching for prey overhead
       * is the same move from the other side. An unbothered walker still stays
       * on the ground, which is what keeps a leap worth watching.
       *
       * The reaching term is the old per-tick 0.08 restated per second, so a
       * hunter still climbs after prey exactly as eagerly as it used to; the
       * fleeing term is new, and adds to it when a cornered creature is both
       * running away and looking up.
       */
      const urgency = (wantsUp ? 4.8 : 0) + (c.mood === 'flee' ? 3 : 0)

      // A hopper doesn't run, it launches: its whole speed is spent at take-off
      // rather than built up by its legs, so it covers roughly the ground a
      // walker does but in arcs, with a beat on landing. That beat is the trade
      // — it can still steer in the air, but it cannot turn round on the spot
      // the way something running can.
      const going = Math.abs(wantX) > 0.15
      const launch = jumpSpeed(bp)
      if (c.grounded && bp.move.hop > 0 && going && rng() < bp.move.hop * 6 * dt) {
        c.vx = Math.sign(wantX) * speed
        c.vy = -launch
        c.grounded = false
      } else if (c.grounded && (blocked || rng() < urgency * dt)) {
        c.vy = -launch
        c.grounded = false
      }
      break
    }
    case 'fly': {
      c.vx += wantX * accel * dt
      c.vy += wantY * accel * dt
      c.vx = clampMag(c.vx, speed)
      c.vy = clampMag(c.vy, speed)
      break
    }
    case 'swim': {
      const wet = boxLiquidFraction(w, c.x, c.y, bw, bh)
      if (wet > 0.3) {
        // Current adds directly to the swimmer's acceleration. Swimming with
        // the current is free speed; fighting it costs effort.
        const cx = TUNING.currentX
        const cy = TUNING.currentY
        c.vx += (wantX * accel + cx) * dt
        c.vy += (wantY * accel + cy) * dt
        c.vx = clampMag(c.vx, speed + Math.abs(cx) * 0.5)
        c.vy = clampMag(c.vy, speed + Math.abs(cy) * 0.5)
      } else {
        // Beached — flop uselessly and hope for the best.
        if (c.grounded && rng() < 6 * dt) {
          c.vy = -6
          c.vx = (rng() - 0.5) * 6
        }
      }
      break
    }
    case 'crawl': {
      // Sticks to any surface, so it moves in 2D but only along walls.
      const touching = touchesSurface(w, c, body)
      if (touching) {
        c.vx += wantX * accel * dt
        c.vy += wantY * accel * dt
        c.vx = clampMag(c.vx, speed)
        c.vy = clampMag(c.vy, speed)
      } else {
        c.vx += wantX * accel * dt * 0.3
      }
      break
    }
    case 'drift': {
      // Drifters go where the water takes them — current carries them freely.
      const cx = TUNING.currentX
      const cy = TUNING.currentY
      c.vx += (wantX * accel * 0.4 + cx) * dt
      c.vy += (wantY * accel * 0.4 + cy) * dt
      c.vx = clampMag(c.vx, speed + Math.abs(cx) * 0.5)
      c.vy = clampMag(c.vy, (speed + Math.abs(cy) * 0.5) * 0.8)
      break
    }
  }

  if (bp.art.faceMotion && Math.abs(c.vx) > 0.2) {
    c.facing = c.vx > 0 ? 1 : -1
  }
}

function touchesSurface(w: WorldState, c: Creature, body: BodyBox): boolean {
  const x0 = Math.floor(c.x + body.dx) - 1
  const x1 = Math.floor(c.x + body.dx + body.w - 0.001) + 1
  const y0 = Math.floor(c.y + body.dy) - 1
  const y1 = Math.floor(c.y + body.dy + body.h - 0.001) + 1
  for (let x = x0; x <= x1; x++) {
    if (solidAt(w, x, y0) || solidAt(w, x, y1)) return true
  }
  for (let y = y0; y <= y1; y++) {
    if (solidAt(w, x0, y) || solidAt(w, x1, y)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------

/**
 * Is there anything solid directly under this body?
 *
 * The row below a box at `y` with height `h` is `floor(y + h - 0.001) + 1` —
 * the same arithmetic `settleOnGround` owns and for the same reason: the naive
 * `floor(y + h)` asks about a row the box is already standing in, which
 * collision has just proven empty, so it always answers "no ground" and every
 * plant in the world would think it was falling.
 */
function hasFooting(w: WorldState, c: Creature, body: BodyBox): boolean {
  const y = Math.floor(c.y + body.dy + body.h - 0.001) + 1
  if (y >= WORLD_H) return true
  const x0 = Math.floor(c.x + body.dx)
  const x1 = Math.floor(c.x + body.dx + body.w - 0.001)
  for (let x = x0; x <= x1; x++) {
    if (solidAt(w, x, y)) return true
  }
  return false
}

function integrate(
  w: WorldState,
  c: Creature,
  bp: CreatureBlueprint,
  bw: number,
  bh: number,
  dt: number,
  wet: number,
  gravityScale: number
): void {
  const kind = bp.move.kind
  const body = bodyBox(bp)
  const inLiquid = wet > 0.3
  const weightless = kind === 'fly' || (kind === 'crawl' && touchesSurface(w, c, body))

  // Cloud and sap: not walls, but not nothing either. A high viscosity holds
  // you up against gravity and bleeds off whatever speed you arrived with, so
  // you sink through a cloud instead of dropping through it.
  const goo = boxViscosity(w, c.x + body.dx, c.y + body.dy, body.w, body.h)
  const inGoo = goo > 0.05

  if (!weightless) {
    let g = TUNING.gravity * bp.body.mass * gravityScale
    if (inLiquid) {
      // Buoyancy above 1 pushes up harder than gravity pulls down.
      g *= 1 - bp.body.buoyancy
    }
    if (kind === 'drift') g *= 0.35
    if (inGoo) g *= 1 - goo * 0.85
    c.vy += g * dt
  }

  // Drag. `body.drag` is the fraction of speed kept per second.
  let dragBase = inLiquid ? bp.body.drag * 0.45 : bp.body.drag
  if (inGoo) dragBase *= 1 - goo * 0.75
  const keep = Math.pow(Math.max(0.001, dragBase), dt)
  c.vx *= keep
  if (weightless || inLiquid || inGoo || kind === 'drift') c.vy *= keep

  c.vy = Math.max(-MAX_FALL, Math.min(MAX_FALL, c.vy))
  c.vx = Math.max(-MAX_FALL, Math.min(MAX_FALL, c.vx))

  const canStepUp = kind === 'walk'

  // Everything below works in *core* coordinates and converts back at the end.
  // `c.x`/`c.y` are the sprite's top-left; the core sits at `+ body.dx/dy`, so
  // snapping the sprite against a tile directly would wedge a big creature by
  // however far its wings stick out.
  const ox = body.dx
  const oy = body.dy

  // --- horizontal ---
  const nx = c.x + c.vx * dt

  // Walk up a ledge without needing to jump — see `stepHeight`, which `steer`
  // reads too so the jump decision and the collision agree about what counts as
  // a wall.
  const maxStep = canStepUp ? stepHeight(body) : 0
  let step = -1
  for (let s = 0; s <= maxStep; s++) {
    if (!boxHitsSolid(w, nx + ox, c.y + oy - s, body.w, body.h)) {
      step = s
      break
    }
  }

  if (step >= 0) {
    c.x = nx
    c.y -= step
  } else {
    const bx = nx + ox
    c.x = (c.vx > 0 ? Math.floor(bx + body.w - 0.001) - body.w : Math.floor(bx) + 1) - ox
    c.vx = -c.vx * bp.body.bounce
    /**
     * Give up on this direction only if it isn't already on its way over.
     *
     * `steer` runs before this, so on the tick a walker launches at a ledge it
     * is still standing flat against it and the horizontal move still fails.
     * Turning it round here undid the jump it had just decided on: it went up,
     * came down facing the way it came, and walked back. Repeat forever, one
     * bounce per approach, never once clearing the ledge. A creature with
     * upward velocity has a plan — let it finish before ruling on it.
     */
    if (c.vy >= 0) {
      c.drift = -c.drift
      c.facing = (c.facing === 1 ? -1 : 1) as 1 | -1
    }
  }

  // --- vertical ---
  c.grounded = false
  const ny = c.y + c.vy * dt
  if (!boxHitsSolid(w, c.x + ox, ny + oy, body.w, body.h)) {
    c.y = ny
  } else {
    const by = ny + oy
    if (c.vy > 0) {
      c.y = Math.floor(by + body.h - 0.001) - body.h - oy
      c.grounded = true
    } else {
      c.y = Math.floor(by) + 1 - oy
    }
    c.vy = Math.abs(c.vy) > 4 ? -c.vy * bp.body.bounce : 0
  }

  // Ground friction, so walkers don't skate.
  if (c.grounded && kind === 'walk') c.vx *= Math.pow(0.02, dt)

  /**
   * Round the cylinder, and never out of the top or the bottom.
   *
   * This is the line that makes the world loop. Everything above it works in
   * unwrapped coordinates — a creature stepping off the right edge is briefly at
   * x = 672.4, and the collision resolution just above needs it to stay that way
   * so its push-out arithmetic lands on the tile it actually hit. Normalising
   * once, here, at the end, is what keeps the invariant in `domain/wrap.ts` true
   * without any of the movement code having to think about the seam.
   */
  c.x = wrapX(c.x)
  c.y = Math.max(0, Math.min(WORLD_H - bh, c.y))
}

function clampMag(v: number, max: number): number {
  return Math.max(-max, Math.min(max, v))
}

function findCreature(w: WorldState, id: number): Creature | null {
  for (const c of w.creatures) if (c.id === id) return c
  return null
}

// ---------------------------------------------------------------------------
// Reproduction and death
// ---------------------------------------------------------------------------

/**
 * Put a child somewhere it can survive, near `ox`/`oy`.
 *
 * Takes a point rather than a parent because a child now has two of them and the
 * point it is born at is the midpoint between them; a plant, which still spreads
 * alone, passes its own corner.
 */
function reproduce(
  w: WorldState,
  bp: CreatureBlueprint,
  ox: number,
  oy: number,
  bw: number,
  bh: number,
  rng: Rng
): Creature | null {
  const isPlant = bp.move.kind === 'root'
  const spread = isPlant ? 14 : 5
  const body = bodyBox(bp)

  for (let attempt = 0; attempt < 12; attempt++) {
    const minSpread = isPlant ? TUNING.plantSpreadMin : 0
    // For plants: pick a random direction and land at least minSpread tiles away.
    // This prevents seeds from piling up directly beneath the parent.
    const signX = rng() > 0.5 ? 1 : -1
    const signY = rng() > 0.5 ? 1 : -1
    const x = isPlant
      ? ox + signX * (minSpread + rng() * (spread - minSpread))
      : ox + (rng() * 2 - 1) * spread
    const ySpread = isPlant ? 6 : spread
    const yMin = isPlant ? minSpread * (6 / 14) : 0
    const y = isPlant
      ? oy + signY * (yMin + rng() * (ySpread - yMin))
      : oy + (rng() * 2 - 1) * ySpread
    const cx = wrapX(x)
    const cy = Math.max(0, Math.min(WORLD_H - bh, y))

    if (boxHitsSolid(w, cx + body.dx, cy + body.dy, body.w, body.h)) continue
    if (
      boxDeadlyMaterial(w, cx + body.dx, cy + body.dy, body.w, body.h) !== null &&
      bp.body.immuneTo.length === 0
    ) {
      continue
    }

    if (isPlant) {
      // A seedling settles onto the first fertile ground below the spot we
      // picked. Same trap as spawning: the tile under a box is
      // `floor(y + bh - 0.001) + 1`, so `settleOnGround` owns that arithmetic.
      const settled = settleOnGround(w, cx + body.dx, cy + body.dy, body.w, body.h, {
        requireFertile: !bp.carnivorousPlant,
        maxDrop: 10,
      })
      if (settled === null) continue
      // `settled` is where the core came to rest; the sprite sits above it.
      return spawnCreature(w, bp, cx, settled - body.dy)
    }

    const wet = boxLiquidFraction(w, cx + body.dx, cy + body.dy, body.w, body.h)
    const needsWater = bp.move.kind === 'swim' || !!bp.habitat.needs?.includes('water')
    if (needsWater && wet < 0.5) continue
    if (!needsWater && bp.habitat.drowns && wet > 0.5) continue

    return spawnCreature(w, bp, cx, cy)
  }
  return null
}

function kill(
  w: WorldState,
  c: Creature,
  bp: CreatureBlueprint,
  dead: Set<number>,
  events: SimEvent[],
  cause: SimEvent['kind']
): void {
  if (dead.has(c.id)) return
  dead.add(c.id)
  const { w: bw, h: bh } = artSize(bp)
  // Animals leave a carcass on any death.
  if (bp.move.kind !== 'root') {
    w.carcasses.push({
      id: w.nextCarcassId++,
      x: wrapX(c.x + bw / 2),
      y: c.y + bh / 2,
      decaySeconds: 15,
      blueprintId: c.blueprintId,
    })
  }
  // Named creatures leave a tombstone that stays in the world. Placed outside
  // the `root` guard so a named plant that burns still gets its headstone.
  if (c.name !== null) {
    w.tombstones.push({
      id: w.nextTombstoneId++,
      x: wrapX(c.x + bw / 2),
      y: c.y + bh / 2,
      name: c.name,
      blueprintId: c.blueprintId,
      ageSeconds: c.ageSeconds,
      generation: c.generation,
      mealsEaten: c.mealsEaten,
      children: c.children,
    })
  }
  emitParticles(
    w,
    wrapX(c.x + bw / 2),
    c.y + bh / 2,
    bp.death.particleColor,
    bp.death.particleCount
  )
  if (bp.death.becomes) {
    dropRemains(w, c.x + bw / 2, c.y + bh / 2, MATERIAL_INDEX[bp.death.becomes])
  }
  events.push({
    kind: cause,
    blueprintId: bp.id,
    x: c.x,
    y: c.y,
    ageSeconds: c.ageSeconds,
    children: c.children,
    creatureName: c.name ?? null,
  })
}

/**
 * How far the remains of a creature look for ground to land on, in tiles.
 *
 * Generous enough to cover a fall from the top of a hill or the bottom of a
 * pond, short enough that something that dies high in open sky leaves nothing
 * behind rather than dropping a rock onto a world it was never standing over.
 */
const REMAINS_DROP = 24

/**
 * Put the tile a creature leaves behind on the ground under where it died.
 *
 * This used to write the material straight into the tile under the creature's
 * *centre*, which is half a body height above its feet — so a Grumblestone that
 * died standing on flat soil left a stone block hanging three tiles up, and a
 * Rustbot left steel at head height. Stone, crystal, metal, obsidian and bone
 * are all static solids: nothing in the tile sim ever makes them fall, so each
 * one stayed there forever, and creatures collide with tiles, so a long-running
 * world slowly filled up with invisible-looking walls at exactly walking
 * height. Ten minutes of the volcanic theme grew 27 of them.
 *
 * Dropping to the first ground beneath instead is what the effect was always
 * meant to look like — the lavafish leaves obsidian *on the floor* — and it
 * keeps the flavour intact rather than deleting it. A creature that dies inside
 * terrain still replaces what it was buried in; one that dies over open air too
 * far from any floor leaves no trace at all.
 */
function dropRemains(w: WorldState, x: number, y: number, mat: number): void {
  const tx = Math.floor(x)
  const ty = Math.floor(y)
  if (!inBounds(tx, ty)) return

  // Died inside the ground — the remains take the place of what buried it.
  if (solidAt(w, tx, ty)) {
    setTile(w, tx, ty, mat)
    return
  }

  for (let d = 1; d <= REMAINS_DROP; d++) {
    const below = ty + d
    // Fell past the bottom of the world: it comes to rest on the last row.
    if (below >= WORLD_H) {
      setTile(w, tx, WORLD_H - 1, mat)
      return
    }
    if (!solidAt(w, tx, below)) continue
    setTile(w, tx, below - 1, mat)
    return
  }
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

export function emitParticles(
  w: WorldState,
  x: number,
  y: number,
  color: string,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    if (w.particles.length >= MAX_PARTICLES) return
    const a = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 8
    w.particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 3,
      life: PARTICLE_LIFE * (0.6 + Math.random() * 0.8),
      maxLife: PARTICLE_LIFE,
      color,
    })
  }
}

function tickParticles(w: WorldState, dt: number, gravityScale: number): void {
  const out: typeof w.particles = []
  for (const p of w.particles) {
    p.life -= dt
    if (p.life <= 0) continue
    p.vy += TUNING.gravity * 0.35 * gravityScale * dt
    p.x = wrapX(p.x + p.vx * dt)
    p.y += p.vy * dt
    // Only the ceiling and the floor can swallow a particle now — sideways it
    // just keeps going and comes back round.
    if (p.y < 0 || p.y >= WORLD_H) continue
    if (solidAt(w, Math.floor(p.x), Math.floor(p.y))) {
      p.vx *= 0.4
      p.vy = -p.vy * 0.2
      p.y -= 0.6
    }
    out.push(p)
  }
  w.particles = out
}
