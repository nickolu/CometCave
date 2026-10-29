import {
  BACK_WALL_Z,
  FIELD_HALF_WIDTH,
  PHYSICS_STEP_S,
  PUCK_RADIUS,
  PUCK_THICKNESS,
  PUSHER_HEIGHT,
} from '@/app/meteor-coins/lib/cabinet'
import { type Vec, flightPath } from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'
import { moonAt, moonPull } from '@/app/meteor-coins/lib/moon'
import { shelfOpenAt } from '@/app/meteor-coins/lib/timing'

/**
 * Gravity Assist's plunger: a pinball spring at the front corner of the
 * cabinet that shoots a glass ball, with the coin inside, up and back over
 * the table. The moon slings it on the way, so where it lands depends on how
 * hard the spring was pulled *and* where the moon is in its orbit when it
 * goes: the moon is the game.
 *
 * Press and hold pulls the spring back (it's fully back after `chargeS`, and
 * stays there); letting go launches. In tap mode a second tap launches.
 *
 * The coin itself is what flies (launched with the spring's speed), so the
 * moon pulls it exactly as it pulls everything else in the air, and the
 * dotted preview — the same flight worked out ahead with the same pull — is
 * the path it takes. The glass ball is drawn around it until it touches
 * anything (it leaves the predicted path), then shatters, and the coin, freed
 * and slowed by the break, drops where the preview ended.
 */
export type PlungerConfig = {
  /** Where the ball sits ready: the mouth of the plunger's lane. */
  at: Vec
  /** The lane's fixed angle, in radians: up from flat, and off straight back (positive to the right). */
  elevation: number
  yaw: number
  /** Launch speed with the spring barely pulled, and pulled all the way. */
  minSpeed: number
  maxSpeed: number
  /** Seconds of holding to pull the spring all the way back. */
  chargeS: number
}

/** The glass ball, drawn around the coin; only the coin collides. */
export const GLASS_BALL_RADIUS = 0.6
/**
 * A ball this far off its predicted path has hit something: the pile, the
 * pusher, a wall. In free flight the prediction matches to ~1e-4.
 */
const OFF_PATH = 0.02
/** The share of the coin's speed that survives the break, so it drops where the ball broke. */
const SHATTER_KEEP = 0.3
/** A ball still whole after this long breaks anyway. */
const FLIGHT_TIMEOUT_S = 4
/** How long a break's shards are drawn. */
export const SHARDS_S = 0.9
/** The preview's landing: about where a coin meets the pusher's top. */
const LAND_Y = PUSHER_HEIGHT + PUCK_THICKNESS
/**
 * A good landing is on the strip of pusher top just in front of the back
 * wall, the strip the arm drops onto. Measured (6 games each): releasing only
 * when the ball comes down there on the beat scored 55, against 40 for
 * anywhere on the pusher's top on the beat (and 20 at random).
 */
const BACK_STRIP_Z = BACK_WALL_Z + 2
/** The ball's coin can't get nearer the glass than this. */
const GLASS_INSET = PUCK_RADIUS + 0.05

/** Where the predicted flight lands, and how long it takes. */
export type PlungerLanding = { x: number; z: number; fallS: number; atGlass: boolean }

/** A ball that broke: where, and when (physics time), for the rig to draw its shards. */
export type Shatter = Vec & { at: number; seed: number }

/** The launch velocity for a pull of `power`, 0 to 1. */
export function plungerVelocity(power: number, c: PlungerConfig): Vec {
  const speed = c.minSpeed + power * (c.maxSpeed - c.minSpeed)
  const flat = speed * Math.cos(c.elevation)
  return { x: flat * Math.sin(c.yaw), y: speed * Math.sin(c.elevation), z: -flat * Math.cos(c.yaw) }
}

/**
 * Whether a ball at `p` has reached the cabinet's sides or back. Above the
 * walls the cabinet is glass (drawn by the rig), so a ball the moon flings
 * high breaks on it instead of leaving the table.
 */
function atGlass(p: Vec): boolean {
  return Math.abs(p.x) > FIELD_HALF_WIDTH - GLASS_INSET || p.z < BACK_WALL_Z + GLASS_INSET
}

export class PlungerDelivery implements Delivery {
  readonly kind = 'plunger'
  mode: 'hold' | 'tap' = 'hold'
  /** Arm-clock time the press started pulling the spring, or null. */
  private pullingFrom: number | null = null
  /** The last launch's pull: the path shown before the next press. A first shot previews half. */
  private lastPower = 0.5
  /** Balls in the air: the coin's index, its predicted flight, and steps flown. */
  private flying: { index: number; path: Vec[]; steps: number }[] = []
  /** Recent breaks, newest last, kept while their shards are drawn. */
  shatters: Shatter[] = []
  private breaks = 0

  constructor(
    private readonly host: DeliveryHost,
    readonly config: PlungerConfig
  ) {}

  setMode(mode: 'hold' | 'tap') {
    this.mode = mode
  }

  /** How far the spring is pulled, 0 to 1, or null when it isn't. */
  get charge(): number | null {
    if (this.pullingFrom === null) return null
    const held = this.host.dropperTime - this.pullingFrom
    return Math.min(1, Math.max(0, held / this.config.chargeS))
  }

