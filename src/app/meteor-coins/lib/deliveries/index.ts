import { FIELD_HALF_WIDTH } from '@/app/meteor-coins/lib/cabinet'
import {
  type CannonConfig,
  type Vec,
  flightPath,
  launchVelocity,
  muzzleAt,
} from '@/app/meteor-coins/lib/cannon'
import { ArmDelivery } from '@/app/meteor-coins/lib/deliveries/arm'
import { CannonDelivery } from '@/app/meteor-coins/lib/deliveries/cannon'
import { type OwlsConfig, OwlsDelivery } from '@/app/meteor-coins/lib/deliveries/owls'
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
  | ({ kind: 'owls' } & OwlsConfig)

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
    case 'owls':
      return new OwlsDelivery(host, config)
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
      return 0
    case 'owls':
      return config.aimY
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
    case 'owls':
      return owlsPoints(config)
  }
}

/**
 * Whether the delivery is played by pressing and holding, so the "Tap
 * twice" setting applies (a tap to start and a tap to finish instead).
 */
export function deliveryHolds(config: DeliveryConfig): boolean {
  switch (config.kind) {
    case 'arm':
      return false
    case 'cannon':
      return true
    case 'owls':
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
    case 'owls':
      return 'owls'
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
      return tapTwice
        ? 'Tap or press Space to aim, and again to fire.'
        : 'Press and hold to aim; how long you hold sets the distance. Let go to fire.'
    case 'owls':
      return 'Point or use the arrow keys to aim. Tap or press Space to shoot a pea.'
  }
}

/** The cannon, each hoop's tag, and the top of a full shot's arc. */
function cannonPoints(c: CannonConfig): Vec[] {
  const full = flightPath(muzzleAt(0, c), launchVelocity(0, 1, c), p => p.y < 0.7)
  const peak = full.reduce((a, b) => (b.y > a.y ? b : a))
  return [
    { x: c.pivot.x - 1.2, y: 0, z: c.pivot.z + 0.6 },
    { x: c.pivot.x + 1.2, y: 0, z: c.pivot.z + 0.6 },
    { x: c.pivot.x, y: c.pivot.y + 0.8, z: c.pivot.z },
    { x: peak.x, y: peak.y + 0.3, z: peak.z },
    ...c.hoops.map(h => ({ x: h.x, y: h.y + h.radius + 0.8, z: h.z })),
  ]
}

/** The pea-shooter, and the top corners of the owls' sky over both pages. */
function owlsPoints(c: OwlsConfig): Vec[] {
  const z = c.pages.flat()
  const top = c.height[1] + 0.6
  return [
    { x: c.shooter.x - 0.8, y: 0, z: c.shooter.z + 0.4 },
    { x: c.shooter.x + 0.8, y: 0, z: c.shooter.z + 0.4 },
    { x: c.shooter.x, y: c.shooter.y + 0.5, z: c.shooter.z },
    ...[Math.min(...z), Math.max(...z)].flatMap(zz => [
      { x: -FIELD_HALF_WIDTH, y: top, z: zz },
      { x: FIELD_HALF_WIDTH, y: top, z: zz },
    ]),
  ]
}
