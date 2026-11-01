import RAPIER from '@dimforge/rapier3d-compat'

import { BACK_WALL_Z, PHYSICS_STEP_S, PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import type { Vec } from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'
import type { GameEvent } from '@/app/meteor-coins/lib/game'
import type { ObjectSpec } from '@/app/meteor-coins/lib/objects'
import { hoopHit } from '@/app/meteor-coins/lib/rules'

/**
 * Moonlight Lanes' bowling alley: a lane that floats over the middle of
 * the table, from just behind the lip to a pin deck over the pusher's top.
 * Six pins stand on the deck in a triangle, each a stack of real coins.
 *
 * Each coin buys a ball. The coin drops into the pit behind the deck (onto
 * the strip of pusher top the arm drops on elsewhere), and the ball rolls
 * down the lane where the player aimed it, as hard as they threw it. The
 * lane is slick, so a pin the ball hits slides and scatters into the others
 * instead of standing its ground. Only coins knocked off the deck pay: they
 * fall into the pit or over the sides, onto the pusher, which carries them
 * to the chute like any other coin. A ball rolled wide drops into a gutter
 * and runs past the pins.
 *
 * Every frame is two balls at the same rack, and nothing is swept between
 * them: a pin the first ball only topples lies on the deck for the second
 * ball to finish off. (A pinsetter's sweep used to push every toppled coin
 * into the pit, so a glancing hit paid the same as a crushing one and the
 * ball hardly mattered.) After the second ball the pinsetter lifts away
 * whatever is left on the lane, standing or lying, and a fresh rack comes
 * down. A strike (all six down on the first ball) pours `strikeBonus` coins
 * into the pit and a spare (the rest down on the second) `spareBonus`; the
 * second ball still rolls after a strike, at the coins the strike left.
 *
 * Controls: a swipe up the lane bowls — its direction is the aim and its
 * length the strength. On the keyboard the arrows turn the aim and holding
 * Space runs a strength meter up and down; letting go bowls. In tap mode a
 * first tap starts the meter (aiming at the pointer) and a second bowls.
 */
export type BowlingConfig = {
  /** Height of the lane's top. */
  y: number
  /** Half the lane's width; the gutters run outside it. */
  halfWidth: number
  /** The lane's near end, and where the ball waits on it. */
  frontZ: number
  ballZ: number
  /** The head pin's spot, and the back edge of the pin deck (the pit is behind it). */
  headZ: number
  endZ: number
  /** Coins in each pin's stack, and the distance between neighbouring pins' centres. */
  pinCoins: number
  pinSpacing: number
  /** Ball speed at the gentlest and the hardest roll. */
  minSpeed: number
  maxSpeed: number
  /** How far the aim turns off straight down the lane, either way (radians). */
  maxAim: number
  /** Seconds for the held strength meter to fill; it then falls back, and so on. */
  chargeS: number
  /**
   * How slick the polished lane is. It overrides what's on it (the lower of
   * the two counts), so a pin the ball hits slides away instead of standing
   * its ground.
   */
  friction: number
  /** Bonus coins poured into the pit for a strike, and for a spare. */
  strikeBonus: number
  spareBonus: number
}

export const BALL_RADIUS = 0.42

/**
 * The ball: a pale moon with three finger holes, about five pins'
 * weight. Lighter (6) and a hard ball sometimes bounced back off the rack;
 * heavier (12) and even a gentle roll knocked five pins, so strength
 * stopped mattering. At 7 a gentle roll takes 2–3 pins, a middling one 4–5,
 * and a hard one near the head pin strikes. It never reaches the chute: it
 * goes back to the foul line after each roll.
 */
export const MOON_BALL: ObjectSpec = {
  id: 'moon-ball',
  name: 'ball',
  plural: 'balls',
  parts: [
    { shape: 'ball', radius: BALL_RADIUS, tone: 'moonBall' },
    ...(
      [
        [0.11, 0.06],
        [-0.11, 0.06],
        [0, -0.13],
      ] as const
    ).map(([x, z]) => ({
      shape: 'ball' as const,
      radius: 0.075,
      at: [x, BALL_RADIUS - 0.045, z] as const,
      tone: 'fingerHole' as const,
      visualOnly: true,
    })),
  ],
  density: 7,
  friction: 0.3,
  restitution: 0.1,
  points: 0,
  refund: 0,
  reach: BALL_RADIUS,
}

/** Pins in the rack: a triangle of three rows. */
export const PIN_ROWS = 3
/** How long the pinsetter takes to lift (or lower) pins, and how long it holds them up between. */
export const LIFT_S = 0.35
export const HOLD_S = 0.3
/** How high the pinsetter lifts pins, above where they stand. */
export const LIFT_HEIGHT = 1.2
/** How far in front of the head pin the pinsetter's plate is drawn reaching (scene/BowlingRig). */
export const PLATE_LEAD = 1.4
/** How fast the arrows turn the aim, in radians per second. */
const AIM_RATE = 0.4
/** A swipe shorter than this (table units) is a tap, not a throw. */
export const MIN_SWIPE = 0.3
/** A swipe this long or longer is a full-strength throw. */
export const FULL_SWIPE = 3.3
/** The ball has stopped (a roll too gentle to reach the pins) below this speed, for this long. */
const STOPPED_SPEED = 0.15
const STOPPED_S = 0.5
/** A roll is called off after this long, wherever the ball is. */
const ROLL_TIMEOUT_S = 6
/** After the ball has gone, the pins get at least this long to fall, and at most this long. */
const SETTLE_MIN_S = 0.7
const SETTLE_MAX_S = 2.5
/** A coin on the deck slower than this has stopped falling. */
const STILL_SPEED = 0.25
/**
 * How far off its spot a pin's bottom coin can be and still stand there.
 * A pin stands only while its stack is whole, too: squat coin stacks rarely
 * tip over, but the ball punches coins out of them and the rest drops back
 * onto the spot, shorter. Counting that as standing (or a stack a coin
 * short) left a pin up after nearly every hit, and almost no strikes.
 */
const SPOT_TOLERANCE = 0.3
/** How far a coin can lean off the bottom coin's centre and still be part of its stack. */
const STACK_TOLERANCE = 0.3
/** How a gutter ball runs: sunk this far below the lane, at least this fast. */
const GUTTER_SINK = 0.25
const GUTTER_MIN_SPEED = 2.5
/** The gutters' width, outside the lane. */
export const GUTTER_WIDTH = 0.35
/** The kickbacks, the walls along the pin deck's sides: their height above the deck, and how far in front of the head pin they start. */
export const KICKBACK_HEIGHT = 1.4
export const KICKBACK_LEAD = 0.7
const KICKBACK_THICK = 0.12
/** How far the scoreboard sign over the pin deck reaches above the lane (scene/BowlingRig). */
export const SIGN_TOP = 2.1
/**
 * Collision groups (membership in the high 16 bits, what it meets in the
 * low). The ball meets everything but the kickbacks, so a ball rolled wide
 * runs off the edge into the gutter beside the deck, as on a real lane,
 * instead of glancing off a kickback into the pins. Coins meet everything.
 */
const BALL_GROUP = 0x0004
const KICKBACK_GROUP = 0x0002
const BALL_GROUPS = (BALL_GROUP << 16) | 0xffff
const KICKBACK_GROUPS = (KICKBACK_GROUP << 16) | (0xffff & ~BALL_GROUP)

export type PinSpot = { x: number; z: number }

/** The rack's spots, head pin first, row by row. */
export function pinSpots(c: BowlingConfig): PinSpot[] {
  const rowGap = (c.pinSpacing * Math.sqrt(3)) / 2
  const spots: PinSpot[] = []
  for (let r = 0; r < PIN_ROWS; r++) {
    for (let k = 0; k <= r; k++) {
      spots.push({ x: (k - r / 2) * c.pinSpacing, z: c.headZ - r * rowGap })
    }
  }
  return spots
}

/** The ball's speed for a throw of `power`, 0 to 1. */
export function ballSpeed(power: number, c: BowlingConfig): number {
  return c.minSpeed + Math.min(1, Math.max(0, power)) * (c.maxSpeed - c.minSpeed)
}

/** The ball's direction along the lane for an aim, as a unit vector on the table. */
export function aimDirection(aim: number): { x: number; z: number } {
  return { x: Math.sin(aim), z: -Math.cos(aim) }
}

/** The ping-pong strength meter, `heldS` seconds after it started: 0 up to 1 and back. */
export function meterAt(heldS: number, chargeS: number): number {
  const phase = (Math.max(0, heldS) / chargeS) % 2
  return phase <= 1 ? phase : 2 - phase
}

/**
 * A swipe from `from` to `to`, on the table: the aim along it and the
 * strength by its length. Null for a tap, or a swipe that doesn't go up
 * the lane.
 */
export function swipeShot(
  from: { x: number; z: number },
  to: { x: number; z: number },
  c: BowlingConfig
): { aim: number; power: number } | null {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const length = Math.hypot(dx, dz)
  if (length < MIN_SWIPE || dz >= 0) return null
  const aim = Math.max(-c.maxAim, Math.min(c.maxAim, Math.atan2(dx, -dz)))
  const power = Math.min(1, (length - MIN_SWIPE) / (FULL_SWIPE - MIN_SWIPE))
  return { aim, power }
}

/** How high the pinsetter holds its pins `t` seconds into a reset: up, held a moment, down. */
export function liftAt(t: number): number {
  if (t < LIFT_S) return Math.max(0, t / LIFT_S)
  if (t < LIFT_S + HOLD_S) return 1
  return Math.max(0, 1 - (t - LIFT_S - HOLD_S) / LIFT_S)
}

/** How long a reset takes: the old rack up, a moment held, the new one down. */
export const RESET_S = LIFT_S * 2 + HOLD_S

type Phase = 'ready' | 'rolling' | 'settling' | 'resetting'

/** A coin the pinsetter holds: where it stands on the deck, and its turn. */
type Held = { index: number; x: number; y: number; z: number; q: RAPIER.Rotation }

/**
 * What the last finished ball did, for the scoreboard: a strike or spare,
 * pins knocked down, coins knocked off the deck (with no pin to its name,
 * after a strike), or nothing.
 */
export type Call = 'strike' | 'spare' | 'down' | 'off' | 'gutter' | null

export class BowlingDelivery implements Delivery {
  readonly kind = 'bowling'
  mode: 'hold' | 'tap' = 'hold'
  /** The aim: radians off straight down the lane, positive to the right. */
  aim = 0
  /** The ball's index in the engine (a parked special). */
  readonly ball: number
  /** Which frame this is (from 1), and which ball of it is next (1 or 2). */
  frame = 1
  ballInFrame: 1 | 2 = 1
  /** Which of the rack's spots still have a pin standing. */
  standing: boolean[]
  /** The last finished frame's call, and when it was made (physics time). */
  lastCall: Call = null
  lastCallAt = -Infinity
  strikes = 0
  spares = 0
  /** The pins knocked down by the last ball, and by every ball so far. */
  lastKnocked = 0
  pinsDown = 0
  /** The coins the last ball knocked off the deck (onto the pusher), and every ball's so far. */
  lastOff = 0
  coinsOff = 0
  phase: Phase = 'ready'
  /** When the current phase started (physics time). */
  phaseAt = 0
  /** The coins on the lane when the ball was bowled: those gone at the end of the roll were knocked off. */
  private onLane = new Set<number>()
  /** The swipe in progress: where it started and where the pointer is now. */
  swipe: { from: { x: number; z: number }; to: { x: number; z: number } } | null = null
  /** When the held strength meter started (arm time), or null. */
  private chargingFrom: number | null = null
  private steerX = 0
  /** Physics steps so far, and the step the last pointer move arrived in. */
  private steps = 0
  private pointStep = -1
  private pointer: { x: number; z: number } | null = null
  /** The roll in progress: when it started, whether it's in a gutter, and how long it's been still. */
  private rollAt = 0
  private gutter: { side: number; speed: number } | null = null
  private stillFor = 0
  /** Coins the pinsetter holds up: a fresh rack coming down. */
  held: Held[] = []
  /** Whatever was left on the lane at the end of a frame, being lifted away for good. */
  private clearing: Held[] = []
  /** Whether this reset has swapped the old rack for a fresh one yet. */
  private racked = false
  readonly spots: PinSpot[]
  /** The coins each pin of the rack was set with (all of them, unless the pool ran short). */
  private pinHeights: number[]
  private pours = 0
  private paid = 0

  constructor(
    private readonly host: DeliveryHost,
    readonly config: BowlingConfig
  ) {
    const c = config
    this.spots = pinSpots(c)
    this.standing = this.spots.map(() => true)
    this.pinHeights = this.spots.map(() => c.pinCoins)
    const engine = host.engine
    const world = engine.world
    // The lane, deck and kickbacks are fixed to the cabinet, and made after
    // everything else so the pile loads exactly as it was baked. The lane
    // hangs over the shelf: its underside clears the heap beneath it.
    const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    const length = c.frontZ - c.endZ
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(c.halfWidth, 0.1, length / 2)
        .setTranslation(0, c.y - 0.1, c.endZ + length / 2)
        .setFriction(c.friction)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),
      fixed
    )
    const kickFrom = c.headZ + KICKBACK_LEAD
    for (const side of [-1, 1]) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(KICKBACK_THICK / 2, KICKBACK_HEIGHT / 2, (kickFrom - c.endZ) / 2)
          .setTranslation(
            side * (c.halfWidth + KICKBACK_THICK / 2),
            c.y + KICKBACK_HEIGHT / 2,
            (kickFrom + c.endZ) / 2
          )
          .setFriction(0.3)
          .setRestitution(0.3)
          .setCollisionGroups(KICKBACK_GROUPS),
        fixed
      )
    }
    this.ball = engine.addParked(MOON_BALL)
    engine.pucks[this.ball].body.collider(0).setCollisionGroups(BALL_GROUPS)
    this.returnBall()
    this.setRack()
    this.release()
  }

  setMode(mode: 'hold' | 'tap') {
    this.mode = mode
    this.chargingFrom = null
    this.swipe = null
  }

  /** Whether the ball is at the foul line and a coin can buy it. */
  get ready(): boolean {
    return this.phase === 'ready' && this.host.canDrop
  }

  /** The strength meter now (held Space, or tap mode), or null when it isn't running. */
  get meter(): number | null {
    if (this.chargingFrom === null) return null
    return meterAt(this.host.dropperTime - this.chargingFrom, this.config.chargeS)
  }

  /** The throw being lined up now: the swipe in progress, else the aim and the meter. */
  get preview(): { aim: number; power: number | null } {
    if (this.swipe) {
      const shot = swipeShot(this.swipe.from, this.swipe.to, this.config)
      return shot ?? { aim: this.aim, power: null }
    }
    return { aim: this.aim, power: this.meter }
  }

  /** How high the pinsetter holds its pins now, 0 (down on the deck) to 1. */
  get lift(): number {
    return this.phase === 'resetting' ? liftAt(this.host.engine.time - this.phaseAt) : 0
  }

  /** The pins standing now, counted. */
  get pinsStanding(): number {
    return this.standing.filter(Boolean).length
  }

  get busy(): number {
    return this.phase === 'ready' ? 0 : 1
  }

  /** Bonus coins pour into the pit, stepping across it. */
  bonusAt(): Vec {
    return this.overPit(this.pours++)
  }

  /**
   * The `n`th spot coins drop into the pit from, stepping across it: from
   * above the deck, so they're seen falling even where the deck hides the
   * pit's floor. (Beside the lane, in plain view, they fell in line with
   * the gutters and were mostly lost.)
   */
  private overPit(n: number): Vec {
    return { x: 1.1 * Math.sin(n * 2.4), y: this.config.y + 1.2, z: this.pitZ }
  }

  /** The middle of the pit, between the deck's back edge and the back wall. */
  get pitZ(): number {
    return (this.config.endZ + BACK_WALL_Z) / 2
  }

  input(e: DeliveryInput): boolean {
    if (e.type === 'point') {
      this.pointer = { x: e.x, z: e.z }
      this.pointStep = this.steps
      if (this.swipe) this.swipe.to = { x: e.x, z: e.z }
      else if (this.mode === 'tap') this.aimAt(e)
      return false
    }
    if (e.type === 'steer') {
      this.steerX = e.x
      return false
    }
    if (e.type === 'press') {
      if (!this.ready) return false
      if (this.mode === 'tap') {
        if (this.chargingFrom === null) {
          this.chargingFrom = this.host.dropperTime
          return true
        }
        return this.bowl(this.meter ?? 0)
      }
      // A press that came with a pointer move is the start of a swipe; one
      // that didn't (Space) starts the strength meter.
      if (this.pointStep === this.steps && this.pointer) {
        this.swipe = { from: { ...this.pointer }, to: { ...this.pointer } }
        return true
      }
      this.chargingFrom = this.host.dropperTime
      return true
    }
    // Release.
    if (this.mode === 'tap') return false
    if (this.swipe) {
      const { from, to } = this.swipe
      this.swipe = null
      const shot = swipeShot(from, to, this.config)
      if (!shot) return false
      this.aim = shot.aim
      return this.bowl(shot.power)
    }
    if (this.chargingFrom !== null) return this.bowl(this.meter ?? 0)
    return false
  }

  /** Points the aim from the ball at a spot on the table, where that's up the lane. */
  private aimAt(p: { x: number; z: number }) {
    const dz = this.config.ballZ - p.z
    if (dz <= 0.3) return
    const a = Math.atan2(p.x, dz)
    this.aim = Math.max(-this.config.maxAim, Math.min(this.config.maxAim, a))
  }

  /** Sends the ball down the lane at `power`, along the aim, paying a coin into the pit. */
  bowl(power: number): boolean {
    this.chargingFrom = null
    if (!this.ready) return false
    const c = this.config
    // The coin it costs drops into the pit.
    const index = this.host.launch(
      { ...this.overPit(this.paid), velocity: { x: 0, y: 0, z: 0 } },
      {}
    )
    if (index === null) return false
    this.paid++
    this.onLane = new Set(this.coinsOnLane())
    const speed = ballSpeed(power, c)
    const d = aimDirection(this.aim)
    const body = this.host.engine.pucks[this.ball].body
    body.setLinvel({ x: d.x * speed, y: 0, z: d.z * speed }, true)
    // Rolling, not skidding: spin to match the speed (ω = up × v / r).
    body.setAngvel({ x: (d.z * speed) / BALL_RADIUS, y: 0, z: (-d.x * speed) / BALL_RADIUS }, true)
    this.setPhase('rolling')
    this.rollAt = this.host.engine.time
    this.stillFor = 0
    this.gutter = null
    return true
  }

  private setPhase(phase: Phase) {
    this.phase = phase
    this.phaseAt = this.host.engine.time
  }

  beforeStep() {
    this.steps++
    const dt = PHYSICS_STEP_S * this.host.speed
    if (this.steerX !== 0 && this.phase !== 'rolling') {
      const c = this.config
      this.aim = Math.max(-c.maxAim, Math.min(c.maxAim, this.aim + this.steerX * AIM_RATE * dt))
    }
    if (this.phase === 'resetting') this.runPinsetter()
  }

  step(events: GameEvent[]) {
    if (this.phase === 'rolling') this.followBall()
    else if (this.phase === 'settling') this.waitForPins(events)
  }

  /** Watches the ball down the lane until it drops into the pit, runs out a gutter, or stops. */
  private followBall() {
    const c = this.config
    const engine = this.host.engine
    const body = engine.pucks[this.ball].body
    const p = body.translation()
    const v = body.linvel()
    const elapsed = engine.time - this.rollAt
    if (this.gutter) {
      body.setLinvel({ x: 0, y: 0, z: -this.gutter.speed }, true)
      if (p.z < c.endZ - 0.4 || elapsed > ROLL_TIMEOUT_S) this.ballGone()
      return
    }
    // Off the side of the lane: into the gutter. It runs on past the pins
    // (as a ghost, touching nothing) and into the pit.
    if (Math.abs(p.x) > c.halfWidth) {
      const side = Math.sign(p.x)
      this.gutter = { side, speed: Math.max(GUTTER_MIN_SPEED, -v.z) }
      body.collider(0).setCollisionGroups(0)
      body.setGravityScale(0, true)
      body.setTranslation(
        { x: side * (c.halfWidth + GUTTER_WIDTH / 2), y: c.y + BALL_RADIUS - GUTTER_SINK, z: p.z },
        true
      )
      body.setAngvel({ x: -this.gutter.speed / BALL_RADIUS, y: 0, z: 0 }, true)
      return
    }
    // Stopped, or bounced back off the pins toward the player: either way
    // the roll is over (a ball never comes back down a real lane).
    const speed = Math.hypot(v.x, v.z)
    const done = speed < STOPPED_SPEED || v.z > STOPPED_SPEED
    this.stillFor = done ? this.stillFor + PHYSICS_STEP_S : 0
    const inPit = p.z < c.endZ || p.y < c.y - 0.2
    if (inPit || this.stillFor > STOPPED_S || elapsed > ROLL_TIMEOUT_S) this.ballGone()
  }

  /** The ball has finished its roll: back to the return, and the pins have a moment to fall. */
  private ballGone() {
    this.host.engine.remove(this.ball)
    const body = this.host.engine.pucks[this.ball].body
    body.collider(0).setCollisionGroups(BALL_GROUPS)
    body.setGravityScale(1, false)
    this.setPhase('settling')
  }

  /**
   * Once the deck is still, judges the ball. After the first ball of a
   * frame the ball comes straight back, to the same rack and whatever the
   * first ball left lying; after the second the pinsetter clears the lane
   * and sets a fresh rack (unless that was the last ball: then there's
   * nothing more to set).
   */
  private waitForPins(events: GameEvent[]) {
    const t = this.host.engine.time - this.phaseAt
    if (t < SETTLE_MIN_S) return
    if (t < SETTLE_MAX_S && !this.deckStill()) return
    const before = this.pinsStanding
    this.standing = this.measurePins().map(pin => pin !== null)
    const after = this.pinsStanding
    this.lastKnocked = before - after
    this.pinsDown += this.lastKnocked
    const still = new Set(this.coinsOnLane())
    this.lastOff = [...this.onLane].filter(i => !still.has(i)).length
    this.coinsOff += this.lastOff
    const strike = this.ballInFrame === 1 && after === 0
    const spare = this.ballInFrame === 2 && before > 0 && after === 0
    if (strike) this.call('strike', this.config.strikeBonus, events)
    else if (spare) this.call('spare', this.config.spareBonus, events)
    else if (this.lastKnocked > 0) this.call('down', 0, events)
    else if (this.lastOff > 0) this.call('off', 0, events)
    else this.call('gutter', 0, events)
    if (this.ballInFrame === 1) {
      this.ballInFrame = 2
      this.returnBall()
      this.setPhase('ready')
    } else if (this.host.canDrop) {
      this.startReset()
    } else {
      this.setPhase('ready')
    }
  }

  private call(call: Call, bonus: number, events: GameEvent[]) {
    this.lastCall = call
    this.lastCallAt = this.host.engine.time
    if (call === 'strike') this.strikes++
    if (call === 'spare') this.spares++
    if (bonus > 0) this.host.state = hoopHit(this.host.state, bonus)
    if (call === 'strike' || call === 'spare') {
      const word = call === 'strike' ? 'Strike!' : 'Spare!'
      events.push({
        type: 'callout',
        text: `${word} +${bonus} coins`,
        announce: `${word} ${bonus} bonus coins.`,
      })
    } else if (call === 'gutter') {
      events.push({ type: 'callout', text: 'Gutter ball', announce: 'Gutter ball. Nothing down.' })
    } else if (call === 'off') {
      const n = this.lastOff
      events.push({
        type: 'callout',
        text: `${n} ${n === 1 ? 'coin' : 'coins'} off`,
        announce: `${n} ${n === 1 ? 'coin' : 'coins'} knocked off the deck.`,
      })
    } else {
      events.push({
        type: 'callout',
        text: `${this.lastKnocked} down`,
        announce: `${this.lastKnocked} pins down.`,
      })
    }
  }

  /** The coins on the lane now (standing or lying, anywhere on it), by index. */
  private coinsOnLane(): number[] {
    const c = this.config
    const on: number[] = []
    this.host.engine.pucks.forEach((puck, index) => {
      if (!puck.active || index === this.ball || !puck.body.isEnabled()) return
      const p = puck.body.translation()
      if (p.y > c.y && Math.abs(p.x) < c.halfWidth && p.z > c.endZ && p.z < c.frontZ) on.push(index)
    })
    return on
  }

  /** Whether every coin on the deck has stopped moving. */
  private deckStill(): boolean {
    const c = this.config
    for (const [i, puck] of this.host.engine.pucks.entries()) {
      if (!puck.active || i === this.ball) continue
      const p = puck.body.translation()
      if (p.y < c.y || Math.abs(p.x) > c.halfWidth || p.z < c.endZ || p.z > c.frontZ) continue
      const v = puck.body.linvel()
      if (Math.hypot(v.x, v.y, v.z) > STILL_SPEED) return false
    }
    return true
  }

  /**
   * Each spot's pin, if it's still standing: the coins stacked on it, bottom
   * first, with the bottom one flat on the deck where the pin was set. A
   * coin lying loose beside a pin (nothing clears the deck between a
   * frame's two balls) is neither its bottom nor part of its stack.
   */
  measurePins(): (number[] | null)[] {
    const c = this.config
    const onDeck: { index: number; x: number; y: number; z: number }[] = []
    this.host.engine.pucks.forEach((puck, index) => {
      if (!puck.active || index === this.ball || !puck.body.isEnabled()) return
      const p = puck.body.translation()
      if (p.y < c.y || p.y > c.y + (c.pinCoins + 2) * PUCK_THICKNESS) return
      const r = puck.body.rotation()
      // The coin's up axis, tipped: flat coins only.
      const upY = 1 - 2 * (r.x * r.x + r.z * r.z)
      if (Math.abs(upY) < 0.9) return
      onDeck.push({ index, x: p.x, y: p.y, z: p.z })
    })
    onDeck.sort((a, b) => a.y - b.y)
    return this.spots.map((spot, i) => {
      if (!this.standing[i]) return null
      const bottom = onDeck.find(
        p =>
          Math.abs(p.y - (c.y + PUCK_THICKNESS / 2)) < 0.06 &&
          Math.hypot(p.x - spot.x, p.z - spot.z) < SPOT_TOLERANCE
      )
      if (!bottom) return null
      const stack = onDeck.filter(
        p => p.y >= bottom.y - 0.01 && Math.hypot(p.x - bottom.x, p.z - bottom.z) < STACK_TOLERANCE
      )
      if (stack.length < this.pinHeights[i]) return null
      return stack.map(p => p.index)
    })
  }

  /**
   * The frame is over: the pinsetter takes hold of everything left on the
   * lane, standing pins and lying coins alike, to lift it away for good.
   */
  private startReset() {
    const engine = this.host.engine
    this.clearing = this.coinsOnLane().map(index => {
      const body = engine.pucks[index].body
      const t = body.translation()
      body.setEnabled(false)
      return { index, x: t.x, y: t.y, z: t.z, q: body.rotation() }
    })
    this.racked = false
    this.setPhase('resetting')
  }

  /** One step of the pinsetter: the old rack up and away, a fresh one down, then the ball comes back. */
  private runPinsetter() {
    const engine = this.host.engine
    // This step's time: the engine's clock moves on after beforeStep.
    const t = engine.time + PHYSICS_STEP_S - this.phaseAt
    const lift = liftAt(t)
    if (t >= LIFT_S && !this.racked) {
      // Lifted away for good: back to the pool. The fresh rack takes its place, held up.
      for (const h of this.clearing) {
        engine.pucks[h.index].body.setEnabled(true)
        engine.remove(h.index)
      }
      this.clearing = []
      this.racked = true
      this.setRack()
      this.frame++
      this.ballInFrame = 1
    }
    for (const h of [...this.held, ...this.clearing]) {
      const body = engine.pucks[h.index].body
      body.setTranslation({ x: h.x, y: h.y + lift * LIFT_HEIGHT, z: h.z }, false)
    }
    if (t >= RESET_S) {
      this.release()
      this.returnBall()
      this.setPhase('ready')
    }
  }

  /**
   * A fresh rack: each pin's coins spawned in place and held up by the
   * pinsetter, to come down with the lift. Short of coins in the pool (a
   * long run of strikes can pile the pusher high), a pin gets what's left,
   * and stands as long as that much of it does; a spot left empty has no
   * pin.
   */
  private setRack() {
    const c = this.config
    const engine = this.host.engine
    this.held = []
    this.pinHeights = this.spots.map((spot, s) => {
      let set = 0
      for (let k = 0; k < c.pinCoins; k++) {
        const y = c.y + PUCK_THICKNESS / 2 + k * PUCK_THICKNESS
        const yaw = (s * 7 + k * 3) * 0.7
        const index = engine.spawn(spot.x, y + LIFT_HEIGHT, spot.z, 'seed', yaw, {
          x: 0,
          y: 0,
          z: 0,
        })
        if (index === null) break
        const body = engine.pucks[index].body
        body.setEnabled(false)
        this.held.push({ index, x: spot.x, y, z: spot.z, q: body.rotation() })
        set++
      }
      return set
    })
    this.standing = this.pinHeights.map(n => n > 0)
  }

  /** Sets the held coins down on the deck, at rest, and lets go of them. */
  private release() {
    const engine = this.host.engine
    for (const h of this.held) {
      const body = engine.pucks[h.index].body
      body.setTranslation({ x: h.x, y: h.y, z: h.z }, false)
      body.setRotation(h.q, false)
      body.setLinvel({ x: 0, y: 0, z: 0 }, false)
      body.setAngvel({ x: 0, y: 0, z: 0 }, false)
      body.setEnabled(true)
    }
    this.held = []
  }

  /** The ball back at the foul line, at rest. */
  private returnBall() {
    const c = this.config
    const engine = this.host.engine
    engine.place(this.ball, 0, c.y + BALL_RADIUS + 0.005, c.ballZ)
    const body = engine.pucks[this.ball].body
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }
}
