import RAPIER from '@dimforge/rapier3d-compat'

import {
  type Board,
  CUP_FLOOR,
  CUP_WALL,
  GATE_TRAVEL,
  sweeperX,
} from '@/app/meteor-coins/lib/board'
import {
  BACK_WALL_GAP,
  CHUTE_HALF_WIDTH,
  CLASSIC_LAYOUT,
  FIELD_HALF_WIDTH,
  type FallResult,
  GRAVITY,
  LINEAR_DAMPING,
  type Layout,
  PHYSICS_STEP_S,
  PUSHER_HEIGHT,
  PUSHER_MID_Z,
  PUSHER_PERIOD_S,
  WALL_HEIGHT,
  classifyFall,
  deckDir,
  deckPusherZ,
  deckStroke,
  fieldBackZ,
  fieldFrontZ,
  openDecks,
  pusherCenterZ,
  slotOf,
  topDeck,
} from '@/app/meteor-coins/lib/cabinet'
import {
  COIN,
  OBJECTS,
  type ObjectSpec,
  type Part,
  type Tone,
} from '@/app/meteor-coins/lib/objects'
import type { PuckPose } from '@/app/meteor-coins/lib/piles'
import { fallTimeToShelf, shelfOpenAt } from '@/app/meteor-coins/lib/timing'

/**
 * The pusher machine as plain physics, with no rendering and no game rules.
 *
 * Every game on this table is a set of rules layered over the same engine:
 * spawn pucks, step the world, hear about pucks that fall off the front.
 * Keeping it free of React means a whole game can run headless — in a test,
 * or in a tuning script — exactly as it runs on screen.
 */

let ready: Promise<void> | null = null

/** Loads the physics module. Safe to call repeatedly; it only loads once. */
export function initPhysics(): Promise<void> {
  ready ??= RAPIER.init()
  return ready
}

/** Special objects are placed by the pile and never recycled; the rest come from the pool. */
export type PuckKind = 'seed' | 'player' | 'bonus' | 'special'

export type Puck = {
  body: RAPIER.RigidBody
  active: boolean
  kind: PuckKind
  spec: ObjectSpec
}

/** z is where it fell; anything well behind the front edge went through the table. */
export type FallEvent = {
  index: number
  kind: PuckKind
  spec: ObjectSpec
  x: number
  z: number
  result: FallResult
}

/**
 * Pieces standing on the shelf. Most are fixed, in front of the pusher's
 * reach; one that `rides` is mounted on the pusher and moves with it, and its
 * `z` is where it stands with the pusher at the middle of its stroke.
 */
export type Obstacle = {
  x: number
  z: number
  height: number
  rides?: boolean
  /**
   * The phases it stands in, on a stage with phases (Comet Homecoming). It
   * rises out of the floor when its phase starts and sinks when it ends:
   * moved, never switched, so nothing resting on it gets launched.
   */
  phases?: readonly number[]
  /** Sweeps side to side across the shelf, by `ampX`, every `periodS`. */
  sweep?: { ampX: number; periodS: number }
  /** How bouncy it is, where it isn't dead (a tub's rubber rim). */
  restitution?: number
  /** What it's drawn in, if not the usual obstacle grey. */
  tone?: Tone
  /** Drawn as glass, like the side walls, so the table shows through it. */
  glass?: boolean
} &
  /** An upright round post. A post with a `tower` name is one a stack goal counts. */
  (| { type: 'post'; radius: number; tower?: string }
    /** A box on the shelf: a lane rail, a soap bar, a post's mounting. */
    | { type: 'block'; width: number; depth: number }
  )

/**
 * A drain in the floor: a square hole things fall through, with a
 * whirlpool around it. On a table with a drain, the drain is what scores;
 * anything that leaves any other way is lost.
 */
export type Drain = {
  x: number
  z: number
  /** The hole's side. */
  size: number
  /**
   * Within `radius` of the hole, things lying on the floor are pulled in
   * and swept around it, in units/s², strongest at the hole and fading to
   * nothing at the edge. Positive spin turns anticlockwise, seen from above.
   */
  swirl: { radius: number; pull: number; spin: number }
}

