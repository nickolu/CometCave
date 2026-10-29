import {
  FIELD_HALF_WIDTH,
  GRAVITY,
  type Layout,
  PHYSICS_STEP_S,
  deckDir,
  deckFaceZ,
  deckStroke,
  deckUnder,
} from '@/app/meteor-coins/lib/cabinet'
import type { Vec } from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'

/**
 * The Bedtime Book's delivery: sleepy owls flap across over the pages, each
 * carrying a word in its talons, and the player has a pea-shooter at the
 * front edge. A soft pea that reaches an owl makes it say "hoo!" and let
 * go of its word, which falls from where the owl was, at the owl's speed,
 * onto the page below. The owl flies on unharmed and comes back later
 * with another word.
 *
 * The skill is two things: leading a moving target (a pea takes about a
 * second to get there), and choosing which owl to knock the word from —
 * over which page, how far from the spine, and when that page's pusher
 * is pulled back, so the word lands on bare page and gets pushed.
 *
 * Peas fly an exact parabola worked out here, not in the physics: they're
 * checked against every owl each step and never touch the table. A miss
 * just fades out past the aim point.
 */

export type OwlsConfig = {
  /** Where peas leave the shooter. */
  shooter: Vec
  /**
   * The height the pointer is projected to, and that each pea's arc passes
   * through at the aim point: the middle of the owls' flight band.
   */
  aimY: number
  /** Each page's band of z the owls fly over, [near the back, near the front]. */
  pages: readonly (readonly [number, number])[]
  /** The owls' flying heights and speeds (units per second of the stage clock). */
  height: readonly [number, number]
  speed: readonly [number, number]
  /** Owls in the air at once. */
  owls: number
  /** Seeds the owls' flight plans, so every run sees the same sky. */
  seed: number
}

export type Owl = {
  x: number
  y: number
  z: number
  /** Units per second of the stage clock, ±. Owls fly straight across. */
  vx: number
  /** The page it flies over (index into config.pages). */
  page: number
  carrying: boolean
  /** Off-screen until this stage-clock time, or null while it's flying. */
  backAt: number | null
  /** The stage-clock time it last said "hoo!", or null. */
  hooAt: number | null
}

export type Pea = {
  from: Vec
  velocity: Vec
  /** Seconds since it was fired (physics time: slow mode slows the owls, not the peas). */
  age: number
  /** Seconds to reach the aim point; it fades out over FADE_S after. */
  reach: number
  at: Vec
}

/** A pea's horizontal speed. About a second to the back page: enough that owls need leading. */
export const PEA_SPEED = 11
/** A gentle gravity on peas, so the shot is a visible arc but stays readable. */
export const PEA_GRAVITY = -9
/** A miss fades out over this long past its aim point. */
export const FADE_S = 0.45
/**
 * How close a pea must pass an owl: an owl is about 1 across. Taller than
 * wide, because the pointer is projected onto one height while owls fly a
 * band of them, and the arc comes in steeply.
 */
export const HIT_RADIUS = 0.7
export const HIT_HALF_HEIGHT = 1
/** Fastest the shooter refires, and how many peas can be up at once. */
export const RELOAD_S = 0.35
export const MAX_PEAS = 3
/** Arrow keys move the aim this fast (units per second). */
export const AIM_SPEED = 6
/** Owls enter and leave this far out, just off the book's boards. */
export const OWL_EXIT_X = 5.8
/** An owl can be knocked only while over the book (its boards included). */
export const OVER_BOOK_X = 4.6
/** Where the word hangs below the owl's middle, and the furthest out it may land. */
export const TALON_DROP = 0.55
const LAND_HALF_WIDTH = FIELD_HALF_WIDTH - 0.5
/** Seconds an owl is away between crossings. */
const AWAY_S: readonly [number, number] = [0.6, 2.2]
/** How long "hoo!" shows. */
export const HOO_S = 0.9

