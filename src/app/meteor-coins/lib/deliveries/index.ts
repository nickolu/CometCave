import {
  type CannonConfig,
  HOOP_BOARD_TOP,
  type Vec,
  flightPath,
  launchVelocity,
  muzzleAt,
} from '@/app/meteor-coins/lib/cannon'
import { ArmDelivery } from '@/app/meteor-coins/lib/deliveries/arm'
import { type BeltConfig, BeltDelivery } from '@/app/meteor-coins/lib/deliveries/belt'
import { CannonDelivery } from '@/app/meteor-coins/lib/deliveries/cannon'
import {
  CRANE_AIM_Y,
  type CraneConfig,
  CraneDelivery,
} from '@/app/meteor-coins/lib/deliveries/crane'
import {
  type SlideConfig,
  SlideDelivery,
  onSlide,
  slideCurve,
} from '@/app/meteor-coins/lib/deliveries/slide'
import {
  SPIDER_RAIL_ABOVE,
  type SpiderConfig,
  SpiderDelivery,
} from '@/app/meteor-coins/lib/deliveries/spider'
import type { Delivery, DeliveryHost } from '@/app/meteor-coins/lib/deliveries/types'
import type { StageDef } from '@/app/meteor-coins/lib/stages'

export type {
  Delivery,
  DeliveryHost,
  DeliveryInput,
  Spawn,
} from '@/app/meteor-coins/lib/deliveries/types'

/**
 * Every delivery a stage can set as `delivery`, by kind. A new one adds its
 * config to this union, a case to each switch below, a rig to
 * scene/DeliveryRig and a bot to scripts/meteor-coins-sim.ts.
 */
export type DeliveryConfig =
  | { kind: 'arm' }
  | ({ kind: 'cannon' } & CannonConfig)
  | ({ kind: 'crane' } & CraneConfig)
  | ({ kind: 'belt' } & BeltConfig)
  | ({ kind: 'spider' } & SpiderConfig)
  | ({ kind: 'slide' } & SlideConfig)

/** The stage's delivery: its own, else the cannon where it has one, else the arm. */
export function deliveryOf(stage: StageDef): DeliveryConfig {
  if (stage.delivery) return stage.delivery
  return stage.cannon ? { kind: 'cannon', ...stage.cannon } : { kind: 'arm' }
}

export function createDelivery(
  host: DeliveryHost,
  config: DeliveryConfig,
  tapDrop: () => boolean
): Delivery {
  switch (config.kind) {
    case 'arm':
      return new ArmDelivery(tapDrop)
    case 'cannon':
      return new CannonDelivery(host, config)
    case 'crane':
      return new CraneDelivery(host, config)
    case 'belt':
      return new BeltDelivery(host, config)
    case 'spider':
      return new SpiderDelivery(host, config)
    case 'slide':
      return new SlideDelivery(host, config)
  }
}

/**
 * The height of the plane the UI projects the pointer onto for `point`
 * inputs: where the delivery's aim lives. 0 (the table top) by default.
 */
export function deliveryAimY(config: DeliveryConfig): number {
  switch (config.kind) {
    case 'arm':
    case 'cannon':
    case 'belt':
    case 'slide':
      return 0
    // The pointer is read over the top of the pile, where the coin will land.
    case 'crane':
      return CRANE_AIM_Y
    case 'spider':
      // About where tower tops are, so pointing at a post puts the spider over it.
      return SPIDER_AIM_Y
  }
}

/**
 * What the camera must keep in view for this delivery, or null to frame
 * the arm's full swing (scene/framing).
 */
export function deliveryKeyPoints(config: DeliveryConfig): Vec[] | null {
  switch (config.kind) {
    case 'arm':
      return null
    case 'cannon':
      return cannonPoints(config)
    case 'crane':
      return cranePoints(config)
    case 'belt':
      return beltPoints(config)
    case 'spider':
      return spiderPoints(config)
    case 'slide':
      return slidePoints(config)
  }
}

/**
 * Whether the delivery is played by pressing and holding, so the "Tap
 * twice" setting applies (a tap to start and a tap to finish instead).
 */
export function deliveryHolds(config: DeliveryConfig): boolean {
  switch (config.kind) {
    case 'arm':
    case 'belt':
    case 'slide':
      return false
    case 'cannon':
      return true
    case 'crane':
    case 'spider':
      return false
  }
}