/** Where an obstacle stands at a moment, given the pusher's stroke. */
export function obstacleZ(o: Obstacle, timeS: number, pusherPeriodS: number): number {
  return o.rides ? o.z + pusherCenterZ(timeS, pusherPeriodS) - PUSHER_MID_Z : o.z
}

/**
 * Pucks are pooled: created once, parked disabled below the table, and
 * recycled when they fall. The cap is the performance budget — a random pile
 * doesn't reliably sleep, so plan for every puck being awake (~1.5ms/step at
 * 200 on an M-series Mac). Forcing pucks to sleep individually was tried and
 * rejected: it left pucks floating once the pile under them was pushed away.
 */
export const POOL_SIZE = 250
const PARK_Y = -50
/** A puck below this height has left the table. */
const FALLEN_Y = -1

export type EngineOptions = {
  /** What the pool holds: the object the arm drops, and the pile is mostly made of. */
  poolObject?: ObjectSpec
  /** Objects on the table at the start, at rest. Defaults to an empty table. */
  pile?: PuckPose[]
  /** Front edge within this half-width scores; outside it is gutter. */
  chuteHalfWidth?: number
  /** Seconds per full pusher stroke. */
  pusherPeriodS?: number
  obstacles?: readonly Obstacle[]
  /** A pachinko board over the drop line (see lib/board). */
  board?: Board
  /**
   * Shelf friction. Low makes it ice: whatever is knocked onto it slides
   * away. It overrides what's sliding on it rather than averaging with it.
   */
  floorFriction?: number
  /**
   * A forward pull, in units/s², on anything lying on the floor: the ice
   * slopes gently to the front, so whatever lands on it slides off.
   */
  floorDrift?: number
  /** The table's decks; one, unless a stage stacks them. */
  layout?: Layout
  /** A drain in the floor, which then does the scoring (Rubber Ducky Rumble). */
  drain?: Drain
}

/** Seconds for a pachinko board's gate to slide open or shut. */
const GATE_S = 0.12
/** Seconds for a phased obstacle to rise out of the floor or sink into it. */
const RISE_S = 0.8
/** How long the Last Push takes to reach full reach, and to ease off again. */
const PUSH_EASE_S = 0.6

/** An obstacle with motion of its own: it rises and sinks with the phases, or sweeps. */
type Mover = { o: Obstacle; body: RAPIER.RigidBody; raised: number; up: boolean }

/** Below this height an object is lying on the floor, for floorDrift. */
const ON_FLOOR_Y = 0.3
/**
 * Below this height a drain's whirlpool takes hold. Higher than floorDrift's,
 * since a big object rests with its center higher, but below anything
 * lying on top of another.
 */
const IN_WATER_Y = 0.45
/** A drain sucks down (units/s²) on anything over its hole lower than this. */
const DRAIN_SUCK = 40
const DRAIN_REACH_Y = 1.2

export class PusherEngine {
  readonly world: RAPIER.World
  readonly pucks: Puck[] = []
  readonly poolObject: ObjectSpec
  readonly chuteHalfWidth: number
  readonly pusherPeriodS: number
  readonly floorDrift: number
  readonly drain: Drain | null
  /** Seconds of simulated time. Advances only in step(). */
  time = 0

  readonly layout: Layout
  /** One per deck, bottom first. */
  private readonly pushers: RAPIER.RigidBody[]
  private free: number[] = []
  private readonly movers: Mover[] = []
  /** A pachinko board's gate, and the board, where it has one. */
  private gate: RAPIER.RigidBody | null = null
  private board: Board | null = null
  /** How open the gate is, 0 to 1. */
  private gateOpen = 0
  private readonly sweepers: { s: Board['sweepers'][number]; body: RAPIER.RigidBody }[] = []
  /** The Last Push: from when, until when, the pushers reach twice as far forward. */
  private push: { from: number; until: number } | null = null

