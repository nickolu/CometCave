import { DROP_Z, PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import {
  type CannonConfig,
  type Vec,
  cannonYaw,
  chargeAfter,
  flightPath,
  launchVelocity,
  muzzleAt,
  throughHoop,
} from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'
import type { GameEvent } from '@/app/meteor-coins/lib/game'
import { hoopHit, shotLanded } from '@/app/meteor-coins/lib/rules'

/** A fired coin is done once it's below the hoops and falling, or after this long. */
const SHOT_TIMEOUT_S = 3
/** Where hoop bonuses pour: across the back of the shelf, from the backboard. */
const BONUS_POUR = { y: 2.5, z: DROP_Z, halfWidth: 2.6 }
/** A fired coin flies flat, so half its thickness is what has to clear a hoop's rim above and below. */
const FLAT_COIN_HALF_HEIGHT = PUCK_THICKNESS / 2

/**
 * Hoop-La Cannon's delivery (see lib/cannon for the aim and the arc): a
 * press locks the swing and starts the charge, letting go fires; in tap
 * mode a second tap fires instead. Fired coins are watched through the
 * hoops until they come down.
 */
export class CannonDelivery implements Delivery {
  readonly kind = 'cannon'
  /** How the cannon is fired: hold and let go, or tap twice. */
  mode: 'hold' | 'tap' = 'hold'
  /** While charging: the aim locked by the press, and when it was pressed. */
  private charging: { yaw: number; from: number } | null = null
  /** The last shot's charge: the arc shown while aiming. A first shot previews full. */
  private lastPower = 1
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

  /** Where the cannon points: locked while charging, swinging otherwise. */
  get yaw(): number {
    return this.charging ? this.charging.yaw : cannonYaw(this.host.dropperTime, this.config)
  }

  /** The charge so far, 0 to 1, or null when not charging. */
  get charge(): number | null {
    if (!this.charging) return null
    return chargeAfter(this.host.dropperTime - this.charging.from, this.config)
  }

  /** The arc a shot would fly: at the current charge, or the last shot's while aiming. */
  previewPath(): Vec[] {
    const yaw = this.yaw
    const v = launchVelocity(yaw, this.charge ?? this.lastPower, this.config)
    return flightPath(muzzleAt(yaw, this.config), v, p => p.y < 0.7 || p.z < DROP_Z - 0.4)
  }

  get busy(): number {
    return this.fired.length + (this.charging ? 1 : 0)
  }

  input(e: DeliveryInput): boolean {
    if (e.type === 'press') {
      if (!this.host.canDrop) return false
      if (!this.charging) {
        this.charging = { yaw: this.yaw, from: this.host.dropperTime }
        return true
      }
      return this.mode === 'tap' ? this.fire() : false
    }
    if (e.type === 'release') {
      return this.mode === 'hold' && this.charging !== null && this.fire()
    }
    return false
  }

  private fire(): boolean {
    if (!this.charging || !this.host.canDrop) return false
    const power = this.charge ?? 0
    const { yaw } = this.charging
    const start = muzzleAt(yaw, this.config)
    const velocity = launchVelocity(yaw, power, this.config)
    const index = this.host.launch({ ...start, velocity })
    if (index === null) return false
    this.charging = null
    this.lastPower = power
    const firedAt = this.host.engine.time
    this.fired.push({ index, firedAt, last: start, hoops: new Set() })
    return true
  }

  /** Checks fired coins against the hoops, and settles the ones that have come down. */
  step(events: GameEvent[]) {
    const host = this.host
    const hoops = this.config.hoops
    const lowest = Math.min(...hoops.map(h => h.y - h.radius))
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
        if (!throughHoop(hoop, shot.last, now, puck.spec.reach, FLAT_COIN_HALF_HEIGHT)) return
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
