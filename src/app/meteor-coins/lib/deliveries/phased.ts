import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'
import type { GameEvent } from '@/app/meteor-coins/lib/game'

/**
 * A stage that changes delivery with its phases (Comet Homecoming's finale
 * tour: the crane, then the plunger, then the cannon). It holds one delivery
 * per phase and hands the player's input to the one for the phase the
 * cabinet is in.
 *
 * Every delivery keeps stepping whatever phase it is, so a coin one of them
 * still has in the air finishes its flight as it would have; and the game
 * holds a phase change back until the outgoing delivery is idle (see
 * DropGame.applyPhase), so nothing is ever in hand when it changes.
 */
export class PhasedDelivery implements Delivery {
  readonly kind = 'phased'

  constructor(
    private readonly host: DeliveryHost,
    /** One per phase, in order. */
    readonly phases: readonly Delivery[]
  ) {}

  /** The delivery the player is using now. */
  get active(): Delivery {
    return this.phases[Math.min(this.host.phase, this.phases.length - 1)]
  }

  input(e: DeliveryInput): boolean {
    return this.active.input(e)
  }

  beforeStep(events: GameEvent[]) {
    for (const d of this.phases) d.beforeStep?.(events)
  }

  step(events: GameEvent[]) {
    for (const d of this.phases) d.step(events)
  }

  get busy(): number {
    return this.phases.reduce((n, d) => n + d.busy, 0)
  }

  setMode(mode: 'hold' | 'tap') {
    for (const d of this.phases) d.setMode?.(mode)
  }
}
