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
  PARTICLE_LIFE,
  WORLD_H,
  WORLD_W,
} from '@/app/micro-land/domain/constants'
import { inherit, lifespanOf, roamOf, sightOf, sizeOf, speedOf } from '@/app/micro-land/domain/traits'
import { TUNING } from '@/app/micro-land/domain/tuning'
import type { Burrow, Creature, CreatureBlueprint, Scent, WorldState } from '@/app/micro-land/domain/types'

import {
  boxDeadlyMaterial,
  boxDrownFraction,
  boxHitsSolid,
  boxLiquidFraction,
  boxViscosity,
  inBounds,
  liquidAt,
  seedNativePlants,
  setTile,
  settleOnGround,
  solidAt,
  spawnCreature,
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
 * Speed (|vx| + |vy|) below which a non-root animal counts as still.
 *
 * Still animals are harder to spot — camouflage. A creature pressed against a
 * wall or resting between hops reads as effectively motionless even though it
 * isn't at literal zero, so the threshold is a small positive rather than zero.
 */
const CAMOUFLAGE_STILL = 1.5

/**
 * Fraction of food-sight at which a still animal can first be detected.
 *
 * 0.5 halves the detection radius, so a resting creature is invisible to a
 * hungry predator until it is much closer than it would otherwise need to be.
 * Plants are exempt — this only applies to animals that could plausibly freeze
 * or blend in, not to vegetation that the food chain depends on finding.
 */
const CAMOUFLAGE_FACTOR = 0.5

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
  kind: 'born' | 'eaten' | 'ate' | 'starved' | 'drowned' | 'burned' | 'aged'
  blueprintId: string
  /** Only set on `ate`: the blueprint id of what was caught. */
  victimId?: string
  x: number
  y: number
}

let tickCount = 0

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
  return bp.move.kind === 'root' ? TUNING.plantMaturity : lifespanOf(c, bp) * 0.2
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
    c.breedCooldown <= 0 && 1 - c.hunger >= bp.diet.breedAt && c.ageSeconds > breedingAge(c, bp)
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
  const dx = other.x - c.x
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