/** What the slow-mode toggle slows, in plain words: "Slower arm". */
export function deliveryName(config: DeliveryConfig): string {
  switch (config.kind) {
    case 'arm':
      return 'arm'
    case 'cannon':
      return 'cannon'
    case 'crane':
      return 'crane'
    case 'belt':
      return 'belt'
    case 'spider':
      return 'spider'
    case 'slide':
      return 'slide'
  }
}

/**
 * How to play the delivery, in plain words, shown before the first coin.
 * `tapTwice` is the accessibility setting for deliveries that are held.
 */
export function deliveryHowTo(config: DeliveryConfig, tapTwice: boolean): string {
  switch (config.kind) {
    case 'arm':
      return 'Tap or press Space to drop.'
    case 'cannon':
      // Two steps: direction, then distance. Tap twice makes the distance
      // a tap to start the charge and a tap to fire, so three taps a shot.
      return tapTwice
        ? 'Tap or press Space to pick the direction. Tap again to start the power, and once more to fire.'
        : 'Tap or press Space to pick the direction. Then press and hold for distance, and let go to fire.'
    case 'crane':
      return 'Move the claw with the pointer or the arrow keys. Tap or press Space to drop.'
    case 'belt':
      return 'Tap or press Space to drop the marked chocolate off the belt, right where it is.'
    case 'spider':
      return 'Touch or point where the spider should go, or use the arrow keys. Tap or press Space to drop the coin.'
    case 'slide':
      return 'Tap or press Space to send a duck down the slide. It goes where the slide points.'
  }
}

/** The slide's top, and its lip at both ends of its sway. */
function slidePoints(c: SlideConfig): Vec[] {
  const { points } = slideCurve(c)
  const lip = points[points.length - 1]
  return [
    { x: c.pivot.x, y: c.pivot.y + 0.8, z: c.pivot.z },
    onSlide(lip, -c.maxYaw, c),
    onSlide(lip, c.maxYaw, c),
  ]
}

/** The cannon, each hoop's backboard (at both ends of a slide), and the top of a full shot's arc. */
function cannonPoints(c: CannonConfig): Vec[] {
  const full = flightPath(muzzleAt(0, c), launchVelocity(0, 1, c), p => p.y < 0.7)
  const peak = full.reduce((a, b) => (b.y > a.y ? b : a))
  return [
    { x: c.pivot.x - 1.2, y: 0, z: c.pivot.z + 0.6 },
    { x: c.pivot.x + 1.2, y: 0, z: c.pivot.z + 0.6 },
    { x: c.pivot.x, y: c.pivot.y + 0.8, z: c.pivot.z },
    { x: peak.x, y: peak.y + 0.3, z: peak.z },
    ...c.hoops.flatMap(h => {
      const reach = h.radius + (h.sweep?.ampX ?? 0)
      return [-reach, reach].map(dx => ({ x: h.x + dx, y: h.y + HOOP_BOARD_TOP, z: h.z }))
    }),
  ]
}

/**
 * The claw at the far corners of its reach, the gantry over the back of
 * the table, and the bottom of the jar under the lip (scene/JarMesh) on a
 * crane's stage.
 */
function cranePoints(c: CraneConfig): Vec[] {
  const [x0, x1] = c.x
  const [z0, z1] = c.z
  const gantryY = c.y + c.cable
  return [
    { x: x0 - 0.6, y: c.y + 0.4, z: z1 },
    { x: x1 + 0.6, y: c.y + 0.4, z: z1 },
    { x: x0 - 1, y: gantryY, z: z0 },
    { x: x1 + 1, y: gantryY, z: z0 },
    { x: 0, y: -1.6, z: 5.3 },
  ]
}

/**
 * The oven, both ends of the belt with a chocolate's headroom, and the
 * front edge from below: Bramble's stage has the belt, and Bramble waits
 * under the lip with its mouth open, so its head must stay in view too.
 */
function beltPoints(c: BeltConfig): Vec[] {
  return [
    { x: c.fromX - 1, y: c.y + 0.9, z: c.z },
    { x: c.toX + 0.6, y: c.y + 0.6, z: c.z },
    { x: -4.3, y: -2.3, z: 5.4 },
    { x: 4.3, y: -2.3, z: 5.4 },
  ]
}

const SPIDER_AIM_Y = 1.5

/** Both ends of the spider's rail, and the bottom of its bob. */
function spiderPoints(c: SpiderConfig): Vec[] {
  const railY = c.highY + SPIDER_RAIL_ABOVE + 0.2
  return [
    { x: -c.halfWidth - 0.8, y: railY, z: c.z },
    { x: c.halfWidth + 0.8, y: railY, z: c.z },
    { x: 0, y: c.lowY - 0.3, z: c.z },
  ]
}
