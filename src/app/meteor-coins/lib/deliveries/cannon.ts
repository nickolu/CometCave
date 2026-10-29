import { BACK_WALL_Z, DROP_Z } from '@/app/meteor-coins/lib/cabinet'
import {
  type CannonConfig,
  type Vec,
  cannonYaw,
  chargeAfter,
  dropsThroughHoop,
  flightPath,
  hoopX,
  launchVelocity,
  muzzleAt,
} from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'
import type { GameEvent } from '@/app/meteor-coins/lib/game'
import { hoopHit, shotLanded } from '@/app/meteor-coins/lib/rules'

/** A fired coin is done once it's below the hoops and falling, or after this long. */
const SHOT_TIMEOUT_S = 3
/** Where hoop bonuses pour: across the back of the shelf, from the backboard. */
const BONUS_POUR = { y: 2.5, z: DROP_Z, halfWidth: 2.6 }
/** The flat aim line: a dot this far apart, from the muzzle back to the back wall. */
const AIM_LINE_STEP = 0.4

/**
 * Hoop-La Cannon's delivery (see lib/cannon for the aim and the arc), in
 * two steps. While the cannon swings, a flat line along the table shows
 * the direction, and a press locks it. Then a press starts the charge and
 * letting go fires; the dotted arc shows the distance, growing with the
 * charge. In tap mode a third tap fires instead of letting go. Fired
 * coins are watched down through the hoops until they come down.
 */
export class CannonDelivery implements Delivery {
  readonly kind = 'cannon'
  /** How the cannon is fired: hold and let go, or tap twice. */
  mode: 'hold' | 'tap' = 'hold'
  /** The direction locked by the first press, or null while the cannon swings. */
  private locked: number | null = null
  /** When the second press started the charge, or null before it. */
  private chargingFrom: number | null = null
  /** Coins in the air, and where each was last step. */
  private fired: { index: number; firedAt: number; last: Vec; hoops: Set<number> }[] = []
  private pours = 0

  constructor(
    private readonly host: DeliveryHost,
    readonly config: CannonConfig
  ) {}

  setMode(mode: 'hold' | 'tap') {
    this.mode = mode
  }

  /** Where the cannon points: locked after the first press, swinging before it. */
  get yaw(): number {
    return this.locked ?? cannonYaw(this.host.dropperTime, this.config)
  }

  /** Whether the direction is locked and the next step is the distance. */
  get isLocked(): boolean {
    return this.locked !== null
  }

  /** The charge so far, 0 to 1, or null when not charging. */
  get charge(): number | null {
    if (this.chargingFrom === null) return null
    return chargeAfter(this.host.dropperTime - this.chargingFrom, this.config)
  }

  /**
   * The flat line along the table the cannon points down, while it swings:
   * dots at the muzzle's height, back to the back wall. Empty once locked.
   */
  aimLine(): Vec[] {
    if (this.locked !== null) return []
    const yaw = this.yaw
    const start = muzzleAt(yaw, this.config)
    const points: Vec[] = []
    for (let d = AIM_LINE_STEP; ; d += AIM_LINE_STEP) {
      const p = { x: start.x + d * Math.sin(yaw), y: start.y, z: start.z - d * Math.cos(yaw) }
      if (p.z < BACK_WALL_Z + 0.3) break
      points.push(p)
    }
    return points
  }

  /**
   * The arc a shot would fly at the charge so far (none yet is the
   * shortest shot), once the direction is locked. Empty while it swings.
   */
  previewPath(): Vec[] {
    if (this.locked === null) return []
    return this.arcAt(this.locked, this.charge ?? 0)
  }

  private arcAt(yaw: number, power: number): Vec[] {
    const v = launchVelocity(yaw, power, this.config)
    return flightPath(muzzleAt(yaw, this.config), v, p => p.y < 0.7 || p.z < DROP_Z - 0.4)
  }

  get busy(): number {
    return this.fired.length + (this.locked !== null ? 1 : 0)
  }

  input(e: DeliveryInput): boolean {
    if (e.type === 'press') {
      if (!this.host.canDrop) return false
      if (this.locked === null) {
        this.locked = this.yaw
        return true
      }
      if (this.chargingFrom === null) {
        this.chargingFrom = this.host.dropperTime
        return true
      }
      return this.mode === 'tap' ? this.fire() : false
    }
    if (e.type === 'release') {
      return this.mode === 'hold' && this.chargingFrom !== null && this.fire()
    }
    return false
  }

  private fire(): boolean {
    const yaw = this.locked
    if (yaw === null || this.chargingFrom === null || !this.host.canDrop) return false
    const power = this.charge ?? 0
    const start = muzzleAt(yaw, this.config)
    const velocity = launchVelocity(yaw, power, this.config)
    const index = this.host.launch({ ...start, velocity })
    if (index === null) return false
    this.locked = null
    this.chargingFrom = null
    const firedAt = this.host.engine.time
    this.fired.push({ index, firedAt, last: start, hoops: new Set() })
    return true
  }

  /** Checks fired coins against the hoops, and settles the ones that have come down. */
  step(events: GameEvent[]) {
    const host = this.host
    const hoops = this.config.hoops
    // Below every rim and still falling, a coin can't go through one any more.
    const lowest = Math.min(...hoops.map(h => h.y)) - 0.2
    this.fired = this.fired.filter(shot => {
      const puck = host.engine.pucks[shot.index]
      if (!puck.active) {
        host.state = shotLanded(host.state)
        return false
      }
      const t = puck.body.translation()
      const now = { x: t.x, y: t.y, z: t.z }
      hoops.forEach((hoop, i) => {
        if (shot.hoops.has(i)) return
        const x = hoopX(hoop, host.dropperTime)
        if (!dropsThroughHoop(hoop, x, shot.last, now, puck.spec.reach)) return
        shot.hoops.add(i)
        host.state = hoopHit(host.state, hoop.bonus)
        events.push({ type: 'hoop', bonus: hoop.bonus })
      })
      shot.last = now
      const down = now.y < lowest && puck.body.linvel().y <= 0
      if (down || host.engine.time - shot.firedAt > SHOT_TIMEOUT_S) {
        host.state = shotLanded(host.state)
        return false
      }
      return true
    })
  }

  /** Hoop bonuses pour stepping across the back of the shelf, from the backboard. */
  bonusAt(): Vec {
    const x = BONUS_POUR.halfWidth * Math.sin(this.pours++ * 2.4)
    return { x, y: BONUS_POUR.y, z: BONUS_POUR.z }
  }
}