  /** Call initPhysics() first. */
  constructor({
    poolObject = COIN,
    pile = [],
    chuteHalfWidth = CHUTE_HALF_WIDTH,
    pusherPeriodS = PUSHER_PERIOD_S,
    obstacles = [],
    board,
    floorFriction,
    floorDrift = 0,
    layout = CLASSIC_LAYOUT,
    drain,
  }: EngineOptions = {}) {
    this.layout = layout
    this.drain = drain ?? null
    this.poolObject = poolObject
    this.floorDrift = floorDrift
    this.chuteHalfWidth = chuteHalfWidth
    this.pusherPeriodS = pusherPeriodS
    const world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 })
    world.timestep = PHYSICS_STEP_S
    this.world = world

    const top = topDeck(layout)
    const backZ = fieldBackZ(layout)
    const frontZ = fieldFrontZ(layout)
    const fieldDepth = frontZ - backZ
    const fieldMidZ = (backZ + frontZ) / 2
    const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    const box = (
      hx: number,
      hy: number,
      hz: number,
      x: number,
      y: number,
      z: number,
      friction: number
    ) =>
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(friction),
        fixed
      )

    // One floor, or two either side of the slot when decks face each other.
    const slot = slotOf(layout)
    const floors = slot
      ? [
          [backZ, slot[0]],
          [slot[1], frontZ],
        ]
      : [[backZ, frontZ]]
    const floorBox = (x0: number, x1: number, z0: number, z1: number) => {
      const floor = box(
        (x1 - x0) / 2,
        0.25,
        (z1 - z0) / 2,
        (x0 + x1) / 2,
        -0.25,
        (z0 + z1) / 2,
        0.4
      )
      if (floorFriction !== undefined) {
        floor.setFriction(floorFriction)
        floor.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      }
    }
    for (const [from, to] of floors) {
      if (!drain) {
        floorBox(-FIELD_HALF_WIDTH, FIELD_HALF_WIDTH, from, to)
        continue
      }
      // A drain cuts a square hole: the floor in four pieces around it.
      const h = drain.size / 2
      floorBox(-FIELD_HALF_WIDTH, FIELD_HALF_WIDTH, from, drain.z - h)
      floorBox(-FIELD_HALF_WIDTH, FIELD_HALF_WIDTH, drain.z + h, to)
      floorBox(-FIELD_HALF_WIDTH, drain.x - h, drain.z - h, drain.z + h)
      floorBox(drain.x + h, FIELD_HALF_WIDTH, drain.z - h, drain.z + h)
    }
    const wallTop = top.floorY + WALL_HEIGHT
    for (const side of [-1, 1]) {
      box(
        0.25,
        wallTop / 2,
        fieldDepth / 2,
        side * (FIELD_HALF_WIDTH + 0.25),
        wallTop / 2,
        fieldMidZ,
        0.2
      )
    }
    // Back wall hangs just above the top pusher so riders get scraped off; a
    // reversed deck's wall does the same at the front.
    const wallBottom = top.floorY + PUSHER_HEIGHT + BACK_WALL_GAP
    const wallHeight = wallTop + 2 - wallBottom
    for (const deck of openDecks(layout)) {
      box(
        FIELD_HALF_WIDTH,
        wallHeight / 2,
        0.25,
        0,
        wallBottom + wallHeight / 2,
        deck.backZ - deckDir(deck) * 0.25,
        0.4
      )
    }
    // Each upper deck is a slab whose underside hangs just above the pusher
    // of the deck below, the way the back wall does, and runs to the back.
    for (let i = 1; i < layout.length; i++) {
      const under = layout[i - 1].floorY + PUSHER_HEIGHT + BACK_WALL_GAP
      const deck = layout[i]
      if (deck.floorY <= layout[i - 1].floorY) continue
      const thick = deck.floorY - under
      const depth = deck.frontZ - backZ
      box(FIELD_HALF_WIDTH, thick / 2, depth / 2, 0, under + thick / 2, backZ + depth / 2, 0.4)
    }

    // Fixed obstacles before the pusher, riders after: the order bodies are
    // made in changes how a pile settles, and the baked piles depend on it.
    const shapeOf = (o: Obstacle) => {
      const desc =
        o.type === 'post'
          ? RAPIER.ColliderDesc.cylinder(o.height / 2, o.radius).setFriction(0.6)
          : RAPIER.ColliderDesc.cuboid(o.width / 2, o.height / 2, o.depth / 2).setFriction(0.2)
      return o.restitution === undefined ? desc : desc.setRestitution(o.restitution)
    }
    const obstacle = (o: Obstacle, parent: RAPIER.RigidBody) => {
      // A rider's collider is fixed to the pusher, offset from its centre.
      const z = o.rides ? o.z - PUSHER_MID_Z : o.z
      const y = o.height / 2 - (o.rides ? PUSHER_HEIGHT / 2 : 0)
      world.createCollider(shapeOf(o).setTranslation(o.x, y, z), parent)
    }
    const moves = (o: Obstacle) => o.phases !== undefined || o.sweep !== undefined
    for (const o of obstacles) if (!o.rides && !moves(o)) obstacle(o, fixed)

    // Scripted motion and infinite mass: nothing pushes back on a pusher.
    this.pushers = layout.map(deck => {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          0,
          deck.floorY + PUSHER_HEIGHT / 2,
          deckPusherZ(deck, 0, pusherPeriodS)
        )
      )
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          FIELD_HALF_WIDTH - 0.02,
          PUSHER_HEIGHT / 2 - 0.005,
          deck.pusher.depth / 2
        ).setFriction(0.5),
        body
      )
      return body
    })
    // Riders mount on the bottom pusher.
    for (const o of obstacles) if (o.rides) obstacle(o, this.pushers[0])
    // Movers are bodies of their own, after everything else. They start in
    // phase 0: up if they stand in it, sunk below the floor if not.
    for (const o of obstacles.filter(moves)) {
      const up = o.phases?.includes(0) ?? true
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          o.x,
          moverY(o, up ? 1 : 0),
          o.z
        )
      )
      world.createCollider(shapeOf(o), body)
      this.movers.push({ o, body, raised: up ? 1 : 0, up })
    }

    if (board) {
      buildBoard(world, fixed, board)
      if (board.gated) {
        // A plate whose top is the board's bottom, across the bins.
        this.gate = world.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
            0,
            board.bottomY - 0.05,
            board.z
          )
        )
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(FIELD_HALF_WIDTH, 0.05, board.slot / 2 + 0.05).setFriction(
            0.3
          ),
          this.gate
        )
        this.board = board
      }
      for (const s of board.sweepers) {
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, s.y, board.z)
        )
        world.createCollider(
          RAPIER.ColliderDesc.cylinder(board.slot / 2, board.pinRadius * 1.5)
            .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
            .setFriction(0.2)
            .setRestitution(0.3),
          body
        )
        this.sweepers.push({ s, body })
      }
    }

    // Pool objects first, at the low indices; special objects after the pool.
    const pooled = pile.filter(pose => (pose.o ?? poolObject.id) === poolObject.id)
    const specials = pile.filter(pose => (pose.o ?? poolObject.id) !== poolObject.id)
    if (pooled.length > POOL_SIZE) {
      throw new Error(`Starting pile of ${pooled.length} exceeds the pool`)
    }
    for (let i = 0; i < POOL_SIZE; i++) {
      const seeded = pooled[i]
      this.pucks.push({
        body: this.createBody(poolObject, seeded, i),
        active: Boolean(seeded),
        kind: 'seed',
        spec: poolObject,
      })
      if (!seeded) this.free.push(i)
    }
    for (const pose of specials) {
      const spec = OBJECTS[pose.o as keyof typeof OBJECTS]
      if (!spec) throw new Error(`Unknown object "${pose.o}" in the starting pile`)
      this.addSpecial(spec, pose)
    }
    // Pop from the end, so hand out low indices first.
    this.free.reverse()
  }

  /** Puts a special object on the table. It isn't pooled: once it falls, it's gone. */
  addSpecial(spec: ObjectSpec, pose: PuckPose): number {
    const index = this.pucks.length
    this.pucks.push({
      body: this.createBody(spec, pose, index),
      active: true,
      kind: 'special',
      spec,
    })
    return index
  }

  private createBody(spec: ObjectSpec, pose: PuckPose | undefined, index: number) {
    const [qx, qy, qz, qw] = pose?.q ?? [0, 0, 0, 1]
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(...(pose?.p ?? [index * 2, PARK_Y, 0]))
        .setRotation({ x: qx, y: qy, z: qz, w: qw })
        .setLinearDamping(LINEAR_DAMPING)
        .setAngularDamping(0.4)
        .setCcdEnabled(true)
        .setEnabled(Boolean(pose))
    )
    for (const part of spec.parts) {
      if (part.visualOnly) continue
      const [x, y, z] = part.at ?? [0, 0, 0]
      this.world.createCollider(
        colliderFor(part)
          .setTranslation(x, y, z)
          .setDensity(spec.density)
          .setFriction(spec.friction)
          .setRestitution(spec.restitution),
        body
      )
    }
    return body
  }

  get freeCount() {
    return this.free.length
  }

  /** The bottom pusher's center z. */
  get pusherZ() {
    return this.pushers[0].translation().z
  }

  /** Each deck's pusher center z, bottom first. */
  pusherZs(): number[] {
    return this.pushers.map(p => p.translation().z)
  }

  /**
   * Wakes a pooled puck at a position, falling or (fired from a cannon)
   * flying. Returns its index, or null if the pool is empty.
   */
  spawn(
    x: number,
    y: number,
    z: number,
    kind: PuckKind,
    yaw = 0,
    velocity = { x: 0, y: -1, z: 0 },
    upright = false
  ): number | null {
    const index = this.free.pop()
    if (index === undefined) return null
    this.pucks[index].kind = kind
    this.wake(index, x, y, z, yaw, velocity, upright)
    return index
  }

  /**
   * Readies a special object off the table, to drop in later with place().
   * Made up front, so the renderer sees every object from the start.
   */
  addParked(spec: ObjectSpec): number {
    const index = this.pucks.length
    this.pucks.push({
      body: this.createBody(spec, undefined, index),
      active: false,
      kind: 'special',
      spec,
    })
    return index
  }

  /** Drops a parked special object in at a position, falling like a released coin. */
  place(index: number, x: number, y: number, z: number) {
    this.wake(index, x, y, z, 0, { x: 0, y: -1, z: 0 })
  }

  private wake(
    index: number,
    x: number,
    y: number,
    z: number,
    yaw: number,
    velocity: { x: number; y: number; z: number },
    upright = false
  ) {
    const puck = this.pucks[index]
    const half = yaw / 2
    puck.body.setTranslation({ x, y, z }, false)
    // Upright: stood on edge, facing the player, for a pachinko board's slot.
    puck.body.setRotation(
      upright
        ? { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }
        : { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) },
      false
    )
    puck.body.setLinvel(velocity, false)
    puck.body.setAngvel({ x: 0, y: 0, z: 0 }, false)
    puck.body.setEnabled(true)
    puck.body.wakeUp()
    puck.active = true
  }

  /** Advances one fixed step and returns the pucks that fell off during it. */
  /** Puts the cabinet in phase `phase`: obstacles rise or sink to match. */
  setPhase(phase: number) {
    for (const m of this.movers) m.up = m.o.phases?.includes(phase) ?? true
  }

  /** Gravity as a share of the usual (Comet Homecoming's low-gravity phase). */
  setGravityScale(scale: number) {
    this.world.gravity = { x: 0, y: GRAVITY * scale, z: 0 }
  }

  /** Doubles the pushers' forward reach for `seconds`, easing in and out. */
  lastPush(seconds: number) {
    this.push = { from: this.time, until: this.time + seconds }
  }

  /** Whether the Last Push is still running. */
  get pushing(): boolean {
    return this.push !== null && this.time < this.push.until
  }

  /** How much of the extra reach is in use now, 0 to 1. */
  private pushShare(): number {
    if (!this.push) return 0
    const t = this.time
    const ease = (x: number) => Math.min(1, Math.max(0, x / PUSH_EASE_S))
    const share = Math.min(ease(t - this.push.from), ease(this.push.until - t))
    // Smoothstep, so the pusher never jerks.
    return share * share * (3 - 2 * share)
  }

  /** Each phased or sweeping obstacle, where it is now (y is its center). */
  moverPositions(): { x: number; y: number; z: number }[] {
    return this.movers.map(m => m.body.translation())
  }

  step(): FallEvent[] {
    this.time += PHYSICS_STEP_S
    const share = this.pushShare()
    this.layout.forEach((deck, i) => {
      // The Last Push adds reach on the way forward only, so the back of the
      // pusher pulls no further back than usual.
      const stroke = deckStroke(deck, this.time, this.pusherPeriodS)
      const extra = (share * deck.pusher.ampZ * (1 + stroke)) / 2
      this.pushers[i].setNextKinematicTranslation({
        x: 0,
        y: deck.floorY + PUSHER_HEIGHT / 2,
        z: deckPusherZ(deck, this.time, this.pusherPeriodS) + deckDir(deck) * extra,
      })
    })
    for (const { s, body } of this.sweepers) {
      body.setNextKinematicTranslation({
        x: sweeperX(s, this.time),
        y: s.y,
        z: body.translation().z,
      })
    }
    if (this.gate && this.board) {
      // Open while a coin falling from the gate now would land on bare shelf.
      const fallS = fallTimeToShelf(this.board.bottomY)
      const open = shelfOpenAt(this.time + fallS, this.pusherPeriodS) ? 1 : 0
      const stepBy = PHYSICS_STEP_S / GATE_S
      this.gateOpen += Math.max(-stepBy, Math.min(stepBy, open - this.gateOpen))
      this.gate.setNextKinematicTranslation({
        x: 0,
        y: this.board.bottomY - 0.05,
        z: this.board.z - this.gateOpen * GATE_TRAVEL,
      })
    }
    for (const m of this.movers) {
      const toward = m.up ? 1 : 0
      const stepBy = PHYSICS_STEP_S / RISE_S
      m.raised += Math.max(-stepBy, Math.min(stepBy, toward - m.raised))
      const sweep = m.o.sweep
      const x = sweep
        ? m.o.x + sweep.ampX * Math.sin((2 * Math.PI * this.time) / sweep.periodS)
        : m.o.x
      m.body.setNextKinematicTranslation({ x, y: moverY(m.o, m.raised), z: m.o.z })
    }
    if (this.floorDrift) this.drift()
    if (this.drain) this.swirl(this.drain)
    this.world.step()

    const falls: FallEvent[] = []
    for (let i = 0; i < this.pucks.length; i++) {
      const puck = this.pucks[i]
      if (!puck.active) continue
      const p = puck.body.translation()
      if (p.y >= FALLEN_Y) continue
      falls.push({
        index: i,
        kind: puck.kind,
        spec: puck.spec,
        x: p.x,
        z: p.z,
        result: this.drain
          ? inDrain(this.drain, p.x, p.z)
            ? 'chute'
            : 'gutter'
          : classifyFall(p.x, this.chuteHalfWidth),
      })
      this.park(i)
    }
    return falls
  }

  private drift() {
    const dv = this.floorDrift * PHYSICS_STEP_S
    for (const puck of this.pucks) {
      if (!puck.active || puck.body.translation().y > ON_FLOOR_Y) continue
      const v = puck.body.linvel()
      puck.body.setLinvel({ x: v.x, y: v.y, z: v.z + dv }, true)
    }
  }

  /** The whirlpool: pulls whatever is in the water near the drain in, and around. */
  private swirl({ x, z, size, swirl }: Drain) {
    for (const puck of this.pucks) {
      if (!puck.active) continue
      const p = puck.body.translation()
      const dx = x - p.x
      const dz = z - p.z
      // Over the hole, the drain sucks down. Without it, two ducks could
      // wedge across the hole tipped on their sides and plug it for good
      // (sim: two games of ten in single figures).
      const over = Math.abs(dx) < size / 2 && Math.abs(dz) < size / 2
      if (over && p.y < DRAIN_REACH_Y) {
        const v = puck.body.linvel()
        puck.body.setLinvel({ x: v.x, y: v.y - DRAIN_SUCK * PHYSICS_STEP_S, z: v.z }, true)
      }
      if (p.y > IN_WATER_Y) continue
      const d = Math.hypot(dx, dz)
      if (d >= swirl.radius || d < 1e-6) continue
      const k = (1 - d / swirl.radius) * PHYSICS_STEP_S
      const ux = dx / d
      const uz = dz / d
      // In toward the hole, plus a quarter turn of that for the spin.
      const ax = swirl.pull * ux - swirl.spin * uz
      const az = swirl.pull * uz + swirl.spin * ux
      const v = puck.body.linvel()
      puck.body.setLinvel({ x: v.x + ax * k, y: v.y, z: v.z + az * k }, true)
    }
  }

  countActive() {
    let live = 0
    let asleep = 0
    for (const puck of this.pucks) {
      if (!puck.active) continue
      live++
      if (puck.body.isSleeping()) asleep++
    }
    return { live, asleep }
  }

  dispose() {
    this.world.free()
  }

  /** Takes an object off the table (caught in a cup, say); a pooled one goes back in the pool. */
  remove(index: number) {
    this.park(index)
  }

  private park(index: number) {
    const puck = this.pucks[index]
    puck.body.setEnabled(false)
    puck.body.setLinvel({ x: 0, y: 0, z: 0 }, false)
    puck.body.setAngvel({ x: 0, y: 0, z: 0 }, false)
    puck.body.setTranslation({ x: index * 2, y: PARK_Y, z: 0 }, false)
    puck.active = false
    if (puck.kind !== 'special') this.free.push(index)
  }
}