  /** The pull the preview shows: the live one while pulling, else the last launch's. */
  get shownPower(): number {
    return this.charge ?? this.lastPower
  }

  /** Coins in glass balls still flying, for the rig to draw a ball around. */
  get balls(): readonly number[] {
    return this.flying.map(f => f.index)
  }

  get busy(): number {
    return this.flying.length + (this.pullingFrom !== null ? 1 : 0)
  }

  /**
   * The flight a ball launched `aheadS` seconds from now at `power` would
   * take, bent by the moon, until it reaches the glass or the floor. Exact
   * until it touches something.
   */
  flight(power = this.shownPower, aheadS = 0, stop?: (p: Vec) => boolean): Vec[] {
    const host = this.host
    const m = host.stage.moon
    const dt = PHYSICS_STEP_S * host.speed
    const t0 = host.dropperTime + aheadS * host.speed
    const pull = m ? (p: Vec, k: number) => moonPull(p, moonAt(t0 + (k + 1) * dt, m), m) : undefined
    const end = stop ?? ((p: Vec) => p.y < 0 || atGlass(p))
    return flightPath(this.config.at, plungerVelocity(power, this.config), end, 300, pull)
  }

  /** The dotted preview: the flight until it lands on the pusher's height or meets the glass. */
  previewPath(power = this.shownPower, aheadS = 0): Vec[] {
    return this.flight(power, aheadS, p => p.y < LAND_Y || atGlass(p))
  }

  /** Where a ball launched `aheadS` from now at `power` would come down. */
  landing(power = this.shownPower, aheadS = 0): PlungerLanding {
    const path = this.previewPath(power, aheadS)
    const end = path[path.length - 1]
    return { x: end.x, z: end.z, fallS: (path.length - 1) * PHYSICS_STEP_S, atGlass: atGlass(end) }
  }

  /**
   * Whether a ball launched now (at the shown pull) would come down on the
   * back strip of the pusher's top while it's forward: bare shelf, the same
   * rule as the arm's cue, judged where and when the slung ball lands.
   */
  landsClear(power = this.shownPower, aheadS = 0): boolean {
    const l = this.landing(power, aheadS)
    return (
      l.z < BACK_STRIP_Z &&
      shelfOpenAt(this.host.engine.time + aheadS + l.fallS, this.host.engine.pusherPeriodS)
    )
  }

  input(e: DeliveryInput): boolean {
    if (e.type === 'press') {
      if (!this.host.canDrop) return false
      if (this.pullingFrom === null) {
        this.pullingFrom = this.host.dropperTime
        return true
      }
      return this.mode === 'tap' ? this.launch() : false
    }
    if (e.type === 'release') {
      return this.mode === 'hold' && this.pullingFrom !== null && this.launch()
    }
    return false
  }

  private launch(): boolean {
    if (this.pullingFrom === null || !this.host.canDrop) return false
    const power = this.charge ?? 0
    const onBeat = this.landsClear(power)
    const path = this.flight(power)
    const velocity = plungerVelocity(power, this.config)
    const index = this.host.launch({ ...this.config.at, velocity }, { onBeat })
    if (index === null) return false
    this.pullingFrom = null
    this.lastPower = power
    this.flying.push({ index, path, steps: 0 })
    return true
  }

  /** Breaks each ball that has touched something, met the glass, or flown too long. */
  step() {
    const engine = this.host.engine
    this.flying = this.flying.filter(ball => {
      const puck = engine.pucks[ball.index]
      if (!puck.active) return false
      ball.steps++
      const t = puck.body.translation()
      const p = { x: t.x, y: t.y, z: t.z }
      const expected = ball.path[Math.min(ball.steps, ball.path.length - 1)]
      const off = Math.hypot(p.x - expected.x, p.y - expected.y, p.z - expected.z)
      const glass = atGlass(p)
      const late = ball.steps * PHYSICS_STEP_S > FLIGHT_TIMEOUT_S
      if (off < OFF_PATH && !glass && !late && ball.steps < ball.path.length - 1) return true
      const v = puck.body.linvel()
      // Off the glass it bounces back in; anywhere, the break takes most of its speed.
      const vx =
        glass && Math.abs(p.x) > FIELD_HALF_WIDTH - GLASS_INSET
          ? -Math.abs(v.x) * Math.sign(p.x)
          : v.x
      const vz = glass && p.z < BACK_WALL_Z + GLASS_INSET ? Math.abs(v.z) : v.z
      if (glass) {
        const x = Math.max(-1, Math.min(1, p.x / (FIELD_HALF_WIDTH - GLASS_INSET)))
        puck.body.setTranslation(
          {
            x: x * (FIELD_HALF_WIDTH - GLASS_INSET),
            y: p.y,
            z: Math.max(p.z, BACK_WALL_Z + GLASS_INSET),
          },
          true
        )
      }
      puck.body.setLinvel(
        { x: vx * SHATTER_KEEP, y: Math.min(v.y, 0) * SHATTER_KEEP, z: vz * SHATTER_KEEP },
        true
      )
      this.shatter(p)
      return false
    })
    this.shatters = this.shatters.filter(s => engine.time - s.at < SHARDS_S)
  }

  private shatter(p: Vec) {
    this.shatters.push({ ...p, at: this.host.engine.time, seed: this.breaks++ })
  }
}
