import {
  AIM_LIMIT,
  BACK_WALL_Z,
  CHUTE_HALF_WIDTH,
  FIELD_BACK_Z,
  FIELD_FRONT_Z,
  PUCK_RADIUS,
  PUCK_THICKNESS,
  PUSHER_AMP_Z,
  PUSHER_DEPTH,
  PUSHER_MID_Z,
  clampAim,
  classifyFall,
  pusherCenterZ,
  seedPile,
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

describe('seedPile', () => {
  it('is the same pile on every load', () => {
    expect(seedPile(4)).toEqual(seedPile(4))
  })

  it('places every puck inside the walls and on the field', () => {
    for (const [x, y, z] of seedPile(4)) {
      expect(Math.abs(x)).toBeLessThanOrEqual(AIM_LIMIT + 0.05)
      // Front row overhangs on purpose, but every center rests on the table.
      expect(z).toBeLessThan(FIELD_FRONT_Z)
      expect(z).toBeGreaterThan(BACK_WALL_Z)
      expect(y).toBeGreaterThan(0)
    }
  })

  it('starts no two pucks overlapping', () => {
    const pile = seedPile(4)
    for (let i = 0; i < pile.length; i++) {
      for (let j = i + 1; j < pile.length; j++) {
        const [ax, ay, az] = pile[i]
        const [bx, by, bz] = pile[j]
        const sameLayer = Math.abs(ay - by) < PUCK_THICKNESS
        if (!sameLayer) continue
        expect(Math.hypot(ax - bx, az - bz)).toBeGreaterThanOrEqual(PUCK_RADIUS * 2 - 0.01)
      }
    }
  })
})
