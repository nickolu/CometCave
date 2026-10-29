import type { Delivery, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'

/**
 * The swinging arm: a press drops the coin at its tip. The arm itself
 * lives in DropGame (armTip, landing, the cues, the ring), because the
 * stages built on it lean on all of that; this just routes the press.
 */
export class ArmDelivery implements Delivery {
  readonly kind = 'arm'
  readonly busy = 0

  constructor(private readonly tapDrop: () => boolean) {}

  input(e: DeliveryInput): boolean {
    return e.type === 'press' && this.tapDrop()
  }

  step() {}
}