/** A small seeded random source: the same flight plans every run. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lerp = ([a, b]: readonly [number, number], k: number) => a + (b - a) * k
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Where a pea fired with `velocity` from `from` is after `t` seconds. */
export function peaAt(from: Vec, velocity: Vec, t: number): Vec {
  return {
    x: from.x + velocity.x * t,
    y: from.y + velocity.y * t + 0.5 * PEA_GRAVITY * t * t,
    z: from.z + velocity.z * t,
  }
}

/**
 * The shot that passes through `aim` (at its height): flying at PEA_SPEED
 * across the ground, it takes `reach` seconds to get there.
 */
export function peaShot(from: Vec, aim: Vec): { velocity: Vec; reach: number } {
  const d = Math.hypot(aim.x - from.x, aim.z - from.z)
  const reach = Math.max(0.2, d / PEA_SPEED)
  return {
    reach,
    velocity: {
      x: (aim.x - from.x) / reach,
      y: (aim.y - from.y - 0.5 * PEA_GRAVITY * reach * reach) / reach,
      z: (aim.z - from.z) / reach,
    },
  }
}

/** Whether the segment a→b passes within an owl's catch of `owl` (an upright ellipsoid). */
export function peaHits(a: Vec, b: Vec, owl: Vec): boolean {
  // Squash height so the catch is a sphere, then the nearest point on the segment.
  const s = HIT_RADIUS / HIT_HALF_HEIGHT
  const ax = a.x - owl.x
  const ay = (a.y - owl.y) * s
  const az = a.z - owl.z
  const dx = b.x - a.x
  const dy = (b.y - a.y) * s
  const dz = b.z - a.z
  const len = dx * dx + dy * dy + dz * dz
  const k = len > 0 ? clamp(-(ax * dx + ay * dy + az * dz) / len, 0, 1) : 0
  const px = ax + dx * k
  const py = ay + dy * k
  const pz = az + dz * k
  return px * px + py * py + pz * pz <= HIT_RADIUS * HIT_RADIUS
}

/**
 * Where a word pays: on bare page just in front of a pusher that's pulled
 * back, so its next stroke shoves the word toward the spine. Measured
 * headless (40 words dropped straight onto the book's pile, 3 runs each,
 * binned by where the pusher's face was when they landed): 0.4–1.6 in
 * front of a face in the back 30% of its stroke scored 103–132; the same
 * spot with the pusher forward 25–50; landing on the pusher's top 6–35;
 * further out on the page 13–40; anywhere at any moment about 35.
 */
export const GOOD_AHEAD: readonly [number, number] = [0.4, 1.6]
export const GOOD_STROKE = -0.4

/** Whether a word landing at `z` at physics time `timeS` lands where it pays (see GOOD_AHEAD). */
export function landsWell(layout: Layout, z: number, timeS: number, periodS: number): boolean {
  if (Math.abs(z) < Math.min(...layout.map(d => Math.abs(d.frontZ)))) return false
  const deck = deckUnder(layout, z)
  const stroke = deckStroke(deck, timeS, periodS)
  const ahead = deckDir(deck) * (z - deckFaceZ(deck, stroke))
  return stroke < GOOD_STROKE && ahead > GOOD_AHEAD[0] && ahead < GOOD_AHEAD[1]
}

/** Seconds for something let go at rest-height `y` to fall to the page. */
function fallS(y: number) {
  return Math.sqrt((2 * Math.max(0, y)) / -GRAVITY)
}

export class OwlsDelivery implements Delivery {
  readonly kind = 'owls'
  readonly owls: Owl[] = []
  peas: Pea[] = []
  /** Where the shooter is aimed, at the aim height. */
  aim: Vec
  private steering = { x: 0, z: 0 }
  private lastShotAt = -Infinity
  private readonly rand: () => number

