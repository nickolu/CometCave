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
import { AIR, IS_DEADLY, IS_FLAMMABLE, IS_LIQUID, IS_SOLID, MATERIAL_BY_INDEX, MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
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
import type { Creature, CreatureBlueprint, Scent, SeedEntry, WorldState } from '@/app/micro-land/domain/types'
import { deltaX, distX, wrapCol, wrapX } from '@/app/micro-land/domain/wrap'

import {
  biomeZoneAt,
  biomeZonesAtWithEcotone,
  boxDeadlyMaterial,
  boxDrownFraction,
  boxHitsSolid,
  boxLiquidFraction,
  boxViscosity,
  hasMycorrhizalPartnerNearby,
  inBounds,
  isInEcotone,
  liquidAt,
  runWorldGenerators,
  setTile,
  settleOnGround,
  solidAt,
  spawnCreature,
  tickAcidRain,
  tickAtmosphericCO2,
  tickBoneDecomposition,
  tickCaveNutrient,
  tickCorridorMask,
  tickEdgeMask,
  tickEvaporation,
  tickCloudDrift,
  tickGroundwater,
  tickMarshDetritus,
  tickMineralVeins,
  tickMoisture,
  tickMycorrhizalNetwork,
  tickSalinity,
  tickTidal,
  tickTileTemp,
  tickFire,
  tickSoilAge,
  tickSoilNutrient,
  tickWebDecay,
  tickWeather,
  tileAt,
  updateBiomeZones,
  updateKeystoneSpecies,
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

const ALLELOPATHY_RADIUS = 8 // tiles — allelopathic suppression reach
const BIOTIC_RESISTANCE_RADIUS = 12 // tiles — diversity sensing reach for invasives
const BIOTIC_RESISTANCE_THRESHOLD = 3 // distinct native species needed for resistance
const COMPETITIVE_EXCLUSION_RADIUS = 6 // tiles
const COMPETITIVE_THRESHOLD = 3.0 // sum of competitor ability at which penalty begins

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

const LATERAL_LINE_RADIUS = 5 // tiles — hydrodynamic pressure sensing range

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
 * Named techniques that intelligent creatures can independently invent and
 * culturally transmit to conspecifics. Each technique is a meme — a unit of
 * cultural information that spreads via social learning. Issue #3415.
 */
const TECHNIQUE_POOL = ['ambush-timing', 'cache-store', 'pry-open', 'mob-defense', 'scent-trail'] as const

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
      // Base fertility on cave nutrient — drip water creates bacterial blooms.
      f = 0.05 + ((w.caveNutrient?.[yi * WORLD_W + xi] ?? 0) * 1.5)
      break
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

/**
 * True when any of the four cardinal tiles around the creature's centre is a
 * liquid that is NOT deadly (water yes, lava/acid no).
 *
 * Used for the food-washing mechanic: washing food in lava is not an upgrade.
 */
function isNearWater(w: WorldState, c: Creature): boolean {
  const cx = Math.floor(c.x)
  const cy = Math.floor(c.y)
  const offsets: [number, number][] = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ]
  for (const [dx, dy] of offsets) {
    const col = wrapCol(cx + dx)
    const row = cy + dy
    if (row < 0 || row >= WORLD_H) continue
    const idx = col + row * WORLD_W
    const tile = w.tiles[idx] ?? 0
    if (IS_LIQUID[tile] && !IS_DEADLY[tile]) return true
  }
  return false
}

/**
 * True when this creature is in a cave — at least 3 solid tiles directly
 * above its head position. Caves are thermally stable (constant temperature
 * independent of seasonal and day/night cycles) and dark (constant moderate
 * darkness, providing selection pressure against high sight traits).
 */
function isUnderground(w: WorldState, c: Creature): boolean {
  const hx = Math.floor(c.x)
  const hy = Math.floor(c.y) - 1
  for (let dy = 0; dy < 3; dy++) {
    const ty = hy - dy
    if (ty < 0) break
    const tile = w.tiles[ty * WORLD_W + wrapCol(hx)]
    if (!IS_SOLID[tile]) return false
  }
  return hy >= 0  // must be valid position
}

/**
 * Returns the depth-from-surface in tiles: how many consecutive solid tiles
 * sit above the creature's head. Returns 0 at or near the surface.
 * Used to model the twilight → transition → midnight cave zone gradient.
 */
function cavityDepth(w: WorldState, c: Creature): number {
  const hx = Math.floor(c.x)
  const hy = Math.floor(c.y) - 1
  let depth = 0
  for (let dy = 0; dy < WORLD_H; dy++) {
    const ty = hy - dy
    if (ty < 0) break
    const tile = w.tiles[ty * WORLD_W + wrapCol(hx)]
    if (!IS_SOLID[tile]) break
    depth++
  }
  return depth
}

/**
 * Y-coordinate of the first solid tile scanning down from the top at column x.
 * Higher return value = lower terrain elevation. Returns WORLD_H for open-sky columns.
 */
function surfaceHeightAt(w: WorldState, x: number): number {
  const col = wrapCol(Math.floor(x))
  for (let y = 0; y < WORLD_H; y++) {
    if (IS_SOLID[w.tiles[y * WORLD_W + col]]) return y
  }
  return WORLD_H
}

/**
 * Local terrain temperature modifier based on terrain relief.
 *
 * Frost hollow (valley floor, surrounded by higher terrain): cold air drains
 * downhill and pools, amplifying winter cold. Returns negative value.
 * Sun-trap (elevated knoll or ridge): less frost shadow, warms faster.
 * Returns positive value. Flat terrain returns 0.
 *
 * Only meaningful when `TUNING.seasonAmplitude > 0`.
 */
function microclimateMod(w: WorldState, x: number): number {
  const here = surfaceHeightAt(w, x)
  const left = surfaceHeightAt(w, x - 8)
  const right = surfaceHeightAt(w, x + 8)
  const avg = (left + right) / 2
  const diff = here - avg  // positive = depression, negative = elevated
  if (diff > 2) return -Math.min(0.4, diff / 20)   // frost hollow
  if (diff < -2) return Math.min(0.25, -diff / 20)  // sun-trap
  return 0
}

/**
 * True when c and other overlap — used for snap-trap contact detection.
 * Uses the creature positions as 1-tile points (plants are 1-wide).
 */
function overlapsPlant(c: Creature, plant: Creature): boolean {
  return Math.abs(c.x - plant.x) < 2 && Math.abs(c.y - plant.y) < 2
}

/**
 * Growing-degree units (0–1000) for the current world time.
 * Derived from the existing season sine wave: 0 at winter nadir, 1000 at
 * summer peak. When seasonAmplitude is 0 (no seasons), returns 1000 so
 * phenological gates are always open — existing gameplay is unaffected.
 */
/**
 * Climate warming bonus — extra GDD added each year as the simulated climate
 * warms over time. Returns 0 when `climateWarmingRate` is 0 (default).
 *
 * Each completed annual cycle (seasonPeriod) adds `climateWarmingRate` GDD
 * to the bonus, capped at 400 to prevent runaway desynchronisation.
 */
function climateBonus(elapsed: number): number {
  if (TUNING.climateWarmingRate === 0 || TUNING.seasonPeriod <= 0) return 0
  const yearsElapsed = Math.floor(elapsed / TUNING.seasonPeriod)
  return Math.min(400, yearsElapsed * TUNING.climateWarmingRate)
}

function worldGdd(elapsed: number): number {
  if (TUNING.seasonAmplitude === 0 || TUNING.seasonPeriod <= 0) return 1000
  const yearFrac = (elapsed % TUNING.seasonPeriod) / TUNING.seasonPeriod
  const baseGdd = Math.round((1 - Math.cos(2 * Math.PI * yearFrac)) / 2 * 1000)
  return Math.min(1000, baseGdd + climateBonus(elapsed))
}

/**
 * True when this creature qualifies as an elder for its species.
 *
 * "Elder" = the last 35% of a creature's natural lifespan, and only for species
 * that have opted into the elder-knowledge mechanic via `bp.elderWisdom`. Elders
 * get an enhanced sight bonus, always emit food-location scents, and younger kin
 * nearby learn by proximity. When all elders of a species die, the population
 * suffers a knowledge gap until new elders emerge.
 */
function isElder(c: Creature, bp: CreatureBlueprint): boolean {
  return (bp.elderWisdom ?? false) && c.ageSeconds > bp.diet.lifespanSeconds * 0.65
}

export interface SimEvent {
  /**
   * `eaten` is from the victim's side (this species lost one); `ate` is from the
   * hunter's side and carries who it caught. Both fire for a single kill — the
   * UI wants the hunter's framing, the extinction check wants the victim's.
   *
   * `diversity-rescue` fires when a species germinates from the seed bank after
   * going locally extinct (speciesCount was 0 at the moment of germination). The
   * field guide removes the species from the extinctions list on receiving this.
   */
  kind: 'born' | 'eaten' | 'ate' | 'starved' | 'drowned' | 'burned' | 'aged' | 'diseased' | 'sick' | 'diversity-rescue' | 'notice' | 'extinction'
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
  /** Only set on `notice` events: the message to display. */
  text?: string
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

/**
 * Ages dormant seeds and tries to germinate them when conditions allow.
 *
 * Seeds lose viability exponentially with a half-life of 600 seconds (two
 * simulated years at the 300s season period). A seed whose viability falls
 * below a random draw on a given tick dies. Surviving seeds try to germinate
 * once per second if: the tile below them is fertile AND the plant cap allows
 * another individual of that species.
 *
 * Issue #3350.
 */
function tickSeedBank(
  w: WorldState,
  dt: number,
  tickCount: number,
  speciesCount: Record<string, number>,
  plantsRef: { value: number },
  rng: Rng,
  events: SimEvent[]
): void {
  if (!w.seedBank || w.seedBank.length === 0) return
  if (tickCount % 60 !== 0) return  // run once per second

  const HALF_LIFE = 600  // seconds to 50 % viability
  const lavaIdx = MATERIAL_INDEX.lava

  // Compute current seasonal phase for cold stratification checks.
  const seasonFactor = TUNING.seasonAmplitude > 0
    ? Math.max(0.05, 1 + TUNING.seasonAmplitude * Math.sin((2 * Math.PI * w.elapsed) / TUNING.seasonPeriod))
    : 1
  const isCold = seasonFactor < 0.9
  const STRATIFICATION_THRESHOLD = 120  // seconds of cold needed to break dormancy

  const surviving: SeedEntry[] = []
  for (const seed of w.seedBank) {
    seed.age += 60 * dt  // approximate: called every 60 ticks

    // Fire scarification: check if lava is at or adjacent to this seed's tile.
    if (!seed.fireScarified) {
      const sx = seed.x, sy = seed.y
      for (let dy = -1; dy <= 1 && !seed.fireScarified; dy++) {
        for (let dx = -1; dx <= 1 && !seed.fireScarified; dx++) {
          const tx = wrapCol(sx + dx), ty = sy + dy
          if (ty < 0 || ty >= WORLD_H) continue
          if (w.tiles[ty * WORLD_W + tx] === lavaIdx) seed.fireScarified = true
        }
      }
    }

    // Try germination
    const bp = w.blueprints[seed.blueprintId]
    if (!bp || bp.move.kind !== 'root') { surviving.push(seed); continue }

    // Fire-germinator species: scarified seeds skip viability decay and germinate eagerly.
    if (bp.fireGerminator) {
      if (!seed.fireScarified) { surviving.push(seed); continue }  // waiting for fire
      // Scarified: attempt germination immediately (don't check viability)
      if (plantsRef.value >= TUNING.maxPlants) { surviving.push(seed); continue }
      if ((speciesCount[seed.blueprintId] ?? 0) >= TUNING.plantSpeciesCap) { surviving.push(seed); continue }
      // Biome gate: fire-scarified seeds respect biome restrictions; ecotone blending
      // lets them establish within ECOTONE_WIDTH rows of an adjacent zone's boundary.
      // Issue #3378, extended by #3379.
      if (bp.biomeRequirements && bp.biomeRequirements.length > 0) {
        const zones = biomeZonesAtWithEcotone(w, seed.y)
        if (!zones.some(z => bp.biomeRequirements!.includes(z))) { surviving.push(seed); continue }
      }
      const { w: bw, h: bh } = artSize(bp)
      const wasExtinct = (speciesCount[seed.blueprintId] ?? 0) === 0
      const germinated = reproduce(w, bp, seed.x + 0.5, seed.y, bw, bh, rng)
      if (germinated) {
        plantsRef.value++
        speciesCount[seed.blueprintId] = (speciesCount[seed.blueprintId] ?? 0) + 1
        if (wasExtinct) events.push({ kind: 'diversity-rescue', blueprintId: seed.blueprintId, x: seed.x, y: seed.y })
      } else {
        surviving.push(seed)  // wait for better ground conditions
      }
      continue  // don't fall through to normal germination
    }

    // Light-gap germinator: germinates eagerly when canopy opens above the seed.
    if (bp.lightGapGerminator && w.lightGrid) {
      const lightLevel = w.lightGrid[seed.y * WORLD_W + seed.x]
      if (lightLevel < 0.4) { surviving.push(seed); continue }  // still shaded — wait
      // Light gap detected: attempt immediate germination
      if (plantsRef.value >= TUNING.maxPlants) { surviving.push(seed); continue }
      if ((speciesCount[seed.blueprintId] ?? 0) >= TUNING.plantSpeciesCap) { surviving.push(seed); continue }
      // Biome gate: light-gap seeds respect biome restrictions; ecotone blending
      // lets them establish within ECOTONE_WIDTH rows of an adjacent zone's boundary.
      // Issue #3378, extended by #3379.
      if (bp.biomeRequirements && bp.biomeRequirements.length > 0) {
        const zones = biomeZonesAtWithEcotone(w, seed.y)
        if (!zones.some(z => bp.biomeRequirements!.includes(z))) { surviving.push(seed); continue }
      }
      const { w: bw, h: bh } = artSize(bp)
      const wasExtinct = (speciesCount[seed.blueprintId] ?? 0) === 0
      const germinated = reproduce(w, bp, seed.x + 0.5, seed.y, bw, bh, rng)
      if (germinated) {
        plantsRef.value++
        speciesCount[seed.blueprintId] = (speciesCount[seed.blueprintId] ?? 0) + 1
        if (wasExtinct) events.push({ kind: 'diversity-rescue', blueprintId: seed.blueprintId, x: seed.x, y: seed.y } as SimEvent)
      } else {
        surviving.push(seed)
      }
      continue
    }

    const halfLife = bp.seedLongevity ?? HALF_LIFE
    const viability = Math.pow(0.5, seed.age / halfLife)
    if (rng() > viability) continue  // seed died

    // Cold stratification: accumulate cold hours; gate germination until threshold met.
    if (bp.requiresStratification && isCold) {
      seed.coldHours = (seed.coldHours ?? 0) + 60 * dt
    }
    if (bp.requiresStratification && (seed.coldHours ?? 0) < STRATIFICATION_THRESHOLD) {
      surviving.push(seed)  // not yet stratified — wait
      continue
    }

    if (plantsRef.value >= TUNING.maxPlants) { surviving.push(seed); continue }
    if ((speciesCount[seed.blueprintId] ?? 0) >= TUNING.plantSpeciesCap) { surviving.push(seed); continue }

    // Biome gate: seeds cannot germinate outside their species' allowed biomes.
    // Within ECOTONE_WIDTH rows of a band boundary, seeds from the adjacent zone
    // may also establish — the seed stays viable and waits if neither zone matches.
    // Issue #3378, extended by #3379.
    if (bp.biomeRequirements && bp.biomeRequirements.length > 0) {
      const zones = biomeZonesAtWithEcotone(w, seed.y)
      if (!zones.some(z => bp.biomeRequirements!.includes(z))) { surviving.push(seed); continue }
    }

    // Obligate mycorrhizal seeds cannot germinate without nearby fungal partners. Issue #3333.
    if (bp.obligateMycorrhizal && !hasMycorrhizalPartnerNearby(w, seed.x, seed.y)) {
      surviving.push(seed)  // wait for network establishment
      continue
    }

    // Succession stage gate: only germinate when soil is mature enough. Issue #3123.
    if (bp.successionStage && bp.successionStage > 1 && w.soilAge) {
      const minAge = (bp.successionStage - 1) * 1500
      const soilAgeHere = w.soilAge[seed.y * WORLD_W + seed.x] ?? 0
      if (soilAgeHere < minAge) { surviving.push(seed); continue }
    }

    // Nutrient-modulated sprout rate (#3101): soilNutrient scales germination probability.
    // 0.5× at zero nutrients, 2× at full nutrients. Fertile soil gives seeds a better chance.
    if (w.soilNutrient) {
      const nutrientHere = w.soilNutrient[seed.y * WORLD_W + seed.x] ?? 0
      const sproutFactor = 0.5 + nutrientHere * 1.5
      if (rng() > sproutFactor / 2) { surviving.push(seed); continue }
    }

    // Photosynthesis pause: seeds require light to germinate. At deep night (nightFactor
    // > 0.7) sprouting drops to ~5% of the normal rate — nearly zero. During the day
    // and especially at dawn the seed bank runs freely. This makes plant colonisation a
    // daytime phenomenon and gives diurnal species a natural edge over nocturnal ones
    // in controlling ground cover. Issue #3073.
    if (TUNING.dayLengthSeconds > 0) {
      const dayFraction = (w.elapsed % TUNING.dayLengthSeconds) / TUNING.dayLengthSeconds
      const seedNightFactor = (1 - Math.cos(2 * Math.PI * dayFraction)) / 2
      if (seedNightFactor > 0.7 && rng() > 0.05) { surviving.push(seed); continue }
    }

    // Try to germinate via the same reproduce path the pollinator uses.
    const { w: bw, h: bh } = artSize(bp)
    const wasExtinct = (speciesCount[seed.blueprintId] ?? 0) === 0

    // Fire-adapted plants sprout at 5× rate when ash is nearby. Issue #3117.
    let sproutAttempts = 1
    if (bp.fireAdapted) {
      const ashMatIdx = MATERIAL_INDEX.ash
      const ox = seed.x, oy = seed.y
      let ashNearby = false
      outer3117: for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = Math.min(WORLD_W - 1, Math.max(0, ox + dx))
          const ny = Math.min(WORLD_H - 1, Math.max(0, oy + dy))
          if (w.tiles[ny * WORLD_W + nx] === ashMatIdx) { ashNearby = true; break outer3117 }
        }
      }
      if (ashNearby) sproutAttempts = 5
    }

    let germinated: ReturnType<typeof reproduce> = null
    for (let a = 0; a < sproutAttempts && !germinated; a++) {
      germinated = reproduce(w, bp, seed.x + 0.5, seed.y, bw, bh, rng)
    }
    if (germinated) {
      plantsRef.value++
      speciesCount[seed.blueprintId] = (speciesCount[seed.blueprintId] ?? 0) + 1
      // Don't push seed — it germinated successfully
      if (wasExtinct) events.push({ kind: 'diversity-rescue', blueprintId: seed.blueprintId, x: seed.x, y: seed.y })
    } else {
      surviving.push(seed)
    }
  }

  w.seedBank = surviving
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
  tickCaveNutrient(w, tickCount, dt)
  tickSalinity(w, tickCount)
  tickTidal(w, tickCount)
  tickMarshDetritus(w, tickCount, dt)
  tickSoilNutrient(w, tickCount)
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

  // Named season and progress: derived from elapsed time, stored for UI and chronicle.
  // yearFrac 0.0–0.25 = spring (rising), 0.25–0.5 = summer (falling), etc. Epic #3074.
  if (TUNING.seasonAmplitude > 0 && TUNING.seasonPeriod > 0) {
    const yearFrac = (w.elapsed % TUNING.seasonPeriod) / TUNING.seasonPeriod
    if (yearFrac < 0.25) {
      w.season = 'spring'
      w.seasonProgress = yearFrac / 0.25
    } else if (yearFrac < 0.5) {
      w.season = 'summer'
      w.seasonProgress = (yearFrac - 0.25) / 0.25
    } else if (yearFrac < 0.75) {
      w.season = 'autumn'
      w.seasonProgress = (yearFrac - 0.5) / 0.25
    } else {
      w.season = 'winter'
      w.seasonProgress = (yearFrac - 0.75) / 0.25
    }
  }

  // Ocean current conveyor: slow lateral current, reverses each half-season. Issue #3250.
  const CURRENT_PERIOD = TUNING.seasonPeriod * 2
  w.oceanCurrentX = Math.sin(2 * Math.PI * w.elapsed / CURRENT_PERIOD) * 0.3

  // Plankton bloom: active during spring/summer peak. Issue #3254.
  w.planktonBloomActive = TUNING.seasonAmplitude > 0 && seasonFactor > 1.2
  // Lunar phase counter: one full cycle every ~28 "moon days" = 0.9333 × seasonPeriod.
  // Issues #3187, #3188.
  const LUNAR_PERIOD = TUNING.seasonPeriod * 0.9333
  w.lunarPhaseDay = (w.elapsed / LUNAR_PERIOD) * 28 % 28
  w.tidalHeight = Math.sin(2 * Math.PI * w.lunarPhaseDay / 28)

  // Count living plants for CO2 absorption
  const plantCount = w.creatures.filter(c => w.blueprints[c.blueprintId]?.move.kind === 'root').length
  tickAtmosphericCO2(w, tickCount, plantCount)
  tickAcidRain(w, tickCount, rng)
  tickMycorrhizalNetwork(w, tickCount, rng)
  tickWebDecay(w, tickCount, rng)
  tickFire(w, tickCount, rng, IS_FLAMMABLE, IS_LIQUID, MATERIAL_INDEX.fire, MATERIAL_INDEX.ash)
  tickWeather(w, tickCount, rng)
  tickMineralVeins(w, tickCount, rng)
  tickEdgeMask(w, tickCount)
  tickCorridorMask(w, tickCount)
  tickBoneDecomposition(w, tickCount, rng)  // Bone slow decomposition (#3103)
  updateBiomeZones(w, tickCount, seasonFactor)
  tickTileTemp(w, tickCount, seasonFactor)

  // Ice formation: cold biome water tiles freeze. Issue #3137.
  // Ice melting: warm biome ice tiles thaw. Issue #3138.
  if (tickCount % 60 === 0 && TUNING.seasonAmplitude > 0 && w.biomeZones) {
    const waterIdx = MATERIAL_INDEX.water
    const iceIdx = MATERIAL_INDEX.ice
    const REGION_H = Math.floor(WORLD_H / (w.biomeZones.length || 1))
    for (let r = 0; r < (w.biomeZones?.length ?? 0); r++) {
      const zone = w.biomeZones[r]
      if (!zone) continue
      const rowStart = r * REGION_H
      const rowEnd = Math.min(rowStart + REGION_H, WORLD_H)
      if (zone.temperature < 0.1) {
        // Freeze some water tiles in this cold zone
        for (let y = rowStart; y < rowEnd; y++) {
          for (let x = 0; x < WORLD_W; x += 8) {  // sample every 8th column
            const i = y * WORLD_W + x
            if (w.tiles[i] === waterIdx && rng() < 0.002) {
              setTile(w, x, y, iceIdx)
            }
          }
        }
      } else if (zone.temperature > 0.35) {
        // Melt some ice tiles in warm zones
        for (let y = rowStart; y < rowEnd; y++) {
          for (let x = 0; x < WORLD_W; x += 8) {
            const i = y * WORLD_W + x
            if (w.tiles[i] === iceIdx && rng() < 0.003) {
              setTile(w, x, y, waterIdx)
            }
          }
        }
      }
    }
  }
  tickSoilAge(w, tickCount)
  updateKeystoneSpecies(w, tickCount)
  // Water cycle — Issues #3110, #3111, #3112, #3114
  tickEvaporation(w, tickCount, rng)
  tickCloudDrift(
    w, tickCount, rng, setTile,
    MATERIAL_INDEX['air'],
    MATERIAL_INDEX['cloud'],
    MATERIAL_INDEX['water'],
    MATERIAL_INDEX['snow'],
  )
  tickGroundwater(w, tickCount, IS_LIQUID)

  // Wind direction: slow sinusoidal oscillation, independent from seasons. Issue #3153.
  const WIND_PERIOD_X = TUNING.seasonPeriod * 3.1
  const WIND_PERIOD_Y = TUNING.seasonPeriod * 4.7
  w.windX = Math.cos(2 * Math.PI * w.elapsed / WIND_PERIOD_X) * 0.4
  w.windY = Math.sin(2 * Math.PI * w.elapsed / WIND_PERIOD_Y) * 0.15

  const creatures = w.creatures
  const dead = new Set<number>()

  // Plants are capped as a share of the population so they can't carpet the map.
  // plantCount was already computed above for CO2 absorption.
  // Tracked live rather than snapshotted: every eligible plant breeds in the
  // same tick, so a snapshot taken up here lets 150 plants become 300 before
  // the cap is ever re-read.
  let plantsAlive = plantCount

  // Per-species headcount, so no single animal can eat the world on its own.
  const speciesCount: Record<string, number> = {}
  for (const c of creatures) {
    speciesCount[c.blueprintId] = (speciesCount[c.blueprintId] ?? 0) + 1
  }

  // Kestrel Kingdom: at each seasonal boundary, the individual with the most
  // cumulative meals is crowned Monarch and hunts at 110% speed. The throne
  // is re-awarded each season with no memory of the previous holder. No
  // interregnum — if the Monarch dies mid-season kestrels continue normally.
  // Issue #3304.
  if (TUNING.seasonPeriod > 0) {
    const currentSeasonIdx = Math.floor(w.elapsed / TUNING.seasonPeriod)
    if ((w.kestrelLastSeasonIdx ?? -1) < currentSeasonIdx) {
      w.kestrelLastSeasonIdx = currentSeasonIdx
      let bestMeals = -1
      let newMonarch: typeof w.creatures[0] | null = null
      for (const c of w.creatures) {
        const cbp = w.blueprints[c.blueprintId]
        c.isMonarch = false  // clear throne from everyone
        if (!cbp?.kestrelKingdom) continue
        if (c.mealsEaten > bestMeals) {
          bestMeals = c.mealsEaten
          newMonarch = c
        }
      }
      if (newMonarch) {
        newMonarch.isMonarch = true
        w.kestrelMonarchId = newMonarch.id
      } else {
        w.kestrelMonarchId = undefined
      }
    }
  }

  // Otter Oligarchy: each season elect the 5 fattest otters as oligarchs.
  // Issue #3308.
  if (TUNING.seasonPeriod > 0) {
    const currentSeasonIdx = Math.floor(w.elapsed / TUNING.seasonPeriod)
    if ((w.otterLastElectionSeason ?? -1) < currentSeasonIdx) {
      w.otterLastElectionSeason = currentSeasonIdx
      // Clear all oligarch flags first
      for (const c of w.creatures) {
        c.isOligarch = false
      }
      // Rank otters by mealsEaten and elect top 5
      const otters = w.creatures
        .filter(c => w.blueprints[c.blueprintId]?.otterOligarchy)
        .sort((a, b) => b.mealsEaten - a.mealsEaten)
        .slice(0, 5)
      const oligarchIdSet = new Set<number>()
      for (const o of otters) {
        o.isOligarch = true
        oligarchIdSet.add(o.id)
      }
      w.otterOligarchIds = [...oligarchIdSet]
    }
  }

  // Vole Voting: each season elect a Chief Vole.
  // Incumbent re-elected 80% of the time. Issue #3315.
  if (TUNING.seasonPeriod > 0) {
    const currentSeasonIdx = Math.floor(w.elapsed / TUNING.seasonPeriod)
    if ((w.chiefVoleLastElectionSeason ?? -1) < currentSeasonIdx) {
      w.chiefVoleLastElectionSeason = currentSeasonIdx
      const voles = w.creatures.filter(c => w.blueprints[c.blueprintId]?.voleVoting)
      if (voles.length > 0) {
        for (const v of voles) v.isChiefVole = false
        // Incumbent loyalty: 80% chance to re-elect if still alive
        const incumbent = voles.find(v => v.id === w.chiefVoleId)
        if (incumbent && rng() < 0.8) {
          incumbent.isChiefVole = true
        } else {
          // New election — random pick
          const winner = voles[Math.floor(rng() * voles.length)]
          winner.isChiefVole = true
          w.chiefVoleId = winner.id
        }
      }
    }
  }

  // Squirrel Socialism: when pop > 30 activate the collective.
  // Issue #3312.
  {
    const squirrels = w.creatures.filter(c => w.blueprints[c.blueprintId]?.squirrelSocialism)
    // Ensure Gerald exists
    if (squirrels.length > 0 && w.squirrelGeraldId === undefined) {
      w.squirrelGeraldId = squirrels[0].id
      squirrels[0].isGerald = true
    }
    const wasActive = w.squirrelCollectiveActive ?? false
    w.squirrelCollectiveActive = squirrels.length > 30
    if (w.squirrelCollectiveActive && !wasActive) {
      // Collective just activated — redistribute hunger toward median
      const hungers = squirrels.map(c => c.hunger).sort((a, b) => a - b)
      const median = hungers[Math.floor(hungers.length / 2)]
      for (const s of squirrels) {
        if (s.id === w.squirrelGeraldId) continue  // Gerald is exempt
        s.hunger = s.hunger * 0.5 + median * 0.5  // smooth toward median
      }
    }
  }

  // Amphitheater Ants: periodic mandatory performance reviews. Issue #3294.
  if (TUNING.seasonPeriod > 0) {
    const currentSeasonIdx = Math.floor(w.elapsed / TUNING.seasonPeriod)
    if ((w.antLastPerformanceSeason ?? -1) < currentSeasonIdx) {
      w.antLastPerformanceSeason = currentSeasonIdx
      const ants = w.creatures.filter(c => w.blueprints[c.blueprintId]?.antTheater)
      if (ants.length > 0) {
        // Clear all performers
        for (const a of ants) a.isPerformer = false
        // Elect performer: most-fed ant
        const performer = ants.reduce((best, a) => a.mealsEaten > best.mealsEaten ? a : best, ants[0])
        performer.isPerformer = true
        // Audience: all ants within 10 tiles
        let audience = 0
        for (const a of ants) {
          const dx = a.x - performer.x, dy = a.y - performer.y
          if (dx * dx + dy * dy < 100) audience++
        }
        w.antAudience = audience
        events.push({ kind: 'notice', blueprintId: performer.blueprintId, x: performer.x, y: performer.y, text: `Mandatory attendance review at the Amphitheater. Attendance: ${audience}/${ants.length}. The committee is not satisfied.` })
        // Reward: attending ants get a breed cooldown boost
        for (const a of ants) {
          const dx = a.x - performer.x, dy = a.y - performer.y
          if (dx * dx + dy * dy < 25) {
            a.breedCooldown = Math.max(0, (a.breedCooldown ?? 0) - 5)
          }
        }
      }
    }
  }

  // Bear Banking: communal savings with seasonal interest. Issue #3295.
  if (TUNING.seasonPeriod > 0) {
    const currentSeasonIdx = Math.floor(w.elapsed / TUNING.seasonPeriod)
    if ((w.bearBankLastSeasonIdx ?? -1) < currentSeasonIdx) {
      w.bearBankLastSeasonIdx = currentSeasonIdx
      const bears = w.creatures.filter(c => w.blueprints[c.blueprintId]?.bearBanking)
      if (bears.length > 0) {
        w.bearBankBalance ??= 0
        // Deposits: well-fed bears add to bank
        for (const b of bears) {
          if (b.hunger < 0.5) {
            const deposit = (0.5 - b.hunger) * 10
            w.bearBankBalance += deposit
          }
        }
        // Interest: 5% per season, cap at 100
        w.bearBankBalance = Math.min(100, w.bearBankBalance * 1.05)
        // Withdrawals: hungry bears draw from bank
        for (const b of bears) {
          if (b.hunger > 0.8 && w.bearBankBalance > 5) {
            const withdrawal = Math.min(5, w.bearBankBalance)
            b.hunger = Math.max(0, b.hunger - withdrawal * 0.02)
            w.bearBankBalance -= withdrawal
          }
        }
        const bpId = bears[0].blueprintId
        if (w.bearBankBalance > 80) {
          events.push({ kind: 'notice', blueprintId: bpId, x: bears[0].x, y: bears[0].y, text: `Bear Bank seasonal dividend declared. Balance: ${w.bearBankBalance.toFixed(1)} nuts. The auditors are impressed.` })
        } else {
          events.push({ kind: 'notice', blueprintId: bpId, x: bears[0].x, y: bears[0].y, text: `Bear Bank balance: ${w.bearBankBalance.toFixed(1)} nuts. Interest rate: 5%. All deposits guaranteed.` })
        }
      }
    }
  }

  // Quail Quarantine Zone: quarantine triggered by single sneeze in Season 4. Issue #3310.
  if (TUNING.seasonPeriod > 0) {
    const currentSeasonIdx = Math.floor(w.elapsed / TUNING.seasonPeriod)
    const quails = w.creatures.filter(c => w.blueprints[c.blueprintId]?.quailQuarantine)
    if (quails.length > 0) {
      const bpId = quails[0].blueprintId
      // Season 4 triggers quarantine (season index 3)
      if (!w.quailQuarantineActive && currentSeasonIdx === 3 && (w.quailQuarantineSeasonIdx ?? -1) < 3) {
        w.quailQuarantineActive = true
        w.quailQuarantineSeasonIdx = currentSeasonIdx
        events.push({ kind: 'notice', blueprintId: bpId, x: quails[0].x, y: quails[0].y, text: `QUARANTINE NOTICE: Quail Settlement placed under quarantine following a suspicious sneeze on Day 1 of Season 4. Breeding suspended pending investigation.` })
      }
      // Lift quarantine after 1 season or when pop < 5
      if (w.quailQuarantineActive) {
        if (currentSeasonIdx > (w.quailQuarantineSeasonIdx ?? 3) || quails.length < 5) {
          w.quailQuarantineActive = false
          events.push({ kind: 'notice', blueprintId: bpId, x: quails[0].x, y: quails[0].y, text: `Quarantine lifted. Health Inspector Vole declared the settlement safe. The original sneezer was unavailable for comment.` })
        }
      }
    }
  }

  // Raccoon Real Estate: seasonal property appraisal and flipping. Issue #3311.
  if (TUNING.seasonPeriod > 0) {
    const currentSeasonIdx = Math.floor(w.elapsed / TUNING.seasonPeriod)
    if ((w.raccoonRealEstateLastSeasonIdx ?? -1) < currentSeasonIdx) {
      w.raccoonRealEstateLastSeasonIdx = currentSeasonIdx
      const raccoons = w.creatures.filter(c => w.blueprints[c.blueprintId]?.raccoonRealEstate)
      if (raccoons.length > 0) {
        w.raccoonDenSites ??= {}
        let topFlipper: typeof raccoons[0] | null = null
        let topGarbage = -1
        for (const r of raccoons) {
          // Appraise location: value = recent meals × 10 capped
          const value = Math.min(10, r.mealsEaten / 10)
          const key = `${Math.floor(r.x)},${Math.floor(r.y)}`
          w.raccoonDenSites[key] = value
          r.garbageCurrency = (r.garbageCurrency ?? 0) + value
          if (r.garbageCurrency > topGarbage) {
            topGarbage = r.garbageCurrency
            topFlipper = r
          }
        }
        if (topFlipper) {
          // Find most valuable site
          let bestSite = '', bestVal = -1
          for (const [k, v] of Object.entries(w.raccoonDenSites)) {
            if (v > bestVal) { bestVal = v; bestSite = k }
          }
          const bpId = topFlipper.blueprintId
          events.push({ kind: 'notice', blueprintId: bpId, x: topFlipper.x, y: topFlipper.y, text: `Raccoon Real Estate Report: ${raccoons.length} listings. Top flipper holds ${topGarbage.toFixed(0)} garbage units. Market: HOT.` })
          topFlipper.garbageCurrency = 0  // spent on the flip
        }
      }
    }
  }

  // Invasion front tracking: for each invasive species, record origin and
  // track the historical maximum X spread. Runs every 60 ticks (once per
  // second). Issue #3366.
  if (tickCount % 60 === 0) {
    w.invasionOriginX ??= {}
    w.invasionFrontX ??= {}
    for (const c of w.creatures) {
      const cbp = w.blueprints[c.blueprintId]
      if (!cbp?.invasive) continue
      const cx = Math.floor(c.x)
      if (w.invasionOriginX[c.blueprintId] === undefined) {
        w.invasionOriginX[c.blueprintId] = cx
      }
      if (w.invasionFrontX[c.blueprintId] === undefined || cx > w.invasionFrontX[c.blueprintId]) {
        w.invasionFrontX[c.blueprintId] = cx
      }
    }
  }

  // Stochastic extinction: tiny populations face random crashes. Issue #3291.
  if (tickCount % 300 === 0) {
    for (const [bpId, cnt] of Object.entries(speciesCount)) {
      if (cnt < 5 && cnt > 0 && rng() < 0.01) {
        const toExtinct = w.creatures.filter(c2 => c2.blueprintId === bpId)
        const extBp = w.blueprints[bpId]
        if (extBp) {
          for (const c2 of toExtinct) kill(w, c2, extBp, dead, events, 'aged')
          events.push({ kind: 'extinction', blueprintId: bpId, x: 0, y: 0, text: `${extBp.name} went locally extinct` })
        }
      }
    }
  }

  // Population overshoot and collapse. Issue #3292.
  if (tickCount % 60 === 0) {
    for (const [bpId, cnt] of Object.entries(speciesCount)) {
      const obp = w.blueprints[bpId]
      if (!obp?.populationCap || cnt <= obp.populationCap * 1.5) continue
      const victims2 = w.creatures.filter(c2 => c2.blueprintId === bpId)
      const killCnt = Math.floor(victims2.length * 0.3)
      for (let ki = 0; ki < killCnt; ki++) {
        const v = victims2[Math.floor(rng() * victims2.length)]
        if (v) kill(w, v, obp, dead, events, 'starved')
      }
      events.push({ kind: 'notice', blueprintId: bpId, x: 0, y: 0, text: `${obp.name} population collapsed from overshoot` })
    }
  }

  // --- Crab Constitution: once-per-world event when 10+ crabs assemble. Issue #3296. ---
  if (!w.crabConstitutionRatified) {
    for (const [bpId, cnt] of Object.entries(speciesCount)) {
      const cbp = w.blueprints[bpId]
      if (!cbp?.crabConstitution || cnt < 10) continue
      w.crabConstitutionRatified = true
      const CLAUSES = [
        'ARTICLE I: The right to moult without interference is inalienable.',
        'ARTICLE II: Equal access to shell sizes for all citizens.',
        'ARTICLE III: A Senate of Shells shall be formed. It has not yet met.',
      ]
      const text = `${cbp.name} Constitution ratified. ${CLAUSES[Math.floor(rng() * CLAUSES.length)]} Enforcement mechanism: none.`
      events.push({ kind: 'notice', blueprintId: bpId, x: 0, y: 0, text })
      break
    }
  }

  // --- Duck Democracy: periodic town hall votes. Issue #3297. ---
  const DUCK_HALL_PERIOD = TUNING.seasonPeriod / 10  // every ~30 seconds ≈ 10 in-game days
  w.duckTownHallTime ??= w.elapsed + DUCK_HALL_PERIOD
  if (w.elapsed >= w.duckTownHallTime) {
    w.duckTownHallTime = w.elapsed + DUCK_HALL_PERIOD
    for (const [bpId] of Object.entries(speciesCount)) {
      const dbp = w.blueprints[bpId]
      if (!dbp?.duckDemocracy) continue
      const ducks = w.creatures.filter(c2 => c2.blueprintId === bpId)
      if (ducks.length < 3) continue
      const facingRight = ducks.filter(d => d.facing === 1).length
      const ISSUES = ['fish supply', 'predator proximity', 'nesting materials', 'pond water quality', 'bread distribution']
      const issue = ISSUES[Math.floor(rng() * ISSUES.length)]
      const outcome = facingRight > ducks.length / 2 ? 'right' : 'left'
      events.push({ kind: 'notice', blueprintId: bpId, x: 0, y: 0, text: `${dbp.name} Town Hall: ${issue} discussed. Decision Made: [Inconclusive] (majority faced ${outcome})` })
      break
    }
  }
  // --- Otter Oligarchy: 5 oligarchs elected by fish catches each season. Issue #3308. ---
  if (TUNING.seasonPeriod > 0) {
    const currentSeason = Math.floor(w.elapsed / TUNING.seasonPeriod)
    if ((w.otterLastElectionSeason ?? -1) < currentSeason) {
      for (const [bpId, cnt] of Object.entries(speciesCount)) {
        const obp = w.blueprints[bpId]
        if (!obp?.otterOligarchy) continue
        w.otterLastElectionSeason = currentSeason
        const otters = w.creatures.filter(c2 => c2.blueprintId === bpId)
        for (const o of otters) o.isOligarch = false
        if (cnt > 15) {
          const oligarchs = otters.sort((a, b2) => b2.mealsEaten - a.mealsEaten).slice(0, 5)
          for (const o of oligarchs) o.isOligarch = true
          w.otterOligarchIds = oligarchs.map(o => o.id)
          const bloc = oligarchs.slice(0, 3).map(o => `#${o.id}`).join(', ')
          events.push({ kind: 'notice', blueprintId: bpId, x: 0, y: 0, text: `${obp.name} Oligarchy elected. Bloc: ${bloc}. The other two are aware.` })
        } else {
          w.otterOligarchIds = []
        }
        break
      }
    }
  }

  // --- Squirrel Socialism: collective food sharing when pop > 30. Issue #3312. ---
  for (const [bpId, cnt] of Object.entries(speciesCount)) {
    const sbp = w.blueprints[bpId]
    if (!sbp?.squirrelSocialism) continue
    const wasCollective = w.squirrelCollectiveActive ?? false
    w.squirrelCollectiveActive = cnt > 30
    if (w.squirrelCollectiveActive && !wasCollective) {
      // Find/assign Gerald (lowest id = first squirrel)
      const squirrels = w.creatures.filter(c2 => c2.blueprintId === bpId)
      const gerald = squirrels.reduce((g, c2) => (c2.id < g.id ? c2 : g), squirrels[0])
      if (gerald) {
        w.squirrelGeraldId = gerald.id
        gerald.isGerald = true
        events.push({ kind: 'notice', blueprintId: bpId, x: 0, y: 0, text: `${sbp.name} Collective formed. Gerald (#${gerald.id}) retains private stash. Exemption is "temporary". Gerald is thriving.` })
      }
    }
    break
  }

  // --- Vole Voting: maze ballot; incumbent exits the maze first (they know the route). Issue #3315. ---
  if (TUNING.seasonPeriod > 0) {
    const vSeason = Math.floor(w.elapsed / TUNING.seasonPeriod)
    if ((w.chiefVoleLastElectionSeason ?? -1) < vSeason) {
      for (const [bpId, cnt] of Object.entries(speciesCount)) {
        const vbp = w.blueprints[bpId]
        if (!vbp?.voleVoting || cnt < 2) continue
        w.chiefVoleLastElectionSeason = vSeason
        const voles = w.creatures.filter(c2 => c2.blueprintId === bpId)
        for (const v of voles) v.isChiefVole = false
        // Incumbent re-elected 80% of the time (knows the maze route)
        const incumbentStillAlive = w.chiefVoleId !== undefined && voles.some(v => v.id === w.chiefVoleId)
        let newChief: typeof voles[0] | null = null
        if (incumbentStillAlive && rng() < 0.8) {
          newChief = voles.find(v => v.id === w.chiefVoleId) ?? null
        } else {
          newChief = voles[Math.floor(rng() * voles.length)]
        }
        if (newChief) {
          newChief.isChiefVole = true
          w.chiefVoleId = newChief.id
          const reElected = incumbentStillAlive && newChief.id === w.chiefVoleId
          events.push({ kind: 'notice', blueprintId: bpId, x: 0, y: 0, text: `${vbp.name} Election: Chief Vole #${newChief.id} ${reElected ? 're-elected' : 'elected'}. Maze designer chairs reform committee. Electoral integrity proposals: 12. Resolved: 0.` })
        }
        break
      }
    }
  }

  // Urchin Union: sea urchins strike when population > 15. Issue #3314.
  for (const [bpId, cnt] of Object.entries(speciesCount)) {
    const ubp = w.blueprints[bpId]
    if (!ubp?.urchinUnion) continue
    const wasStriking = w.urchinStrikeActive ?? false
    w.urchinStrikeActive = cnt > 15
    if (w.urchinStrikeActive && !wasStriking) {
      events.push({ kind: 'notice', blueprintId: bpId, x: 0, y: 0, text: `${ubp.name} Union on strike. Demands: stronger currents, fewer predators. Management has not responded.` })
    }
    break
  }

  // --- Frog Fundamentalism: annual Founding Rain ritual. Issue #3299. ---
  if (tickCount % 60 === 0) {
    for (const [bpId, cnt] of Object.entries(speciesCount)) {
      const fbp = w.blueprints[bpId]
      if (!fbp?.frogFundamentalism || cnt < 1) continue
      const currentSeason = TUNING.seasonPeriod > 0 ? Math.floor(w.elapsed / TUNING.seasonPeriod) : 0
      if ((w.lastFrogRitualSeason ?? -1) < currentSeason) {
        w.lastFrogRitualSeason = currentSeason
        // Founding Rain: frogs near water are faithful; distant frogs are apostates
        const frogsNearWater: number[] = []
        const apostateFrogs: Creature[] = []
        for (const frog of w.creatures) {
          if (frog.blueprintId !== bpId) continue
          const fx = Math.floor(frog.x), fy = Math.floor(frog.y)
          let nearWater = false
          for (let dy = -3; dy <= 3 && !nearWater; dy++) {
            for (let dx = -3; dx <= 3 && !nearWater; dx++) {
              const ty = fy + dy, tx = (fx + dx + WORLD_W) % WORLD_W
              if (ty < 0 || ty >= w.tiles.length / WORLD_W) continue
              if (IS_LIQUID[w.tiles[ty * WORLD_W + tx]] === 1) nearWater = true
            }
          }
          if (nearWater) frogsNearWater.push(frog.id)
          else { frog.frogApostate = TUNING.seasonPeriod / 18; apostateFrogs.push(frog) }
        }
        events.push({ kind: 'notice', blueprintId: bpId, x: 0, y: 0, text: `${fbp.name} Founding Rain observed. ${frogsNearWater.length} faithful, ${apostateFrogs.length} apostates. No theology. Only the rain matters.` })
      }
      break
    }
  }

  // MVP warning and rescue effect. Issues #3284, #3285.
  if (tickCount % 60 === 0) {
    for (const [bpId, cnt] of Object.entries(speciesCount)) {
      const ebp = w.blueprints[bpId]
      if (!ebp?.minViablePopulation) continue
      if (cnt < ebp.minViablePopulation && cnt > 0) {
        // Rescue effect: stochastic immigration from an imagined meta-population
        // prevents immediate extinction when a small population persists.
        if (rng() < 0.05 * dt) {
          const randomExisting = w.creatures.find(c2 => c2.blueprintId === bpId)
          if (randomExisting) {
            const immigrant = spawnCreature(w, ebp, randomExisting.x + (rng() - 0.5) * 10, randomExisting.y + (rng() - 0.5) * 10)
            if (immigrant) {
              immigrant.generation = randomExisting.generation
              // spawnCreature already pushed immigrant to w.creatures
            }
          }
        }
      }
    }
  }

  // --- Lemming Legislature: periodic cliff votes. Issue #3305. ---
  const LEMMING_VOTE_PERIOD = TUNING.seasonPeriod / 6  // ~50 s ≈ 15 in-game days
  for (const [bpId, cnt] of Object.entries(speciesCount)) {
    const lbp = w.blueprints[bpId]
    if (!lbp?.lemmingLegislature) continue
    // Record baseline on first observation
    ;(w.lemmingBaseline ??= {})[bpId] ??= Math.max(50, cnt)
    // Initialize vote timer
    w.lemmingNextVoteTime ??= w.elapsed + LEMMING_VOTE_PERIOD
    if (w.elapsed >= w.lemmingNextVoteTime) {
      w.lemmingNextVoteTime = w.elapsed + LEMMING_VOTE_PERIOD
      // Elect up to 20 legislators from the healthiest individuals
      const eligible = w.creatures.filter(c2 => c2.blueprintId === bpId)
      for (const c2 of eligible) c2.isLegislator = false
      if (cnt >= 100) {
        const legislators = eligible
          .sort((a, b2) => a.hunger - b2.hunger)  // least hungry = healthiest
          .slice(0, 20)
        for (const leg of legislators) leg.isLegislator = true
      }
      // The Vote: Cliff or No Cliff
      const baseline = (w.lemmingBaseline ??= {})[bpId] ?? 100
      const densityRatio = cnt / baseline
      if (densityRatio > 2 && cnt >= 100) {
        // CLIFF VOTE: legislators + 30% of followers march off the edge
        for (const c2 of eligible) {
          if (c2.isLegislator || rng() < 0.3) c2.cliffBound = true
        }
        events.push({ kind: 'notice', blueprintId: bpId, x: 0, y: 0, text: `${lbp.name} Legislature votes: CLIFF` })
      }
    }
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

  // Thermocline: temperature boundary creates distinct shallow vs deep water zones. Issue #3249.
  if (tickCount % 300 === 0) {
    // Find water surface (topmost liquid tile in middle column).
    const midCol = Math.floor(WORLD_W / 2)
    let surfaceY = 0
    for (let ty = 0; ty < WORLD_H; ty++) {
      if (IS_LIQUID[w.tiles[ty * WORLD_W + midCol] ?? 0] === 1) {
        surfaceY = ty
        break
      }
    }
    w.thermoclineY = Math.floor(surfaceY + (WORLD_H - surfaceY) * 0.4)
  }

  // Marine snow: surface productivity creates downward nutrient flux to deep sea. Issue #3251.
  if (tickCount % 120 === 0 && w.thermoclineY !== undefined) {
    w.caveNutrient ??= new Float32Array(WORLD_W * WORLD_H)
    const snowRate = 0.002
    for (let sx = 0; sx < WORLD_W; sx++) {
      // Find water surface for this column.
      let surf = -1
      for (let sy = 0; sy < WORLD_H; sy++) {
        if (IS_LIQUID[w.tiles[sy * WORLD_W + sx] ?? 0] === 1) { surf = sy; break }
      }
      if (surf < 0) continue
      // Find bottom for this column.
      let bottom = WORLD_H - 1
      for (let sy = WORLD_H - 1; sy >= surf; sy--) {
        if (IS_LIQUID[w.tiles[sy * WORLD_W + sx] ?? 0] === 1) { bottom = sy; break }
      }
      if (bottom <= surf) continue
      const surfIdx = surf * WORLD_W + sx
      const bottomIdx = bottom * WORLD_W + sx
      // Transfer a fraction of surface nutrient to the bottom.
      const snowAmount = (w.caveNutrient[surfIdx] ?? 0) * snowRate
      if (snowAmount > 0.0001) {
        w.caveNutrient[surfIdx] = Math.max(0, w.caveNutrient[surfIdx] - snowAmount)
        w.caveNutrient[bottomIdx] = Math.min(1, (w.caveNutrient[bottomIdx] ?? 0) + snowAmount)
      }
    }
  }

  // Mass emergence pre-computation: which species have >= 3 pupae whose timer
  // will expire this tick? Used for predator satiation during the eating pass.
  // Issue #3339.
  const massEmergingSpecies = new Set<string>()
  const pupaCountBySpecies: Record<string, number> = {}
  if (seasonFactor >= 0.7) {
    for (const c of creatures) {
      if (c.lifeStage === 'pupa' && c.pupalTimer !== undefined && c.pupalTimer <= dt) {
        pupaCountBySpecies[c.blueprintId] = (pupaCountBySpecies[c.blueprintId] ?? 0) + 1
      }
    }
    for (const [bpId, count] of Object.entries(pupaCountBySpecies)) {
      if (count >= 3) massEmergingSpecies.add(bpId)
    }
  }

  // Per-tick emergence counter for the post-loop notice event. Issue #3339.
  const emergenceCount: Record<string, number> = {}

  for (const c of creatures) {
    if (dead.has(c.id)) continue
    const bp = w.blueprints[c.blueprintId]
    if (!bp) {
      dead.add(c.id)
      continue
    }

    /**
     * Whether this creature is a rooted plant.
     *
     * Declared at the top of the loop body rather than down in the breeding
     * section, which is where it is most used and where it used to live.
     * Habitat features added since — riparian buffers, leaf litter subsidy,
     * technique innovation — read it hundreds of lines earlier, and a `const`
     * read above its own declaration is not a hoisting convenience, it is a
     * temporal dead zone throw. It killed `step()` on the first plant to tick,
     * which is every world the moment fertile ground is painted. Keep this
     * above every read.
     */
    const isPlant = bp.move.kind === 'root'

    // `bw`/`bh` are what the creature *looks* like — used for sight, biting and
    // anything the player can see. `body` is what it collides with. For all but
    // the largest creatures the two are identical.
    const { w: bw, h: bh } = artSize(bp)
    const body = bodyBox(bp)

    // Reproduction rate multiplier — accumulated by habitat features, consumed in the breed gate.
    let reproRate = 1

    c.ageSeconds += dt
    c.animMs += dt * 1000
    if (c.breedCooldown > 0) {
      const nutrientBoost = (c.nutrientStore ?? 0) > 0.2 ? 1.5 : 1
      // Jellyfish Judiciary verdict: court-granted breeding priority decays cooldown 50% faster. Issue #3303.
      const judiciaryBoost = (c.judiciaryPriorityTimer ?? 0) > 0 ? 1.5 : 1
      // Gerald breeds 20% faster (Squirrel Socialism founder exemption). Issue #3312.
      const geraldBoost = (bp.squirrelSocialism && c.isGerald) ? 1.2 : 1
      // Chief Vole breeds 15% faster (Vole Voting electoral advantage). Issue #3315.
      const chiefVoleBoost = (bp.voleVoting && c.isChiefVole) ? 1.15 : 1
      c.breedCooldown -= dt * nutrientBoost * judiciaryBoost * geraldBoost * chiefVoleBoost
    }
    // Decay nutrient store over time.
    if (c.nutrientStore) {
      c.nutrientStore = Math.max(0, c.nutrientStore - 0.0005 * dt)
    }
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
    // Venom slow + DoT: tick down venom debuff; envenomed creatures also suffer
    // a hunger drain (damage-over-time), creating real selection pressure for
    // venomResistance evolution in prey populations. Issue #3236.
    if (c.venomTimer && c.venomTimer > 0) {
      c.venomTimer = Math.max(0, c.venomTimer - dt)
      c.hunger = Math.min(1, c.hunger + 0.003 * dt) // ~0.3% hunger/sec while envenomed
    }
    if (c.insightTimer && c.insightTimer > 0) c.insightTimer = Math.max(0, c.insightTimer - dt)
    // Chemical defense prime: tick down mycorrhizal-relayed signal. Issue #3331.
    if (c.defenseTimer !== undefined && c.defenseTimer > 0) {
      c.defenseTimer = Math.max(0, c.defenseTimer - dt)
    }
    // Stress-signal primed defense: tick down volatile-compound prime. Issue #3239.
    if (c.primedDefense && c.primedDefense > 0) c.primedDefense = Math.max(0, c.primedDefense - dt)
    if ((c as { symbiosisTimer?: number }).symbiosisTimer === undefined) c.symbiosisTimer = 0
    if (c.symbiosisTimer > 0) c.symbiosisTimer = Math.max(0, c.symbiosisTimer - dt)
    // Jellyfish Judiciary priority: tick down court-granted breeding bonus. Issue #3303.
    if (c.judiciaryPriorityTimer && c.judiciaryPriorityTimer > 0) {
      c.judiciaryPriorityTimer = Math.max(0, c.judiciaryPriorityTimer - dt)
    }
    // Dominance hierarchy: decay rank contest cooldown and rank itself with age. Issue #3227.
    if (bp.dominanceHierarchy) {
      if ((c.rankContestCooldown ?? 0) > 0) {
        c.rankContestCooldown = Math.max(0, (c.rankContestCooldown ?? 0) - dt)
      }
      // Rank decays faster as the creature ages.
      const ageRatio = c.ageSeconds / (bp.diet.lifespanSeconds ?? 100)
      c.dominanceRank = Math.max(0, (c.dominanceRank ?? 0.5) - 0.00001 * dt * ageRatio)
    }
    // Alarm calls: propagate alarm to nearby conspecifics; decrement timer. Issue #3231.
    if (bp.alarmCaller && (c.alarmCallTimer ?? 0) > 0) {
      const alarmSight = sightOf(c, bp) * 2
      const alarmSight2 = alarmSight * alarmSight
      const acx = c.x + bw / 2
      const acy = c.y + bh / 2
      for (const other of w.creatures) {
        if (other.id === c.id || other.blueprintId !== c.blueprintId) continue
        const { w: ow, h: oh } = artSize(w.blueprints[other.blueprintId] ?? bp)
        const odx = deltaX(acx, other.x + ow / 2)
        const ody = (other.y + oh / 2) - acy
        if (odx * odx + ody * ody <= alarmSight2) {
          other.mood = 'flee'
        }
      }
      // Caller pays an exposure cost for calling out loud.
      c.hunger = Math.min(1, c.hunger + 0.001 * dt)
      c.alarmCallTimer = Math.max(0, (c.alarmCallTimer ?? 0) - dt)
    }
    // Kin selection: share food with nearby starving kin every 60 ticks. Issue #3230.
    if (bp.kinSelection && c.hunger < 0.4 && tickCount % 60 === c.id % 60) {
      const kinRange2 = 25 // 5 tiles squared
      const kcx = c.x + bw / 2
      const kcy = c.y + bh / 2
      for (const other of w.creatures) {
        if (other.id === c.id || other.blueprintId !== c.blueprintId) continue
        if (other.hunger < 0.7) continue
        if ((other.kinGroupId ?? '') !== (c.kinGroupId ?? '')) continue
        const { w: ow, h: oh } = artSize(w.blueprints[other.blueprintId] ?? bp)
        const odx = deltaX(kcx, other.x + ow / 2)
        const ody = (other.y + oh / 2) - kcy
        if (odx * odx + ody * ody <= kinRange2) {
          other.hunger = Math.max(0, other.hunger - 0.02)
          c.hunger = Math.min(1, c.hunger + 0.02)
          break // share with at most one kin per tick
        }
      }
    }
    // Drift state: exit drift when creature leaves water.
    if (c.drifting) {
      const driftTile = w.tiles[Math.floor(c.y) * WORLD_W + wrapCol(Math.floor(c.x))] ?? 0
      if (!IS_LIQUID[driftTile]) c.drifting = false
    }

    // Initialize home landmark on first tick. Issue #3326.
    if (bp.landmarkMemory && c.homeLandmarkX === undefined) {
      c.homeLandmarkX = c.x
      c.homeLandmarkY = c.y
    }

    // Territory marking: claim home range, threaten intruders. Issue #3226.
    if (bp.territorialBlueprintFlag) {
      // Claim territory on first tick.
      if (c.territoryX === undefined) {
        c.territoryX = c.x
        c.territoryY = c.y
      }
      if ((tickCount + c.id) % 60 === 0) {
        const radius = bp.territoryRadius ?? 8
        let contested = false
        for (const other of w.creatures) {
          if (other === c || other.blueprintId !== c.blueprintId) continue
          const oFromCenterX = deltaX(other.x, c.territoryX!)
          const oFromCenterY = other.y - (c.territoryY ?? c.y)
          if (oFromCenterX * oFromCenterX + oFromCenterY * oFromCenterY < radius * radius) {
            contested = true
            c.threatDisplayTimer = 3
            other.threatDisplayTimer = 3
          }
        }
        if (!contested && c.breedCooldown > 0) {
          c.breedCooldown *= 0.85  // faster breeding in uncontested territory. Issue #3226.
        }
      }
      if (c.threatDisplayTimer && c.threatDisplayTimer > 0) {
        c.threatDisplayTimer = Math.max(0, c.threatDisplayTimer - dt)
        // Don't flee during threat display.
        if (c.mood === 'flee') c.mood = 'wander'
      }
    }

    // Circadian clock: advance internal phase at individual period (±10% of day length).
    // Issue #3357, #3358, #3359.
    if (TUNING.dayLengthSeconds > 0) {
      if (c.circadianPhase === undefined) {
        // First tick: initialize to a random phase (different individuals are out of sync)
        c.circadianPhase = (c.id % 97) / 97  // deterministic spread using creature id
      }
      // Individual period variation: ±10% based on creature id (deterministic, not random)
      const periodVariation = 1 + ((c.id % 17) - 8) / 80  // ±10%
      const chronotypeOffset = (c.traits.chronotype ?? 0) * (2 / 24)  // ±2h expressed as fraction
      c.circadianPhase = (c.circadianPhase + dt / (TUNING.dayLengthSeconds * periodVariation) + chronotypeOffset * dt / TUNING.dayLengthSeconds * 0.01) % 1
      if (c.circadianPhase < 0) c.circadianPhase += 1

      // Zeitgeber: dawn light resets circadian phase toward external time. Issue #3358.
      // Underground creatures in deep cave (> 3 tiles) do not receive the signal.
      const externalPhase = (w.elapsed % TUNING.dayLengthSeconds) / TUNING.dayLengthSeconds
      const inDawnWindow = externalPhase < 0.1 || externalPhase > 0.95  // dawn/just-before-dawn
      const isDeepCave = isUnderground(w, c) && cavityDepth(w, c) > 3
      if (inDawnWindow && !isDeepCave) {
        // Gentle pull toward external phase — not an instant reset, a gradual correction
        const phaseError = ((c.circadianPhase - externalPhase + 1.5) % 1) - 0.5  // signed shortest-path error
        c.circadianPhase = ((c.circadianPhase - phaseError * 0.003 * dt) + 1) % 1
      }
    }

    // Clock disruption: creatures badly out of phase with local time suffer
    // jet-lag equivalent penalties — mild hunger increase. Issue #3361.
    if (
      TUNING.dayLengthSeconds > 0 &&
      c.circadianPhase !== undefined &&
      !isUnderground(w, c)
    ) {
      const extPhase = (w.elapsed % TUNING.dayLengthSeconds) / TUNING.dayLengthSeconds
      const rawErr = Math.abs(c.circadianPhase - extPhase)
      const phaseErr = Math.min(rawErr, 1 - rawErr)  // shortest-path error [0, 0.5]
      const jetlagThreshold = 4 / 24  // 4 hours in a 24-hour equivalent cycle
      if (phaseErr > jetlagThreshold) {
        const severity = (phaseErr - jetlagThreshold) / (0.5 - jetlagThreshold)  // 0→1
        c.hunger = Math.min(1, c.hunger + severity * 0.00005 * dt)  // mild metabolic disruption
      }
    }

    // Thermocline penalty: out-of-zone specialists suffer hunger penalties. Issue #3249.
    if (w.thermoclineY !== undefined) {
      const tileIdx = Math.floor(c.y) * WORLD_W + wrapCol(Math.floor(c.x))
      if (IS_LIQUID[w.tiles[tileIdx] ?? 0] === 1) {
        const inDeepWater = c.y > w.thermoclineY
        if (bp.deepWaterSpecialist && !inDeepWater) {
          c.hunger = Math.min(1, c.hunger + 0.00005 * dt)  // too warm at surface. Issue #3249.
        }
        if (bp.shallowWaterSpecialist && inDeepWater) {
          c.hunger = Math.min(1, c.hunger + 0.00005 * dt)  // too cold in deep water. Issue #3249.
        }
      }
    }

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
        // Recovered-carrier: spreads at 20% rate for 60 s after recovery. Issue #3184.
        ;(c as { carrierTimer?: number }).carrierTimer = 60
      }
    }
    // Migrate timer: counts seconds hungry with no food found.
    if (c.hunger > FORAGE_HUNGER && c.targetId === null) {
      c.migrateTimer += dt
    } else {
      c.migrateTimer = Math.max(0, c.migrateTimer - dt)
    }

    // --- Hedgehog Healthcare: spine-sharing — nearby kin slightly repel threats. Issue #3301. ---
    if (bp.hedgehogHealthcare) {
      const nearKin = w.creatures.filter(k =>
        k.id !== c.id && k.blueprintId === c.blueprintId &&
        Math.abs(k.x - c.x) < 5 && Math.abs(k.y - c.y) < 5
      )
      if (nearKin.length >= 2) {
        c.spineBoost = 0.2  // active healthcare benefit
      } else {
        c.spineBoost = 0
      }
    }

    // --- Xerus Xenophobia: ground squirrels ignore non-digger species. Issue #3317. ---
    if (bp.xerusXenophobia && c.targetId !== null) {
      const target = w.creatures.find(t => t.id === c.targetId)
      if (target) {
        const tbp = w.blueprints[target.blueprintId]
        // Embargo flying species; 100% tariff on non-diggers (push them away from food target)
        if (tbp?.move.kind === 'fly') {
          c.targetId = null  // refuse to interact with fliers
        } else if (!tbp?.burrowDigger && tbp?.move.kind !== 'walk') {
          // Non-digger non-flier: ignore their food if another digger source is present
          // (simplified: just 50% chance to ignore non-digger food target each tick)
          if (rng() < 0.01 * dt) c.targetId = null
        }
      }
    }

    // Quicksand: walkers progressively slow and die after 12 s if they can't escape.
    // `move.kind`, not the `body.locomotion` this used to read — that field went
    // away with the digging feature, so this whole quicksand branch had been
    // dead since. Walkers sink again.
    if (bp.move.kind === 'walk') {
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
    const cognitiveOverhead = 1 + (bp.brainSize ?? 0) * 0.2
    // Pre-migration hyperphagia: migratory creatures double hunger intake during
    // the late-summer fattening phase — season is still above 1 but falling.
    // Issue #3323.
    const migratoryHyperphagia = (() => {
      if (!bp.migratory || TUNING.seasonAmplitude === 0) return 1
      const p = (2 * Math.PI * w.elapsed) / TUNING.seasonPeriod
      const isAutumnFalling = Math.cos(p) < -0.05
      const isStillSummer = Math.sin(p) > 0.3
      return isAutumnFalling && isStillSummer ? 2.0 : 1.0
    })()
    // V-formation aerodynamics: migratory flyers in a group of 3+ benefit from
    // upwash vortices (70 % cost); lone migrants pay a solo penalty (120 %).
    // Leadership rotates by creature id parity — a simple but stable rotation.
    // Non-migratory or non-flying creatures are unaffected. Issue #3325.
    const vFormationFactor = (() => {
      if (!bp.migratory || !c.migrating || bp.move.kind !== 'fly') return 1
      let flockSize = 0
      for (const other of w.creatures) {
        if (other.id === c.id) continue
        if (w.blueprints[other.blueprintId]?.id !== bp.id) continue
        if (!other.migrating) continue
        if (Math.abs(other.x - c.x) > 12 || Math.abs(other.y - c.y) > 8) continue
        flockSize++
      }
      if (flockSize === 0) return 1.2  // lone migrant
      if (flockSize < 2) return 1.0   // pair, no formation yet
      // Flock of 3+: leader pays full, others get upwash discount
      const isLeader = c.id % 3 === 0
      return isLeader ? 1.0 : 0.7
    })()
    // Kleiber's metabolic scaling: hunger rate ∝ bodyMass^0.75. Issue #3272.
    // Large animals need more total food but are more efficient per unit mass.
    // At mass=1.0 this is 1.0 (no change). At mass=4.0 it's 4^0.75 ≈ 2.83 (more hungry).
    const klieber = Math.pow(bp.bodyMass ?? 1.0, 0.75)
    c.hunger = Math.min(
      1,
      c.hunger + bp.diet.hungerRate * TUNING.hungerRateScale * restSlowdown * symbiosisFed * metabolicRate * cognitiveOverhead * migratoryHyperphagia * vFormationFactor * klieber * dt
    )
    // Drought starvation pressure on plant-eaters: food is scarcer when moisture is low. Issue #3096.
    if (w.weatherState === 'drought' && bp.diet.eats.includes('plant') && !bp.diet.eats.includes('meat')) {
      c.hunger = Math.min(1, c.hunger + 0.0005 * dt)
    }
    // Plant nutrient bonus (#3101): rooted plants in nutrient-rich soil have lower hunger drain.
    // High soilNutrient up to 50% hunger reduction — fertile soil sustains plants longer.
    if (bp.move.kind === 'root' && w.soilNutrient) {
      const nutrientHere = w.soilNutrient[Math.floor(c.y) * w.width + Math.floor(c.x)] ?? 0
      const nutrientRelief = nutrientHere * 0.5 * bp.diet.hungerRate * TUNING.hungerRateScale * dt
      c.hunger = Math.max(0, c.hunger - nutrientRelief)
    }
    // Phenological mismatch penalty: species breeding far from the summer GDD peak
    // (≈ 500) face elevated hunger during their breeding season — prey/plants are
    // scarce when their demand is highest. Penalty is zero when seasons are disabled
    // or when the species has no phenological gate.
    if (
      bp.phenology?.breedingGdd !== undefined &&
      TUNING.seasonAmplitude > 0 &&
      worldGdd(w.elapsed) >= bp.phenology.breedingGdd
    ) {
      // mismatch: 0 = perfectly timed (breedingGdd=500), 1 = maximally mismatched
      const effectiveBreedingGdd = bp.phenology.breedingGdd + (c.phenoOffset ?? 0)
      const mismatch = Math.abs(effectiveBreedingGdd - 500) / 500
      c.hunger = Math.min(1, c.hunger + mismatch * 0.00008 * dt)
    }
    // Osmotic stress: creatures outside their salinity tolerance range
    // spend energy on osmoregulation. No effect when salinity is not enabled.
    if (bp.salinityTolerance && w.salinity) {
      const cx = Math.floor(c.x)
      const cy = Math.floor(c.y)
      if (cx >= 0 && cx < WORLD_W && cy >= 0 && cy < WORLD_H) {
        const tileSalinity = w.salinity[cy * WORLD_W + cx] ?? 0
        const { min, max } = bp.salinityTolerance
        if (tileSalinity < min) {
          const stress = (min - tileSalinity) * 0.0002 * dt
          c.hunger = Math.min(1, c.hunger + stress)
        } else if (tileSalinity > max) {
          const stress = (tileSalinity - max) * 0.0002 * dt
          c.hunger = Math.min(1, c.hunger + stress)
        } else if (c.ageSeconds < (bp.diet.lifespanSeconds ?? 240) * 0.15) {
          // Nursery habitat: juveniles in optimal salinity zone get a feeding bonus.
          // Models documented estuarine nursery function for juvenile marine fish.
          // Aerial-root plants (mangroves) within 8 tiles double the bonus —
          // structural shelter reduces predation and improves feeding conditions.
          let nurseryBonus = 0.00005
          const jcx = Math.floor(c.x)
          const jcy = Math.floor(c.y)
          for (const other of w.creatures) {
            const obp = w.blueprints[other.blueprintId]
            if (!obp?.aerialRoots) continue
            const { w: ow, h: oh } = artSize(obp)
            const odx = Math.abs(Math.floor(other.x + ow / 2) - jcx)
            const ody = Math.abs(Math.floor(other.y + oh / 2) - jcy)
            if (odx <= 8 && ody <= 8) { nurseryBonus = 0.0001; break }
          }
          c.hunger = Math.max(0, c.hunger - nurseryBonus * dt)
        }
      }
    }
    // Thermal stress: heat-sensitive species suffer in warm summer water.
    // Spring-fed tiles (high moisture from groundwater percolation) act as
    // cool refugia — local moisture proportionally relieves the heat penalty.
    // No effect when seasons are disabled (seasonAmplitude = 0).
    if (bp.heatSensitive && TUNING.seasonAmplitude > 0 && seasonFactor > 1.0) {
      const thx = Math.floor(c.x)
      const thy = Math.floor(c.y)
      if (thx >= 0 && thx < WORLD_W && thy >= 0 && thy < WORLD_H) {
        const moisture = w.moisture ? (w.moisture[thy * WORLD_W + thx] ?? 0) : 0
        // Stress proportional to how hot the season is; relief proportional to spring-water moisture
        const heatStress = (seasonFactor - 1.0) * 0.0002 * dt
        const springRelief = moisture * heatStress  // high moisture = full relief
        c.hunger = Math.min(1, c.hunger + Math.max(0, heatStress - springRelief))
      }
    }
    // Winter dormancy: creatures with dormancyPhotoperiod slow metabolism
    // in deep winter (seasonFactor < 0.7). Issue #3360.
    if (bp.dormancyPhotoperiod && TUNING.seasonAmplitude > 0 && seasonFactor < 0.7) {
      const dormancyDepth = Math.max(0, 0.7 - seasonFactor) / 0.7  // 0→1 as season goes from 0.7→0
      c.hunger = Math.max(0, c.hunger - dormancyDepth * 0.0003 * dt)
    }
    // Wind chill: warm-blooded creatures lose heat faster in cold wind. Issue #3156.
    if (bp.warmBlooded && TUNING.seasonAmplitude > 0 && seasonFactor < 0.8 && w.windX !== undefined) {
      const windMag = Math.abs(w.windX) + Math.abs(w.windY ?? 0) * 0.5
      if (windMag > 0.1) {
        const coldFactor = Math.max(0, 0.8 - seasonFactor) / 0.8
        c.hunger = Math.min(1, c.hunger + coldFactor * windMag * 0.0002 * dt)
      }
    }
    // Flow zone preference: aquatic creatures thrive in their matched zone.
    // Preferred zone → slight hunger relief; wrong zone → mild hunger increase.
    // Zones are 1=pool, 2=run, 3=riffle; 0 means non-water tile. Issue #3370.
    if (bp.flowZonePreference && w.flowZone) {
      const fzx = Math.floor(c.x)
      const fzy = Math.floor(c.y)
      if (fzx >= 0 && fzx < WORLD_W && fzy >= 0 && fzy < WORLD_H) {
        const zone = w.flowZone[fzy * WORLD_W + fzx]
        if (zone > 0) {
          const preferred =
            bp.flowZonePreference === 'riffle' ? 3 : bp.flowZonePreference === 'run' ? 2 : 1
          if (zone === preferred) {
            c.hunger = Math.max(0, c.hunger - 0.00005 * dt)
          } else {
            c.hunger = Math.min(1, c.hunger + 0.00008 * dt)
          }
        }
      }
    }
    // Ecotone fitness reduction: a creature operating inside its biome zone's
    // boundary strip (within ECOTONE_WIDTH rows of a band edge) but actually
    // standing in the *adjacent* zone pays a mild hunger tax. This models the
    // real cost of functioning outside an organism's primary niche — reduced
    // foraging efficiency, unfamiliar microhabitat — without hard-blocking
    // movement or survival. Species without biomeRequirements are unaffected.
    // Issue #3379.
    if (bp.biomeRequirements && bp.biomeRequirements.length > 0 && isInEcotone(w, Math.floor(c.y))) {
      const zone = biomeZoneAt(w, Math.floor(c.y))
      if (zone && !bp.biomeRequirements.includes(zone)) {
        c.hunger = Math.min(1, c.hunger + 0.00003 * dt)
      }
    }
    // Obligate mycorrhizal: plants cannot survive without fungal partners. Issue #3333.
    if (bp.obligateMycorrhizal && bp.move.kind === 'root') {
      if (!hasMycorrhizalPartnerNearby(w, c.x, c.y)) {
        c.hunger = Math.min(1, c.hunger + 0.0001 * dt)  // starvation without fungal support
      }
    }
    // Hydrothermal vent chemosynthesis: gain hunger relief near lava. Issue #3252.
    if (bp.chemosynthetic) {
      const cx2 = Math.floor(c.x), cy2 = Math.floor(c.y)
      const thisTile = w.tiles[cy2 * WORLD_W + wrapCol(cx2)] ?? 0
      if (IS_LIQUID[thisTile] && !IS_DEADLY[thisTile]) {
        // Check for adjacent lava tiles
        let nearLava = false
        for (let dy = -2; dy <= 2 && !nearLava; dy++) {
          for (let dx2 = -2; dx2 <= 2 && !nearLava; dx2++) {
            const tx = wrapCol(cx2 + dx2), ty = cy2 + dy
            if (ty < 0 || ty >= WORLD_H) continue
            if (w.tiles[ty * WORLD_W + tx] === MATERIAL_INDEX.lava) nearLava = true
          }
        }
        if (nearLava) c.hunger = Math.max(0, c.hunger - 0.004 * dt)
      }
    }

    // Plankton bloom: faster hunger relief during bloom. Issue #3254.
    if (bp.phytoplankton && w.planktonBloomActive) {
      c.hunger = Math.max(0, c.hunger - 0.001 * dt)
    }

    // Eusocial drone age: drones die after 30 seconds. Issue #3229.
    if (c.caste === 'drone') {
      c.droneAge = (c.droneAge ?? 0) + dt
      if (c.droneAge > 30) {
        kill(w, c, bp, dead, events, 'aged')
        continue
      }
    }

    // Eusocial queen breeds fast; workers are metabolically efficient; soldiers have hunger cost. Issue #3229.
    if (bp.eusocialSpecies) {
      if (c.caste === 'queen') {
        // Queen breeds fast — handled via breedCooldown reduction below
        c.hunger = Math.max(0, c.hunger - 0.001 * dt)  // queen fed by workers (conceptual)
      } else if (c.caste === 'worker') {
        c.hunger = Math.max(0, c.hunger - 0.0005 * dt)  // efficient metabolism
      }
    }

    // Plant nutrient uptake from soil. Issue #3147.
    if (bp.move.kind === 'root' && w.soilNutrient) {
      const sni = Math.floor(c.y) * WORLD_W + wrapCol(Math.floor(c.x))
      if (sni >= 0 && sni < w.soilNutrient.length) {
        const soilN = w.soilNutrient[sni]
        // Bonus in nutrient-rich soil
        if (soilN > 1.1) {
          c.hunger = Math.max(0, c.hunger - (soilN - 1.0) * 0.0002 * dt)
        }
        // Depletion: actively growing plant depletes local soil
        if (c.hunger < 0.5 && soilN > 0.05) {
          w.soilNutrient[sni] = Math.max(0.05, soilN - 0.0001 * dt)
        }
      }
    }

    // Nitrogen fixation: enrich nearby soil every 60 ticks. Issue #3148.
    if (bp.fixesNitrogen && bp.move.kind === 'root' && w.soilNutrient && (tickCount + c.id) % 60 === 0) {
      const nx = Math.floor(c.x), ny = Math.floor(c.y)
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const tx = wrapCol(nx + dx), ty = ny + dy
          if (ty < 0 || ty >= WORLD_H) continue
          const ti = ty * WORLD_W + tx
          w.soilNutrient[ti] = Math.min(2.0, (w.soilNutrient[ti] ?? 1.0) + 0.0003)
        }
      }
    }

    // Low O2 respiration penalty: thin atmosphere reduces metabolic efficiency. Issue #3276.
    const o2Level = w.atmosphericO2 ?? 1.0
    if (o2Level < 0.7 && !bp.tags?.includes('plant')) {
      c.hunger = Math.min(1, c.hunger + 0.0002 * dt * (0.7 - o2Level) / 0.7)  // up to +0.0002/s at O2=0
    }
    // Acid rain damage: acid-sensitive aquatic species take hunger damage in low-pH water. Issue #3279.
    if (bp.acidSensitive && w.tilePH) {
      const ci = Math.round(c.y) * w.width + Math.round(c.x)
      if (ci >= 0 && ci < w.tilePH.length) {
        const ph = w.tilePH[ci]
        if (ph < 5.5) {
          // Damage proportional to how acidic the water is
          const acidDamage = (5.5 - ph) / 5.5 * 0.003
          c.hunger = Math.min(1, c.hunger + acidDamage * dt)
        }
      }
    }
    // Bioaccumulation: decay and apply slow/hunger penalty at high load. Issue #3238.
    if ((c as { toxinLoad?: number }).toxinLoad !== undefined && (c as { toxinLoad?: number }).toxinLoad! > 0) {
      c.toxinLoad = Math.max(0, (c.toxinLoad as number) - 0.0001 * dt)
    }
    if ((c.toxinLoad as number | undefined ?? 0) > 0.7) {
      c.hunger = Math.min(1, c.hunger + 0.0003 * dt)
    }
    // Edge effects: habitat boundary stress increases hunger slightly. Issue #3282.
    if (w.edgeMask) {
      const ci = Math.round(c.y) * w.width + Math.round(c.x)
      if (ci >= 0 && ci < w.edgeMask.length && w.edgeMask[ci]) {
        c.hunger = Math.min(1, c.hunger + 0.0002 * dt)
        // Invasive species breed faster at edges (edge release from competition)
        if (bp.invasive) reproRate *= 1.3
      }
    }
    // Photosynthesis: plant creatures hunger more slowly in bright light. Issue #3171.
    if (bp.tags?.includes('plant') && w.lightGrid) {
      const li = Math.round(c.y) * w.width + Math.round(c.x)
      if (li >= 0 && li < w.lightGrid.length) {
        const light = w.lightGrid[li]
        if (light > 0.6) {
          c.hunger = Math.max(0, c.hunger - 0.0003 * dt)
        } else if (light < 0.1) {
          c.hunger = Math.min(1, c.hunger + 0.0003 * dt)
        }
      }
    }
    // Bioluminescence: creature emits light into lightGrid tiles. Issue #3172.
    if (bp.bioluminescent && w.lightGrid && tickCount % 30 === c.id % 30) {
      const cx = Math.round(c.x), cy = Math.round(c.y)
      const R = 4
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist > R) continue
          const li = (cy + dy) * w.width + (cx + dx)
          if (li >= 0 && li < w.lightGrid.length) {
            const glow = (1 - dist / R) * 0.8
            w.lightGrid[li] = Math.min(1, w.lightGrid[li] + glow)
          }
        }
      }
    }
    // UV stress: exposed high-altitude tiles damage UV-sensitive species. Issue #3173.
    if (bp.uvSensitive && w.lightGrid) {
      const ci = Math.round(c.y) * w.width + Math.round(c.x)
      if (c.y < 20 && ci >= 0 && ci < w.lightGrid.length && w.lightGrid[ci] > 0.8) {
        c.hunger = Math.min(1, c.hunger + 0.0005 * dt)
      }
    }
    // Local temperature from biome zone. Issues #3134, #3135, #3136.
    const creatureZoneTemp: number = (() => {
      if (!w.biomeZones || w.biomeZones.length === 0) return 0.5
      const REGION_H2 = Math.floor(WORLD_H / w.biomeZones.length)
      const ri = Math.min(w.biomeZones.length - 1, Math.floor(Math.floor(c.y) / Math.max(1, REGION_H2)))
      return w.biomeZones[ri]?.temperature ?? 0.5
    })()

    // Cold-blooded speed scaling: ectotherms slow in cold, fast in heat. Issue #3134.
    if (bp.coldBlooded) {
      const speedMod = 0.5 + creatureZoneTemp * 0.9  // 0.5× at 0, 1.4× at 1
      // Apply by directly scaling velocity (not traits, which are inherited)
      c.vx *= speedMod
      c.vy *= speedMod
    }

    // Warm-blooded thermoregulation: endotherms burn energy in extremes. Issue #3135.
    if (bp.warmBlooded) {
      if (creatureZoneTemp < 0.15) {
        const coldStress = (0.15 - creatureZoneTemp) / 0.15
        c.hunger = Math.min(1, c.hunger + coldStress * 0.0003 * dt)
      } else if (creatureZoneTemp > 0.85) {
        const heatStress = (creatureZoneTemp - 0.85) / 0.15
        c.hunger = Math.min(1, c.hunger + heatStress * 0.0002 * dt)
      }
    }

    // Temperature comfort range: hunger penalty outside tempMin/tempMax. Issue #3136.
    if (bp.tempMin !== undefined && creatureZoneTemp < bp.tempMin) {
      const deviation = bp.tempMin - creatureZoneTemp
      c.hunger = Math.min(1, c.hunger + deviation * 0.0004 * dt)
    }
    if (bp.tempMax !== undefined && creatureZoneTemp > bp.tempMax) {
      const deviation = creatureZoneTemp - bp.tempMax
      c.hunger = Math.min(1, c.hunger + deviation * 0.0004 * dt)
    }

    // Decomposer: gain hunger from mud tiles and convert them back to dirt. Issue #3146.
    if (bp.decomposer) {
      const dx2 = Math.floor(c.x), dy2 = Math.floor(c.y)
      if (dx2 >= 0 && dx2 < WORLD_W && dy2 >= 0 && dy2 < WORLD_H) {
        const di = dy2 * WORLD_W + wrapCol(dx2)
        if (w.tiles[di] === MATERIAL_INDEX.mud) {
          c.hunger = Math.max(0, c.hunger - 0.003 * dt)  // feed on organic matter
          // Slowly convert mud back to dirt (decomposition complete)
          if (rng() < 0.0002 * dt) {
            setTile(w, dx2, dy2, MATERIAL_INDEX.dirt)
          }
        }
      }
    }
    // Prey escalation: surviving prey slowly builds evasion every 60 ticks. Issue #3263.
    if (tickCount % 60 === 0 && bp.preyEscalation) {
      c.escalatedEvasion = Math.min(0.5, (c.escalatedEvasion ?? 0) + 0.002)
    }
    // Immunity waning: host-parasite immunity decays over time without re-exposure. Issue #3265.
    if (tickCount % 300 === 0 && c.parasiteExposure !== undefined) {
      c.parasiteExposure = Math.max(0, c.parasiteExposure - 0.1)
    }
    // Obligate coevolution: faster starvation when partner species is extinct. Issue #3266.
    if (bp.obligatePartner !== undefined && (speciesCount[bp.obligatePartner] ?? 0) === 0) {
      c.hunger = Math.min(1, c.hunger + 0.001 * dt)
    }
    // Genetic isolation tracking: time without nearby conspecific. Issue #3164.
    if ((tickCount + c.id) % 60 === 0) {
      const isoReach = 30
      const isoCount = gather(c.x + bw / 2, isoReach + bw / 2)
      let hasConspecific = false
      for (let i = 0; i < isoCount; i++) {
        const nb = found[i]
        if (nb.id !== c.id && nb.blueprintId === c.blueprintId) { hasConspecific = true; break }
      }
      if (hasConspecific) {
        c.isolationTime = 0
      } else {
        c.isolationTime = (c.isolationTime ?? 0) + 60  // +60 seconds per check interval
      }
    }
    // Sexual dimorphism: females age slightly slower. Issue #3165.
    if (bp.sexualDimorphism && c.sex === 'female') {
      // Undo 10% of the age tick to simulate longer lifespan
      c.ageSeconds = Math.max(0, c.ageSeconds - 0.1 * dt)
    }
    // Intertidal zone: bonus at low tide, penalty at high tide. Issue #3191.
    if (bp.intertidal && w.tidalHeight !== undefined) {
      if (w.tidalHeight < -0.3) {
        c.hunger = Math.max(0, c.hunger - 0.002 * dt)
      } else if (w.tidalHeight > 0.5) {
        c.hunger = Math.min(1, c.hunger + 0.001 * dt)
      }
    }
    if (c.hunger >= 1) {
      c.starving += dt
      if (c.starving >= bp.diet.starveSeconds) {
        kill(w, c, bp, dead, events, 'starved')
        continue
      }
    } else {
      c.starving = Math.max(0, c.starving - dt * 2)
    }

    // Otter Oligarchy extraction: oligarchs drain 5% hunger from nearby non-oligarchs.
    // Issue #3308.
    if (tickCount % 60 === 0 && bp.otterOligarchy && c.isOligarch) {
      const ocx = c.x + bw / 2
      const ocy = c.y + bh / 2
      for (const other of w.creatures) {
        if (other === c || other.isOligarch) continue
        if (other.blueprintId !== c.blueprintId) continue
        const odx = deltaX(ocx, other.x + bw / 2)
        const ody = (other.y + bh / 2) - ocy
        if (odx * odx + ody * ody < 64) { // within 8 tiles
          const extracted = other.hunger * 0.05
          other.hunger = Math.max(0, other.hunger - extracted)
        }
      }
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

    // --- snap-trap mechanics -------------------------------------------
    if (bp.trapType === 'snap' && bp.move.kind === 'root') {
      if (c.trapDigestingId !== undefined) {
        // Digesting: drain prey hunger, fill plant's hunger.
        const prey = w.creatures.find(p => p.id === c.trapDigestingId)
        if (prey) {
          prey.hunger = Math.min(1, prey.hunger + 0.04 * dt)
          c.hunger = Math.max(0, c.hunger - 0.01 * dt)
          if (prey.hunger >= 1) {
            // Prey dies of starvation in the trap; reset.
            const preyBp = w.blueprints[prey.blueprintId]
            if (preyBp) kill(w, prey, preyBp, dead, events, 'starved')
            else dead.add(prey.id)
            c.nutrientStore = Math.min(1, (c.nutrientStore ?? 0) + 0.3)
            c.trapDigestingId = undefined
            c.trapTriggerCount = 0
            c.forceFrame = undefined
          }
        } else {
          // Prey already gone.
          c.trapDigestingId = undefined
          c.trapTriggerCount = 0
          c.forceFrame = undefined
        }
      } else {
        // Trap is open — look for prey contact.
        c.trapTriggerTimer = Math.max(0, (c.trapTriggerTimer ?? 0) - dt)
        if (c.trapTriggerTimer === 0) {
          c.trapTriggerCount = 0  // timer expired, reset trigger
        }
        for (const other of w.creatures) {
          if (
            other.id === c.id ||
            other.blueprintId === c.blueprintId ||
            other.immobilizedById !== undefined ||
            !overlapsPlant(other, c)
          ) continue
          const otherBp = w.blueprints[other.blueprintId]
          if (!otherBp || otherBp.size > 2) continue  // only catch small creatures
          c.trapTriggerCount = (c.trapTriggerCount ?? 0) + 1
          c.trapTriggerTimer = 3  // 3-second window for second touch
          if (c.trapTriggerCount >= 2) {
            // Trap snaps shut!
            c.trapDigestingId = other.id
            other.immobilizedById = c.id
            c.trapTriggerCount = 0
            c.trapTriggerTimer = 0
            c.forceFrame = 1  // show closed-trap frame
            break
          }
          break  // only process one touch per tick
        }
      }
    }
    // --- pitfall-trap mechanics ----------------------------------------
    if (bp.trapType === 'pitfall' && bp.move.kind === 'root') {
      // Digest any prey already captured.
      if (!c.trapPreyIds) c.trapPreyIds = []
      const stillDigesting: number[] = []
      for (const preyId of c.trapPreyIds) {
        const prey = w.creatures.find(p => p.id === preyId)
        if (prey) {
          prey.hunger = Math.min(1, prey.hunger + 0.05 * dt)  // drowning faster than snap
          c.hunger = Math.max(0, c.hunger - 0.008 * dt)
          if (prey.hunger >= 1) {
            dead.add(preyId)
            c.nutrientStore = Math.min(1, (c.nutrientStore ?? 0) + 0.25)
          } else {
            stillDigesting.push(preyId)
          }
        }
      }
      c.trapPreyIds = stillDigesting
      // Passive trap: any small creature nearby has a chance to slip in.
      if (c.trapPreyIds.length < 3) {  // pitcher can hold up to 3 prey
        for (const other of w.creatures) {
          if (
            other.id === c.id ||
            other.blueprintId === c.blueprintId ||
            c.trapPreyIds.includes(other.id) ||
            other.immobilizedById !== undefined ||
            !overlapsPlant(other, c)
          ) continue
          const otherBp = w.blueprints[other.blueprintId]
          if (!otherBp || otherBp.size > 2) continue
          if (rng() < 0.01 * dt * 60) {  // ~1% chance per tick at 60fps
            c.trapPreyIds.push(other.id)
            other.immobilizedById = c.id
          }
        }
      }
    }
    // --- sticky-trap mechanics -----------------------------------------
    if (bp.trapType === 'sticky' && bp.move.kind === 'root') {
      if (!c.trapPreyIds) c.trapPreyIds = []
      const stillDigesting: number[] = []
      for (const preyId of c.trapPreyIds) {
        const prey = w.creatures.find(p => p.id === preyId)
        if (prey) {
          prey.hunger = Math.min(1, prey.hunger + 0.03 * dt)
          c.hunger = Math.max(0, c.hunger - 0.006 * dt)
          if (prey.hunger >= 1) {
            dead.add(preyId)
            c.nutrientStore = Math.min(1, (c.nutrientStore ?? 0) + 0.2)
          } else {
            stillDigesting.push(preyId)
          }
        }
      }
      c.trapPreyIds = stillDigesting
      for (const other of w.creatures) {
        if (
          other.id === c.id ||
          other.blueprintId === c.blueprintId ||
          c.trapPreyIds.includes(other.id) ||
          other.immobilizedById !== undefined ||
          !overlapsPlant(other, c)
        ) continue
        const otherBp = w.blueprints[other.blueprintId]
        if (!otherBp || otherBp.size > 2) continue
        other.adheredTicks = (other.adheredTicks ?? 0) + 1
        if (other.adheredTicks >= 3) {
          // Fully adhered after 3 contacts.
          c.trapPreyIds.push(other.id)
          other.immobilizedById = c.id
          other.adheredTicks = 0
        } else {
          // Slow but not yet captured: heavily penalise movement.
          other.vx *= 0.1
          other.vy *= 0.1
        }
      }
    }
    // Clear immobilization if the captor is gone.
    if (c.immobilizedById !== undefined) {
      const captor = w.creatures.find(p => p.id === c.immobilizedById)
      const stillHeld = captor && (
        captor.trapDigestingId === c.id ||
        (captor.trapPreyIds?.includes(c.id) ?? false)
      )
      if (!stillHeld) {
        c.immobilizedById = undefined
        c.adheredTicks = undefined
      }
    }
    // Immobilized creatures cannot move.
    if (c.immobilizedById !== undefined) {
      c.vx = 0
      c.vy = 0
    }

    // --- metamorphosis: larva → pupa → adult. Issue #3336. -------------------
    // Age-gated transition: when the larva (or any metamorphosing stage) exceeds
    // its metamorphosisAge, it transforms into the next stage blueprint.
    if (bp.metamorphosesInto && bp.metamorphosisAge !== undefined && c.ageSeconds >= bp.metamorphosisAge) {
      const nextBp = w.blueprints[bp.metamorphosesInto]
      if (nextBp) {
        c.blueprintId = bp.metamorphosesInto
        c.lifeStage = nextBp.pupalDuration !== undefined ? 'pupa' : 'adult'
        c.pupalTimer = nextBp.pupalDuration
        c.ageSeconds = 0  // reset age for the new stage
        c.hunger = 0.5    // reset hunger at metamorphosis
      }
    }
    // Pupa countdown: timer ticks down until adult emergence. Issue #3336.
    // We read the current blueprintId because it may have just been updated above.
    const currentBp = w.blueprints[c.blueprintId] ?? bp
    if (c.lifeStage === 'pupa' && c.pupalTimer !== undefined) {
      // Pupal diapause: cold temperatures pause development. Issue #3338.
      // Only tick the timer when the season is warm (seasonFactor >= 0.7);
      // in deep winter the pupa enters extended diapause and waits.
      if (seasonFactor >= 0.7) {
        c.pupalTimer -= dt
      }
      if (c.pupalTimer <= 0) {
        const adultBpId = currentBp.metamorphosesInto
        const adultBp = adultBpId ? w.blueprints[adultBpId] : undefined
        if (adultBp) {
          // Track how many of each species emerge this tick for mass-emergence
          // notice and predator satiation. Issue #3339.
          emergenceCount[adultBpId!] = (emergenceCount[adultBpId!] ?? 0) + 1
          c.blueprintId = adultBpId!
          c.lifeStage = 'adult'
          c.pupalTimer = undefined
          c.ageSeconds = 0
        }
      }
    }
    // Pupae are immobile — skip movement and hunting this tick. Issue #3336.
    if (c.lifeStage === 'pupa') {
      c.vx = 0
      c.vy = 0
      continue
    }

    // --- hemimetabolous instar progression + moulting. Issues #3340, #3341. ---
    if (c.lifeStage === 'nymph') {
      const currentNymphBp = w.blueprints[c.blueprintId] ?? bp
      if (c.moultingTimer !== undefined) {
        // Currently moulting — count down, stay immobile
        c.moultingTimer -= dt
        c.vx = 0
        c.vy = 0
        if (c.moultingTimer <= 0) {
          c.moultingTimer = undefined
          c.instar = (c.instar ?? 1) + 1
          const instCount = currentNymphBp.instarCount ?? 3
          if ((c.instar ?? 1) >= instCount) {
            // Final moult → adult
            const adultBpId = currentNymphBp.metamorphosesInto
            const adultBp = adultBpId ? w.blueprints[adultBpId] : undefined
            if (adultBp) {
              c.blueprintId = adultBpId!
              c.lifeStage = 'adult'
              c.instar = undefined
              c.ageSeconds = 0
            }
          }
        }
        continue  // immobile during moult, skip rest of tick
      } else {
        // Check if it's time to moult to the next instar
        const instCount = currentNymphBp.instarCount ?? 3
        const instDur = currentNymphBp.instarDuration ?? 30
        const currentInstar = c.instar ?? 1
        if (currentInstar < instCount && c.ageSeconds >= instDur * currentInstar) {
          // Place shed-skin tile at creature position. Issue #3341.
          const tx = Math.round(c.x)
          const ty = Math.round(c.y)
          const tileIdx = ty * w.width + tx
          if (tileIdx >= 0 && tileIdx < w.tiles.length && w.tiles[tileIdx] === MATERIAL_INDEX['air']) {
            w.tiles[tileIdx] = MATERIAL_INDEX['shed-skin']
          }
          // Start moult pause
          c.moultingTimer = 2
          c.vx = 0
          c.vy = 0
          continue
        }
      }
    }

    // --- web building: spiders periodically place web tiles near solid anchor points. Issue #3420. ---
    if (bp.webSpinner) {
      c.webBuildTimer = (c.webBuildTimer ?? 0) - dt
      if (c.webBuildTimer <= 0) {
        c.webBuildTimer = bp.webBuildInterval ?? 5
        const range = bp.webRange ?? 4
        const cx = Math.round(c.x)
        const cy = Math.round(c.y)
        const webMat = MATERIAL_INDEX['web']
        const airMat = 0  // AIR is always index 0
        for (let attempt = 0; attempt < 8; attempt++) {
          const tx = cx + Math.round((rng() * 2 - 1) * range)
          const ty = cy + Math.round((rng() * 2 - 1) * range)
          if (tx < 0 || tx >= w.width || ty < 0 || ty >= w.height) continue
          const tIdx = ty * w.width + tx
          if (w.tiles[tIdx] !== airMat) continue
          const webOffsets: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
          const hasAnchor = webOffsets.some(([dx, dy]) => {
            const ni = (ty + dy) * w.width + (tx + dx)
            return ni >= 0 && ni < w.tiles.length && IS_SOLID[w.tiles[ni]]
          })
          if (hasAnchor) {
            w.tiles[tIdx] = webMat
            break
          }
        }
      }
    }

    // --- object manipulation: pick up nearby collectable tiles. Issues #3412, #3418. ---
    if ((bp.objectManipulator || bp.nestBuilder) && c.carriedMaterial === undefined && c.hunger < 0.5) {
      const collectibles: string[] = bp.nestMaterials ?? ['grass', 'moss', 'wood']
      const cx = Math.round(c.x), cy = Math.round(c.y)
      outerPickup:
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx2 = -2; dx2 <= 2; dx2++) {
          const tx = cx + dx2, ty = cy + dy
          if (tx < 0 || tx >= w.width || ty < 0 || ty >= w.height) continue
          const tIdx = ty * w.width + tx
          const matId = MATERIAL_BY_INDEX[w.tiles[tIdx]]?.id
          if (matId !== undefined && collectibles.includes(matId) && rng() < 0.05 * dt) {
            c.carriedMaterial = w.tiles[tIdx]
            w.tiles[tIdx] = AIR
            break outerPickup
          }
        }
      }
    }
    // --- nest delivery: when carrying, steer toward nest site and place tile. Issue #3418. ---
    if (bp.nestBuilder && c.carriedMaterial !== undefined && c.nestX !== undefined && c.nestY !== undefined) {
      const ddx = c.nestX - c.x, ddy = c.nestY - c.y
      const dist = Math.sqrt(ddx * ddx + ddy * ddy)
      if (dist < 2) {
        // Place the tile at or near the nest anchor
        const placeIdx = Math.round(c.nestY) * w.width + Math.round(c.nestX)
        if (placeIdx >= 0 && placeIdx < w.tiles.length && w.tiles[placeIdx] === AIR) {
          w.tiles[placeIdx] = c.carriedMaterial
        }
        c.carriedMaterial = undefined
        c.nestProgress = (c.nestProgress ?? 0) + 1
        // Register/update nest in WorldState
        w.nestSites = w.nestSites ?? {}
        const nestKey = `${Math.round(c.nestX)},${Math.round(c.nestY)}`
        w.nestSites[nestKey] = {
          progress: c.nestProgress,
          ownerId: c.id,
          x: Math.round(c.nestX),
          y: Math.round(c.nestY),
        }
      } else {
        // Bias velocity toward nest site
        c.vx += (ddx / dist) * 0.2 * dt
        c.vy += (ddy / dist) * 0.2 * dt
      }
    }

    // --- Parental care: stay near nest when eggs exist nearby. Issue #3258. ---
    if (bp.parentalCare && c.nestX !== undefined) {
      const pdx = c.nestX - c.x, pdy = c.nestY! - c.y
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy)
      const pRadius = bp.parentalRadius ?? 5
      if (pdist > pRadius) {
        c.vx += (pdx / pdist) * 0.4 * dt
        c.vy += (pdy / pdist) * 0.4 * dt
      }
    }

    // --- Cliff march: elected lemmings run toward the nearest world edge. Issue #3305. ---
    if (c.cliffBound) {
      const distLeft = c.x
      const distRight = WORLD_W - 1 - c.x
      const edgeX = distLeft <= distRight ? 0 : WORLD_W - 1
      const edgeDx = edgeX - c.x
      const edgeDist = Math.abs(edgeDx)
      if (edgeDist > 0.5) {
        c.vx += (edgeDx / edgeDist) * 2.0 * dt
      }
    }

    // --- Otter Oligarchy: oligarchs extract 5% of catch from nearby otters. Issue #3308. ---
    if (bp.otterOligarchy && c.isOligarch) {
      for (const other of w.creatures) {
        if (other.id === c.id || other.blueprintId !== c.blueprintId || other.isOligarch) continue
        const odist = Math.sqrt((other.x - c.x) ** 2 + (other.y - c.y) ** 2)
        if (odist > 10) continue
        const fee = 0.05
        if (other.hunger < 0.85 && c.hunger > 0.1) {
          other.hunger = Math.min(1, other.hunger + fee)
          c.hunger = Math.max(0, c.hunger - fee)
        }
      }
    }

    // --- Squirrel Socialism: collective food sharing (except Gerald). Issue #3312. ---
    if (bp.squirrelSocialism && w.squirrelCollectiveActive) {
      if (c.isGerald) {
        // Gerald thrives: breed cooldown drains 20% faster
        if (c.breedCooldown > 0) c.breedCooldown -= 0.2 * dt
      } else if (c.hunger < 0.4) {
        // Find a well-fed conspecific to share from (the collective)
        for (const donor of w.creatures) {
          if (donor.id === c.id || donor.blueprintId !== c.blueprintId || donor.isGerald) continue
          if (donor.hunger > 0.6) continue  // don't take from hungry donors
          const ddist = Math.sqrt((donor.x - c.x) ** 2 + (donor.y - c.y) ** 2)
          if (ddist > 12) continue
          const share = 0.1
          c.hunger = Math.max(0, c.hunger - share)
          donor.hunger = Math.min(1, donor.hunger + share)
          break
        }
      }
    }

    // --- Vole Voting: Chief Vole has a slight speed bonus (knows all the routes). Issue #3315. ---
    if (bp.voleVoting && c.isChiefVole) {
      c.vx *= 1 + 0.05 * dt  // tiny incumbent advantage
      c.vy *= 1 + 0.05 * dt
    }

    // --- Weasel War Crimes Tribunal: territory conflicts escalate to tribunal. Issue #3316. ---
    if (bp.weaselTribunal && c.mood === 'hunt') {
      // Count nearby same-species rivals
      for (const rival of w.creatures) {
        if (rival.id === c.id || rival.blueprintId !== c.blueprintId) continue
        const rdist = Math.sqrt((rival.x - c.x) ** 2 + (rival.y - c.y) ** 2)
        if (rdist > 6 || rival.mood !== 'hunt') continue
        // Confrontation detected
        c.conflictCount = (c.conflictCount ?? 0) + dt * 0.1  // slow accumulation
        if ((c.conflictCount ?? 0) >= 3 && rng() < 0.001 * dt) {
          c.conflictCount = 0
          const VERDICTS = [
            'relocate burrow 4 tiles east',
            'forfeit one prey item',
            'cease and desist territorial scent marking',
            'issue formal apology via pheromone',
          ]
          const verdict = VERDICTS[Math.floor(rng() * VERDICTS.length)]
          const complied = rng() < 0.12
          events.push({ kind: 'notice', blueprintId: bp.id, x: c.x, y: c.y, text: `${bp.name} Tribunal verdict: "${verdict}". Complied: ${complied ? 'yes' : 'no'}. Compliance rate: 12%. Tribunal has no enforcement arm.` })
          if (complied) {
            // Actually relocate
            c.x += 4 * (rng() > 0.5 ? 1 : -1)
          }
        }
      }
    }

    // Platypus Philosophy: periodic existential contemplation. Issue #3309.
    if (bp.platypusPhilosophy) {
      if (c.philosophyTimer === undefined) c.philosophyTimer = (TUNING.seasonPeriod / 10) * rng()
      c.philosophyTimer -= dt
      if (c.philosophyTimer <= 0) {
        c.philosophyTimer = TUNING.seasonPeriod / 10
        c.wisdom = (c.wisdom ?? 0) + 1
        c.insightTimer = (c.insightTimer ?? 0) + 4
        const MUSINGS = [
          'I have a bill but also fur. Am I real?',
          'I lay eggs but nurse young. What does this mean?',
          'I have electroreceptors. Most creatures do not. Why?',
          'The question of platypus existence remains unresolved.',
          'Is this a bill or a beak? The Philosophical Society is divided.',
        ]
        const musing = MUSINGS[Math.floor(rng() * MUSINGS.length)]
        events.push({ kind: 'notice', blueprintId: bp.id, x: c.x, y: c.y, text: `Platypus (wisdom: ${c.wisdom}): "${musing}"` })
      }
    }

    // Toad Taxation: levy a toll on creatures passing near a toad on water. Issue #3313.
    if (bp.toadTaxation && IS_LIQUID[w.tiles[Math.floor(c.y) * WORLD_W + Math.floor(c.x)]] === 1) {
      for (const traveler of w.creatures) {
        if (traveler.id === c.id || traveler.blueprintId === c.blueprintId) continue
        const tdist = Math.sqrt((traveler.x - c.x) ** 2 + (traveler.y - c.y) ** 2)
        if (tdist > 3) continue
        const toll = 0.05
        if (traveler.hunger < 0.9 && c.hunger > 0.05) {
          traveler.hunger = Math.min(1, traveler.hunger + toll)
          c.hunger = Math.max(0, c.hunger - toll)
          if (rng() < 0.4) {
            traveler.stunTimer = (traveler.stunTimer ?? 0) + 0.5
          }
        }
      }
    }

    // Urchin Union strike: strikers refuse to move. Issue #3314.
    if (bp.urchinUnion && w.urchinStrikeActive) {
      c.vx = 0
      c.vy = 0
    }

    // --- Earthworm Elevator: express vertical shaft for worms. Issue #3298. ---
    if (bp.earthwormElevator) {
      if (Math.abs(c.vy) > Math.abs(c.vx) * 1.5 && Math.abs(c.vy) > 0.2) {
        c.vy *= 1 + 2 * dt  // small continuous boost that compounds
      }
      w.earthwormElevatorNextRebuild ??= w.elapsed + TUNING.seasonPeriod
      if (w.elapsed >= w.earthwormElevatorNextRebuild) {
        w.earthwormElevatorNextRebuild = w.elapsed + TUNING.seasonPeriod * (0.8 + rng() * 0.4)
        w.earthwormElevatorRebuildCount = (w.earthwormElevatorRebuildCount ?? 0) + 1
        events.push({ kind: 'notice', blueprintId: bp.id, x: c.x, y: c.y, text: `${bp.name} rebuilt the elevator. (Rebuild #${w.earthwormElevatorRebuildCount}) This always surprises them.` })
      }
    }

    // --- Frog Fundamentalism: apostates have breeding penalty. Issue #3299. ---
    if (bp.frogFundamentalism && (c.frogApostate ?? 0) > 0) {
      c.frogApostate = (c.frogApostate ?? 0) - dt
      // Breeding penalty: breed cooldown drains 70% slower
      if (c.breedCooldown > 0) c.breedCooldown += 0.3 * dt  // net: slower recovery
    }

    // --- Gopher Government: one gopher holds all 17 cabinet positions. Issue #3300. ---
    if (bp.gopherGovernment) {
      if (w.gopherAdminId === undefined) {
        w.gopherAdminId = c.id
        c.isGopherAdmin = true
        const CABINET = ['Minister of Tunnels', 'Secretary of Roots', 'Undersecretary of Subterranean Affairs',
          'Chief Inspector of Moisture', 'Director of Emergency Soil', 'Ambassador to the Surface',
          'Deputy Commissioner of Worms', 'Minister Without Portfolio (also Tunnels)',
          'Secretary of State for Mole Relations', 'Administrator General of Burrow Standards',
          'Chief of Staff (Subterranean Division)', 'Treasurer (no treasury exists)',
          'Secretary of Defense (against owls)', 'Director of Interior (quite literal)',
          'Commissioner for Tunnel Safety and Also Danger', 'Undersecretary for Undersecretary Affairs',
          'Minister Plenipotentiary for Everything Else']
        const sample = CABINET.slice(0, 3).join(', ') + `, and ${CABINET.length - 3} more`
        events.push({ kind: 'notice', blueprintId: bp.id, x: c.x, y: c.y, text: `${bp.name} Administrator appointed: ${sample}. Has never attended a meeting with themselves.` })
      } else if (c.id === w.gopherAdminId) {
        c.isGopherAdmin = true
      }
    }

    // --- Insect Internet: beetles relay stale pheromone messages. Issue #3302. ---
    if (bp.beetleInternet) {
      const BEETLE_DELAY = 135  // ~45 in-game minutes
      // Record food location when eating
      if (c.mood === 'eat' && c.beetleMailRecordedAt === undefined) {
        c.beetleMailRecordedAt = w.elapsed
        c.beetleMailType = 'food'
        c.beetleMailX = Math.floor(c.x)
        c.beetleMailY = Math.floor(c.y)
      }
      // Record predator location when fleeing
      if (c.mood === 'flee' && c.targetId !== null && c.beetleMailRecordedAt === undefined) {
        c.beetleMailRecordedAt = w.elapsed
        c.beetleMailType = 'predator'
        c.beetleMailX = Math.floor(c.x)
        c.beetleMailY = Math.floor(c.y)
      }
      // After delay, broadcast stale info to nearby beetles
      if (c.beetleMailRecordedAt !== undefined && (w.elapsed - c.beetleMailRecordedAt) >= BEETLE_DELAY) {
        const msgType = c.beetleMailType ?? 'food'
        const msgX = c.beetleMailX!, msgY = c.beetleMailY!
        if (rng() < 0.05 * dt) {
          events.push({ kind: 'notice', blueprintId: bp.id, x: c.x, y: c.y, text: `${bp.name} network packet delivered: "${msgType} here" (${Math.floor(w.elapsed - c.beetleMailRecordedAt)}s out of date). The network is considered a marvel.` })
        }
        // Nudge nearby beetles toward old location (probably wrong)
        for (const recv of w.creatures) {
          if (recv.id === c.id || recv.blueprintId !== c.blueprintId) continue
          const rd = Math.sqrt((recv.x - c.x) ** 2 + (recv.y - c.y) ** 2)
          if (rd > 12 || recv.mood !== 'wander') continue
          const mdx = msgX - recv.x, mdy = msgY - recv.y
          const md = Math.sqrt(mdx * mdx + mdy * mdy)
          if (md > 1) {
            recv.vx += (mdx / md) * 0.2 * dt
            recv.vy += (mdy / md) * 0.2 * dt
          }
        }
        c.beetleMailRecordedAt = undefined
        c.beetleMailType = undefined
        c.beetleMailX = undefined
        c.beetleMailY = undefined
      }
    }

    // --- Mole Mail: record food location; broadcast stale info after 2 seasons. Issue #3306. ---
    if (bp.moleMailCarrier) {
      // Record food location when eating
      if (c.mood === 'eat' && c.targetId !== null) {
        if (c.moleMailRecordedAt === undefined) {
          c.moleMailRecordedAt = w.elapsed
          c.moleMailFoodX = Math.floor(c.x)
          c.moleMailFoodY = Math.floor(c.y)
        }
      }
      // After 2 seasons, broadcast stale food location to nearby conspecifics
      const MAIL_DELAY = TUNING.seasonPeriod * 2
      if (c.moleMailRecordedAt !== undefined && (w.elapsed - c.moleMailRecordedAt) >= MAIL_DELAY) {
        const mailX = c.moleMailFoodX!
        const mailY = c.moleMailFoodY!
        // Nudge nearby conspecifics toward the (stale) food location
        for (const recipient of w.creatures) {
          if (recipient.id === c.id || recipient.blueprintId !== c.blueprintId) continue
          const rdist = Math.sqrt((recipient.x - c.x) ** 2 + (recipient.y - c.y) ** 2)
          if (rdist > 15) continue
          // Push recipient toward old food location (probably empty now)
          const mdx = mailX - recipient.x, mdy = mailY - recipient.y
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy)
          if (mdist > 1 && recipient.mood === 'wander') {
            recipient.vx += (mdx / mdist) * 0.3 * dt
            recipient.vy += (mdy / mdist) * 0.3 * dt
          }
        }
        // 99% delivery rate — occasionally fire a notice event
        if (rng() < 0.01 * dt) {
          events.push({ kind: 'notice', blueprintId: bp.id, x: c.x, y: c.y, text: `${bp.name} delivers mail: food was at (${mailX}, ${mailY}) two seasons ago` })
        }
        // Reset for next mail cycle
        c.moleMailRecordedAt = undefined
        c.moleMailFoodX = undefined
        c.moleMailFoodY = undefined
      }
    }

    // --- Newt Newspaper: periodic pond headlines. Issue #3307. ---
    if (bp.newtNewspaper) {
      const PAPER_PERIOD = TUNING.seasonPeriod / 7  // ~14 in-game days
      if (c.newtNewsTimer === undefined) c.newtNewsTimer = PAPER_PERIOD * rng()
      c.newtNewsTimer -= dt
      if (c.newtNewsTimer <= 0) {
        c.newtNewsTimer = PAPER_PERIOD
        const HEADLINES = [
          'LARGE ROCK DISPLACES WATER IN NORTH SECTOR',
          'CREATURE SPOTTED, LEAVES WITHOUT COMMENT',
          'ALGAE BLOOM: COVERAGE CONTINUES PAGE 2',
          'LOCAL FISH DOES NOTHING OF NOTE FOR THIRD CONSECUTIVE DAY',
          'CURRENT SLIGHTLY FASTER THAN YESTERDAY',
          'POND EDGE REPORT: IT IS STILL THERE',
          'REED CENSUS SHOWS REEDS',
          'MYSTERIOUS SPLASH — INVESTIGATION ONGOING',
          'WATER TEMPERATURE WITHIN NORMAL RANGE',
          'EDITORIAL: THE CASE FOR STAYING IN THE POND',
        ]
        const headline = HEADLINES[Math.floor(rng() * HEADLINES.length)]
        events.push({ kind: 'notice', blueprintId: bp.id, x: c.x, y: c.y, text: `${bp.name} Newspaper: ${headline}` })
      }
    }

    // --- burrow excavation: dig through soil tiles downward. Issue #3419. ---
    if (bp.burrowDigger) {
      const digMats = ['dirt', 'mud', 'sand', 'grass', 'snow', 'ash']
      for (const ddy of [0, 1]) {
        const tx = Math.round(c.x), ty = Math.round(c.y) + ddy
        if (tx < 0 || tx >= w.width || ty < 0 || ty >= w.height) continue
        const tIdx = ty * w.width + tx
        const matId = MATERIAL_BY_INDEX[w.tiles[tIdx]]?.id
        if (matId !== undefined && digMats.includes(matId) && rng() < 0.15 * dt) {
          if (c.burrowX === undefined) {
            c.burrowX = tx
            c.burrowY = ty
          }
          w.tiles[tIdx] = AIR
          break
        }
      }
    }

    // --- in-burrow status: underground at burrow site = safe. Issue #3419. ---
    if (bp.burrowDigger && c.burrowX !== undefined) {
      const distToBurrow = Math.sqrt((c.x - c.burrowX) ** 2 + (c.y - c.burrowY!) ** 2)
      const aboveIdx = (Math.round(c.y) - 1) * w.width + Math.round(c.x)
      const hasRoof = aboveIdx >= 0 && aboveIdx < w.tiles.length && IS_SOLID[w.tiles[aboveIdx]]
      c.inBurrow = distToBurrow < 3 && !!hasRoof
    } else {
      c.inBurrow = false
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

    // Cliff fall: cliffBound creatures that reach the world edge fall off. Issue #3305.
    if (c.cliffBound && (c.x <= 0.5 || c.x >= WORLD_W - 1.5)) {
      kill(w, c, bp, dead, events, 'starved')
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
      look(w, c, bp, bw, bh, dead, events, massEmergingSpecies, rng, dt)
    }

    // --- burrow retreat: when threatened or hungry, head back to burrow. Issue #3419. ---
    if (bp.burrowDigger && c.burrowX !== undefined && (c.hunger > 0.7 || c.mood === 'flee')) {
      const rdx = c.burrowX - c.x, rdy = c.burrowY! - c.y
      const rdist = Math.sqrt(rdx * rdx + rdy * rdy)
      if (rdist > 1) {
        c.vx += (rdx / rdist) * 0.5 * dt
        c.vy += (rdy / rdist) * 0.5 * dt
      }
    }

    // --- food cache: store/draw surplus energy in burrow. Issue #3419. ---
    if (bp.burrowDigger && c.inBurrow) {
      const cacheMax = bp.burrowCacheSize ?? 0.3
      if (c.hunger < 0.2 && (c.cachedFood ?? 0) < cacheMax) {
        c.cachedFood = Math.min(cacheMax, (c.cachedFood ?? 0) + 0.05 * dt)
      }
      if (c.hunger > 0.8 && (c.cachedFood ?? 0) > 0) {
        const draw = Math.min(c.cachedFood ?? 0, 0.3 * dt)
        c.cachedFood = (c.cachedFood ?? 0) - draw
        c.hunger = Math.max(0, c.hunger - draw)
      }
    }

    // Termite mound construction: workers build mound tiles upward. Issue #3421.
    if (bp.termiteWorker && rng() < 0.02 * dt) {
      const tx = Math.round(c.x), ty = Math.round(c.y) - 1
      if (tx >= 0 && tx < w.width && ty >= 0 && ty < w.height) {
        const tIdx = ty * w.width + tx
        if (w.tiles[tIdx] === AIR) {
          w.tiles[tIdx] = MATERIAL_INDEX['termite-mound']
        }
      }
    }

    // Mound destroyer: breaks termite-mound tiles and eats termites. Issue #3421.
    if (bp.moundDestroyer) {
      const tx = Math.round(c.x), ty = Math.round(c.y)
      const tIdx = ty * w.width + tx
      if (tIdx >= 0 && tIdx < w.tiles.length && w.tiles[tIdx] === MATERIAL_INDEX['termite-mound'] && rng() < 0.1 * dt) {
        w.tiles[tIdx] = AIR
        c.hunger = Math.max(0, c.hunger - 0.1)
        // Nutrient release: mound material enriches surrounding soil
        if (w.caveNutrient) {
          for (let ndy = -3; ndy <= 3; ndy++) {
            for (let ndx = -3; ndx <= 3; ndx++) {
              const ni = (ty + ndy) * w.width + (tx + ndx)
              if (ni >= 0 && ni < w.tiles.length) {
                w.caveNutrient[ni] = Math.min(1, (w.caveNutrient[ni] ?? 0) + 0.15)
              }
            }
          }
        }
      }
    }

    // Mound commensal: stay near termite mound habitat. Issue #3421.
    if (bp.moundCommensal) {
      const cx = Math.round(c.x), cy = Math.round(c.y)
      let nearMound = false
      for (let ndy = -4; ndy <= 4 && !nearMound; ndy++) {
        for (let ndx = -4; ndx <= 4 && !nearMound; ndx++) {
          const ni = (cy + ndy) * w.width + (cx + ndx)
          if (ni >= 0 && ni < w.tiles.length && w.tiles[ni] === MATERIAL_INDEX['termite-mound']) {
            nearMound = true
          }
        }
      }
      if (!nearMound) {
        c.vx *= 0.97  // slow drift when away from mound — tendency to find one
        c.vy *= 0.97
      }
    }

    // Secondary colonization: move into vacant built structures. Issue #3423.
    if (bp.secondaryColonizer && c.occupiedStructureKey === undefined && w.nestSites && tickCount % 120 === c.id % 120) {
      const cx = Math.round(c.x), cy = Math.round(c.y)
      const livingOwnerIds = new Set(w.creatures.map(cr => cr.id))
      const occupiedKeys = new Set(
        w.creatures.filter(cr => cr.occupiedStructureKey != null).map(cr => cr.occupiedStructureKey!)
      )
      for (const [key, site] of Object.entries(w.nestSites)) {
        if (livingOwnerIds.has(site.ownerId)) continue  // owner still alive
        if (occupiedKeys.has(key)) continue              // already occupied by someone else
        const sdx = site.x - cx, sdy = site.y - cy
        const sdist = Math.sqrt(sdx * sdx + sdy * sdy)
        if (sdist > 20) continue  // too far away
        // Steer toward this vacant structure
        if (sdist > 1) {
          c.vx += (sdx / sdist) * 0.3 * dt
          c.vy += (sdy / sdist) * 0.3 * dt
        }
        if (sdist < 2) {
          // Move in!
          c.occupiedStructureKey = key
          site.ownerId = c.id  // update occupant
        }
        break
      }
    }

    // Species-area: compute local habitat patch score for patch-dependent species. Issue #3281.
    if (bp.patchDependent && tickCount % 120 === c.id % 120) {
      const cx = Math.round(c.x), cy = Math.round(c.y)
      const tileAtCreature = w.tiles[cy * w.width + cx]
      let patchScore = 0
      const R = 10
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const ni = (cy + dy) * w.width + (cx + dx)
          if (ni >= 0 && ni < w.tiles.length && w.tiles[ni] === tileAtCreature) patchScore++
        }
      }
      c.localPatchScore = patchScore
    }

    // Landmark homing: navigate back toward memorized home territory. Issue #3326.
    if (bp.landmarkMemory && c.homeLandmarkX !== undefined && c.ageSeconds > 60) {
      const lmDx = c.homeLandmarkX - c.x, lmDy = c.homeLandmarkY! - c.y
      const lmDist = Math.sqrt(lmDx * lmDx + lmDy * lmDy)
      if (lmDist > 25 && c.hunger > 0.5) {
        // Strongly displaced and hungry — head home
        c.vx += (lmDx / lmDist) * 0.4 * dt
        c.vy += (lmDy / lmDist) * 0.4 * dt
      }
    }

    // Juvenile following: young creatures follow experienced adults. Issue #3326.
    if (bp.landmarkMemory && c.ageSeconds < 30) {
      let nearestAdult: { x: number; y: number } | null = null
      let nearestDist = 15
      for (const other of w.creatures) {
        if (other.id === c.id || other.blueprintId !== c.blueprintId || other.ageSeconds < 30) continue
        const jdx = other.x - c.x, jdy = other.y - c.y
        const jdist = Math.sqrt(jdx * jdx + jdy * jdy)
        if (jdist < nearestDist) {
          nearestDist = jdist
          nearestAdult = other
        }
      }
      if (nearestAdult) {
        const jdx2 = nearestAdult.x - c.x, jdy2 = nearestAdult.y - c.y
        const jdist2 = Math.sqrt(jdx2 * jdx2 + jdy2 * jdy2)
        if (jdist2 > 1) {
          c.vx += (jdx2 / jdist2) * 0.5 * dt
          c.vy += (jdy2 / jdist2) * 0.5 * dt
        }
      }
    }

    // Dam construction: beavers place wood tiles to block water channels. Issue #3422.
    if (bp.damBuilder && rng() < 0.05 * dt) {
      const cx = Math.round(c.x), cy = Math.round(c.y)
      const woodMat = MATERIAL_INDEX['wood']
      const waterMat = MATERIAL_INDEX['water']
      const airMat = AIR
      // Find a water tile within 2 radius, with an adjacent air tile (flow gap)
      damSearch:
      for (let ddy = -2; ddy <= 2; ddy++) {
        for (let ddx = -2; ddx <= 2; ddx++) {
          const tx = cx + ddx, ty = cy + ddy
          if (tx < 0 || tx >= w.width || ty < 0 || ty >= w.height) continue
          const tIdx = ty * w.width + tx
          if (w.tiles[tIdx] !== waterMat) continue
          // Check for an adjacent air tile we can block
          for (const [odx, ody] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
            const otx = tx + odx, oty = ty + ody
            if (otx < 0 || otx >= w.width || oty < 0 || oty >= w.height) continue
            const otIdx = oty * w.width + otx
            if (w.tiles[otIdx] === airMat) {
              // Place wood to dam the gap
              w.tiles[otIdx] = woodMat
              c.damProgress = (c.damProgress ?? 0) + 1
              break damSearch
            }
          }
        }
      }
    }

    // Play behavior: juvenile creatures build skills through play. Issue #3232.
    if (bp.playBehavior && bp.maturityAge && c.ageSeconds < bp.maturityAge) {
      if (c.playTimer === undefined) c.playTimer = 10 + rng() * 20
      c.playTimer -= dt
      if (c.playTimer <= 0) {
        c.playTimer = 15 + rng() * 15
        const maxBonus = 0.1
        if ((c.playSkillBonus ?? 0) < maxBonus) {
          c.playSkillBonus = Math.min(maxBonus, (c.playSkillBonus ?? 0) + 0.001)
          c.traits.speed = (c.traits.speed ?? 1) + 0.001
        }
        c.hunger = Math.min(1, c.hunger + 0.01)  // play costs energy
      }
    }

    // Mating call attractance: ready-to-breed creatures emit calls; receptive ones navigate. Issue #3244.
    if (bp.matingCaller && tickCount % 60 === 0) {
      const range = bp.matingCallRange ?? 15
      // Effective range scales with caller health
      const effectiveRange = range * (1 - (c.hunger ?? 0) * 0.5)
      if (readyToBreed(c, bp)) {
        // Caller: find receptive same-species within range and set their target
        for (const other of w.creatures) {
          if (other === c || other.blueprintId !== c.blueprintId) continue
          if (!readyToBreed(other, bp)) continue
          const dx = deltaX(c.x, other.x), dy = other.y - c.y
          if (dx * dx + dy * dy < effectiveRange * effectiveRange) {
            other.matingCallSourceX = c.x
            other.matingCallSourceY = c.y
          }
        }
      }
      // Clear stale call source if creature is no longer receptive
      if (c.matingCallSourceX !== undefined && !readyToBreed(c, bp)) {
        c.matingCallSourceX = undefined
        c.matingCallSourceY = undefined
      }
    }

    // Dawn chorus: birds vocalize at sunrise, establishing acoustic territory. Issue #3246.
    if (bp.dawnChorus) {
      // nightFactor: 0 = day, 1 = night. dayFraction here: 0 = start of day, 1 = end.
      // We derive a day fraction from the same cosine formula used for nightFactor.
      // nightFactor = (1 - cos(2π * elapsed / dayLength)) / 2
      // Dawn window: nightFactor transitions from 1 toward 0 — we use the raw elapsed
      // modulus to identify 0.05–0.2 of the day period as the dawn chorus window.
      const dayLen = TUNING.dayLengthSeconds
      const dayFraction = dayLen > 0 ? (w.elapsed % dayLen) / dayLen : 0
      const isDawnWindow = dayFraction > 0.05 && dayFraction < 0.2
      c.chorusing = isDawnWindow
      if (isDawnWindow) {
        const chorusRange = bp.dawnChorusRange ?? 12
        // Push nearby same-species birds to maintain spacing
        for (const other of w.creatures) {
          if (other === c || other.blueprintId !== c.blueprintId) continue
          const dx = deltaX(c.x, other.x), dy = other.y - c.y
          const dist2 = dx * dx + dy * dy
          if (dist2 < chorusRange * chorusRange && dist2 > 0) {
            const dist = Math.sqrt(dist2)
            // Gently push other away
            other.vx += (dx / dist) * 20 * dt
            other.vy += (dy / dist) * 20 * dt
          }
        }
      }
    }

    // Water pressure zones: creatures below maxDepth take pressure damage. Issue #3248.
    if (bp.maxDepth !== undefined && (tickCount + c.id) % 60 === 0) {
      // Find depth below water surface by scanning up
      const cx = Math.floor(c.x + bw / 2), cy = Math.floor(c.y + bh / 2)
      let depth = 0
      for (let dy = 0; dy < 50; dy++) {
        const ty = cy - dy
        if (ty < 0) break
        if (IS_LIQUID[w.tiles[ty * WORLD_W + (cx % WORLD_W)]] !== 1) break
        depth = dy
      }
      const excess = depth - bp.maxDepth
      if (excess > 0) {
        c.hunger = Math.min(1, c.hunger + excess * 0.001)  // pressure damage
        if (excess > 10) {
          // Severe pressure: push creature upward
          c.vy = Math.min(c.vy, -20)
        }
      }
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

    // Ocean current conveyor: lateral drift for aquatic creatures. Issue #3250.
    if (w.oceanCurrentX && (bp.move.kind === 'swim' || bp.habitat?.needs?.includes('water'))) {
      c.vx += (w.oceanCurrentX ?? 0) * dt * 0.3
    }

    // --- web capture: flying creatures entering a web tile become trapped. Issue #3420. ---
    if (bp.move.kind === 'fly' || bp.move.kind === 'drift') {
      const capTileIdx = Math.round(c.y) * w.width + wrapCol(Math.round(c.x))
      if (capTileIdx >= 0 && capTileIdx < w.tiles.length && w.tiles[capTileIdx] === MATERIAL_INDEX['web']) {
        c.webTrapped = true
      }
    }
    if (c.webTrapped) {
      // Small chance to escape each second; otherwise freeze velocity.
      if (rng() < 0.005 * dt) {
        c.webTrapped = false
      } else {
        c.vx = 0
        c.vy = 0
      }
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

    // --- cultural forgetting ------------------------------------------------
    // Learned food washing can fade without reinforcement. Rate is moderated
    // by brainSize (smarter creatures retain knowledge longer) and
    // socialLearningRate (social species forget less — active peer reinforcement
    // keeps the behavior alive). 0.0002/s base → ~2% per 100s for brainSize=0;
    // brainSize=1 → never forgets. Models the documented loss of cultural
    // behaviors in isolated cetacean populations.
    if (c.learnedFoodWashing) {
      const cbp = w.blueprints[c.blueprintId]
      const forgetRate = 0.0002 * (1 - (cbp?.brainSize ?? 0)) * (1 - ((cbp?.socialLearningRate ?? 0.5) * 0.4))
      if (rng() < forgetRate * dt) {
        c.learnedFoodWashing = false
      }
    }

    // Technique innovation and social learning (issue #3415)
    // Independent invention + peer transmission — techniques spread like cultural memes.
    if (bp.canInnovateTechniques && !isPlant) {
      const techBrainSize = bp.brainSize ?? 0
      if (!c.innovations) c.innovations = []

      // Independent discovery: rare spontaneous invention, scales with brainSize
      if (c.innovations.length < TECHNIQUE_POOL.length && rng() < techBrainSize * 0.00005) {
        const unknown = TECHNIQUE_POOL.filter(t => !c.innovations!.includes(t))
        if (unknown.length > 0) {
          const discovered = unknown[Math.floor(rng() * unknown.length)]
          c.innovations.push(discovered)
          logLife(c, w.elapsed, `Invented: ${discovered}`)
        }
      }

      // Efficiency bonus: each known technique reduces hunger slightly
      if (c.innovations.length > 0) {
        c.hunger = Math.max(0, c.hunger - 0.00002 * c.innovations.length * dt)
      }

      // Social transmission: pass techniques to nearby conspecifics within sight
      if (c.innovations.length > 0) {
        const techSight = c.traits.sight * bp.senses.sight
        for (const other of w.creatures) {
          if (other.id === c.id || other.blueprintId !== c.blueprintId) continue
          const learnerBp = w.blueprints[other.blueprintId]
          if (!learnerBp?.canInnovateTechniques) continue
          const tdx2 = distX(c.x, other.x) ** 2
          const tdy2 = (c.y - other.y) ** 2
          if (tdx2 + tdy2 > techSight * techSight) continue
          if (!other.innovations) other.innovations = []
          // Transmit one unknown technique per tick per observer
          for (const technique of c.innovations) {
            if (other.innovations.includes(technique)) continue
            const socialScale = (learnerBp.socialLearningRate ?? 0.5) * (1 + (learnerBp.brainSize ?? 0))
            if (rng() < 0.001 * socialScale * dt) {
              other.innovations.push(technique)
              logLife(other, w.elapsed, `Learned: ${technique}`)
              break
            }
          }
        }
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
            if (!seedling) {
              // Germination failed — bury the seed in the bank for later sprouting.
              w.seedBank ??= []
              w.nextSeedBankId ??= 1
              if (w.seedBank.length < 300) {
                w.seedBank.push({
                  id: w.nextSeedBankId++,
                  blueprintId: seedBp.id,
                  x: Math.floor(c.x),
                  y: Math.floor(c.y + bh),
                  age: 0,
                })
              } else {
                // Evict oldest to keep cap. Seeds are generally pushed in order, so
                // index 0 is oldest — O(n) shift but n is capped at 300.
                w.seedBank.shift()
                w.seedBank.push({
                  id: w.nextSeedBankId++,
                  blueprintId: seedBp.id,
                  x: Math.floor(c.x),
                  y: Math.floor(c.y + bh),
                  age: 0,
                })
              }
            }
          }
          c.carryingSeed = null
          c.seedTimer = 0
        }
      } else {
        // Not carrying — look for a nearby plant to pick up on the SENSE_EVERY interval.
        // UV-sensitive pollinators detect UV-nectar plants at their full sight range;
        // all pollinators can still pick up any plant within 3 tiles by contact.
        if ((tickCount + c.id) % SENSE_EVERY === 0) {
          const cx = c.x + bw / 2
          const cy = c.y + bh / 2
          const uvRange = bp.uvSensitive
            ? bp.senses.sight * (c.traits.sight ?? 1)
            : 0
          const uvRange2 = uvRange * uvRange
          let bestSeed: string | null = null
          let bestD2 = Infinity
          for (const other of w.creatures) {
            if (other === c || dead.has(other.id)) continue
            const obp = w.blueprints[other.blueprintId]
            if (!obp || obp.move.kind !== 'root') continue
            const { w: ow, h: oh } = artSize(obp)
            const dx = deltaX(other.x + ow / 2, cx)
            const dy = cy - (other.y + oh / 2)
            const d2 = dx * dx + dy * dy
            // Contact range (3 tiles) works for any plant.
            // UV sight range only works for plants with UV nectar guides.
            const maxD2 = obp.uvNectar && uvRange2 > 0 ? uvRange2 : 9
            if (d2 < maxD2 && d2 < bestD2) {
              bestD2 = d2
              bestSeed = other.blueprintId
            }
          }
          if (bestSeed !== null) {
            c.carryingSeed = bestSeed
            c.seedTimer = TUNING.pollinationCarrySeconds
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

    // Cave bat guano: underground bats continuously deposit guano on floor tiles,
    // subsidising the cave food web through the caveNutrient overlay.
    // SPORECAP fungi grow faster on guano-enriched stone; cave crickets follow.
    if (bp.caveBat && isUnderground(w, c)) {
      const gx = Math.floor(c.x + bw / 2)
      const gy = Math.floor(c.y + bh)  // floor tile directly below bat
      w.caveNutrient ??= new Float32Array(WORLD_W * WORLD_H)
      for (let dx = -2; dx <= 2; dx++) {
        const tx = (gx + dx + WORLD_W) % WORLD_W
        if (gy >= 0 && gy < WORLD_H) {
          const idx = gy * WORLD_W + tx
          w.caveNutrient[idx] = Math.min(1, (w.caveNutrient[idx] ?? 0) + 0.0002 * dt)
        }
      }
    }

    // Riparian buffer: root plants within 3 tiles of water absorb surface
    // nutrients before they reach the stream. The plant benefits (extra growth);
    // the water body stays cleaner. Issue #3371.
    if (isPlant) {
      const rpx = Math.floor(c.x + bw / 2), rpy = Math.floor(c.y + bh / 2)
      let riparianNearWater = false
      outer: for (let rdy = -3; rdy <= 3; rdy++) {
        for (let rdx = -3; rdx <= 3; rdx++) {
          const rtx = wrapCol(rpx + rdx), rty = rpy + rdy
          if (rty < 0 || rty >= WORLD_H) continue
          if (IS_LIQUID[w.tiles[rty * WORLD_W + rtx] ?? 0] && !IS_DEADLY[w.tiles[rty * WORLD_W + rtx] ?? 0]) {
            riparianNearWater = true
            break outer
          }
        }
      }
      if (riparianNearWater && w.caveNutrient) {
        const rni = rpy * WORLD_W + rpx
        const ripNutrient = w.caveNutrient[rni] ?? 0
        if (ripNutrient > 0) {
          const absorbed = Math.min(ripNutrient, 0.0005 * dt)
          w.caveNutrient[rni] -= absorbed
          c.hunger = Math.max(0, c.hunger - absorbed * 0.4)
        }
      }
    }

    // Leaf litter / falling insect bonus: aquatic creatures near overhanging
    // riparian vegetation receive a small food subsidy from organic inputs.
    // Issue #3371.
    if (!isPlant && isNearWater(w, c)) {
      const llcx = Math.floor(c.x), llcy = Math.floor(c.y)
      for (const other of w.creatures) {
        if (other.id === c.id) continue
        const obp = w.blueprints[other.blueprintId]
        if (!obp || obp.move.kind !== 'root') continue
        const lldx = Math.abs(Math.floor(other.x) - llcx), lldy = Math.abs(Math.floor(other.y) - llcy)
        if (lldx <= 3 && lldy <= 3) {
          c.hunger = Math.max(0, c.hunger - 0.00002 * dt)
          break
        }
      }
    }

    // Invertebrate drift: aquatic invertebrates with canDrift occasionally release
    // from substrate and drift passively with current. Highest at dusk/dawn.
    // Drifting creatures are easy prey for fish positioned upstream. Issue #3373.
    if (bp.canDrift && bp.move.kind !== 'root' && !c.drifting) {
      const driftTile = w.tiles[Math.floor(c.y) * WORLD_W + wrapCol(Math.floor(c.x))] ?? 0
      if (IS_LIQUID[driftTile] && !IS_DEADLY[driftTile]) {
        // Dawn/dusk periodicity: nightFactor ∈ [0.25, 0.75] → 3× base probability.
        // Compute nightFactor inline (same formula as look() function).
        const driftNightFactor = TUNING.dayLengthSeconds > 0
          ? (1 - Math.cos((2 * Math.PI * w.elapsed) / TUNING.dayLengthSeconds)) / 2
          : 0
        const isDuskDawn = driftNightFactor > 0.25 && driftNightFactor < 0.75
        const driftProb = (isDuskDawn ? 0.0006 : 0.0002) * dt
        if (rng() < driftProb) {
          c.drifting = true
          c.drift = 1  // drift rightward (proxy for downstream)
        }
      }
    }

    // Seasonal migration state: migratory creatures track which half of the year
    // it is and drive toward their seasonal destination. Triggers when > 15 tiles
    // from destination; clears when within 15 tiles. Issue #3321.
    if (bp.migratory && TUNING.seasonAmplitude > 0) {
      const migP = (2 * Math.PI * w.elapsed) / TUNING.seasonPeriod
      const cosP = Math.cos(migP)
      if (Math.abs(cosP) > 0.1) {
        const destX = cosP < 0
          ? (bp.winteringX ?? Math.round(WORLD_W * 0.25))
          : (bp.summerX ?? Math.round(WORLD_W * 0.75))
        const distToDest = Math.abs(deltaX(c.x, destX))
        c.migrating = distToDest > 15
        c.migrationDestX = destX
      } else {
        // Near equinox: hold current state, don't thrash direction
        c.migrating = c.migrating ?? false
      }
    }

    // Migratory fat tracking and stopover refueling. Creatures with a
    // `stopoverHabitat` array deplete fat while actively migrating; they
    // pause and refuel when standing on a matching tile, and die of
    // exhaustion if fat hits zero. Creatures without the field skip all of
    // this. Issue #3324.
    if (bp.migratory && bp.stopoverHabitat && bp.stopoverHabitat.length > 0) {
      c.migratoryFat ??= 1.0

      if (c.migrating) {
        // Active migration: deplete fat reserves
        c.migratoryFat = Math.max(0, c.migratoryFat - 0.002 * dt)

        if (c.migratoryFat <= 0) {
          kill(w, c, bp, dead, events, 'starved')
          continue
        }

        // Check for stopover habitat: tile at foot level
        const stx = Math.floor(c.x)
        const sty = Math.floor(c.y + 1)  // one tile below creature centre
        const underfoot = MATERIAL_BY_INDEX[tileAt(w, stx, sty)]?.id
        if (underfoot && bp.stopoverHabitat.includes(underfoot)) {
          c.migrating = false  // pause to rest and refuel
        }
      } else {
        // At stopover or destination: slowly refuel
        c.migratoryFat = Math.min(1, c.migratoryFat + 0.002 * dt)
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

    // --- niche construction feedback ------------------------------------
    // In persistently modified habitats, traits that were neutral elsewhere
    // become either costly or advantageous — the constructed environment
    // drives selection in ways the original did not.
    {
      const ncx = Math.floor(c.x + body.dx + body.w / 2)
      const ncy = Math.floor(c.y + body.dy + body.h)
      const footMat = tileAt(w, ncx, ncy)

      // Mud zones (created by soilEngineer): murky, organic-rich substrate.
      // High sight is costly — visual acuity buys little in turbid conditions.
      // High cooperation pays off — dense habitat rewards group foraging.
      if (footMat === MATERIAL_INDEX.mud) {
        const sightOvershoot = Math.max(0, c.traits.sight - 1.0)
        c.hunger = Math.min(1, c.hunger + sightOvershoot * 0.00005 * dt)
        const coopBonus = Math.max(0, c.traits.cooperation - 0.5)
        c.hunger = Math.max(0, c.hunger - coopBonus * 0.00003 * dt)
      }

      // Persistently wet zones (moisture > 0.65, from soilEngineer/bioturbator):
      // damp habitats accelerate microbial spread — low-immunity lineages pay a cost.
      if (w.moisture) {
        const tileIdx = ncy * WORLD_W + ncx
        if (ncy >= 0 && ncy < WORLD_H && ncx >= 0 && ncx < WORLD_W) {
          const moisture = w.moisture[tileIdx] ?? 0
          if (moisture > 0.65) {
            const immunityGap = Math.max(0, 0.6 - c.traits.immunity)
            c.hunger = Math.min(1, c.hunger + immunityGap * 0.00005 * dt)
          }
        }
      }

      // Ash zones (created by polluter): visually homogenous soot landscape.
      // Conspicuous, low-camouflage creatures stand out and are taken first —
      // industrial melanism selection pressure reinforced through hunger cost.
      if (footMat === MATERIAL_INDEX.ash && bp.move.kind !== 'root') {
        const camoGap = Math.max(0, 0.4 - c.traits.camouflage)
        c.hunger = Math.min(1, c.hunger + camoGap * 0.00004 * dt)
      }
    }

    // Polarized mating beacon: polarized-skin creatures ready to breed emit a
    // covert polarized signal once per SENSE_EVERY interval. Only same-species
    // polarizedVision creatures can detect this — predators are blind to it.
    if (bp.polarizedSkin && readyToBreed(c, bp) && (tickCount + c.id) % SENSE_EVERY === 0 && w.scents.length < 200) {
      w.scents.push({ x: c.x + bw / 2, y: c.y + bh / 2, blueprintId: c.blueprintId, decaySeconds: 8, polarized: true })
    }

    // Eusocial workers and soldiers don't breed — only queens do. Issue #3229.
    if ((c.caste === 'worker' || c.caste === 'soldier') && bp.eusocialSpecies) continue

    // --- breeding -------------------------------------------------------
    // `isPlant` is declared at the top of the loop body — see the note there.
    // Phenological gate: species with a breedingGdd threshold only mate when
    // accumulated warmth (0–1000) has reached their seasonal window. When
    // seasons are disabled (seasonAmplitude=0), worldGdd returns 1000, so the
    // gate is permanently open and existing behaviour is unchanged.
    // Photoperiod gate: long-day breeders require seasonFactor >= 1 (summer);
    // short-day breeders require seasonFactor <= 1 (winter/autumn). Issue #3360.
    const photoperiodOk = !bp.breedingPhotoperiod || TUNING.seasonAmplitude === 0 ||
      (bp.breedingPhotoperiod === 'long' ? seasonFactor >= 1.0 : seasonFactor <= 1.0)
    const inBreedingSeason = photoperiodOk && (
      !bp.phenology?.breedingGdd ||
      worldGdd(w.elapsed) >= bp.phenology.breedingGdd + (c.phenoOffset ?? 0)
    )
    // Lunar breeding trigger: species tied to a moon phase can only breed near it. Issue #3190.
    if (bp.lunarBreedingPhase !== undefined && w.lunarPhaseDay !== undefined) {
      const phaseDiff = Math.abs(((w.lunarPhaseDay - bp.lunarBreedingPhase + 28) % 28))
      const phaseDiffWrapped = Math.min(phaseDiff, 28 - phaseDiff)
      if (phaseDiffWrapped > 2) continue
    }
    // Quail Quarantine: breeding suspended while quarantine is active. Issue #3310.
    if (bp.quailQuarantine && w.quailQuarantineActive) continue

    if (
      inBreedingSeason &&
      readyToBreed(c, bp) &&
      creatures.length < TUNING.maxCreatures &&
      !(isPlant && plantsAlive >= TUNING.maxPlants) &&
      !(isPlant && TUNING.pollinationOnly) &&
      (speciesCount[bp.id] ?? 0) < (isPlant ? TUNING.plantSpeciesCap : TUNING.speciesSoftCap)
    ) {
      // Biome gate: species with biomeRequirements cannot breed outside their
      // allowed zones. Within ECOTONE_WIDTH rows of a band boundary, both adjacent
      // zones are valid — a creature near the edge of its zone may still reproduce.
      // A row outside all bands (out-of-bounds y) still blocks breeding.
      // Issue #3378, extended by #3379.
      if (bp.biomeRequirements && bp.biomeRequirements.length > 0) {
        const zones = biomeZonesAtWithEcotone(w, Math.floor(c.y))
        if (!zones.some(z => bp.biomeRequirements!.includes(z))) continue
      }

      // Obligate coevolution: cannot reproduce without partner species present. Issue #3266.
      if (bp.obligatePartner !== undefined) {
        const partnerCount = speciesCount[bp.obligatePartner] ?? 0
        if (partnerCount === 0) continue  // partner extinct — no reproduction
      }

      // Carrying capacity density penalty. Issue #3287.
      if (bp.populationCap) {
        const pop = speciesCount[c.blueprintId] ?? 0
        const density = pop / bp.populationCap
        if (density >= 1.0) continue  // at or above capacity: skip reproduction
        if (density >= 0.8) {
          // linear decline from 100% → 0% as density goes from 0.8 → 1.0
          const penalty = (density - 0.8) / 0.2
          if (rng() < penalty) continue
        }
      }

      // Allee effect: mate scarcity reduces reproduction. Issue #3288.
      if (bp.alleeThreshold) {
        const pop = speciesCount[c.blueprintId] ?? 0
        if (pop < bp.alleeThreshold) {
          const alleeFactor = pop / bp.alleeThreshold
          if (rng() >= alleeFactor) continue
        }
      }

      // Semelparous: skip reproduction if already reproduced once. Issue #3259.
      if (bp.semelparous && c.hasReproduced) continue

      // Polygyny: only the most-fed male within sight breeds. Issue #3257.
      if (bp.matingSystem === 'polygyny' && c.id % 2 === 0) {
        const sight = bp.senses?.sight ?? 12
        const competitors = w.creatures.filter(o => o !== c && o.blueprintId === c.blueprintId && !dead.has(o.id) && Math.hypot(o.x - c.x, o.y - c.y) < sight && o.id % 2 === 0)
        if (competitors.some(o => o.mealsEaten > c.mealsEaten)) continue  // dominated — skip
      }

      // Age-structured reproduction: rate varies by life stage. Issue #3261.
      if (bp.ageReproductionCurve) {
        const lifespan = lifespanOf(c, bp) * TUNING.lifespanScale
        const relAge = Math.min(1, c.ageSeconds / lifespan)
        let ageFactor = 1
        if (bp.ageReproductionCurve === 'peak-early') {
          ageFactor = relAge < 0.3 ? 1.5 : relAge < 0.6 ? 1.0 : 0.4
        } else if (bp.ageReproductionCurve === 'peak-middle') {
          ageFactor = relAge < 0.2 ? 0.3 : relAge < 0.7 ? 1.4 : 0.5
        } else if (bp.ageReproductionCurve === 'peak-late') {
          ageFactor = relAge < 0.5 ? 0.5 : relAge < 0.85 ? 1.0 : 1.8
        }
        if (rng() >= ageFactor) continue
      }

      // Species-area: small patches suppress reproduction. Issue #3281.
      if (bp.patchDependent && (c.localPatchScore ?? 100) < 50) {
        reproRate *= Math.max(0.1, (c.localPatchScore ?? 10) / 50)
        if (rng() >= reproRate) continue
      }

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
      // Promiscuous species reproduce without a mate. Issue #3257.
      const effectiveWantsMate = bp.matingSystem === 'promiscuity' ? false : wantsMate
      const mate = effectiveWantsMate ? findMate(w, c, bp, dead) : null
      if (!effectiveWantsMate || mate) {
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
        // Brood parasitism: lay egg in a host species' nest instead. Issue #3260.
        if (bp.broodParasite && bp.broodParasiteHost && bp.egglayer && !isPlant) {
          const hosts = bp.broodParasiteHost
          for (const host of w.creatures) {
            const hbp = w.blueprints[host.blueprintId]
            if (!hosts.includes(host.blueprintId) || host.nestX === undefined) continue
            const hdx = host.nestX - c.x, hdy = host.nestY! - c.y
            const hdist = Math.sqrt(hdx * hdx + hdy * hdy)
            if (hdist < 8) {
              const childTraits = inherit(c.traits, null, rng)
              const generation = c.generation + 1
              w.eggs.push({
                id: w.nextEggId++,
                x: host.nestX,
                y: host.nestY!,
                blueprintId: c.blueprintId,
                traits: childTraits,
                generation,
                hatchIn: TUNING.eggHatchSeconds * 0.7,  // parasite hatches faster
              })
              c.children++
              if (c.children === 1) logLife(c, w.elapsed, 'First offspring')
              speciesCount[bp.id] = (speciesCount[bp.id] ?? 0) + 1
              c.breedCooldown = TUNING.breedCooldown *
                ((c.traits as { reproductionCooldown?: number }).reproductionCooldown ?? 1)
              events.push({ kind: 'notice', blueprintId: bp.id, x: host.nestX, y: host.nestY!, text: `${bp.name} parasitized a ${hbp?.name ?? 'host'} nest` })
              break
            }
          }
        } else if (bp.egglayer && !isPlant) {
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
            hatchIn: TUNING.eggHatchSeconds * (bp.rK !== undefined ? 0.7 + bp.rK * 0.6 : 1),  // r-selected hatch faster
          })
          // Assign nest site when first egg is laid. Issue #3418.
          if (bp.nestBuilder && c.nestX === undefined) {
            c.nestX = c.x
            c.nestY = c.y
          }
          c.children++
          if (c.children === 1) logLife(c, w.elapsed, 'First offspring')
          else if (c.children % 10 === 0) logLife(c, w.elapsed, `${c.children} offspring`)
          speciesCount[bp.id] = (speciesCount[bp.id] ?? 0) + 1
          c.breedCooldown =
            TUNING.breedCooldown *
            ((c.traits as { reproductionCooldown?: number }).reproductionCooldown ?? 1) *
            (bp.slowMetabolism ? 2 : 1) *
            (bp.invasive ? 0.67 : 1)
          // r/K selection: rK=0 → shorter cooldown (fast breeders), rK=1 → longer cooldown (slow breeders). Issue #3256.
          if (bp.rK !== undefined) {
            const cooldownMultiplier = 0.5 + bp.rK * 1.5  // 0.5x at rK=0, 2.0x at rK=1
            c.breedCooldown *= cooldownMultiplier
          }
          // Semelparous: die after first reproduction. Issue #3259.
          if (bp.semelparous) {
            c.hasReproduced = true
            kill(w, c, bp, dead, events, 'aged')
          }
          payForChild(w, c, bp, bw, bh, helpers)
          if (mate) {
            mate.children++
            if (mate.children === 1) logLife(mate, w.elapsed, 'First offspring')
            else if (mate.children % 10 === 0)
              logLife(mate, w.elapsed, `${mate.children} offspring`)
            payForChild(w, mate, bp, bw, bh, helpers)
          }
          // Monogamy pair-bond: nearby mate reduces next cooldown. Issue #3257.
          if (bp.matingSystem === 'monogamy') {
            const sight = bp.senses?.sight ?? 12
            const bondMate = w.creatures.find(o => o !== c && o.blueprintId === c.blueprintId && !dead.has(o.id) && Math.hypot(o.x - c.x, o.y - c.y) < sight)
            if (bondMate) c.breedCooldown *= 0.8
          }
          // Eusocial queen breeds faster. Issue #3229.
          if (bp.eusocialSpecies && c.caste === 'queen') {
            c.breedCooldown *= 0.4
          }
          // Plankton bloom: 4× breeding rate during bloom. Issue #3254.
          if (bp.phytoplankton && w.planktonBloomActive) {
            c.breedCooldown *= 0.25
          }
          // Semelparous: die after first reproduction. Issue #3259.
          if (bp.semelparous) {
            c.hasReproduced = true
            kill(w, c, bp, dead, events, 'aged')
          }
          // Sexual dimorphism: sex-based cooldown modification for parent. Issue #3165.
          if (bp.sexualDimorphism && c.sex === 'male') {
            c.breedCooldown *= 0.9  // males breed slightly faster
          }
          // Breeding resets isolation counter. Issue #3164.
          c.isolationTime = 0
          if (mate) mate.isolationTime = 0
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
            // Eusocial caste assignment at birth. Issue #3229.
            if (bp.eusocialSpecies) {
              w.eusocialQueenIds ??= {}
              const queenId = w.eusocialQueenIds[bp.id]
              const queenAlive = queenId !== undefined && !dead.has(queenId) && w.creatures.some(cc => cc.id === queenId)
              const totalPop = speciesCount[bp.id] ?? 0
              const soldierCount = w.creatures.filter(cc => cc.blueprintId === bp.id && cc.caste === 'soldier').length
              const soldierFrac = totalPop > 0 ? soldierCount / totalPop : 0
              if (!queenAlive) {
                child.caste = 'queen'
                w.eusocialQueenIds[bp.id] = child.id
              } else if (soldierFrac < 0.25 && rng() < 0.4) {
                child.caste = 'soldier'
              } else if (rng() < 0.05) {
                child.caste = 'drone'
                child.droneAge = 0
              } else {
                child.caste = 'worker'
              }
            }
            // Food-washing inheritance: 70% chance to inherit from the parent
            // that knows the technique. Models early cultural transmission —
            // offspring raised by a food-washer mostly pick up the behavior.
            if (
              (c.learnedFoodWashing || mate?.learnedFoodWashing) &&
              bp.canLearnFoodWashing &&
              rng() < 0.7
            ) {
              child.learnedFoodWashing = true
              child.foodWashingVariant = c.foodWashingVariant ?? mate?.foodWashingVariant
            }
            // Phenological timing inheritance with mutation.
            // Children inherit the midpoint of both parents' offsets, plus a small
            // random nudge (±10 GDD). Capped at ±200 to prevent runaway drift.
            // Selection acts through the mismatch penalty: offspring closer to GDD 500
            // (summer peak) face less hunger during breeding season and outcompete
            // poorly-timed siblings over generations.
            if (bp.phenology?.breedingGdd !== undefined) {
              const parentOffset = (c.phenoOffset ?? 0)
              const mateOffset = (mate?.phenoOffset ?? 0)
              const midpoint = mate ? (parentOffset + mateOffset) / 2 : parentOffset
              const mutated = midpoint + (rng() * 20 - 10)
              child.phenoOffset = Math.max(-200, Math.min(200, mutated))
            }
            // Bergmann's rule: body size drifts larger in cold regions, smaller in warm. Issue #3270.
            if (bp.bodyMass !== undefined) {
              const zone = biomeZoneAt(w, Math.floor(c.y))
              const coldZones = new Set(['boreal', 'tundra', 'ice-cap'])
              const warmZones = new Set(['tropical-rainforest', 'tropical-savanna', 'desert'])
              if (zone && coldZones.has(zone)) {
                child.traits.size = Math.min(1.2, child.traits.size + 0.015)
              } else if (zone && warmZones.has(zone)) {
                child.traits.size = Math.max(0.8, child.traits.size - 0.015)
              }
            }
            // Island dwarfism / gigantism: isolated land populations evolve different body sizes. Issue #3271.
            if (bp.bodyMass !== undefined && bp.move.kind === 'walk') {
              const cx = Math.floor(c.x), cy = Math.floor(c.y)
              const ISLAND_RADIUS = 20
              let waterLeft = false, waterRight = false
              for (let dx = 1; dx <= ISLAND_RADIUS; dx++) {
                const rowL = cy * WORLD_W + ((cx - dx + WORLD_W) % WORLD_W)
                const rowR = cy * WORLD_W + ((cx + dx) % WORLD_W)
                if (IS_LIQUID[w.tiles[rowL]] === 1) { waterLeft = true }
                if (IS_LIQUID[w.tiles[rowR]] === 1) { waterRight = true }
                if (waterLeft && waterRight) break
              }
              if (waterLeft && waterRight) {
                // Isolated island: prey shrink (no predation pressure), predators grow (no competition)
                const isPrey = bp.diet.eats.includes('plant') && !bp.diet.eats.includes('meat')
                const isPredator = bp.diet.eats.includes('meat')
                if (isPrey) {
                  // Check if any predator of this species is nearby
                  const nearPredator = w.creatures.some(p => {
                    if (p.blueprintId === c.blueprintId) return false
                    const pbp = w.blueprints[p.blueprintId]
                    return pbp?.diet.eats.includes('meat') &&
                      Math.abs(p.x - c.x) < ISLAND_RADIUS && Math.abs(p.y - c.y) < ISLAND_RADIUS
                  })
                  if (!nearPredator) child.traits.size = Math.max(0.8, child.traits.size - 0.02)
                } else if (isPredator) {
                  child.traits.size = Math.min(1.2, child.traits.size + 0.02)
                }
              }
            }
            // Sexual dimorphism: assign sex and adjust traits/hue. Issue #3165.
            if (bp.sexualDimorphism) {
              child.sex = rng() < 0.5 ? 'male' : 'female'
              if (child.sex === 'male') {
                child.traits = { ...child.traits, hue: (child.traits.hue + 30) % 360 }
              }
            }
            // Genetic isolation: extra drift for isolated parents. Issue #3164.
            if ((c.isolationTime ?? 0) > 1800) {
              const extraDrift = 0.1  // additional nudge
              child.traits = {
                ...child.traits,
                speed: Math.max(0.6, Math.min(1.6, child.traits.speed + (rng() - 0.5) * extraDrift)),
                sight: Math.max(0.6, Math.min(1.6, child.traits.sight + (rng() - 0.5) * extraDrift)),
                size: Math.max(0.8, Math.min(1.2, child.traits.size + (rng() - 0.5) * extraDrift)),
              }
            }
            child.lifeLog = [{ elapsed: w.elapsed, text: `Born (gen ${child.generation})` }]
            // Kin selection: offspring inherit parent's kin group. Issue #3230.
            if (bp.kinSelection) {
              child.kinGroupId = c.kinGroupId ?? (c.blueprintId + '_' + c.id)
            }
            // Record birth position for anadromous migration homing.
            if (bp.anadromous) child.natalX = Math.floor(child.x)
            // Multi-host parasite: start as larval stage. Issue #3185.
            if (bp.intermediateHostId !== undefined) {
              child.lifecycleStage = 'larval'
            }
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

              // allelopathy suppression: nearby allelopathic different-species plants
              // slow our breeding by 30%
              let allelopathyFactor = 1
              if (!bp.novelCompoundResistant) {
                const ax = c.x + bw / 2
                const ay = c.y + bh / 2
                const nearbyN = gather(ax, ALLELOPATHY_RADIUS + bw / 2)
                for (let i = 0; i < nearbyN; i++) {
                  const other = found[i]
                  if (other.id === c.id) continue
                  const obp = w.blueprints[other.blueprintId]
                  if (!obp?.allelopathic || obp.id === bp.id) continue
                  const odx = other.x + (obp.art.frames[0][0]?.length ?? 1) / 2 - ax
                  const ody = other.y + (obp.art.frames[0]?.length ?? 1) / 2 - ay
                  if (odx * odx + ody * ody < ALLELOPATHY_RADIUS * ALLELOPATHY_RADIUS) {
                    allelopathyFactor = 1.3
                    break
                  }
                }
              }

              // biotic resistance: diverse native communities slow invasive colonization
              let bioticResistanceFactor = 1
              if (bp.invasive) {
                const bx = c.x + bw / 2
                const by = c.y + bh / 2
                const nearbyN2 = gather(bx, BIOTIC_RESISTANCE_RADIUS + bw / 2)
                const nativeSpeciesNearby = new Set<string>()
                for (let i = 0; i < nearbyN2; i++) {
                  const other = found[i]
                  if (other.id === c.id) continue
                  const obp = w.blueprints[other.blueprintId]
                  if (!obp || obp.invasive) continue // only count non-invasive (native) species
                  const odx = other.x + (obp.art.frames[0][0]?.length ?? 1) / 2 - bx
                  const ody = other.y + (obp.art.frames[0]?.length ?? 1) / 2 - by
                  if (odx * odx + ody * ody < BIOTIC_RESISTANCE_RADIUS * BIOTIC_RESISTANCE_RADIUS) {
                    nativeSpeciesNearby.add(other.blueprintId)
                  }
                }
                if (nativeSpeciesNearby.size >= BIOTIC_RESISTANCE_THRESHOLD) {
                  bioticResistanceFactor = 1.5 // 50% slower in diverse native communities
                }
              }

              // competitive exclusion: high-ability competitors suppress breeding
              let competitiveExclusionFactor = 1
              {
                const myAbility = bp.competitiveAbility ?? 1
                const ccx = c.x + bw / 2
                const ccy = c.y + bh / 2
                const nearbyN3 = gather(ccx, COMPETITIVE_EXCLUSION_RADIUS + bw / 2)
                let competitorPressure = 0
                for (let i = 0; i < nearbyN3; i++) {
                  const other = found[i]
                  if (other.id === c.id) continue
                  const obp = w.blueprints[other.blueprintId]
                  if (!obp || obp.move.kind !== 'root' || obp.id === bp.id) continue
                  const odx = other.x + (obp.art.frames[0][0]?.length ?? 1) / 2 - ccx
                  const ody = other.y + (obp.art.frames[0]?.length ?? 1) / 2 - ccy
                  if (odx * odx + ody * ody < COMPETITIVE_EXCLUSION_RADIUS * COMPETITIVE_EXCLUSION_RADIUS) {
                    competitorPressure += (obp.competitiveAbility ?? 1)
                  }
                }
                const relativePressure = competitorPressure / Math.max(0.1, myAbility)
                if (relativePressure > COMPETITIVE_THRESHOLD) {
                  const excess = Math.min(2, (relativePressure - COMPETITIVE_THRESHOLD) / COMPETITIVE_THRESHOLD)
                  competitiveExclusionFactor = 1 + 0.5 * excess
                }
              }

              // Salt marsh productivity: plants in optimal salinity breed up to 3× faster,
              // modelling the extreme NPP of tidal wetland communities.
              // Detrital subsidy: marshDetritus further boosts productivity.
              let salinityBoost = 1.0
              if (bp.salinityTolerance && w.salinity) {
                const { min, max } = bp.salinityTolerance
                const half = (max - min) / 2
                const mid = min + half
                const tileSal = w.salinity[footY * WORLD_W + footX] ?? 0
                if (tileSal >= min && tileSal <= max && half > 0) {
                  const proximity = 1 - Math.abs(tileSal - mid) / half
                  salinityBoost = 1 + 2 * proximity  // 1→3×
                }
              }
              if (w.marshDetritus) {
                const det = w.marshDetritus[footY * WORLD_W + footX] ?? 0
                salinityBoost *= 1 + det  // up to 2× additional from detrital export
              }
              // Microclimate pocket: frost hollows amplify winter cold (lower season factor),
              // sun-traps moderate it. Effect is proportional — strongest in winter when
              // seasonFactor is already low. Only applies when seasons are enabled.
              const localSeasonFactor = TUNING.seasonAmplitude > 0
                ? Math.max(0.01, seasonFactor * (1 + microclimateMod(w, footX)))
                : seasonFactor
              c.breedCooldown =
                (TUNING.plantSpreadCooldown * crowdingPenalty * allelopathyFactor * bioticResistanceFactor * competitiveExclusionFactor) /
                (auraBoost(w, c, bp, bw, bh, helpers) *
                  plantFertilityFactor *
                  localSeasonFactor *
                  salinityBoost)
              // Plankton bloom: 4× breeding rate during bloom. Issue #3254.
              if (bp.phytoplankton && w.planktonBloomActive) {
                c.breedCooldown *= 0.25
              }
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
              // Anadromous spawning: the act of reproduction is fatal — spent fish die
              // and deposit marine-derived nutrients (nitrogen, phosphorus) into the
              // headwater ecosystem. Issue #3374.
              if (bp.anadromous) {
                c.hunger = 1  // exhausted — will starve next tick
                const spawnX = Math.floor(c.x + bw / 2), spawnY = Math.floor(c.y + bh / 2)
                w.caveNutrient ??= new Float32Array(WORLD_W * WORLD_H)
                for (let ndy = -3; ndy <= 3; ndy++) {
                  for (let ndx = -3; ndx <= 3; ndx++) {
                    const ntx = wrapCol(spawnX + ndx), nty = spawnY + ndy
                    if (nty >= 0 && nty < WORLD_H) {
                      w.caveNutrient[nty * WORLD_W + ntx] = Math.min(1, (w.caveNutrient[nty * WORLD_W + ntx] ?? 0) + 0.15)
                    }
                  }
                }
                logLife(c, w.elapsed, 'Spawned and spent — returning nutrients to the headwater')
              }
              // r/K selection cooldown multiplier (same as egglayer path). Issue #3256.
              if (bp.rK !== undefined) {
                const cooldownMultiplier = 0.5 + bp.rK * 1.5  // 0.5× at rK=0, 2.0× at rK=1
                c.breedCooldown *= cooldownMultiplier
              }
              // Monogamy pair-bond: nearby mate reduces next cooldown. Issue #3257.
              if (bp.matingSystem === 'monogamy') {
                const sight = bp.senses?.sight ?? 12
                const bondMate = w.creatures.find(o => o !== c && o.blueprintId === c.blueprintId && !dead.has(o.id) && Math.hypot(o.x - c.x, o.y - c.y) < sight)
                if (bondMate) c.breedCooldown *= 0.8
              }
              // Eusocial queen breeds faster. Issue #3229.
              if (bp.eusocialSpecies && c.caste === 'queen') {
                c.breedCooldown *= 0.4
              }
              // Plankton bloom: 4× breeding rate during bloom. Issue #3254.
              if (bp.phytoplankton && w.planktonBloomActive) {
                c.breedCooldown *= 0.25
              }
              // Semelparous: die after first reproduction. Issue #3259.
              if (bp.semelparous) {
                c.hasReproduced = true
                kill(w, c, bp, dead, events, 'aged')
              }
              // Sexual dimorphism: sex-based cooldown modification for parent. Issue #3165.
              if (bp.sexualDimorphism && c.sex === 'male') {
                c.breedCooldown *= 0.9  // males breed slightly faster
              }
              // Breeding resets isolation counter. Issue #3164.
              c.isolationTime = 0
              if (mate) mate.isolationTime = 0
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

  // Eusocial queen succession: clear queen id when queen dies. Issue #3229.
  if (w.eusocialQueenIds) {
    for (const [bpId, queenId] of Object.entries(w.eusocialQueenIds)) {
      if (dead.has(queenId)) {
        delete w.eusocialQueenIds[bpId]
        // Next creature of that species will be crowned in the next tick
      }
    }
  }

  // Mass emergence notice: if >= 3 adults of the same species emerged this tick,
  // fire a notice event (predator satiation — overwhelming numbers). Issue #3339.
  for (const [bpId, count] of Object.entries(emergenceCount)) {
    if (count >= 3) {
      const ebp = w.blueprints[bpId]
      events.push({
        kind: 'notice',
        blueprintId: bpId,
        text: `${count} ${ebp?.name ?? bpId}s emerge at once — predators overwhelmed!`,
        x: 0,
        y: 0,
      })
    }
  }

  // Egg hatching: decrement timers and hatch ready eggs.
  w.eggs ??= []
  const hatchedEggIds = new Set<number>()
  for (const egg of w.eggs) {
    egg.hatchIn -= dt
    // Nest hatch bonus: eggs near a complete nest hatch faster. Issue #3418.
    if (w.nestSites && egg.hatchIn > 0) {
      const nestBpForEgg = w.blueprints[egg.blueprintId]
      if (nestBpForEgg?.nestBuilder) {
        const completeAt = nestBpForEgg.nestCompleteAt ?? 8
        const radius = nestBpForEgg.nestRadius ?? 3
        const hatchBonus = nestBpForEgg.nestHatchBonus ?? 0.7
        for (const nest of Object.values(w.nestSites)) {
          const ex = egg.x - nest.x, ey = egg.y - nest.y
          if (nest.progress >= completeAt && Math.sqrt(ex * ex + ey * ey) <= radius) {
            // Accelerate hatch: reduce remaining time proportionally this tick
            egg.hatchIn -= dt * (1 / hatchBonus - 1)  // net effect: hatchIn depletes faster
            break
          }
        }
      }
    }
    // Parental care hatch bonus: guarded eggs hatch faster. Issue #3258.
    if (egg.hatchIn > 0) {
      for (const parent of w.creatures) {
        const pbp = w.blueprints[parent.blueprintId]
        if (!pbp?.parentalCare || parent.blueprintId !== egg.blueprintId) continue
        const pDist = Math.sqrt((parent.x - egg.x) ** 2 + (parent.y - egg.y) ** 2)
        const pRadius = pbp.parentalRadius ?? 5
        if (pDist <= pRadius) {
          const bonus = pbp.broodProtection ?? 0.8
          egg.hatchIn -= dt * (1 / bonus - 1)  // net faster
          break
        }
      }
    }
    if (egg.hatchIn <= 0) {
      const parentBp = w.blueprints[egg.blueprintId]
      // Holometabolous: eggs from this adult hatch as the larval form. Issue #3336.
      // Hemimetabolous: eggs from this adult hatch as nymph instar 1. Issue #3340.
      const hatchBpId = parentBp?.holometabolous && parentBp.larvaeBlueprint
        ? parentBp.larvaeBlueprint
        : parentBp?.hemimetabolous && parentBp.nymphBlueprint
          ? parentBp.nymphBlueprint
          : egg.blueprintId
      const ebp = w.blueprints[hatchBpId]
      if (ebp && w.creatures.length < TUNING.maxCreatures) {
        const { w: ew, h: eh } = artSize(ebp)
        const hatchling = spawnCreature(w, ebp, egg.x - ew / 2, egg.y - eh / 2)
        if (hatchling) {
          hatchling.generation = egg.generation
          hatchling.traits = egg.traits
          // Bergmann's rule: body size drifts larger in cold regions, smaller in warm. Issue #3270.
          if (ebp.bodyMass !== undefined) {
            const hatchZone = biomeZoneAt(w, Math.floor(egg.y))
            const coldZ = new Set(['boreal', 'tundra', 'ice-cap'])
            const warmZ = new Set(['tropical-rainforest', 'tropical-savanna', 'desert'])
            if (hatchZone && coldZ.has(hatchZone)) {
              hatchling.traits.size = Math.min(1.2, hatchling.traits.size + 0.015)
            } else if (hatchZone && warmZ.has(hatchZone)) {
              hatchling.traits.size = Math.max(0.8, hatchling.traits.size - 0.015)
            }
          }
          // Island dwarfism / gigantism at egg hatch. Issue #3271.
          if (ebp.bodyMass !== undefined && ebp.move.kind === 'walk') {
            const ex = Math.floor(egg.x), ey = Math.floor(egg.y)
            const ISLAND_R = 20
            let wL = false, wR = false
            for (let idx2 = 1; idx2 <= ISLAND_R; idx2++) {
              if (IS_LIQUID[w.tiles[ey * WORLD_W + ((ex - idx2 + WORLD_W) % WORLD_W)]] === 1) wL = true
              if (IS_LIQUID[w.tiles[ey * WORLD_W + ((ex + idx2) % WORLD_W)]] === 1) wR = true
              if (wL && wR) break
            }
            if (wL && wR) {
              const isPrey2 = ebp.diet.eats.includes('plant') && !ebp.diet.eats.includes('meat')
              const isPred2 = ebp.diet.eats.includes('meat')
              if (isPrey2) {
                const nearPred2 = w.creatures.some(p2 => {
                  if (p2.blueprintId === egg.blueprintId) return false
                  const p2bp = w.blueprints[p2.blueprintId]
                  return p2bp?.diet.eats.includes('meat') &&
                    Math.abs(p2.x - egg.x) < ISLAND_R && Math.abs(p2.y - egg.y) < ISLAND_R
                })
                if (!nearPred2) hatchling.traits.size = Math.max(0.8, hatchling.traits.size - 0.02)
              } else if (isPred2) {
                hatchling.traits.size = Math.min(1.2, hatchling.traits.size + 0.02)
              }
            }
          }
          hatchling.lifeLog = [{ elapsed: w.elapsed, text: `Born (gen ${egg.generation})` }]
          // Mark life stage from hatch. Issue #3336.
          if (parentBp?.holometabolous) {
            hatchling.lifeStage = 'larva'
          }
          // Hemimetabolous: hatch as nymph at instar 1. Issue #3340.
          if (parentBp?.hemimetabolous) {
            hatchling.lifeStage = 'nymph'
            hatchling.instar = 1
          }
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
    // Wind-dispersed seeds (dandelion, maple, grass) ride the prevailing wind much
    // farther than they would go by random scatter alone. Non-windDispersed seeds
    // (heavy nuts, sticky burrs) don't care which way the wind blows. Issue #3154.
    const pollinationWindScale = victimBp.windDispersed ? 55 : 0
    const ox = ev.x + Math.cos(angle) * dist + (w.windX ?? 0) * pollinationWindScale
    const oy = ev.y + Math.sin(angle) * dist + (w.windY ?? 0) * (pollinationWindScale * 0.6)
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
  // Organic matter: decayed carcasses on dirt/grass enrich soil to mud. Issue #3145.
  for (const car of w.carcasses) {
    if (car.decaySeconds <= 0) {
      const cx2 = Math.floor(car.x), cy2 = Math.floor(car.y)
      if (cx2 >= 0 && cx2 < WORLD_W && cy2 >= 0 && cy2 < WORLD_H) {
        const ti = cy2 * WORLD_W + wrapCol(cx2)
        const tile = w.tiles[ti]
        if (tile === MATERIAL_INDEX.dirt || tile === MATERIAL_INDEX.grass) {
          setTile(w, cx2, cy2, MATERIAL_INDEX.mud)
        }
      }
    }
  }
  // Fossil record: ancient carcasses on stone tiles become bone fossils. Issue #3178.
  for (const car of w.carcasses) {
    if (car.decaySeconds <= 0) {
      const fx = Math.floor(car.x), fy = Math.floor(car.y)
      if (fx >= 0 && fx < WORLD_W && fy >= 0 && fy < WORLD_H) {
        const ti = fy * WORLD_W + wrapCol(fx)
        if (w.tiles[ti] === MATERIAL_INDEX.stone) {
          setTile(w, fx, fy, MATERIAL_INDEX.bone)
        }
      }
    }
  }
  if (w.carcasses.some(car => car.decaySeconds <= 0)) {
    // Carcass-to-nutrient conversion (#3100): expired carcasses enrich the soil beneath them.
    if (!w.soilNutrient) w.soilNutrient = new Float32Array(w.width * w.height)
    for (const car of w.carcasses) {
      if (car.decaySeconds <= 0) {
        const nIdx = Math.floor(car.y) * w.width + Math.floor(car.x)
        if (nIdx >= 0 && nIdx < w.soilNutrient.length) {
          w.soilNutrient[nIdx] = Math.min(1, w.soilNutrient[nIdx] + 0.15)
        }
      }
    }
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

  // Scent decay and wind dispersal. Issue #3155 for wind dispersal.
  for (const s of w.scents) {
    s.decaySeconds -= dt
    // Scents drift downwind. Issue #3155.
    if (w.windX) s.x += w.windX * dt * 0.4
    if (w.windY) s.y += w.windY * dt * 0.4
  }
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

  // Seed bank tick: age dormant seeds and try to germinate survivors.
  if (w.seedBank && w.seedBank.length > 0) {
    const sbSpeciesCount: Record<string, number> = {}
    let sbPlantsAlive = 0
    for (const c of w.creatures) {
      sbSpeciesCount[c.blueprintId] = (sbSpeciesCount[c.blueprintId] ?? 0) + 1
      if (w.blueprints[c.blueprintId]?.move.kind === 'root') sbPlantsAlive++
    }
    const plantsRef = { value: sbPlantsAlive }
    tickSeedBank(w, dt, tickCount, sbSpeciesCount, plantsRef, rng, events)
  }

  // Rock weathering: exposed stone near surface slowly converts to dirt. Issue #3176.
  if (tickCount % 600 === 0) {
    const weatherTx = Math.floor(rng() * WORLD_W)
    const surfaceY = Math.floor(WORLD_H * 0.3)
    for (let ty = 0; ty < surfaceY; ty++) {
      const ti = ty * WORLD_W + wrapCol(weatherTx)
      if (w.tiles[ti] === MATERIAL_INDEX.stone) {
        const above = ty > 0 ? w.tiles[(ty - 1) * WORLD_W + wrapCol(weatherTx)] : 0
        if (!IS_SOLID[above] && !IS_LIQUID[above]) {
          if (rng() < 0.05) setTile(w, weatherTx, ty, MATERIAL_INDEX.dirt)
  // Wind erosion: high wind strips topsoil from exposed surface tiles. Issue #3159.
  if (tickCount % 120 === 0 && w.windX !== undefined) {
    const windMag = Math.abs(w.windX) + Math.abs(w.windY ?? 0) * 0.5
    if (windMag > 0.25) {
      const surfaceDepth = Math.floor(WORLD_H * 0.2)  // top 20% of world height
      const tx = Math.floor(rng() * WORLD_W)
      for (let ty = 0; ty < surfaceDepth; ty++) {
        const tid = ty * WORLD_W + wrapCol(tx)
        const tile = w.tiles[tid]
        if ((tile === MATERIAL_INDEX.sand || tile === MATERIAL_INDEX.dirt) && rng() < windMag * 0.04) {
          // Check that tile above is air (exposed surface)
          const aboveTid = (ty - 1) * WORLD_W + wrapCol(tx)
          const above = ty > 0 ? w.tiles[aboveTid] : 0
          if (!IS_SOLID[above] && !IS_LIQUID[above]) {
            setTile(w, tx, ty, MATERIAL_INDEX.air)
          }
          break
        }
      }
    }
  }
}
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Larval niche separation helpers. Issue #3337.
// ---------------------------------------------------------------------------

/**
 * Returns false when a creature's life-stage override suppresses all hunting.
 *
 * When adultTrophicLevel === 'none' the adult does not eat at all — models
 * mayflies and Shimmer Flies that live only to breed. The creature's hunger
 * is still ticked normally (it was set to 0 at metamorphosis) so starvation
 * is not immediate; it just can't replenish.
 */
function canHuntAtLifeStage(c: Creature, bp: CreatureBlueprint): boolean {
  if (c.lifeStage === 'adult' && bp.adultTrophicLevel === 'none') return false
  return true
}

/**
 * Returns true if this hunter can eat this prey, accounting for life-stage
 * trophic overrides.
 *
 * When larvalTrophicLevel is set and the hunter is a larva, the prey must
 * carry that tag rather than any of the normal diet.eats tags. This creates
 * zero resource competition between larvae and adults of the same species —
 * the caterpillar eats leaves, the butterfly drinks nectar (or nothing).
 */
function canEatAtLifeStage(hunter: Creature, bp: CreatureBlueprint, prey: CreatureBlueprint): boolean {
  if (bp.id === prey.id) return false
  if (prey.size > bp.size) return false
  if (hunter.lifeStage === 'larva' && bp.larvalTrophicLevel) {
    // Larval stage overrides: use the larvalTrophicLevel tag instead of diet.eats.
    return prey.tags.includes(bp.larvalTrophicLevel)
  }
  return bp.diet.eats.some(tag => prey.tags.includes(tag))
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
  massEmergingSpecies: ReadonlySet<string>,
  rng: Rng,
  dt: number
): void {
  const cx = c.x + bw / 2
  const cy = c.y + bh / 2
  const hungry = c.hunger > 0.3

  // This creature's sight, not its species' — everything downstream, including
  // the foraging reach and the window the loop below walks, is measured off it.
  const diurnal = (c.traits as { diurnal?: number }).diurnal ?? 0
  const underground = isUnderground(w, c)
  // Cave thermal stability: underground creatures are thermally decoupled from
  // surface day/night and seasonal cycles. Cave darkness is constant (0.8 nightFactor)
  // regardless of time — providing selection pressure against high sight traits
  // (troglobitic evolution). Lateral-line species bypass this penalty.
  const nightFactor = underground
    ? Math.min(0.8, 0.1 + cavityDepth(w, c) * 0.07)  // twilight→midnight gradient
    : TUNING.dayLengthSeconds > 0
      ? (1 - Math.cos((2 * Math.PI * w.elapsed) / TUNING.dayLengthSeconds)) / 2
      : 0
  // Echolocation: unaffected by night penalty; suppressed in noisy crowds. Issue #3242.
  const echolocates = bp.echolocates === true
  const diurnalPenalty = echolocates
    ? 0  // echolocating creatures navigate by sound — no darkness penalty
    : underground
      ? bp.lateralLine
        ? 0  // lateral-line species navigate by mechanosensory — no darkness penalty
        : Math.max(0, diurnal > 0 ? diurnal * nightFactor : -diurnal * (1 - nightFactor)) * 0.5
      : Math.max(0, diurnal > 0 ? diurnal * nightFactor : -diurnal * (1 - nightFactor)) * 0.5
  const rawSight = sightOf(c, bp)
  // Ambient noise suppression: crowds of 20+ nearby creatures mask echolocation signals.
  let echoNoiseSuppression = 1
  if (echolocates) {
    const noiseRadius = rawSight * 2
    const noiseRadius2 = noiseRadius * noiseRadius
    let nearbyCount = 0
    for (const echoOther of w.creatures) {
      if (echoOther.id === c.id) continue
      const ndx = deltaX(c.x, echoOther.x), ndy = echoOther.y - c.y
      if (ndx * ndx + ndy * ndy < noiseRadius2) nearbyCount++
      if (nearbyCount > 20) break
    }
    if (nearbyCount > 20) echoNoiseSuppression = 0.5  // ambient noise suppresses echolocation
  }
  let baseSight = rawSight * (1 - diurnalPenalty) * echoNoiseSuppression

  /**
   * Elder wisdom sight adjustment.
   *
   * Elders know where food is — 1.4× sight from accumulated territory knowledge.
   * Young creatures near an elder learn by proximity — 1.2× sight. Young creatures
   * with no living elder of their species anywhere suffer a knowledge gap — 0.85×
   * sight until new elders emerge. Only applies for species with elderWisdom: true.
   *
   * The "any elder alive" scan is O(n) but runs only when needed (non-elder of an
   * elderWisdom species), which is a small subset of the population. The sense
   * pass is already O(n²), so one extra O(n) scan is acceptable.
   */
  let elderWisdomMultiplier = 1
  if (bp.elderWisdom) {
    if (isElder(c, bp)) {
      // Elders get enhanced sight — they know the territory.
      elderWisdomMultiplier = 1.4
    } else {
      // Young creature: check if any elder of this species is alive.
      let elderAlive = false
      let elderNearby = false
      const baseSight2 = baseSight * baseSight
      for (const other of w.creatures) {
        if (other.id === c.id || other.blueprintId !== c.blueprintId) continue
        const obp = w.blueprints[other.blueprintId]
        if (!obp) continue
        if (isElder(other, obp)) {
          elderAlive = true
          // Check if this elder is within sight range for proximity learning.
          const edx = deltaX(cx, other.x)
          const edy = other.y - cy
          if (edx * edx + edy * edy <= baseSight2) {
            elderNearby = true
            break // near an elder — no need to keep scanning
          }
        }
      }
      if (elderNearby) {
        // Learning by proximity — the elder is right here.
        elderWisdomMultiplier = 1.2
      } else if (!elderAlive) {
        // Knowledge gap — no elder of this species left in the world.
        elderWisdomMultiplier = 0.85
      }
      // If elders exist but none are nearby: no bonus, no penalty.
    }
  }

  // Acoustic frequency interference: crowded same-band species reduce effective sight. Issue #3243.
  const myFreq = (bp as { soundFrequency?: number }).soundFrequency
  if (myFreq !== undefined) {
    let interferenceCount = 0
    const freqScanCount = gather(cx, baseSight + bw / 2)
    for (let i = 0; i < freqScanCount; i++) {
      const nb = found[i]
      if (nb.blueprintId === bp.id) continue
      const nbp = w.blueprints[nb.blueprintId]
      const nbFreq = (nbp as { soundFrequency?: number } | undefined)?.soundFrequency
      if (nbFreq !== undefined && Math.abs(nbFreq - myFreq) < 0.1) interferenceCount++
    }
    if (interferenceCount >= 3) baseSight *= 0.8
  }

  let sight = baseSight * elderWisdomMultiplier
  const sight2 = sight * sight

  /**
   * Density-dependent fear: prey reduce foraging range when predators are
   * numerous nearby. When 3+ predators that could eat this creature are within
   * a 10-tile radius, foraging sight is reduced by 40%. Issue #3120.
   */
  if (bp.move.kind !== 'root') {
    let nearbyPredatorCount = 0
    const fearRadius2 = 100  // 10 tiles squared
    for (const other of w.creatures) {
      if (other.id === c.id) continue
      const obp = w.blueprints[other.blueprintId]
      if (!obp) continue
      if (!obp.diet.eats.some(tag => bp.tags.includes(tag)) || obp.size < bp.size) continue
      const odx = deltaX(cx, other.x + bw / 2)
      const ody = other.y - cy
      if (odx * odx + ody * ody <= fearRadius2) {
        nearbyPredatorCount++
        if (nearbyPredatorCount >= 3) { sight = sight * 0.6; break }
      }
    }
  }

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
  // Nocturnal ambush advantage: nocturnal predators (diurnal < 0) detect prey farther
  // in the dark, modelling tapetum lucidum, heat-sensitive pits, and evolved night senses.
  // A fully nocturnal hunter at full night gains 30% extra detection range; the bonus
  // scales continuously with both the diurnal trait and the darkness level. Issue #3073.
  const nocturnalBonus = (TUNING.dayLengthSeconds > 0 && diurnal < 0)
    ? 1 + Math.max(0, -diurnal) * nightFactor * 0.3
    : 1
  const foodSight2 = foodSight * foodSight * nocturnalBonus * nocturnalBonus

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
        // Elder wisdom: elders always share food location regardless of cooperation.
        if (isElder(c, bp) && bp.elderWisdom && w.scents.length < 200) {
          w.scents.push({ x: c.x, y: c.y, blueprintId: c.blueprintId, decaySeconds: 15 })
        }
        c.mood = 'eat'
        c.targetId = null
        car.decaySeconds = 0 // mark for removal at end of tick
        events.push({ kind: 'ate', blueprintId: bp.id, victimId: car.blueprintId, x: c.x, y: c.y })
        return
      }
    }
  }

  // Decomposer carcass eating (#3099): decomposers eat from nearby carcasses and convert mass to nutrients.
  if (bp.decomposer && hungry && bp.move.kind !== 'root' && w.carcasses.length > 0) {
    for (const car of w.carcasses) {
      if (car.decaySeconds <= 0) continue
      const dx = deltaX(cx, car.x)
      const dy = car.y - cy
      if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
        const bite = 0.1
        c.hunger = Math.max(0, c.hunger - bite * 0.5)
        c.starving = 0
        c.huntBlockedId = null
        c.mealsEaten++
        if (c.mealsEaten === 1) logLife(c, w.elapsed, 'First meal')
        // Accelerate decay — the decomposer has done work on this carcass.
        car.decaySeconds = Math.max(0, car.decaySeconds - 1)
        // Convert mass to soil nutrients at the carcass site.
        if (!w.soilNutrient) w.soilNutrient = new Float32Array(w.width * w.height)
        const nIdx = Math.floor(car.y) * w.width + Math.floor(car.x)
        if (nIdx >= 0 && nIdx < w.soilNutrient.length) {
          w.soilNutrient[nIdx] = Math.min(1, w.soilNutrient[nIdx] + bite * 0.3)
        }
        c.mood = 'eat'
        c.targetId = null
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
        // Parental egg defense: parent intercepts predators approaching eggs. Issue #3258.
        let eggDefended = false
        for (const parent of w.creatures) {
          const pbp = w.blueprints[parent.blueprintId]
          if (!pbp?.parentalCare || parent.blueprintId !== egg.blueprintId) continue
          if (parent.nestX === undefined) continue
          const pRadius = pbp.parentalRadius ?? 5
          const pdist = Math.sqrt((parent.x - egg.x) ** 2 + (parent.y - egg.y) ** 2)
          if (pdist <= pRadius && rng() < 0.4) {
            eggDefended = true
            break
          }
        }
        if (eggDefended) continue
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
    // Burrowed creatures are safe from non-burrowing, non-probing predators. Issues #3419, #3414.
    if (other.inBurrow && !bp.burrowDigger && !bp.stickProber) continue
    // Colonized structure shelter: colonizers in occupied structures are hidden. Issue #3423.
    if (other.occupiedStructureKey && !bp.secondaryColonizer && !bp.burrowDigger && !bp.moundDestroyer) continue

    // Hard-shelled prey: requires anvil (stone tile nearby). Issue #3413.
    if (obp.hardShelled) {
      if (!bp.anvilUser) continue
      let hasAnvil = false
      const axc = Math.round(c.x), ayc = Math.round(c.y)
      anvilSearch:
      for (let ady = -3; ady <= 3; ady++) {
        for (let adx = -3; adx <= 3; adx++) {
          const ani = (ayc + ady) * w.width + (axc + adx)
          if (ani >= 0 && ani < w.tiles.length) {
            const amat = MATERIAL_BY_INDEX[w.tiles[ani]]?.id
            if (amat === 'stone' || amat === 'metal' || amat === 'marble' || amat === 'obsidian' || amat === 'iron') {
              hasAnvil = true
              break anvilSearch
            }
          }
        }
      }
      if (!hasAnvil) continue
    }

    // Size-based predation gate: prey must be within mass ratio [0.1, 3.0] of predator. Issue #3273.
    // Only applies when both predator and prey have bodyMass defined (non-default).
    // Default mass 1.0 / 1.0 ratio = 1.0 which is within [0.1, 3.0], so unset species are unaffected.
    if (bp.bodyMass !== undefined && obp.bodyMass !== undefined) {
      const predMass = bp.bodyMass
      const preyMass = obp.bodyMass
      const massRatio = preyMass / predMass
      if (massRatio < 0.1 || massRatio > 3.0) continue  // prey too small or too large
    }

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
        // Alarm calls: prey species emit an alarm signal upon detecting a predator. Issue #3231.
        if (bp.alarmCaller) {
          c.alarmCallTimer = 5
        }
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
      // Dominance hierarchy: rank contests between same-species individuals. Issue #3227.
      if (bp.dominanceHierarchy && d2 <= sight2) {
        const cooldown = c.rankContestCooldown ?? 0
        if (cooldown <= 0) {
          // Contest: higher mealsEaten wins; winner gains rank, loser loses rank.
          const cRank = c.dominanceRank ?? 0.5
          const oRank = other.dominanceRank ?? 0.5
          if (c.mealsEaten >= other.mealsEaten) {
            c.dominanceRank = Math.min(1, cRank + 0.1)
            other.dominanceRank = Math.max(0, oRank - 0.05)
          } else {
            c.dominanceRank = Math.max(0, cRank - 0.05)
            other.dominanceRank = Math.min(1, oRank + 0.1)
          }
          c.rankContestCooldown = 30
        }
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

    // Life-stage trophic override: adult with adultTrophicLevel === 'none' skips
    // all hunting; larvae use larvalTrophicLevel instead of diet.eats. Issue #3337.
    if (!canHuntAtLifeStage(c, bp)) continue
    const wantToEat =
      hungry ||
      (bp.clearingMaintainer === true &&
        obp.move.kind === 'root' &&
        other.ageSeconds < SEEDLING_MAX_AGE)
    if (wantToEat && canEatAtLifeStage(c, bp, obp) && sizeOf(other) / sizeOf(c) < 1.8) {
      // Bodies touching? Eat now, don't bother pathing — camouflage can't save
      // something once the predator is already on top of it.
      const touching = gapX <= BITE_PAD && gapY <= BITE_PAD
      if (touching && bp.parasite) {
        // Parasites attach rather than kill — drain the host over time.
        c.hostId = other.id
        c.mood = 'eat'
        c.targetId = null
        // Multi-host lifecycle: mature from larval to adult when attaching to intermediate host. Issue #3185.
        if (bp.intermediateHostId !== undefined && c.lifecycleStage === 'larval' && other.blueprintId === bp.intermediateHostId) {
          c.lifecycleStage = 'adult'
        }
        if (other.mood === 'wander' || other.mood === 'rest') {
          other.mood = 'flee'
          other.targetId = c.id
        }
        return
      }
      if (touching) {
        // Dominance hierarchy food priority: a lower-ranked individual defers to
        // a higher-ranked conspecific within 2 tiles. Issue #3227.
        if (bp.dominanceHierarchy) {
          const cRank = c.dominanceRank ?? 0.5
          const dominanceReach2 = 4  // 2 tiles squared
          let dominated = false
          for (const rival of w.creatures) {
            if (rival.id === c.id || rival.blueprintId !== c.blueprintId) continue
            const rdx = deltaX(cx, rival.x + bw / 2)
            const rdy = rival.y + bh / 2 - cy
            if (rdx * rdx + rdy * rdy <= dominanceReach2 && (rival.dominanceRank ?? 0.5) > cRank) {
              dominated = true
              break
            }
          }
          if (dominated) continue
        }
        // Chemical defense: a plant that received a mycorrhizal warning signal is
        // primed with volatile compounds — the grazer finds it unpalatable and
        // moves on. The signal decays in 30 s so the defense is temporary.
        // Issue #3331.
        if (obp.move.kind === 'root' && other.defenseTimer && other.defenseTimer > 0) return
        // Hedgehog Healthcare: kin-pooled spines give 20% miss chance. Issue #3301.
        if ((other.spineBoost ?? 0) > 0 && rng() < (other.spineBoost ?? 0)) continue
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
        // Pack hunting: coordinated attack bonus and large prey protection. Issue #3228.
        if (bp.packHunting) {
          const range = bp.coordinationRange ?? 12
          const range2 = range * range
          let packCount = 0
          for (const ally of w.creatures) {
            if (ally.id === c.id || ally.blueprintId !== c.blueprintId || dead.has(ally.id)) continue
            const adx = deltaX(c.x, ally.x), ady = c.y - ally.y
            if (adx * adx + ady * ady < range2) packCount++
          }
          const preyBpMass = obp.bodyMass ?? 1.0
          const threshold = bp.packSizeThreshold ?? 2.0
          if (preyBpMass > threshold && packCount < 1) {
            // Prey too large for solo hunter — retreat
            c.mood = 'wander'
            c.targetId = null
            return
          }
          // Pack bonus: coordinated kill grants extra energy
          if (packCount >= 1) {
            c.hunger = Math.max(0, c.hunger - 0.1)  // bonus energy from coordinated hunt
          }
        }
        // Venom injection: venomous predators inject slow on contact. Issue #3236.
        // Effective resistance = species baseline + individual heritable trait (coevolves).
        if (bp.venomous && !dead.has(other.id)) {
          const potency = bp.venomPotency ?? 0.5
          const speciesResistance = obp.venomResistance ?? 0
          const traitResistance = other.traits.venomResistance ?? 0
          const resistance = Math.min(1, speciesResistance + traitResistance)
          const effective = potency * (1 - resistance)
          if (effective > 0) {
            other.venomTimer = Math.max(other.venomTimer ?? 0, effective * 20)
          }
        }
        devour(w, other, obp, dead, events)
        // Plant stress signaling: eaten plant emits volatiles to warn neighbors. Issue #3239.
        if (obp.stressSignaler && obp.move.kind === 'root') {
          for (const neighbor of w.creatures) {
            if (!w.blueprints[neighbor.blueprintId]?.stressReceiver) continue
            const ndx = other.x - neighbor.x, ndy = other.y - neighbor.y
            if (ndx * ndx + ndy * ndy < 64) {  // within 8 tiles
              neighbor.primedDefense = Math.max(neighbor.primedDefense ?? 0, 60)
            }
          }
        }
        // Chemical signal relay: the eaten plant warns its mycorrhizal-network
        // neighbors via volatile compounds, priming their chemical defenses for
        // 30 s. Only plants (root locomotion) relay the signal. Issue #3331.
        if (obp.move.kind === 'root' && w.mycorrhizalLinks) {
          const links = w.mycorrhizalLinks[String(other.id)]
          if (links) {
            for (const neighborId of links) {
              const neighbor = w.creatures.find(nc => nc.id === neighborId)
              if (neighbor) neighbor.defenseTimer = Math.max(neighbor.defenseTimer ?? 0, 30)
            }
          }
        }
        let fill = mealFill(c, bp, obp, sizeOf(other))
        // Nocturnal predators gain an ambush advantage in storms (dark + chaos). Issue #3097.
        if (w.weatherState === 'storm' && ((c.traits as { diurnal?: number }).diurnal ?? 0) < -0.2) {
          fill *= 1.2
        }
        // Primed defense: stressed plant less nutritious and unpalatable. Issue #3239.
        if (other.primedDefense && other.primedDefense > 0) {
          fill *= 0.7  // 30% less nutrition from chemically-primed plant
        }
        // Food washing bonus: +5% energy if the creature has learned the behavior
        // and is near non-deadly liquid (water, not lava/acid).
        if (c.learnedFoodWashing && isNearWater(w, c)) {
          fill *= 1.05
        }
        // Biocontrol targeting: specialist agents are more effective against their
        // target species (2× fill — co-evolved hunting efficiency) and less effective
        // against non-targets (0.7× fill — off-target effort). Issue #3368.
        if (bp.biocontrolTargets && bp.biocontrolTargets.length > 0) {
          if (bp.biocontrolTargets.includes(obp.id)) {
            fill *= 2
          } else {
            fill *= 0.7
          }
        }
        // Predator satiation during mass emergence: when a cohort of the prey's
        // species is emerging simultaneously, the predator is already gorged from
        // the glut and gains only half the normal hunger reduction. Issue #3339.
        if (massEmergingSpecies.has(obp.id)) {
          fill *= 0.5
        }
        // Pupal vulnerability: pupae are easy, rewarding prey — predator gets extra
        // fill, making pupae more targeted by opportunistic hunters. Issue #3338.
        if (other.lifeStage === 'pupa' && obp.pupalVulnerability) {
          fill *= 1 + obp.pupalVulnerability
        }
        // Moult vulnerability: moulting nymphs are soft-shelled and easy prey. Issue #3341.
        if (other.lifeStage === 'nymph' && other.moultingTimer !== undefined && obp.moultVulnerability) {
          fill *= 1 + obp.moultVulnerability
        }
        // Web-trapped prey: immobilized creatures are easy pickings for the spider. Issue #3420.
        if (other.webTrapped && bp.webSpinner) {
          fill *= 2
        }
        // Stick probing: slightly reduced efficiency when extracting from burrow. Issue #3414.
        if (bp.stickProber && other.inBurrow) {
          fill *= 0.8
        }
        // Pollinator specialization: tongue-length match to flower tube depth modifies fill. Issue #3264.
        if (bp.pollinatorSpecialist && obp.flowerTubeDepth !== undefined) {
          const myTongue = bp.tongueLength ?? 0.5
          if (myTongue < obp.flowerTubeDepth * 0.8) {
            fill = 0  // tongue too short — no access to nectar
          } else {
            // Close match bonus: 20% extra fill when tongue fits the tube well
            const matchBonus = myTongue <= obp.flowerTubeDepth * 1.2 ? 1.2 : 1.0
            fill *= matchBonus
          }
        }
        // Host-parasite immunity cycling: parasite on a host-parasite target faces immune resistance. Issue #3265.
        if (bp.hostParasiteAttacker && obp.hostParasite) {
          const immunity = other.parasiteExposure ?? 0
          if (rng() < immunity * 0.8) {
            // Host is immune this cycle — parasite gains nothing
            fill = 0
          } else {
            // Successful parasitism: exposure builds immunity; parasite gets a weak drain only
            other.parasiteExposure = Math.min(1, (other.parasiteExposure ?? 0) + 0.05)
            fill *= 0.3
          }
        }
        c.hunger = Math.max(0, c.hunger - fill)
        c.starving = 0
        c.huntBlockedId = null
        c.mealsEaten++
        if (c.mealsEaten === 1) logLife(c, w.elapsed, 'First meal')
        // Grazer waste cycle (#3102): herbivores deposit nutrients at their feeding site (manure).
        if (obp.move.kind === 'root' && bp.diet.eats.includes('plant') && !bp.diet.eats.includes('meat')) {
          if (!w.soilNutrient) w.soilNutrient = new Float32Array(w.width * w.height)
          const nIdx = Math.floor(c.y) * w.width + Math.floor(c.x)
          if (nIdx >= 0 && nIdx < w.soilNutrient.length) {
            w.soilNutrient[nIdx] = Math.min(1, w.soilNutrient[nIdx] + 0.01)
          }
        }
        // Predator-prey trait escalation: successful hunts grant a small permanent speed bonus. Issue #3263.
        if (bp.predatorEscalation) {
          c.escalatedSpeed = Math.min(0.5, (c.escalatedSpeed ?? 0) + 0.005)
        }
        // Weasel War Crimes Tribunal: track conflicts and fire tribunal events.
        // Issue #3316.
        if (bp.weaselTribunal && obp.move.kind !== 'root') {
          c.conflictCount = (c.conflictCount ?? 0) + 1
          if (c.conflictCount >= 3 && rng() < 0.12) {
            c.conflictCount = 0  // reset after tribunal
            events.push({
              kind: 'notice',
              blueprintId: bp.id,
              x: c.x,
              y: c.y,
              text: `${c.name ?? 'A ' + bp.name} was brought before the War Crimes Tribunal. The tribunal issued a strongly-worded notice. Compliance rate: 12%.`,
            })
          }
        }
        // Cultural innovation: rare spontaneous food-washing discovery near water.
        if (bp.canLearnFoodWashing && !c.learnedFoodWashing && isNearWater(w, c) && rng() < 0.002) {
          c.learnedFoodWashing = true
          c.foodWashingVariant = Math.floor(rng() * 999) + 1
        }
        // Cultural transmission: a food-washer near kin passes the behavior on,
        // including their cultural variant (dialect). Already-knowers with a different
        // variant may hybridize when populations mix.
        if (c.learnedFoodWashing && isNearWater(w, c)) {
          const sight = c.traits.sight * bp.senses.sight
          for (const other2 of w.creatures) {
            if (
              other2.id === c.id ||
              other2.blueprintId !== c.blueprintId ||
              !w.blueprints[other2.blueprintId]?.canLearnFoodWashing
            ) continue
            const dx2 = distX(c.x, other2.x) ** 2
            const dy2 = (c.y - other2.y) ** 2
            if (dx2 + dy2 > sight * sight) continue
            const learnerBp = w.blueprints[other2.blueprintId]
            if (!other2.learnedFoodWashing) {
              // Initial acquisition: juvenile imprinting scales with socialLearningRate and brainSize.
              const isJuvenile = other2.ageSeconds < (learnerBp?.diet.lifespanSeconds ?? 240) * 0.15
              const baseProb = isJuvenile ? 0.40 : 0.04
              const socialScale = (learnerBp?.socialLearningRate ?? 0.5) * 2 * (1 + (learnerBp?.brainSize ?? 0))
              const transmissionProb = Math.min(0.95, baseProb * socialScale)
              if (rng() < transmissionProb) {
                other2.learnedFoodWashing = true
                other2.foodWashingVariant = c.foodWashingVariant
              }
            } else if (other2.foodWashingVariant !== c.foodWashingVariant && rng() < 0.005) {
              // Dialect hybridization: when populations reconnect, rare chance to
              // adopt the teacher's variant — models documented whale-song dialect
              // spread when communities merge.
              other2.foodWashingVariant = c.foodWashingVariant
            }
          }
        }
        // Cooperative creatures signal food location to kin.
        if (
          ((c.traits as { cooperation?: number }).cooperation ?? 0.3) > 0.5 &&
          w.scents.length < 200
        ) {
          w.scents.push({ x: c.x, y: c.y, blueprintId: c.blueprintId, decaySeconds: 10 })
        }
        // Elder wisdom: elders always share food location with kin regardless of
        // cooperation level. Their scents last longer (15 s vs 10 s) — the elder's
        // knowledge of the territory persists in the world after each meal.
        if (isElder(c, bp) && bp.elderWisdom && w.scents.length < 200) {
          w.scents.push({ x: c.x, y: c.y, blueprintId: c.blueprintId, decaySeconds: 15 })
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
        // Bioaccumulation: accumulate toxin in own tissues. Issue #3238.
        if (preyToxicity > 0) {
          if ((c as { toxinLoad?: number }).toxinLoad === undefined) c.toxinLoad = 0
          c.toxinLoad = Math.min(1, (c.toxinLoad as number) + preyToxicity * 0.3)
        }
        // Aposematism: eating a brightly-colored toxic prey teaches the predator to avoid
        // that species in future. Naive predators (mealsEaten < 5) still attack freely. Issue #3237.
        if (obp.aposematic && obp.toxic) {
          if (!c.learnedAversions) c.learnedAversions = []
          if (!c.learnedAversions.includes(obp.id)) {
            c.learnedAversions.push(obp.id)
          }
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
      // Sensory modalities that bypass visual camouflage entirely
      // lateral line: bypasses camouflage within short range in water/mud tiles
      const predFootX = Math.floor(c.x + bw / 2)
      const predFootY = Math.floor(c.y + bh)
      const predTile = tileAt(w, predFootX, predFootY)
      const predMat = MATERIAL_BY_INDEX[predTile]
      const inWaterOrMud = predMat?.id === 'water' || predMat?.id === 'mud'
      const lateralLineSense =
        bp.lateralLine === true &&
        inWaterOrMud &&
        d2 < LATERAL_LINE_RADIUS * LATERAL_LINE_RADIUS
      const sensorBypass =
        bp.electroreceptive === true || // detects bioelectric fields
        (bp.infraredVision === true && obp.warmBlooded === true) || // detects heat
        lateralLineSense // detects water pressure waves
      const baseCamouflage = sensorBypass
        ? 0
        : chromaFade > 0
          ? 0 // transitioning — briefly exposed
          : obp.cryptic && !bp.polarizedVision
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
      // Prey escalation: evasive prey has a chance to dodge targeting. Issue #3263.
      if (obp.preyEscalation && rng() < (other.escalatedEvasion ?? 0)) continue
      // Aposematism: predators avoid genuinely toxic species after experience. Issue #3267.
      if (obp.toxic && bp.diet.eats?.includes('meat') && rng() < 0.7) continue
      // Aposematism learned aversion: experienced predators avoid aposematic toxic prey. Issue #3237.
      if (obp.aposematic && obp.toxic && c.mealsEaten >= 5) {
        const aversions = c.learnedAversions
        if (aversions && aversions.includes(obp.id) && rng() < 0.9) continue
      }
      // Mimicry: harmless mimics get protection proportional to nearby toxic species density. Issue #3267.
      if (obp.toxicMimic && rng() < 0.2) {
        const totalNearby = w.creatures.filter(o2 => Math.hypot(o2.x - c.x, o2.y - c.y) < 20).length
        const toxicNearby = w.creatures.filter(o2 => {
          const o2bp = w.blueprints[o2.blueprintId]
          return o2bp?.toxic && Math.hypot(o2.x - c.x, o2.y - c.y) < 20
        }).length
        const mimicryProtection = totalNearby > 0 ? Math.min(0.8, (toxicNearby / totalNearby) * 4) : 0
        if (rng() < mimicryProtection) continue
      }
      // Biocontrol preference: specialist agents prioritize their target species.
      // Halve the effective distance for biocontrol targets so they always win
      // target selection over non-targets at similar range. Issue #3368.
      const biocontrolPriorityD2 =
        bp.biocontrolTargets && bp.biocontrolTargets.includes(obp.id) ? d2 * 0.25 : d2
      if (d2 <= finalEfs2 && biocontrolPriorityD2 < preyDist) {
        preyDist = biocontrolPriorityD2
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
      // Sensory modalities that bypass visual camouflage entirely
      // lateral line: bypasses camouflage within short range in water/mud tiles
      const intPredFootX = Math.floor(c.x + bw / 2)
      const intPredFootY = Math.floor(c.y + bh)
      const intPredTile = tileAt(w, intPredFootX, intPredFootY)
      const intPredMat = MATERIAL_BY_INDEX[intPredTile]
      const intInWaterOrMud = intPredMat?.id === 'water' || intPredMat?.id === 'mud'
      const intLateralLineSense =
        bp.lateralLine === true &&
        intInWaterOrMud &&
        d2 < LATERAL_LINE_RADIUS * LATERAL_LINE_RADIUS
      const intruderSensorBypass =
        bp.electroreceptive === true || // detects bioelectric fields
        (bp.infraredVision === true && obp.warmBlooded === true) || // detects heat
        intLateralLineSense // detects water pressure waves
      const intruderCamoBase = intruderSensorBypass
        ? 0
        : intruderChromaFade > 0
          ? 0
          : obp.cryptic && !bp.polarizedVision
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
    (cooperationVal > 0.5 || bp.pheromoneDepositor === true)
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

  // Chemoreception gradient: high-chemoreception creatures sample scent
  // concentration across their detection range and steer up the gradient.
  // Unlike simple scent-following, this works on prey scents too — the creature
  // can track where food has been eaten even without a line of sight.
  const chemoRange = (bp.senses.chemoreception ?? 0) * (c.traits.sight ?? 1)
  if (
    chemoRange > 0 &&
    hungry &&
    !prey &&
    !threat &&
    c.mood === 'wander' &&
    w.scents.length > 0
  ) {
    const chemoRange2 = chemoRange * chemoRange
    const midX = cx
    const midY = c.y + bh / 2
    let leftScore = 0
    let rightScore = 0
    for (const s of w.scents) {
      // Track same-species scents OR prey species scents
      if (s.blueprintId !== c.blueprintId) {
        const scentBp = w.blueprints[s.blueprintId]
        if (!scentBp) continue
        const isEdible = bp.diet.eats.some(tag => scentBp.tags.includes(tag))
        if (!isEdible) continue
      }
      const sdx = deltaX(midX, s.x)
      const sdy = s.y - midY
      const d2 = sdx * sdx + sdy * sdy
      if (d2 > chemoRange2) continue
      // Weight by inverse distance — closer scents count more
      const weight = 1 / (1 + Math.sqrt(d2))
      if (sdx > 0) rightScore += weight
      else leftScore += weight
    }
    const gradient = rightScore - leftScore
    if (Math.abs(gradient) > 0.05) {
      // Strength scales with chemoreception relative to sight range
      const strength = Math.min(0.5, (chemoRange / 20) * 0.4)
      c.drift = gradient > 0 ? strength : -strength
    }
  }

  // Polarized mating signal: polarizedVision creatures detect polarized beacons
  // from same-species polarizedSkin individuals at 2× normal sight range.
  // These covert signals are invisible to predators without polarizedVision.
  if (
    bp.polarizedVision &&
    !prey &&
    !threat &&
    c.mood === 'wander' &&
    w.scents.length > 0
  ) {
    const polReach2 = sight * sight * 4  // 2× sight radius
    const midX = cx
    const midY = c.y + bh / 2
    let nearestPolD2 = Infinity
    let nearestPolScent: Scent | null = null
    for (const s of w.scents) {
      if (!s.polarized) continue
      if (s.blueprintId !== c.blueprintId) continue
      const sdx = deltaX(midX, s.x)
      const sdy = s.y - midY
      const d2 = sdx * sdx + sdy * sdy
      if (d2 < nearestPolD2 && d2 < polReach2) {
        nearestPolD2 = d2
        nearestPolScent = s
      }
    }
    if (nearestPolScent) {
      const weight = 0.35
      c.drift = deltaX(midX, nearestPolScent.x) > 0 ? weight : -weight
    }
  }

  // Sound-receptive: flee from nearby sound emitter scents. Issue #3241.
  if (bp.soundReceptive && c.mood === 'wander' && w.scents.length > 0) {
    const soundRange = (bp.soundReceptiveRange ?? 12)
    const soundRange2 = soundRange * soundRange
    const midX = cx
    const midY = c.y + bh / 2
    for (const s of w.scents) {
      if (s.blueprintId === c.blueprintId) continue  // ignore own species
      const sdx = deltaX(midX, s.x)
      const sdy = s.y - midY
      if (sdx * sdx + sdy * sdy < soundRange2) {
        const soundBp = w.blueprints[s.blueprintId]
        if (soundBp?.soundEmitter) {
          c.mood = 'flee'
          c.vx += sdx > 0 ? -0.3 : 0.3
          c.vy += sdy > 0 ? -0.2 : 0.2
          break
        }
      }
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

  // Insight problem solving: cognitively superior creatures unlock novel solutions when stuck
  const insightBrainSize = bp.brainSize ?? 0
  if (
    insightBrainSize >= 0.5 &&
    bp.move.kind !== 'root' &&
    (c.huntPassCount ?? 0) >= 4 &&
    !c.insightTimer &&
    Math.random() < insightBrainSize * 0.08
  ) {
    c.insightTimer = 2 + insightBrainSize * 3
    c.insightCount = (c.insightCount ?? 0) + 1
    c.huntPassCount = 0
    c.huntBlockedId = null
    logLife(c, w.elapsed, `Insight #${c.insightCount}: unlocked novel path to prey`)
  }

  // Disease spread: an infected creature spreads to non-plant neighbours within 4 tiles.
  if (c.sick > 0 && bp.move.kind !== 'root') {
    const spreadReach = 4
    const sickNearby = gather(cx, spreadReach + bw / 2)
    // Epidemic density scaling: higher local density accelerates transmission. Issue #3183.
    const densityFactor = Math.min(2, sickNearby / 5)
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
      if (rng() < TUNING.diseaseSpreadChance * densityFactor * (1 - otherImmunity)) {
        if (!other.sick) {
          events.push({ kind: 'sick', blueprintId: other.blueprintId, x: other.x, y: other.y })
        }
        other.sick = TUNING.diseaseDuration
      }
    }
  }

  // Recovered-carrier: can still transmit at 20% rate for 60 s. Issue #3184.
  if ((c as { carrierTimer?: number }).carrierTimer && (c as { carrierTimer?: number }).carrierTimer! > 0) {
    ;(c as { carrierTimer?: number }).carrierTimer = Math.max(0, (c as { carrierTimer?: number }).carrierTimer! - dt)
    if ((c as { carrierTimer?: number }).carrierTimer! > 0) {
      const carrierReach = 3
      const nearbyCount = gather(cx, carrierReach + bw / 2)
      for (let i = 0; i < nearbyCount; i++) {
        const other = found[i]
        if (other.id === c.id || dead.has(other.id)) continue
        if ((other as { sick?: number }).sick) continue
        const obp = w.blueprints[other.blueprintId]
        if (!obp || obp.move.kind === 'root') continue
        const rawOtherImmunity = (other.traits as { immunity?: number }).immunity ?? 0.2
        const otherImmunity = obp.invasive ? Math.min(1, rawOtherImmunity + 0.56) : rawOtherImmunity
        if (rng() < TUNING.diseaseSpreadChance * 0.2 * (1 - otherImmunity)) {
          if (!other.sick) events.push({ kind: 'sick', blueprintId: other.blueprintId, x: other.x, y: other.y })
          other.sick = TUNING.diseaseDuration
        }
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

  // Jellyfish Judiciary (Court of Currents): when an aquatic species shares a
  // tile with a rival aquatic species and a drifter jelly is within sight, the
  // court convenes. One side is randomly awarded 10 s of breeding priority.
  // The court then disperses and forgets — each session starts fresh with no
  // memory of previous rulings. Issue #3303.
  const isAquatic = bp.move.kind === 'swim' || !!bp.habitat.needs?.includes('water')
  if (isAquatic) {
    let hasRival = false
    for (const other of w.creatures) {
      if (other === c || other.blueprintId === c.blueprintId) continue
      const obp = w.blueprints[other.blueprintId]
      if (!obp) continue
      if (obp.move.kind !== 'swim' && !obp.habitat.needs?.includes('water')) continue
      const odx = deltaX(cx, other.x + bw / 2)
      const ody = (other.y + bh / 2) - cy
      if (odx * odx + ody * ody < 9) { // within ~3 tiles — same territory
        hasRival = true
        break
      }
    }
    if (hasRival) {
      for (const judge of w.creatures) {
        if (judge.blueprintId !== 'drifter-jelly') continue
        const jdx = deltaX(cx, judge.x)
        const jdy = judge.y - cy
        if (jdx * jdx + jdy * jdy > sight2) continue // judge not in sight
        // Court convenes — random verdict; winner gets 10 s breeding priority
        if (rng() < 0.5 && !(c.judiciaryPriorityTimer && c.judiciaryPriorityTimer > 0)) {
          c.judiciaryPriorityTimer = 10
        }
        break // one ruling per sense pass
      }
    }
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
    // Drifting invertebrates are locked rightward and move slowly regardless of state.
    if (c.drifting) {
      c.drift = 1
    }
    // Seasonal migration drive: override wander drift with a strong directional
    // pull toward the seasonal destination. Magnetoreceptive flyers also climb
    // slightly to avoid terrain. Issue #3321 / #3322.
    if (bp.migratory && c.migrating && c.migrationDestX !== undefined) {
      const towardDest = deltaX(c.x, c.migrationDestX)
      c.drift = towardDest > 0 ? 1 : -1
      if (bp.magnetoreceptive && bp.move.kind === 'fly') {
        wantY = -0.4  // climb to avoid terrain during migration
      }
    }
    // Anadromous migration: adult fish drive toward natal spawn site when mature.
    if (bp.anadromous && c.natalX !== undefined && c.ageSeconds > (bp.diet.lifespanSeconds ?? 240) * 0.4) {
      const toNatal = deltaX(c.x, c.natalX)
      if (Math.abs(toNatal) > 5) {
        c.drift = toNatal > 0 ? 1 : -1
      }
    }
    wantX = c.drift
    wantY = bp.move.kind === 'fly' || bp.move.kind === 'swim' ? (rng() - 0.5) * 0.6 : 0
    c.targetId = null
    // Mating call navigation: move toward call source if set. Issue #3244.
    if (bp.matingCaller && c.matingCallSourceX !== undefined && readyToBreed(c, bp)) {
      const cdx = deltaX(c.x, c.matingCallSourceX)
      const cdy = (c.matingCallSourceY ?? c.y) - c.y
      const dist = Math.sqrt(cdx * cdx + cdy * cdy)
      if (dist > 2) {
        wantX = cdx / dist
        wantY = cdy / dist
      } else {
        c.matingCallSourceX = undefined
        c.matingCallSourceY = undefined
      }
    }
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

  // Acoustic camouflage: pause movement when no noisy creatures are nearby. Issue #3245.
  if ((bp as { acousticCamouflage?: boolean }).acousticCamouflage) {
    const camReach = 5
    const camCount = gather(cx, camReach + bw / 2)
    let hasNoise = false
    for (let i = 0; i < camCount; i++) {
      const nb = found[i]
      if (nb.id === c.id) continue
      if (nb.mood === 'flee' || nb.mood === 'eat') { hasNoise = true; break }
    }
    if (!hasNoise && rng() < 0.7) {
      c.vx *= 0.1
      c.vy *= 0.1
    } else if (hasNoise) {
      c.vx *= 1.2
      c.vy *= 1.2
    }
  }

  // Poison from a toxic plant halves movement speed for its duration.
  // Larger creatures are slower: size is a denominator, not a multiplier.
  const diurnal = (c.traits as { diurnal?: number }).diurnal ?? 0
  const underground = isUnderground(w, c)
  const nightFactor = underground
    ? Math.min(0.8, 0.1 + cavityDepth(w, c) * 0.07)  // twilight→midnight gradient
    : TUNING.dayLengthSeconds > 0
      ? (1 - Math.cos((2 * Math.PI * w.elapsed) / TUNING.dayLengthSeconds)) / 2
      : 0
  const diurnalPenalty = underground
    ? bp.lateralLine
      ? 0  // lateral-line species navigate by mechanosensory — no darkness penalty
      : Math.max(0, diurnal > 0 ? diurnal * nightFactor : -diurnal * (1 - nightFactor)) * 0.5
    : Math.max(0, diurnal > 0 ? diurnal * nightFactor : -diurnal * (1 - nightFactor)) * 0.5
  const speed =
    ((speedOf(c, bp) *
      (c.poisoned > 0 ? 0.5 : 1) *
      ((c.toxinLoad as number | undefined ?? 0) > 0.7 ? 0.7 : 1) *  // bioaccumulation speed penalty. Issue #3238.
      (c.venomTimer && c.venomTimer > 0 ? 0.5 : 1) *  // venom slows movement. Issue #3236.
      (c.packTimer > 0 ? 1.2 : 1) *
      (c.stunTimer > 0 ? 0.2 : 1) *
      (c.sick > 0 ? 0.7 : 1) *
      (c.symbiosisTimer > 0 ? 1.15 : 1) *
      (c.insightTimer && c.insightTimer > 0 ? 0.05 : 1) *  // insight pause
      (c.drifting ? 0.4 : 1) *  // drift — slower passive flow
      (c.isMonarch && c.mood === 'hunt' ? 1.1 : 1) *  // Kestrel Kingdom throne bonus. Issue #3304.
      (w.corridorMask && w.corridorMask[Math.round(c.y) * w.width + Math.round(c.x)] ? 1.15 : 1) *  // corridor dispersal. Issue #3283.
      (1 + (c.escalatedSpeed ?? 0)) *   // predator escalation speed bonus. Issue #3263.
      (1 - Math.max(0, (c.fatigue ?? 0) - 0.5))) /
      sizeOf(c)) *
    (1 - diurnalPenalty) *
    // Storm grounds flying creatures — 70% speed penalty. Issue #3097.
    (w.weatherState === 'storm' && bp.move.kind === 'fly' ? 0.3 : 1) *
    // Amphibian rain bonus: creatures that don't drown thrive in wet conditions.
    // Rain and storm trigger a 20% speed boost — models burst activity in frogs and
    // salamanders following the first wet-season rains. Epic #3075.
    (!bp.body.drowns && (w.weatherState === 'rain' || w.weatherState === 'storm') ? 1.2 : 1)
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

  // Wind-dispersed seeds ride the prevailing wind. windX=0.4 → up to 12 tiles extra
  // in the horizontal direction on self-seeding; vertical is scaled proportionally.
  // Issue #3154.
  const selfWindX = isPlant && bp.windDispersed ? (w.windX ?? 0) * 30 : 0
  const selfWindY = isPlant && bp.windDispersed ? (w.windY ?? 0) * 20 : 0

  for (let attempt = 0; attempt < 12; attempt++) {
    const minSpread = isPlant ? TUNING.plantSpreadMin : 0
    // For plants: pick a random direction and land at least minSpread tiles away.
    // This prevents seeds from piling up directly beneath the parent.
    const signX = rng() > 0.5 ? 1 : -1
    const signY = rng() > 0.5 ? 1 : -1
    const x = isPlant
      ? ox + signX * (minSpread + rng() * (spread - minSpread)) + selfWindX
      : ox + (rng() * 2 - 1) * spread
    const ySpread = isPlant ? 6 : spread
    const yMin = isPlant ? minSpread * (6 / 14) : 0
    const y = isPlant
      ? oy + signY * (yMin + rng() * (ySpread - yMin)) + selfWindY
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
  // Marsh detritus: when salt-tolerant plants die, export dissolved organic
  // carbon to surrounding tiles, subsidising the coastal food web.
  if (bp.move.kind === 'root' && bp.salinityTolerance && w.salinity) {
    const px = Math.floor(wrapX(c.x))
    const py = Math.floor(c.y)
    w.marshDetritus ??= new Float32Array(WORLD_W * WORLD_H)
    for (let dy = -2; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = (px + dx + WORLD_W) % WORLD_W
        const ny = py + dy
        if (ny < 0 || ny >= WORLD_H) continue
        const idx = ny * WORLD_W + nx
        w.marshDetritus[idx] = Math.min(1, w.marshDetritus[idx] + 0.08)
      }
    }
  }
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
