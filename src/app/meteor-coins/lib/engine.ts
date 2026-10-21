import RAPIER from '@dimforge/rapier3d-compat'

import {
  BACK_WALL_GAP,
  BACK_WALL_Z,
  CHUTE_HALF_WIDTH,
  FIELD_BACK_Z,
  FIELD_FRONT_Z,
  FIELD_HALF_WIDTH,
  type FallResult,
  GRAVITY,
  PHYSICS_STEP_S,
  PUCK_RADIUS,
  PUCK_THICKNESS,
  PUSHER_DEPTH,
  PUSHER_HEIGHT,
  PUSHER_PERIOD_S,
  type PuckShape,
  SQUARE_SIDE,
  WALL_HEIGHT,
  classifyFall,
  pusherCenterZ,
} from '@/app/meteor-coins/lib/cabinet'
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

export type PuckKind = 'seed' | 'player' | 'bonus'

export type Puck = {
  body: RAPIER.RigidBody
  active: boolean
  kind: PuckKind
}

/** z is where it fell; anything well behind the front edge went through the table. */
export type FallEvent = { index: number; kind: PuckKind; x: number; z: number; result: FallResult }

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
  shape?: PuckShape
  /** Coins on the table at the start, at rest. Defaults to an empty table. */
  pile?: PuckPose[]
  /** Front edge within this half-width scores; outside it is gutter. */
  chuteHalfWidth?: number
  /** Seconds per full pusher stroke. */
  pusherPeriodS?: number
}

export class PusherEngine {
  readonly world: RAPIER.World
  readonly pucks: Puck[] = []
  readonly shape: PuckShape
  readonly chuteHalfWidth: number
  readonly pusherPeriodS: number
  /** Seconds of simulated time. Advances only in step(). */
  time = 0

  private readonly pusher: RAPIER.RigidBody
  private free: number[] = []

  /** Call initPhysics() first. */
  constructor({
    shape = 'round',
    pile = [],
    chuteHalfWidth = CHUTE_HALF_WIDTH,
    pusherPeriodS = PUSHER_PERIOD_S,
  }: EngineOptions = {}) {
    this.shape = shape
    this.chuteHalfWidth = chuteHalfWidth
    this.pusherPeriodS = pusherPeriodS
    const world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 })
    world.timestep = PHYSICS_STEP_S
    this.world = world

    const fieldDepth = FIELD_FRONT_Z - FIELD_BACK_Z
    const fieldMidZ = (FIELD_BACK_Z + FIELD_FRONT_Z) / 2
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

    box(FIELD_HALF_WIDTH, 0.25, fieldDepth / 2, 0, -0.25, fieldMidZ, 0.4)
    for (const side of [-1, 1]) {
      box(
        0.25,
        WALL_HEIGHT / 2,
        fieldDepth / 2,
        side * (FIELD_HALF_WIDTH + 0.25),
        WALL_HEIGHT / 2,
        fieldMidZ,
        0.2
      )
    }
    // Back wall hangs just above the pusher top so riders get scraped off.
    const wallBottom = PUSHER_HEIGHT + BACK_WALL_GAP
    const wallHeight = WALL_HEIGHT + 2 - wallBottom
    box(
      FIELD_HALF_WIDTH,
      wallHeight / 2,
      0.25,
      0,
      wallBottom + wallHeight / 2,
      BACK_WALL_Z - 0.25,
      0.4
    )

    // Scripted motion and infinite mass: nothing pushes back on the pusher.
    this.pusher = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        0,
        PUSHER_HEIGHT / 2,
        pusherCenterZ(0)
      )
    )
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        FIELD_HALF_WIDTH - 0.02,
        PUSHER_HEIGHT / 2 - 0.005,
        PUSHER_DEPTH / 2
      ).setFriction(0.5),
      this.pusher
    )

    if (pile.length > POOL_SIZE) throw new Error(`Starting pile of ${pile.length} exceeds the pool`)
    for (let i = 0; i < POOL_SIZE; i++) {
      const seeded = pile[i]
      const [qx, qy, qz, qw] = seeded?.q ?? [0, 0, 0, 1]
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(...(seeded?.p ?? [i * 2, PARK_Y, 0]))
          .setRotation({ x: qx, y: qy, z: qz, w: qw })
          .setLinearDamping(0.1)
          .setAngularDamping(0.4)
          .setCcdEnabled(true)
          .setEnabled(Boolean(seeded))
      )
      const collider =
        shape === 'round'
          ? RAPIER.ColliderDesc.cylinder(PUCK_THICKNESS / 2, PUCK_RADIUS)
          : RAPIER.ColliderDesc.cuboid(SQUARE_SIDE / 2, PUCK_THICKNESS / 2, SQUARE_SIDE / 2)
      world.createCollider(collider.setFriction(0.6).setRestitution(0.05), body)
      this.pucks.push({ body, active: Boolean(seeded), kind: 'seed' })
      if (!seeded) this.free.push(i)
    }
    // Pop from the end, so hand out low indices first.
    this.free.reverse()
  }

  get freeCount() {
    return this.free.length
  }

  get pusherZ() {
    return this.pusher.translation().z
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
    this.pusher.setNextKinematicTranslation({
      x: 0,
      y: PUSHER_HEIGHT / 2,
      z: pusherCenterZ(this.time, this.pusherPeriodS),
    })
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
        x: p.x,
        z: p.z,
        result: classifyFall(p.x, this.chuteHalfWidth),
      })
      this.park(i)
    }
    return falls
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
    this.free.push(index)
  }
}