  constructor(
    private readonly host: DeliveryHost,
    readonly config: OwlsConfig
  ) {
    this.rand = seeded(config.seed)
    const back = config.pages[0]
    this.aim = { x: 0, y: config.aimY, z: (back[0] + back[1]) / 2 }
    // Start with owls already crossing, so there's something to shoot at once.
    for (let i = 0; i < config.owls; i++) {
      const owl = this.newOwl(i % config.pages.length, i < config.owls - 1)
      // Spread along their crossing, the last one waiting just off the book.
      if (i < config.owls - 1) owl.x = -Math.sign(owl.vx) * (2.5 - 3 * i)
      else owl.backAt = 1.2
      this.owls.push(owl)
    }
  }

  /** A new crossing over `page`, from a random side, at a random height and speed. */
  private newOwl(page: number, carrying: boolean): Owl {
    const c = this.config
    const dir = this.rand() < 0.5 ? 1 : -1
    return {
      x: -dir * OWL_EXIT_X,
      y: lerp(c.height, this.rand()),
      z: lerp(c.pages[page], this.rand()),
      vx: dir * lerp(c.speed, this.rand()),
      page,
      carrying,
      backAt: null,
      hooAt: null,
    }
  }

  /** Words still to give out that no owl is carrying yet. */
  private get wordsFree(): number {
    const left = this.host.state.coinsLeft
    if (left === null) return Infinity
    return left - this.owls.filter(o => o.carrying).length
  }

  get busy(): number {
    // Words carried aren't counted: owls only carry words the budget still
    // has, and drop them all when it runs out, so a spent stage never waits
    // on one. A pea in the air could still knock one loose until then.
    return this.peas.length
  }

  /** The owl's velocity in the world (units per physics second), for the word it drops. */
  owlVelocity(owl: Owl): Vec {
    return { x: owl.vx * this.host.speed, y: 0, z: 0 }
  }

  /** Where an owl will be `ahead` physics seconds from now, if it keeps flying. */
  owlAhead(owl: Owl, ahead: number): Vec {
    return { x: owl.x + owl.vx * this.host.speed * ahead, y: owl.y, z: owl.z }
  }

  /** The shot the shooter would fire now. */
  shot(aim: Vec = this.aim) {
    return peaShot(this.config.shooter, aim)
  }

  /** The arc a pea fired now would fly, to its aim point and a little past. */
  previewPath(aim: Vec = this.aim, every = 0.04): Vec[] {
    const { velocity, reach } = this.shot(aim)
    const path: Vec[] = []
    for (let t = 0; t <= reach + 0.15; t += every)
      path.push(peaAt(this.config.shooter, velocity, t))
    return path
  }

  /** Whether the shooter is ready: words left, a free slot, reloaded. */
  get ready(): boolean {
    return (
      this.host.canDrop &&
      this.peas.length < MAX_PEAS &&
      this.host.engine.time - this.lastShotAt >= RELOAD_S
    )
  }

  input(e: DeliveryInput): boolean {
    if (e.type === 'point') {
      this.aimAt(e.x, e.z)
      return true
    }
    if (e.type === 'steer') {
      this.steering = { x: e.x, z: e.z }
      return true
    }
    if (e.type === 'press') return this.fire()
    return false
  }

  /** Points the shooter at a spot over the pages, kept to where owls fly. */
  aimAt(x: number, z: number) {
    const pages = this.config.pages.flat()
    this.aim = {
      x: clamp(x, -OVER_BOOK_X, OVER_BOOK_X),
      y: this.config.aimY,
      z: clamp(z, Math.min(...pages) - 0.8, Math.max(...pages) + 0.8),
    }
  }

  private fire(): boolean {
    if (!this.ready) return false
    const from = this.config.shooter
    const { velocity, reach } = this.shot()
    this.peas.push({ from, velocity, age: 0, reach, at: { ...from } })
    this.lastShotAt = this.host.engine.time
    return true
  }

