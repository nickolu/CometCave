import { PhasedDelivery } from '@/app/meteor-coins/lib/deliveries/phased'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'

/** A stand-in delivery that records what it was sent. */
function fake(kind: string, busy = 0) {
  const got: DeliveryInput[] = []
  const d: Delivery & { got: DeliveryInput[]; steps: number; mode: string } = {
    kind,
    busy,
    got,
    steps: 0,
    mode: 'hold',
    input(e) {
      got.push(e)
      return true
    },
    step() {
      d.steps++
    },
    setMode(mode) {
      d.mode = mode
    },
  }
  return d
}

describe('PhasedDelivery', () => {
  it('hands input to the delivery for the phase the cabinet is in', () => {
    const host = { phase: 0 }
    const crane = fake('crane')
    const cannon = fake('cannon')
    const phased = new PhasedDelivery(host as unknown as DeliveryHost, [crane, cannon])
    expect(phased.active).toBe(crane)
    phased.input({ type: 'point', x: 1, z: 2 })
    phased.input({ type: 'press' })
    host.phase = 1
    expect(phased.active).toBe(cannon)
    phased.input({ type: 'press' })
    expect(crane.got.map(e => e.type)).toEqual(['point', 'press'])
    expect(cannon.got.map(e => e.type)).toEqual(['press'])
  })

  it('keeps stepping every delivery, and is busy while any of them is', () => {
    const host = { phase: 1 }
    const plunger = fake('plunger', 1)
    const cannon = fake('cannon')
    const phased = new PhasedDelivery(host as unknown as DeliveryHost, [plunger, cannon])
    phased.step([])
    phased.beforeStep([])
    // The plunger's ball, still in the air in the cannon's phase, finishes its flight.
    expect(plunger.steps).toBe(1)
    expect(cannon.steps).toBe(1)
    expect(phased.busy).toBe(1)
  })

  it('sets "tap, don\'t hold" on all of them', () => {
    const a = fake('plunger')
    const b = fake('cannon')
    new PhasedDelivery({ phase: 0 } as unknown as DeliveryHost, [a, b]).setMode('tap')
    expect([a.mode, b.mode]).toEqual(['tap', 'tap'])
  })
})
