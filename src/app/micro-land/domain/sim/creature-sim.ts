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
import { artSize, bodyBox, canEat, fears } from '@/app/micro-land/domain/blueprint'
import type { BodyBox } from '@/app/micro-land/domain/blueprint'
import { MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import {
  BREATH_SECONDS,
  MAX_FALL,
  MAX_PARTICLES,
  PARTICLE_LIFE,
  WORLD_H,
  WORLD_W,
} from '@/app/micro-land/domain/constants'
import { TUNING } from '@/app/micro-land/domain/tuning'
import type { Creature, CreatureBlueprint, WorldState } from '@/app/micro-land/domain/types'

import {
  boxDeadlyMaterial,
  boxDrownFraction,
  boxHitsSolid,
  boxLiquidFraction,
  boxViscosity,
  inBounds,
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
 * Slack either side of the sight window, in tiles.
 *
 * Sorting is on the sprite's left edge but sight is measured from its centre,
 * so a wide creature's edge can sit well outside the window its centre falls in.
 * Covers the widest sprite plus a tick's worth of drift since the sort.
 */
const SIGHT_PAD = 20

function compareX(a: Creature, b: Creature): number {
  return a.x - b.x
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

    // --- hunger ---------------------------------------------------------
    c.hunger = Math.min(1, c.hunger + bp.diet.hungerRate * dt)
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
    if (c.ageSeconds >= bp.diet.lifespanSeconds) {
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
    const fullness = 1 - c.hunger
    const isPlant = bp.move.kind === 'root'
    // Plants photosynthesise: spreading costs them nothing. Charging them the
    // usual hunger cost would sterilise them permanently — their hungerRate is
    // 0, so the debt could never be paid back and each plant would breed twice
    // in its entire life.
    const maturity = isPlant ? TUNING.plantMaturity : bp.diet.lifespanSeconds * 0.2
    if (
      c.breedCooldown <= 0 &&
      fullness >= bp.diet.breedAt &&
      c.ageSeconds > maturity &&
      creatures.length < TUNING.maxCreatures &&
      !(isPlant && plantsAlive >= TUNING.maxPlants) &&
      (speciesCount[bp.id] ?? 0) < (isPlant ? TUNING.plantSpeciesCap : TUNING.speciesSoftCap)
    ) {
      const child = reproduce(w, c, bp, bw, bh, rng)
      if (child) {
        // Set here rather than inside `reproduce`, which returns through two
        // different paths and would need the parent threaded into both.
        child.generation = c.generation + 1
        c.children++
        if (isPlant) plantsAlive++
        else c.hunger = Math.min(1, c.hunger + TUNING.breedCost)
        speciesCount[bp.id] = (speciesCount[bp.id] ?? 0) + 1
        // A pollinator nearby shortens the wait before the next one.
        const help = auraBoost(w, c, bp, bw, bh, helpers)
        c.breedCooldown = (isPlant ? TUNING.plantSpreadCooldown : TUNING.breedCooldown) / help
        events.push({ kind: 'born', blueprintId: bp.id, x: child.x, y: child.y })
      } else {
        // Nowhere to put it — wait a bit before trying again.
        c.breedCooldown = 3
      }
    }
  }

  if (dead.size > 0) {
    w.creatures = creatures.filter(c => !dead.has(c.id))
  }

  // The only thing the world regrows on its own. Animals that die out stay
  // dead — see `seedNativePlants`.
  seedNativePlants(w, rng)

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
  const sight2 = bp.senses.sight * bp.senses.sight
  const cx = c.x + bw / 2
  const cy = c.y + bh / 2
  const hungry = c.hunger > 0.3

  let threat: Creature | null = null
  let threatDist = Infinity
  let prey: Creature | null = null
  let preyDist = Infinity

  // Only the creatures whose left edge falls in the sight window can possibly
  // be in range; everything beyond the window is skipped without being touched.
  const reach = bp.senses.sight + SIGHT_PAD
  const last = cx + reach
  for (let i = lowerBound(byX, cx - reach); i < byX.length; i++) {
    const other = byX[i]
    if (other.x > last) break
    if (other.id === c.id || dead.has(other.id)) continue
    const obp = w.blueprints[other.blueprintId]
    if (!obp) continue

    const { w: ow, h: oh } = artSize(obp)
    const dx = other.x + ow / 2 - cx
    const dy = other.y + oh / 2 - cy
    const d2 = dx * dx + dy * dy
    if (d2 > sight2) continue

    if (fears(bp, obp)) {
      if (d2 < threatDist) {
        threatDist = d2
        threat = other
      }
      continue
    }

    if (hungry && canEat(bp, obp)) {
      // Bodies touching? Eat now, don't bother pathing.
      const touching =
        Math.abs(dx) <= (bw + ow) / 2 + BITE_PAD && Math.abs(dy) <= (bh + oh) / 2 + BITE_PAD
      if (touching) {
        devour(w, other, obp, dead, events)
        c.hunger = Math.max(0, c.hunger - TUNING.mealValue)
        c.starving = 0
        c.mealsEaten++
        c.mood = 'eat'
        c.targetId = null
        events.push({
          kind: 'ate',
          blueprintId: bp.id,
          victimId: obp.id,
          x: c.x,
          y: c.y,
        })
        return
      }
      if (d2 < preyDist) {
        preyDist = d2
        prey = other
      }
    }
  }

  if (threat) {
    c.mood = 'flee'
    c.targetId = threat.id
  } else if (prey) {
    c.mood = 'hunt'
    c.targetId = prey.id
  } else {
    c.mood = c.hunger > 0.75 ? 'hunt' : 'wander'
    c.targetId = null
  }
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
  } else {
    // Idle wander. `restlessness` is how often it changes its mind.
    if (rng() < bp.move.restlessness * dt * 4) {
      c.drift = rng() * 2 - 1
    }
    wantX = c.drift
    wantY = bp.move.kind === 'fly' || bp.move.kind === 'swim' ? (rng() - 0.5) * 0.6 : 0
    c.targetId = null
  }

  const speed = bp.move.speed
  const accel = speed * 6
  const digger = bp.dig.through.length > 0

  switch (bp.move.kind) {
    case 'walk': {
      c.vx += wantX * accel * dt
      c.vx = clampMag(c.vx, speed)
      // A burrower doesn't only dig when cornered — a well-fed one goes to
      // ground and makes a warren. Only when well fed, or it would tunnel away
      // from the food it needs and starve in the dark. How deep it gets is
      // bounded by its own dig list: a Delver chews soil but not stone, so it
      // hollows out the topsoil and stops there instead of reaching the lava.
      if (digger && c.grounded && c.hunger < 0.4 && rng() < 0.6 * dt) {
        c.vy = 6
      }
      // Jump when there's a wall in the way, or the target is overhead. Probed
      // from the solid core, not the wingtip — a dragon shouldn't try to hop
      // over a pebble its wing is drawn across.
      const ahead = Math.sign(c.vx) || c.facing
      const blocked = solidAt(
        w,
        Math.floor(c.x + body.dx + body.w / 2 + ahead * (body.w / 2 + 1)),
        Math.floor(c.y + body.dy + body.h / 2)
      )
      const wantsUp = wantY < -0.4
      if (c.grounded && (blocked || (wantsUp && rng() < 0.08))) {
        c.vy = -bp.move.jump
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

  // Walk up a ledge without needing to jump. How high a ledge depends on how
  // long your legs are: one tile per five of body height. Everything that
  // existed before big creatures did is under ten tiles tall, so they all still
  // get exactly the one tile they always had — but a tyrannosaur steps over a
  // boulder instead of wedging against it, which is what it was doing.
  const maxStep = canStepUp ? Math.max(1, Math.floor(body.h / 5)) : 0
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
    c.drift = -c.drift
    c.facing = (c.facing === 1 ? -1 : 1) as 1 | -1
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

function reproduce(
  w: WorldState,
  parent: Creature,
  bp: CreatureBlueprint,
  bw: number,
  bh: number,
  rng: Rng
): Creature | null {
  const isPlant = bp.move.kind === 'root'
  const spread = isPlant ? 14 : 5
  const body = bodyBox(bp)

  for (let attempt = 0; attempt < 12; attempt++) {
    const x = parent.x + (rng() * 2 - 1) * spread
    const y = parent.y + (rng() * 2 - 1) * (isPlant ? 6 : spread)
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