export function tickCreatures(
  w: WorldState,
  dt: number,
  rng: Rng,
  gravityScale: number,
  events: SimEvent[]
): void {
  tickCount++

  // Migration: worlds saved before carcasses were added won't have these fields.
  w.carcasses ??= []
  w.nextCarcassId ??= 1
  w.burrows ??= []
  w.scents ??= []

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
    if ((c as { homeX?: number }).homeX === undefined) { c.homeX = Math.round(c.x); c.homeY = Math.round(c.y) }
    if ((c as { packTimer?: number }).packTimer === undefined) c.packTimer = 0
    if (c.packTimer > 0) c.packTimer = Math.max(0, c.packTimer - dt)

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

    // Burrowing: a well-rested digger stakes this spot as a den if none is nearby.
    if (
      c.mood === 'rest' &&
      bp.dig.through.length > 0 &&
      w.burrows.length < 50
    ) {
      const bx = Math.round(c.x)
      const by = Math.round(c.y)
      const nearbyBurrow = w.burrows.some(
        b => b.blueprintId === c.blueprintId && Math.abs(b.x - bx) + Math.abs(b.y - by) < 8
      )
      if (!nearbyBurrow) {
        w.burrows.push({ x: bx, y: by, blueprintId: c.blueprintId })
      }
    }

    c.hunger = Math.min(1, c.hunger + bp.diet.hungerRate * TUNING.hungerRateScale * restSlowdown * dt)
    if (c.hunger >= 1) {
      c.starving += dt
      if (c.starving >= bp.diet.starveSeconds) {
        kill(w, c, bp, dead, events, 'starved')
        continue
      }
    } else {
      c.starving = Math.max(0, c.starving - dt * 2)
    }

    // --- old age --------------------------------------------------------
    if (c.ageSeconds >= lifespanOf(c, bp)) {
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
      look(w, c, bp, bw, bh, dead, events)
    }

    // --- movement -------------------------------------------------------
    if (bp.move.kind !== 'root') {
      steer(w, c, bp, dt, rng)
      integrate(w, c, bp, bw, bh, dt, wet, gravityScale)
    }

    // --- what it does to the world around it -----------------------------
    if (bp.aura?.converts) applyConversion(w, c, bp, bw, bh, dt, rng)

    // --- breeding -------------------------------------------------------
    const isPlant = bp.move.kind === 'root'
    if (
      readyToBreed(c, bp) &&
      creatures.length < TUNING.maxCreatures &&
      !(isPlant && plantsAlive >= TUNING.maxPlants) &&
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
        const ox = mate ? (c.x + mate.x) / 2 : c.x
        const oy = mate ? (c.y + mate.y) / 2 : c.y
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
          c.children++
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
            c.breedCooldown =
              TUNING.plantSpreadCooldown /
              (auraBoost(w, c, bp, bw, bh, helpers) *
                fertilityAt(w, c.x + bw / 2, c.y + bh / 2) *
                seasonFactor)
          } else {
            // Both of them paid to be here, so both of them pay for it. Charging
            // only the one whose turn it happened to be would make a baby cost a
            // pair half of what it used to cost a single animal, which is a
            // *cheapening* of breeding dressed up as a restriction.
            payForChild(w, c, bp, bw, bh, helpers)
            if (mate) {
              mate.children++
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

  if (dead.size > 0) {
    w.creatures = creatures.filter(c => !dead.has(c.id))
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
    }
  }

  // The only thing the world regrows on its own. Animals that die out stay
  // dead — see `seedNativePlants`.
  seedNativePlants(w, rng, seasonFactor)

  // Decay carcasses and remove expired ones.
  for (const car of w.carcasses) {
    car.decaySeconds -= dt
  }
  if (w.carcasses.some(car => car.decaySeconds <= 0)) {
    w.carcasses = w.carcasses.filter(car => car.decaySeconds > 0)
  }

  // Scent decay
  for (const s of w.scents) s.decaySeconds -= dt
  w.scents = w.scents.filter(s => s.decaySeconds > 0)

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
  events: SimEvent[]
): void {
  const cx = c.x + bw / 2
  const cy = c.y + bh / 2
  const hungry = c.hunger > 0.3

  // This creature's sight, not its species' — everything downstream, including
  // the foraging reach and the window the loop below walks, is measured off it.
  const sight = sightOf(c, bp)
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
  const foodSight = sight * (1 + HUNGER_REACH * desperation * roamOf(c))
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
      const dx = car.x - cx
      const dy = car.y - cy
      // Gap between creature sprite edge and the carcass point.
      const gapX = Math.max(0, Math.abs(dx) - bw / 2)
      const gapY = Math.max(0, Math.abs(dy) - bh / 2)
      if (gapX <= BITE_PAD && gapY <= BITE_PAD) {
        c.hunger = Math.max(0, c.hunger - TUNING.mealValue)
        c.starving = 0
        c.mealsEaten++
        // Leave a scent so hungry packmates can follow toward food.
        if (w.scents.length < 200) {
          w.scents.push({ x: c.x, y: c.y, blueprintId: c.blueprintId, decaySeconds: 15 })
        }
        c.mood = 'eat'
        c.targetId = null
        car.decaySeconds = 0 // mark for removal at end of tick
        events.push({ kind: 'ate', blueprintId: bp.id, x: c.x, y: c.y })
        return
      }
    }
  }

  // Only the creatures whose left edge falls in the window can possibly be in
  // range; everything beyond it is skipped without being touched. Sized off the
  // *food* reach, which is the larger of the two whenever the creature is hungry
  // enough for it to matter — so a fed animal pays exactly what it always did.
  const reach = Math.max(sight, foodSight) + bw / 2
  const last = cx + reach + SIGHT_PAD_RIGHT
  for (let i = lowerBound(byX, cx - reach - SIGHT_PAD_LEFT); i < byX.length; i++) {
    const other = byX[i]
    if (other.x > last) break
    if (other.id === c.id || dead.has(other.id)) continue
    const obp = w.blueprints[other.blueprintId]
    if (!obp) continue

    const { w: ow, h: oh } = artSize(obp)
    const dx = other.x + ow / 2 - cx
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

    if (hungry && canEat(bp, obp) && sizeOf(other) / sizeOf(c) < 1.8) {
      // Bodies touching? Eat now, don't bother pathing — camouflage can't save
      // something once the predator is already on top of it.
      const touching = gapX <= BITE_PAD && gapY <= BITE_PAD
      if (touching) {
        devour(w, other, obp, dead, events)
        c.hunger = Math.max(0, c.hunger - TUNING.mealValue)
        c.starving = 0
        c.mealsEaten++
        // Leave a scent so hungry packmates can follow toward food.
        if (w.scents.length < 200) {
          w.scents.push({ x: c.x, y: c.y, blueprintId: c.blueprintId, decaySeconds: 15 })
        }
        c.mood = 'eat'
        c.targetId = null
        // Toxic plants slow the eater — the meal lands, but at a cost.
        if (obp.toxicity) {
          c.poisoned = Math.max(c.poisoned, obp.toxicity * 5)
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
        obp.move.kind !== 'root' &&
        Math.abs(other.vx) + Math.abs(other.vy) < CAMOUFLAGE_STILL
      const efs2 = still ? foodSight2 * (CAMOUFLAGE_FACTOR * CAMOUFLAGE_FACTOR) : foodSight2
      if (d2 <= efs2 && d2 < preyDist) {
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
      !canEat(bp, obp) &&   // not our prey
      !canEat(obp, bp) &&   // not our predator
      obp.move.kind !== 'root'  // not a plant
    ) {
      const territoryR = (c.traits.territorial ?? 0.5) * 10
      if (d2 < territoryR * territoryR && d2 < preyDist) {
        preyDist = d2
        prey = other
        preyDir = dx >= 0 ? 1 : -1
        preyCx = other.x + ow / 2
        preyCy = other.y + oh / 2
      }
    }
  }

  // Scent following: a hungry animal with nothing in sight drifts toward
  // a same-species scent trail if one is nearby. Cap the search radius at
  // 2× plain sight so the behavior doesn't fire from across the world.
  if (hungry && !prey && !threat && w.scents.length > 0) {
    const scentReach2 = sight * sight * 4
    const midX = cx
    const midY = c.y + bh / 2
    let nearestD2 = Infinity
    let nearestScent: Scent | null = null
    for (const s of w.scents) {
      if (s.blueprintId !== c.blueprintId) continue
      const sdx = s.x - midX
      const sdy = s.y - midY
      const d2 = sdx * sdx + sdy * sdy
      if (d2 < nearestD2 && d2 < scentReach2) {
        nearestD2 = d2
        nearestScent = s
      }
    }
    if (nearestScent) {
      c.drift = nearestScent.x > midX ? 1 : -1
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

  // Pack hunting: scan for a same-species neighbour targeting the same prey.
  // When found, both creatures share a brief speed bonus — coordinated attacks
  // close faster and are harder to flee from.
  if (prey !== null) {
    const packReach = sight + bw / 2
    const packLast = cx + packReach + SIGHT_PAD_RIGHT
    let coordinating = false
    for (let pi = lowerBound(byX, cx - packReach - SIGHT_PAD_LEFT); pi < byX.length; pi++) {
      const pk = byX[pi]
      if (pk.x > packLast) break
      if (pk.id === c.id) continue
      if (pk.blueprintId === c.blueprintId && pk.targetId === prey.id) {
        coordinating = true
        break
      }
    }
    // Grant one sense-interval of bonus (plus a little buffer) so it persists
    // until the next pass rather than dropping between ticks.
    c.packTimer = coordinating ? (SENSE_EVERY / 60) * 2.5 : 0
  } else {
    c.packTimer = 0
  }

  if (threat) {
    c.mood = 'flee'
    c.targetId = threat.id
    // Diggers: flee toward a known burrow rather than just away from threat.
    if (bp.dig.through.length > 0 && w.burrows.length > 0) {
      let nearestBurrow: Burrow | null = null
      let nearestBurrowD2 = Infinity
      for (const b of w.burrows) {
        if (b.blueprintId !== c.blueprintId) continue
        const bdx = b.x - cx
        const bdy = b.y - (c.y + bh / 2)
        const bd2 = bdx * bdx + bdy * bdy
        if (bd2 < nearestBurrowD2 && bd2 < sight * sight * 9) {
          nearestBurrowD2 = bd2
          nearestBurrow = b
        }
      }
      if (nearestBurrow) {
        c.drift = nearestBurrow.x > cx ? 1 : -1
      }
    }
  } else if (prey && (preyDist <= sight2 || clearRun(w, bp, cx, cy, preyCx, preyCy))) {
    c.mood = 'hunt'
    c.targetId = prey.id
  } else if (prey) {
    /**
     * Smelled, not seen — food inside the hunger reach but past plain sight.
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
  const dx = toX - fromX
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
      x: victim.x + vw / 2,
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
  parent.breedCooldown = TUNING.breedCooldown / auraBoost(w, parent, bp, bw, bh, helpers)
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
    const dx = helper.x + hw / 2 - cx
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

/** Solid directly over its head. The sky is not a roof. */
function roofed(w: WorldState, c: Creature, body: BodyBox): boolean {
  const y = Math.floor(c.y + body.dy) - 1
  if (y < 0) return false
  const x1 = Math.floor(c.x + body.dx + body.w - 0.001)
  for (let x = Math.floor(c.x + body.dx); x <= x1; x++) {
    if (solidAt(w, x, y)) return true
  }
  return false
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

  let wantX = 0
  let wantY = 0

  const target = c.targetId !== null ? findCreature(w, c.targetId) : null
  if (target) {
    const tbp = w.blueprints[target.blueprintId]
    const size = tbp ? artSize(tbp) : { w: 1, h: 1 }
    const dx = target.x + size.w / 2 - cx
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
    if (c.drift !== 0 && unliveableAhead(w, c, bp, body, c.drift > 0 ? 1 : -1)) {
      c.drift = -c.drift
    }
    // Pull toward home when far away.
    if ((c.traits.territorial ?? 0.5) > 0.2 && Math.abs(c.homeX - c.x) > 15) {
      c.drift = c.homeX > c.x ? 1 : -1
    }
    wantX = c.drift
    wantY = bp.move.kind === 'fly' || bp.move.kind === 'swim' ? (rng() - 0.5) * 0.6 : 0
    c.targetId = null
  }

  // Poison from a toxic plant halves movement speed for its duration.
  // Larger creatures are slower: size is a denominator, not a multiplier.
  const speed = speedOf(c, bp) * (c.poisoned > 0 ? 0.5 : 1) * (c.packTimer > 0 ? 1.2 : 1) / sizeOf(c)
  const accel = speed * 6
  const digger = bp.dig.through.length > 0

  switch (bp.move.kind) {
    case 'walk': {
      // Mud slows walkers to 50%; quicksand slows progressively toward 0.
      const footX = Math.floor(c.x + body.dx + body.w / 2)
      const footY = Math.floor(c.y + body.dy + body.h)
      const groundId = MATERIAL_BY_INDEX[tileAt(w, footX, footY)]?.id
      const groundMult =
        groundId === 'mud' ? 0.5
        : groundId === 'quicksand' ? Math.max(0.05, 1 - c.sinking / 8)
        : 1
      c.vx += wantX * accel * dt
      c.vx = clampMag(c.vx, speed * groundMult)

      /**
       * A burrower goes to ground when it is fed, and comes back up when it is
       * hungry.
       *
       * Downward was already here: a well-fed digger makes a warren, and only a
       * well-fed one, or it would tunnel away from the food it needs and starve
       * in the dark. How deep it gets is bounded by its own dig list — a Delver
       * chews soil but not stone, so it hollows out the topsoil and stops there
       * instead of reaching the lava.
       *
       * What was missing was the return trip. Sampling the harness at the moment
       * of starving, a Delver had something edible inside its sight 81% of the
       * time, a median of fourteen tiles away — because the food was on the
       * surface and the Delver was under it. A tunnel dug on a full stomach was
       * a one-way trip.
       *
       * Upward is re-asserted every tick rather than kicked once, because
       * gravity is pulling the other way and it is being held against the roof
       * that lets `chewThrough` accumulate progress and pop the tile. It costs
       * one row of lookups per digger per tick and stops the instant there is
       * open sky overhead, so a digger already on the surface pays nothing.
       */
      if (digger) {
        if (c.grounded && c.hunger < 0.4 && rng() < 0.6 * dt) {
          c.vy = 6
        } else if (c.hunger > FORAGE_HUNGER && roofed(w, c, body)) {
          c.vy = Math.min(c.vy, -Math.max(2, bp.dig.speed * 2))
        }
      }

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
        c.vx += wantX * accel * dt
        c.vy += wantY * accel * dt
        c.vx = clampMag(c.vx, speed)
        c.vy = clampMag(c.vy, speed)
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
      c.vx += wantX * accel * dt * 0.4
      c.vy += wantY * accel * dt * 0.4
      c.vx = clampMag(c.vx, speed)
      c.vy = clampMag(c.vy, speed * 0.8)
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
  const digger = bp.dig.through.length > 0

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
  } else if (digger && chewThrough(w, c, bp, nx + ox, c.y + oy, body.w, body.h, dt)) {
    // Held against the rock while it works. The tunnel opens next tick.
    c.vx *= 0.2
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
  } else if (digger && chewThrough(w, c, bp, c.x + ox, ny + oy, body.w, body.h, dt)) {
    c.vy *= 0.2
    // A digger resting on rock it is actively burrowing into still counts as
    // standing on something, or a walker would never get the jump to push down.
    if (c.vy > 0) c.grounded = true
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

  // Belt and braces: never let anything escape the box.
  c.x = Math.max(0, Math.min(WORLD_W - bw, c.x))
  c.y = Math.max(0, Math.min(WORLD_H - bh, c.y))
}

/**
 * Try to tunnel into whatever is blocking a move.
 *
 * Returns true when the creature is *able* to dig here — including while it is
 * still part-way through a tile — so the caller stalls it against the rock
 * instead of bouncing it off. Only one tile is removed per completed unit of
 * progress, which is what makes a slow digger read as effort rather than a
 * creature that phases through walls.
 */
function chewThrough(
  w: WorldState,
  c: Creature,
  bp: CreatureBlueprint,
  x: number,
  y: number,
  bw: number,
  bh: number,
  dt: number
): boolean {
  const diggable = new Set(bp.dig.through.map(m => MATERIAL_INDEX[m]))

  // Collect the blocking tiles this move would run into.
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.floor(x + bw - 0.001)
  const y1 = Math.floor(y + bh - 0.001)

  let targetX = -1
  let targetY = -1
  for (let ty = y0; ty <= y1 && targetX < 0; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!solidAt(w, tx, ty)) continue
      // Out of bounds reads as solid but isn't a real tile — never dig the walls
      // of the world, or creatures escape the box entirely.
      if (!inBounds(tx, ty)) return false
      if (!diggable.has(tileAt(w, tx, ty))) return false
      targetX = tx
      targetY = ty
      break
    }
  }
  if (targetX < 0) return false

  c.digProgress += bp.dig.speed * dt
  if (c.digProgress >= 1) {
    c.digProgress -= 1
    setTile(w, targetX, targetY, MATERIAL_INDEX.air)
    c.tilesDug++
  }
  return true
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
    const x = ox + (rng() * 2 - 1) * spread
    const y = oy + (rng() * 2 - 1) * (isPlant ? 6 : spread)
    const cx = Math.max(0, Math.min(WORLD_W - bw, x))
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
        requireFertile: true,
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
      x: c.x + bw / 2,
      y: c.y + bh / 2,
      decaySeconds: 15,
      blueprintId: c.blueprintId,
    })
  }
  emitParticles(w, c.x + bw / 2, c.y + bh / 2, bp.death.particleColor, bp.death.particleCount)
  if (bp.death.becomes) {
    setTile(w, Math.floor(c.x + bw / 2), Math.floor(c.y + bh / 2), MATERIAL_INDEX[bp.death.becomes])
  }
  events.push({ kind: cause, blueprintId: bp.id, x: c.x, y: c.y })
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
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.x < 0 || p.y < 0 || p.x >= WORLD_W || p.y >= WORLD_H) continue
    if (solidAt(w, Math.floor(p.x), Math.floor(p.y))) {
      p.vx *= 0.4
      p.vy = -p.vy * 0.2
      p.y -= 0.6
    }
    out.push(p)
  }
  w.particles = out
}
