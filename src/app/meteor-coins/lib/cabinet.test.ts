import {
  AIM_LIMIT,
  BACK_WALL_Z,
  CHUTE_HALF_WIDTH,
  FIELD_BACK_Z,
  PUSHER_AMP_Z,
  PUSHER_DEPTH,
  PUSHER_MID_Z,
  clampAim,
  classifyFall,
  pusherCenterZ,
} from './cabinet'

describe('cabinet geometry', () => {
  it('keeps the back of the pusher behind the back wall at full extension', () => {
    // Otherwise a gap opens behind the pusher and pucks fall into it.
    const backAtFullExtension = PUSHER_MID_Z + PUSHER_AMP_Z - PUSHER_DEPTH / 2
    expect(backAtFullExtension).toBeLessThanOrEqual(BACK_WALL_Z)
  })

  it('never pulls the back of the pusher past the back of the floor', () => {
    const backAtFullRetraction = PUSHER_MID_Z - PUSHER_AMP_Z - PUSHER_DEPTH / 2
    expect(backAtFullRetraction).toBeGreaterThanOrEqual(FIELD_BACK_Z)
  })

  it('sweeps the pusher between its two extremes', () => {
    const samples = Array.from({ length: 400 }, (_, i) => pusherCenterZ(i / 100))
    expect(Math.min(...samples)).toBeCloseTo(PUSHER_MID_Z - PUSHER_AMP_Z, 2)
    expect(Math.max(...samples)).toBeCloseTo(PUSHER_MID_Z + PUSHER_AMP_Z, 2)
  })
})

describe('classifyFall', () => {
  it('scores the middle of the front edge and loses the sides', () => {
    expect(classifyFall(0)).toBe('chute')
    expect(classifyFall(CHUTE_HALF_WIDTH)).toBe('chute')
    expect(classifyFall(-CHUTE_HALF_WIDTH - 0.01)).toBe('gutter')
    expect(classifyFall(3.5)).toBe('gutter')
  })
})

describe('clampAim', () => {
  it('keeps drops inside the side walls', () => {
    expect(clampAim(100)).toBe(AIM_LIMIT)
    expect(clampAim(-100)).toBe(-AIM_LIMIT)
    expect(clampAim(1.5)).toBe(1.5)
  })
})