/** The board's pins, glass and cups, fixed to the cabinet. */
function buildBoard(world: RAPIER.World, fixed: RAPIER.RigidBody, board: Board) {
  const { z: midZ, slot: depth } = board
  // Rapier's cylinders stand along y; a quarter turn about x points them at the player.
  const along = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }
  for (const pin of board.pins) {
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(depth / 2, board.pinRadius)
        .setTranslation(pin.x, pin.y, midZ)
        .setRotation(along)
        .setFriction(0.2)
        .setRestitution(0.3),
      fixed
    )
  }
  const glassHeight = board.topY - board.bottomY
  for (const side of [-1, 1]) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(FIELD_HALF_WIDTH, glassHeight / 2, 0.05)
        .setTranslation(0, board.bottomY + glassHeight / 2, midZ + side * (depth / 2 + 0.05))
        .setFriction(0.05),
      fixed
    )
  }
  // Ends, where the board stands taller than the cabinet's side walls.
  for (const side of [-1, 1]) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.05, glassHeight / 2, depth / 2 + 0.1)
        .setTranslation(side * (FIELD_HALF_WIDTH + 0.05), board.bottomY + glassHeight / 2, midZ)
        .setFriction(0.1),
      fixed
    )
  }
  const dividerHeight = board.dividerTop - board.bottomY
  for (const x of board.dividers) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.04, dividerHeight / 2, depth / 2)
        .setTranslation(x, board.bottomY + dividerHeight / 2, midZ)
        .setFriction(0.3)
        .setRestitution(0.1),
      fixed
    )
  }
  for (const cup of board.cups) {
    const box = (hx: number, hy: number, x: number, y: number) =>
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, depth / 2)
          .setTranslation(x, y, midZ)
          .setFriction(0.5),
        fixed
      )
    box(cup.width / 2, CUP_FLOOR / 2, cup.x, cup.y + CUP_FLOOR / 2)
    for (const side of [-1, 1])
      box(0.04, CUP_WALL / 2, cup.x + (side * cup.width) / 2, cup.y + CUP_WALL / 2)
  }
}

/** Whether a point is over a drain's hole (with a little give: things fall in tipped). */
export function inDrain(drain: Drain, x: number, z: number): boolean {
  const reach = drain.size / 2 + 0.3
  return Math.abs(x - drain.x) < reach && Math.abs(z - drain.z) < reach
}

/** A mover's center height, from sunk just below the floor (0) to standing on it (1). */
function moverY(o: Obstacle, raised: number): number {
  return o.height / 2 - (1 - raised) * (o.height + 0.05)
}

function colliderFor(part: Part): RAPIER.ColliderDesc {
  switch (part.shape) {
    case 'cylinder':
      return RAPIER.ColliderDesc.cylinder(part.height / 2, part.radius)
    case 'box': {
      const [hx, hy, hz] = part.size.map(n => n / 2 - (part.rounding ?? 0))
      return part.rounding
        ? RAPIER.ColliderDesc.roundCuboid(hx, hy, hz, part.rounding)
        : RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    }
    case 'ball':
      return RAPIER.ColliderDesc.ball(part.radius)
    case 'arc':
      throw new Error('Arcs are drawn only; mark them visualOnly')
  }
}
