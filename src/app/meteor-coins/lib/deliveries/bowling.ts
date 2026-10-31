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
 * instead of standing its ground. Pins knocked off the deck fall into the
 * pit or over the sides, onto the pusher, which carries them to the chute
 * like any other coin. A ball rolled wide drops into a gutter and runs past
 * the pins.
 *
 * Then the pinsetter does what a real one does: it lifts the pins still
 * standing, a bar sweeps the knocked-down coins on the deck into the pit,
 * and the standing pins come back down for the second ball. After the
 * second ball (or a strike) the pins left standing are lifted away for
 * good and a fresh rack comes down. A strike pours `strikeBonus` coins
 * into the pit, a spare `spareBonus`.
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
/** How long the pinsetter takes to lift (or lower) pins, and to sweep the deck. */
export const LIFT_S = 0.35
export const SWEEP_S = 1.2
/** How high the pinsetter lifts pins, above where they stand. */
export const LIFT_HEIGHT = 1.2
/**
 * The sweep bar: its height and depth, and where it starts in front of the
 * head pin. Tall enough to catch a knocked coin lying on top of others, not
 * only ones flat on the deck: a bar half as tall passed under them.
 */
export const BAR_HEIGHT = 0.65
export const BAR_DEPTH = 0.15
const BAR_LEAD = 1.4
/** The bar's weight per volume: about two, some fifteen coins' worth. */
const BAR_DENSITY = 6
/** The fastest the bar is driven to catch up with where it should be. */
const BAR_MAX_SPEED = 5
/** Where the bar waits, out of everything's way, between sweeps. */
const PARKED_Y = 30
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

/**
 * Where the sweep bar's middle is, `t` (0 to 1) of the way through a sweep:
 * from in front of the head pin to where its leading face meets the deck's
 * back edge. It stops there rather than reaching over the pit, where it
 * squeezed coins heaped up to the deck against the back wall and threw them
 * out of the cabinet.
 */
export function sweepBarZ(t: number, c: BowlingConfig): number {
  const from = c.headZ + BAR_LEAD
  const to = c.endZ + BAR_DEPTH / 2
  return from + (to - from) * t
}

/** How high the pinsetter holds its pins `t` seconds into a reset: up, held through the sweep, down. */
export function liftAt(t: number): number {
  if (t < LIFT_S) return Math.max(0, t / LIFT_S)
  if (t < LIFT_S + SWEEP_S) return 1
  return Math.max(0, 1 - (t - LIFT_S - SWEEP_S) / LIFT_S)
}

type Phase = 'ready' | 'rolling' | 'settling' | 'resetting'

/** A coin the pinsetter holds: where it stands on the deck, and its turn. */
type Held = { index: number; x: number; y: number; z: number; q: RAPIER.Rotation }

