import { FIELD_HALF_WIDTH, PUCK_RADIUS } from './cabinet'
import {
  ARM_PERIOD_S,
  HIT_RADIUS,
  RING_PERIOD_S,
  RING_RANGE,
  RING_Y,
  armTip,
  isHit,
  ringX,
} from './dropper'

const samples = (period: number) => Array.from({ length: 200 }, (_, i) => (i / 200) * period)

describe('arm', () => {
  it('swings the tip across the table but never past the walls', () => {
    const xs = samples(ARM_PERIOD_S).map(t => armTip(t).x)
    expect(Math.max(...xs)).toBeGreaterThan(3)
    expect(Math.min(...xs)).toBeLessThan(-3)
    expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(FIELD_HALF_WIDTH - PUCK_RADIUS)
  })

  it('always releases above the ring', () => {
    for (const t of samples(ARM_PERIOD_S)) expect(armTip(t).y).toBeGreaterThan(RING_Y + 0.5)
  })
})

describe('ring', () => {
  it('slides across its range', () => {
    const xs = samples(RING_PERIOD_S).map(t => ringX(t))
    expect(Math.max(...xs)).toBeCloseTo(RING_RANGE, 1)
    expect(Math.min(...xs)).toBeCloseTo(-RING_RANGE, 1)
  })

  it('counts a hit only near its center', () => {
    const t = 1.3
    expect(isHit(ringX(t), t)).toBe(true)
    expect(isHit(ringX(t) + HIT_RADIUS * 0.9, t)).toBe(true)
    expect(isHit(ringX(t) + HIT_RADIUS * 1.1, t)).toBe(false)
  })

  it('does not start lined up with the arm', () => {
    expect(Math.abs(armTip(0).x - ringX(0))).toBeGreaterThan(HIT_RADIUS)
  })
})
