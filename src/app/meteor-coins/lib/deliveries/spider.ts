import { PHYSICS_STEP_S, PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import type { Vec } from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'
import type { Landing } from '@/app/meteor-coins/lib/game'

/**
 * The Cairn's spider: it hangs on a thread from a rail over the posts,
 * holding the next coin, and bobs up and down on its own. The player walks
 * it sideways along the rail and lets go of the coin.
 */
export type SpiderConfig = {
  /** Where the rail runs: the drop line, over the posts. */
  z: number
  /** How far either side of the middle the spider can walk. */
  halfWidth: number
  /** The held coin's lowest and highest point on the bob. */
  lowY: number
  highY: number
  /** Seconds for one bob, down and back up. */
  bobPeriodS: number
  /** Top walking speed along the rail, in units/s. */
  speed: number
  /** Seconds it takes to fetch the next coin after letting go of one. */
  reloadS: number
}

/**
 * A pointer this far from the spider is somewhere it's still walking to:
 * letting go there aims rather than drops, so a tap on a phone walks it
 * over and a second tap drops.
 */
export const SPIDER_REACH = 0.35
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
 * Press, then let go, to drop the coin from where the spider is right now;
 * the pointer (`point`) or the arrow keys (`steer`) walk it along the rail.
 * It walks at a limited speed, so getting over a post takes a moment.
 */
export class SpiderDelivery implements Delivery {
  readonly kind = 'spider'
  readonly busy = 0
  /** Where the spider is along the rail. */
  x = 0
  /** Where the pointer last asked it to go, or null while the keys steer it. */
  private target: number | null = null
  private steerX = 0
  private pressed = false
  /** Stage time it has the next coin back, after a drop. */
  private reloadUntil = -Infinity

  constructor(
    private readonly host: DeliveryHost,
    readonly config: SpiderConfig
  ) {}

  /** Where the coin it holds would start falling from, `ahead` seconds from now. */
  tipAt(ahead = 0): Vec {
    const t = this.host.dropperTime + ahead * this.host.speed
    return { x: this.x, y: spiderY(t, this.config), z: this.config.z }
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

  input(e: DeliveryInput): boolean {
    switch (e.type) {
      case 'point':
        this.target = this.clamp(e.x)
        return true
      case 'steer':
        this.steerX = e.x
        if (e.x !== 0) this.target = null
        return true
      case 'press':
        this.pressed = true
        return this.holding
      case 'release': {
        if (!this.pressed) return false
        this.pressed = false
        // Still walking to the pointer: that was an aim, not a drop.
        if (this.target !== null && Math.abs(this.target - this.x) > SPIDER_REACH) return true
        return this.letGo()
      }
    }
  }

  private clamp(x: number): number {
    const w = this.config.halfWidth
    return Math.max(-w, Math.min(w, x))
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

  /** Walks toward the pointer, or the way the keys hold, at its top speed. */
  beforeStep() {
    const most = this.config.speed * PHYSICS_STEP_S
    const want = this.target ?? this.x + this.steerX * most
    this.x = this.clamp(this.x + Math.max(-most, Math.min(most, want - this.x)))
  }

  step() {}
}