/** What the last finished ball did, for the scoreboard. */
export type Call = 'strike' | 'spare' | 'down' | 'gutter' | null

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
  phase: Phase = 'ready'
  /** When the current phase started (physics time). */
  phaseAt = 0
  /** Whether this reset ends the frame (fresh rack) or sets up the second ball. */
  private frameOver = false
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
  /** Coins the pinsetter holds up (standing pins between balls, or a fresh rack coming down). */
  held: Held[] = []
  /** The standing pins being lifted away for good at the end of a frame. */
  private retiring: Held[] = []
  readonly spots: PinSpot[]
  /** The coins each pin of the rack was set with (all of them, unless the pool ran short). */
  private pinHeights: number[]
  private readonly bar: RAPIER.RigidBody
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
    // The pinsetter's sweep bar. It's a heavy body driven along the deck,
    // not a kinematic one: a kinematic bar can't be stopped, and where the
    // pit had heaped up to the deck after a strike it crushed coins against
    // the back wall and threw them out of the cabinet. This one pushes about
    // fifteen coins' weight and stalls against anything more. It rides only
    // along the lane, upright, and sleeps out of the way between sweeps.
    this.bar = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, PARKED_Y, c.headZ)
        .setGravityScale(0)
        .lockRotations()
        .enabledTranslations(false, false, true)
        .setEnabled(false)
    )
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(c.halfWidth - 0.03, BAR_HEIGHT / 2, BAR_DEPTH / 2)
        .setFriction(0.2)
        .setDensity(BAR_DENSITY),
      this.bar
    )
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

  /** Where the sweep bar is along the deck, or null when it isn't sweeping. */
  get sweepZ(): number | null {
    return this.bar.isEnabled() ? this.bar.translation().z : null
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

  /** Once the deck is still, judges the ball and starts the pinsetter. */
  private waitForPins(events: GameEvent[]) {
    const t = this.host.engine.time - this.phaseAt
    if (t < SETTLE_MIN_S) return
    if (t < SETTLE_MAX_S && !this.deckStill()) return
    const before = this.pinsStanding
    this.standing = this.measurePins().map(pin => pin !== null)
    const after = this.pinsStanding
    this.lastKnocked = before - after
    this.pinsDown += this.lastKnocked
    const strike = this.ballInFrame === 1 && after === 0
    const spare = this.ballInFrame === 2 && after === 0
    const outOfBalls = !this.host.canDrop
    this.frameOver = strike || this.ballInFrame === 2
    if (strike) this.call('strike', this.config.strikeBonus, events)
    else if (spare) this.call('spare', this.config.spareBonus, events)
    else this.call(this.lastKnocked === 0 ? 'gutter' : 'down', 0, events)
    // After the last ball the deck is still swept, so every pin knocked
    // down reaches the pusher, but no fresh rack comes.
    if (outOfBalls) this.frameOver = false
    this.startReset()
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
      events.push({ type: 'callout', text: 'Gutter ball', announce: 'Gutter ball. No pins down.' })
    } else {
      events.push({
        type: 'callout',
        text: `${this.lastKnocked} down`,
        announce: `${this.lastKnocked} pins down.`,
      })
    }
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
   * first, with the bottom one flat on the deck where the pin was set.
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
    return this.spots.map((spot, i) => {
      if (!this.standing[i]) return null
      const stack = onDeck
        .filter(p => Math.hypot(p.x - spot.x, p.z - spot.z) < SPOT_TOLERANCE + 0.25)
        .sort((a, b) => a.y - b.y)
      const bottom = stack[0]
      if (!bottom) return null
      const flatOnDeck = Math.abs(bottom.y - (c.y + PUCK_THICKNESS / 2)) < 0.06
      const onSpot = Math.hypot(bottom.x - spot.x, bottom.z - spot.z) < SPOT_TOLERANCE
      if (!flatOnDeck || !onSpot || stack.length < this.pinHeights[i]) return null
      return stack.map(p => p.index)
    })
  }

  /**
   * The pinsetter starts: the standing pins go up, clear of the sweep. At
   * the end of a frame they're lifted away for good; otherwise they come
   * back down for the next ball.
   */
  private startReset() {
    const engine = this.host.engine
    const holds = this.measurePins()
      .flatMap(pin => pin ?? [])
      .map(index => {
        const body = engine.pucks[index].body
        const t = body.translation()
        body.setEnabled(false)
        return { index, x: t.x, y: t.y, z: t.z, q: body.rotation() }
      })
    if (this.frameOver) this.retiring = holds
    else this.held = holds
    this.setPhase('resetting')
  }

  /** One step of the pinsetter: lift, sweep, lower (or a fresh rack), then the ball comes back. */
  private runPinsetter() {
    const c = this.config
    const engine = this.host.engine
    // This step's time: the engine's clock moves on after beforeStep.
    const t = engine.time + PHYSICS_STEP_S - this.phaseAt
    const lift = liftAt(t)
    for (const h of [...this.held, ...this.retiring]) {
      const body = engine.pucks[h.index].body
      body.setTranslation({ x: h.x, y: h.y + lift * LIFT_HEIGHT, z: h.z }, false)
    }
    const sweepT = (t - LIFT_S) / SWEEP_S
    if (sweepT >= 0 && sweepT <= 1) {
      if (this.retiring.length) {
        // Lifted away for good: back to the pool.
        for (const h of this.retiring) {
          engine.pucks[h.index].body.setEnabled(true)
          engine.remove(h.index)
        }
        this.retiring = []
      }
      const z = sweepBarZ(sweepT, c)
      if (!this.bar.isEnabled()) {
        this.bar.setTranslation({ x: 0, y: c.y + BAR_HEIGHT / 2 + 0.01, z: sweepBarZ(0, c) }, true)
        this.bar.setEnabled(true)
      }
      // Driven toward where it should be by the end of this step.
      const at = this.bar.translation().z
      const vz = Math.max(-BAR_MAX_SPEED, Math.min(BAR_MAX_SPEED, (z - at) / PHYSICS_STEP_S))
      this.bar.setLinvel({ x: 0, y: 0, z: vz }, true)
      return
    }
    if (sweepT > 1 && this.bar.isEnabled()) {
      this.bar.setLinvel({ x: 0, y: 0, z: 0 }, false)
      this.bar.setTranslation({ x: 0, y: PARKED_Y, z: c.headZ }, false)
      this.bar.setEnabled(false)
      // A fresh rack comes down where the frame is over.
      if (this.frameOver) {
        this.setRack()
        this.frame++
        this.ballInFrame = 1
      } else {
        this.ballInFrame = 2
      }
    }
    if (t >= LIFT_S * 2 + SWEEP_S) {
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