  /** Flies the owls (on the stage clock) and moves the aim by the arrow keys. */
  beforeStep() {
    const dt = PHYSICS_STEP_S * this.host.speed
    const now = this.host.dropperTime
    if (this.steering.x || this.steering.z) {
      const k = AIM_SPEED * PHYSICS_STEP_S
      this.aimAt(this.aim.x + this.steering.x * k, this.aim.z + this.steering.z * k)
    }
    // Once the budget is spent, no owl is left holding a word.
    if (this.wordsFree < 0) {
      for (const owl of this.owls) if (owl.carrying && this.wordsFree < 0) owl.carrying = false
    }
    this.owls.forEach((owl, i) => {
      if (owl.backAt !== null) {
        if (now < owl.backAt) return
        // Back with another word, over whichever page has fewer owls.
        const counts = this.config.pages.map(
          (_, p) => this.owls.filter(o => o !== owl && o.backAt === null && o.page === p).length
        )
        const fewest = Math.min(...counts)
        const pages = counts.flatMap((n, p) => (n === fewest ? [p] : []))
        const page = pages[Math.floor(this.rand() * pages.length)]
        this.owls[i] = this.newOwl(page, this.wordsFree > 0)
        return
      }
      owl.x += owl.vx * dt
      if (Math.abs(owl.x) > OWL_EXIT_X && Math.sign(owl.x) === Math.sign(owl.vx)) {
        // Never leave the sky without a word in it: if no other owl is
        // carrying one, this one turns straight round.
        const others = this.owls.some(o => o !== owl && o.backAt === null && o.carrying)
        const soon = !others && this.wordsFree + (owl.carrying ? 1 : 0) > 0
        owl.backAt = now + (soon ? 0.2 : lerp(AWAY_S, this.rand()))
        owl.carrying = false
      }
    })
  }

  /** Moves the peas along their arcs and checks each against the owls. */
  step() {
    const dt = PHYSICS_STEP_S
    this.peas = this.peas.filter(pea => {
      pea.age += dt
      const next = peaAt(pea.from, pea.velocity, pea.age)
      const hit = this.owls.find(
        o => o.backAt === null && Math.abs(o.x) <= OVER_BOOK_X && peaHits(pea.at, next, o)
      )
      pea.at = next
      if (hit) {
        this.knock(hit)
        return false
      }
      return pea.age < pea.reach + FADE_S && next.y > 0.3
    })
  }

  /** A pea reached an owl: "hoo!", and its word drops onto the page. */
  private knock(owl: Owl) {
    owl.hooAt = this.host.dropperTime
    if (!owl.carrying || !this.host.canDrop) return
    const y = owl.y - TALON_DROP
    // Kept on the page: a word let go out past the edge slides in to it.
    const x = clamp(owl.x, -LAND_HALF_WIDTH, LAND_HALF_WIDTH)
    const v = this.owlVelocity(owl)
    const t = fallS(y)
    const vx = clamp(v.x, (-LAND_HALF_WIDTH - x) / t, (LAND_HALF_WIDTH - x) / t)
    const index = this.host.launch({ x, y, z: owl.z, velocity: { x: vx, y: 0, z: 0 } })
    if (index !== null) owl.carrying = false
  }

  /**
   * Whether the aim mark is lit: a word knocked loose at the aim point by
   * a pea fired now would land where it pays (see landsWell). It's judged
   * by the aim, not by any owl, so it reads as "now's a good moment to hit
   * one here".
   */
  get aimLit(): boolean {
    const { reach } = this.shot()
    const at = this.host.engine.time + reach + fallS(this.aim.y - TALON_DROP)
    return landsWell(this.host.engine.layout, this.aim.z, at, this.host.engine.pusherPeriodS)
  }

  /** Where a word knocked loose now would land, roughly (no pile), and when. */
  landing(owl: Owl, ahead = 0): { x: number; z: number; afterS: number } {
    const at = this.owlAhead(owl, ahead)
    const t = fallS(at.y - TALON_DROP)
    return { x: clamp(at.x + owl.vx * this.host.speed * t, -4, 4), z: at.z, afterS: ahead + t }
  }
}
