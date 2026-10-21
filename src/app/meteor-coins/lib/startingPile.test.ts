import { FIELD_FRONT_Z, FIELD_HALF_WIDTH, PUCK_RADIUS } from './cabinet'
import { POOL_SIZE, PusherEngine, initPhysics } from './engine'
import { STARTING_PILE } from './startingPile'

describe('STARTING_PILE', () => {
  it('fits in the pool with room left for play', () => {
    expect(STARTING_PILE.length).toBeGreaterThan(100)
    expect(POOL_SIZE - STARTING_PILE.length).toBeGreaterThanOrEqual(75)
  })

  it('rests every coin on the table', () => {
    for (const { p, q } of STARTING_PILE) {
      expect(Math.abs(p[0])).toBeLessThan(FIELD_HALF_WIDTH)
      expect(p[1]).toBeGreaterThan(0)
      // Some hang over the front edge on purpose, propped on their neighbours;
      // the stillness test below is what proves they rest.
      expect(p[2]).toBeLessThan(FIELD_FRONT_Z + PUCK_RADIUS / 2)
      expect(Math.hypot(...q)).toBeCloseTo(1, 3)
    }
  })

  it('is uneven, not a grid', () => {
    const heights = new Set(STARTING_PILE.map(c => c.p[1].toFixed(2)))
    expect(heights.size).toBeGreaterThan(10)
  })

  it('holds still until the player drops something — a fair start', async () => {
    await initPhysics()
    const engine = new PusherEngine({ pile: STARTING_PILE })
    let fell = 0
    for (let i = 0; i < 60 * 4; i++) fell += engine.step().length
    expect(fell).toBe(0)
    engine.dispose()
  })
})
