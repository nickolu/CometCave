import type { Vec } from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'
import { fallTimeToShelf, shelfOpenAt } from '@/app/meteor-coins/lib/timing'

/**
 * The bakery belt: chocolates come out of a little oven on one side and
 * ride a conveyor across, high over the back of the shelf. The belt is a
 * row of trapdoors; a press opens the one under the leading chocolate and
 * it falls straight down onto the shelf, right where it was. So when you
 * press decides where across the shelf it lands, and (as with the arm)
 * whether it lands on bare shelf.
 */
export type BeltConfig = {
  /** Height the chocolates ride at, and the line across the table the belt runs along. */
  y: number
  z: number
  /** Where chocolates come out of the oven, and where the belt ends and takes them back. */
  fromX: number
  toX: number
  /** Distance between chocolates on the belt. */
  spacing: number
  /** Belt speed, in units per second of the stage clock (so slow mode slows it). */
  speed: number
  /** Trapdoors open only over the shelf: within this of the middle. */
  dropHalfWidth: number
}

/** A chocolate on the belt: which slot it rides in (slots leave the oven in order). */
type Riding = { slot: number }

/**
 * The belt's moving parts are positions only: nothing is a physics body
 * until its trapdoor opens and `host.launch` puts it on the table. The belt
 * runs on the stage clock, so a chocolate's place is a pure function of
 * time and its slot.
 */
export class BeltDelivery implements Delivery {
  readonly kind = 'belt'
  /** Chocolates on the belt, oldest (furthest along) first. */
  private riding: Riding[] = []
  /** The next slot to come out of the oven. */
  private nextSlot = 0
  /** Trapdoors opened so far, for the rig: where each one was and when (stage clock). */
  readonly opened: { x: number; at: number }[] = []

  constructor(
    private readonly host: DeliveryHost,
    readonly config: BeltConfig
  ) {}

  /** No chocolate waits on the stage: one left riding goes back to the oven, not on the table. */
  readonly busy = 0

  /** Where slot `slot` is along the belt now. */
  slotX(slot: number, time = this.host.dropperTime): number {
    const c = this.config
    return c.fromX + c.speed * time - slot * c.spacing
  }

  /** Every chocolate on the belt now, furthest along first. */
  chocolates(): Vec[] {
    const { y, z } = this.config
    return this.riding.map(r => ({ x: this.slotX(r.slot), y, z }))
  }

  /** The chocolate a press drops now: the furthest along that's over the shelf. Null if none is. */
  next(): Vec | null {
    const r = this.nextRiding()
    return r ? { x: this.slotX(r.slot), y: this.config.y, z: this.config.z } : null
  }

  private nextRiding(): Riding | null {
    const half = this.config.dropHalfWidth
    return this.riding.find(r => Math.abs(this.slotX(r.slot)) <= half) ?? null
  }

  /**
   * Whether a chocolate dropped now lands on bare shelf: the arm's timing
   * rule (lib/timing), judged at landing from the belt's height.
   */
  get landsClear(): boolean {
    const fallS = fallTimeToShelf(this.config.y)
    return shelfOpenAt(this.host.engine.time + fallS, this.host.engine.pusherPeriodS)
  }

  input(e: DeliveryInput): boolean {
    if (e.type !== 'press') return false
    const r = this.nextRiding()
    if (!r || !this.host.canDrop) return false
    const x = this.slotX(r.slot)
    const { y, z } = this.config
    if (this.host.launch({ x, y, z }) === null) return false
    this.riding = this.riding.filter(o => o !== r)
    this.opened.push({ x, at: this.host.dropperTime })
    if (this.opened.length > 8) this.opened.shift()
    return true
  }

  /**
   * Moves the belt on: new chocolates come out of the oven while the tin
   * has more than the belt already carries, and any that reach the far end
   * undropped go back in. They were never taken from the tin.
   */
  beforeStep() {
    const { toX } = this.config
    this.riding = this.riding.filter(r => this.slotX(r.slot) <= toX)
    while (this.slotX(this.nextSlot) >= this.config.fromX) {
      const left = this.host.state.coinsLeft
      if (left === null || this.riding.length < left) this.riding.push({ slot: this.nextSlot })
      this.nextSlot++
    }
  }

  step() {}
}
