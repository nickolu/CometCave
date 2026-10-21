import { DROP_Z, PHYSICS_STEP_S, PUSHER_PERIOD_S } from './cabinet'
import { armTip } from './dropper'
import { PusherEngine, initPhysics } from './engine'
import { SHELF_OPEN_SIN, fallTimeToShelf, shelfOpenAt } from './timing'

describe('fallTimeToShelf', () => {
  it('matches how long a real drop takes to reach the pusher', async () => {
    await initPhysics()
    const engine = new PusherEngine()
    const tip = armTip(0)
    const index = engine.spawn(tip.x, tip.y, DROP_Z, 'player') as number
    const body = engine.pucks[index].body
    let landedAt = 0
    for (let i = 0; i < 120 && !landedAt; i++) {
      engine.step()
      if (body.linvel().y > -1) landedAt = engine.time
    }
    expect(landedAt).toBeGreaterThan(0)
    // Within a few physics steps; the cue's window is about a second wide.
    expect(Math.abs(fallTimeToShelf(tip.y) - landedAt)).toBeLessThan(PHYSICS_STEP_S * 4)
    engine.dispose()
  })
})

describe('shelfOpenAt', () => {
  it('opens for the front part of each pusher stroke, about 30% of the time', () => {
    const samples = 1000
    let open = 0
    for (let i = 0; i < samples; i++) {
      if (shelfOpenAt((i / samples) * PUSHER_PERIOD_S, PUSHER_PERIOD_S)) open++
    }
    const expected = (Math.PI - 2 * Math.asin(SHELF_OPEN_SIN)) / (2 * Math.PI)
    expect(open / samples).toBeCloseTo(expected, 2)
    expect(expected).toBeGreaterThan(0.25)
    expect(expected).toBeLessThan(0.35)
  })

  it('is open at the front of the stroke and closed at the back', () => {
    expect(shelfOpenAt(PUSHER_PERIOD_S / 4, PUSHER_PERIOD_S)).toBe(true)
    expect(shelfOpenAt((3 * PUSHER_PERIOD_S) / 4, PUSHER_PERIOD_S)).toBe(false)
  })
})
