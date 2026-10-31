import { PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import type { Vec } from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'
import type { Landing } from '@/app/meteor-coins/lib/game'

/**
 * The Cairn's spider: it hangs on a thread from a rail over the posts,
 * holding the next coin, and walks the rail and bobs up and down on its own.
 * The player only picks the moment to let go. (In round 1 the player walked
 * it, and could park it over a post and wait for the bob: too easy, in
 * Nick's playtest.)
 */
export type SpiderConfig = {
  /** Where the rail runs: the drop line, over the posts. */
  z: number
  /** How far either side of the middle the spider walks. */
  halfWidth: number
  /** The held coin's lowest and highest point on the bob. */
  lowY: number
  highY: number
  /** Seconds for one bob, down and back up. */
  bobPeriodS: number
  /** Seconds to walk the rail from one end to the other. It walks there and back. */
  crossS: number
  /**
   * How much it slows over each post, 0 to 1: its speed there is
   * (1 - postEase) of its average, so it lingers a little where a drop counts.
   */
  postEase: number
  /** Seconds it stands still over each post (part of `crossS`). */
  postPauseS: number
  /** Seconds it takes to fetch the next coin after letting go of one. */
  reloadS: number
}

/** The spider's rail runs this far above the held coin's highest point. */
export const SPIDER_RAIL_ABOVE = 1.5
/** A coin never lets go closer than this above a tower's top. */
const SPAWN_CLEARANCE = 0.25

/**
 * The longest fall onto a tower that lands soft. Measured headless:
 * falls of ~4 knocked towers down, ~2.5 kept them.
 */
export const SOFT_FALL = 3

/**
 * Whether the landing dot fills: a coin let go from `tip` now would land
 * square on a post (see DropGame.landing), and softly.
 */
export function spiderCueLit(landing: Landing, tip: Vec): boolean {
  return landing.post !== null && tip.y - landing.y <= SOFT_FALL
}

/** How high the held coin hangs at stage time `t`: highest at the start, lowest half a bob later. */
export function spiderY(t: number, c: SpiderConfig): number {
  const k = (1 + Math.cos((2 * Math.PI * t) / c.bobPeriodS)) / 2
  return c.lowY + (c.highY - c.lowY) * k
}

/**
 * Where the spider is along the rail at stage time `t`. It walks from end to
 * end and back, starting in the middle and walking right. Each stretch
 * between two stops (the rail's ends, and the posts at `posts`) takes time
 * in proportion to its length, eased with a Hermite curve: to a standstill
 * at the ends, where it turns, and to (1 - postEase) of its average speed
 * over a post, so it never stops there, only slows.
 */
export function spiderX(t: number, c: SpiderConfig, posts: number[]): number {
  const w = c.halfWidth
  const stops = [-w, ...posts.filter(x => x > -w && x < w).sort((a, b) => a - b), w]
  const pauses = (stops.length - 2) * c.postPauseS
  const walkS = c.crossS - pauses
  // Seconds into one end-to-end walk, left to right; the walk back mirrors it.
  // At t = 0 it is in the middle of the walk, going right.
  const lap = (((t + c.crossS / 2) % (2 * c.crossS)) + 2 * c.crossS) % (2 * c.crossS)
  const back = lap > c.crossS
  let left = back ? 2 * c.crossS - lap : lap
  let x = w
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    const legS = (walkS * (b - a)) / (2 * w)
    if (left <= legS) {
      const s = left / legS
      const m0 = i === 0 ? 0 : 1 - c.postEase
      const m1 = i === stops.length - 2 ? 0 : 1 - c.postEase
      const s2 = s * s
      const s3 = s2 * s
      x = a + (b - a) * ((s3 - 2 * s2 + s) * m0 + (3 * s2 - 2 * s3) + (s3 - s2) * m1)
      break
    }
    left -= legS
    if (i < stops.length - 2) {
      if (left <= c.postPauseS) {
        x = b
        break
      }
      left -= c.postPauseS
    }
  }
  return x
}

/**
 * Press (a tap or Space) to drop the coin from where the spider is right
 * now. Nothing steers it: it patrols and bobs on its own, and the skill is
 * letting go when it is over a post and low in its bob, and, for the middle
 * post, when that post is sliding across the drop line too.
 */
export class SpiderDelivery implements Delivery {
  readonly kind = 'spider'
  readonly busy = 0
  /** Stage time it has the next coin back, after a drop. */
  private reloadUntil = -Infinity
  /** Where it slows on its walk: over each tower post. */
  private readonly posts: number[]

  constructor(
    private readonly host: DeliveryHost,
    readonly config: SpiderConfig
  ) {
    this.posts = this.towerPosts().map(p => p.x)
  }

  /** Where it is along the rail right now. */
  get x(): number {
    return this.tipAt().x
  }

  /** Where the coin it holds would start falling from, `ahead` seconds from now. */
  tipAt(ahead = 0): Vec {
    const t = this.host.dropperTime + ahead * this.host.speed
    return { x: spiderX(t, this.config, this.posts), y: spiderY(t, this.config), z: this.config.z }
  }

  /** Whether it's holding a coin it could let go of now. */
  get holding(): boolean {
    return this.host.dropperTime >= this.reloadUntil && this.host.canDrop
  }

  /** How far through fetching the next coin it is, 0 to 1 (1 when it has it). */
  get reload(): number {
    const left = this.reloadUntil - this.host.dropperTime
    return left <= 0 ? 1 : 1 - left / this.config.reloadS
  }

  /** Only a press does anything: it lets go on the moment of the tap. */
  input(e: DeliveryInput): boolean {
    return e.type === 'press' && this.letGo()
  }

  private letGo(): boolean {
    if (!this.holding) return false
    const tip = this.tipAt()
    // A tower that has grown up to the spider: let go just above it instead.
    for (const [i, post] of this.towerPosts().entries()) {
      if (Math.abs(post.x - tip.x) > post.radius) continue
      const top = post.height + (this.host.state.towers[i] ?? 0) * PUCK_THICKNESS
      tip.y = Math.max(tip.y, top + SPAWN_CLEARANCE)
    }
    if (this.host.launch(tip) === null) return false
    this.reloadUntil = this.host.dropperTime + this.config.reloadS
    return true
  }

  private towerPosts() {
    return (this.host.stage.table.obstacles ?? []).filter(
      o => o.type === 'post' && o.tower !== undefined
    ) as { x: number; height: number; radius: number }[]
  }

  step() {}
}
