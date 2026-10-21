import RAPIER from '@dimforge/rapier3d-compat'

import {
  BACK_WALL_GAP,
  CHUTE_HALF_WIDTH,
  CLASSIC_LAYOUT,
  FIELD_HALF_WIDTH,
  type FallResult,
  GRAVITY,
  type Layout,
  PHYSICS_STEP_S,
  PUSHER_HEIGHT,
  PUSHER_MID_Z,
  PUSHER_PERIOD_S,
  WALL_HEIGHT,
  classifyFall,
  deckDir,
  deckPusherZ,
  fieldBackZ,
  fieldFrontZ,
  openDecks,
  pusherCenterZ,
  slotOf,
  topDeck,
} from '@/app/meteor-coins/lib/cabinet'
import { COIN, OBJECTS, type ObjectSpec, type Part } from '@/app/meteor-coins/lib/objects'
import type { PuckPose } from '@/app/meteor-coins/lib/piles'

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
export type Obstacle = { x: number; z: number; height: number; rides?: boolean } &
  /** An upright round post. A post with a `tower` name is one a stack goal counts. */
  (| { type: 'post'; radius: number; tower?: string }
    /** A box on the shelf: a lane rail, a soap bar, a post's mounting. */
    | { type: 'block'; width: number; depth: number }
  )

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
}

/** Below this height an object is lying on the floor, for floorDrift. */
const ON_FLOOR_Y = 0.3

export class PusherEngine {
  readonly world: RAPIER.World
  readonly pucks: Puck[] = []
  readonly poolObject: ObjectSpec
  readonly chuteHalfWidth: number
  readonly pusherPeriodS: number
  readonly floorDrift: number
  /** Seconds of simulated time. Advances only in step(). */
  time = 0

  readonly layout: Layout
  /** One per deck, bottom first. */
  private readonly pushers: RAPIER.RigidBody[]
  private free: number[] = []

  /** Call initPhysics() first. */
  constructor({
    poolObject = COIN,
    pile = [],
    chuteHalfWidth = CHUTE_HALF_WIDTH,
    pusherPeriodS = PUSHER_PERIOD_S,
    obstacles = [],
    floorFriction,
    floorDrift = 0,
    layout = CLASSIC_LAYOUT,
  }: EngineOptions = {}) {
    this.layout = layout
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
    for (const [from, to] of floors) {
      const floor = box(FIELD_HALF_WIDTH, 0.25, (to - from) / 2, 0, -0.25, (from + to) / 2, 0.4)
      if (floorFriction !== undefined) {
        floor.setFriction(floorFriction)
        floor.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      }
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
    const obstacle = (o: Obstacle, parent: RAPIER.RigidBody) => {
      // A rider's collider is fixed to the pusher, offset from its centre.
      const z = o.rides ? o.z - PUSHER_MID_Z : o.z
      const y = o.height / 2 - (o.rides ? PUSHER_HEIGHT / 2 : 0)
      const shape =
        o.type === 'post'
          ? RAPIER.ColliderDesc.cylinder(o.height / 2, o.radius).setFriction(0.6)
          : RAPIER.ColliderDesc.cuboid(o.width / 2, o.height / 2, o.depth / 2).setFriction(0.2)
      world.createCollider(shape.setTranslation(o.x, y, z), parent)
    }
    for (const o of obstacles) if (!o.rides) obstacle(o, fixed)

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
        .setLinearDamping(0.1)
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

  /** Wakes a pooled puck at a position. Returns its index, or null if the pool is empty. */
  spawn(x: number, y: number, z: number, kind: PuckKind, yaw = 0): number | null {
    const index = this.free.pop()
    if (index === undefined) return null
    const puck = this.pucks[index]
    const half = yaw / 2
    puck.body.setTranslation({ x, y, z }, false)
    puck.body.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }, false)
    puck.body.setLinvel({ x: 0, y: -1, z: 0 }, false)
    puck.body.setAngvel({ x: 0, y: 0, z: 0 }, false)
    puck.body.setEnabled(true)
    puck.body.wakeUp()
    puck.active = true
    puck.kind = kind
    return index
  }

  /** Advances one fixed step and returns the pucks that fell off during it. */
  step(): FallEvent[] {
    this.time += PHYSICS_STEP_S
    this.layout.forEach((deck, i) =>
      this.pushers[i].setNextKinematicTranslation({
        x: 0,
        y: deck.floorY + PUSHER_HEIGHT / 2,
        z: deckPusherZ(deck, this.time, this.pusherPeriodS),
      })
    )
    if (this.floorDrift) this.drift()
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
        result: classifyFall(p.x, this.chuteHalfWidth),
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
