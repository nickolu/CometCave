import { CLASSIC_LAYOUT, FIELD_HALF_WIDTH, overEdge } from './cabinet'
import { POOL_SIZE, PusherEngine, initPhysics } from './engine'
import { OBJECTS } from './objects'
import { PILES } from './piles'
import { type StageDef, playableStage } from './stages'

/** The table each pile was baked on: its stage's pusher timing, obstacles and pool object. */
function table(name: string) {
  const stage = playableStage(name) as StageDef
  return { ...stage.table, poolObject: stage.objects.drop }
}

describe.each(Object.entries(PILES))('the %s pile', (name, STARTING_PILE) => {
  it('fits in the pool with room left for play', () => {
    const pooled = STARTING_PILE.filter(pose => !pose.o)
    // Bulky objects (ducks) fill the shelf with fewer, and a tub with a
    // drain keeps its ducks afloat in a single layer, with room to bonk.
    const tub = playableStage(name)?.table.drain !== undefined
    expect(pooled.length).toBeGreaterThan(tub ? 20 : 60)
    expect(POOL_SIZE - pooled.length).toBeGreaterThanOrEqual(75)
  })

  it('rests everything on the table', () => {
    const stage = playableStage(name) as StageDef
    const { drop } = stage.objects
    for (const { p, q, o } of STARTING_PILE) {
      const reach = (o ? OBJECTS[o] : drop).reach
      expect(Math.abs(p[0])).toBeLessThan(FIELD_HALF_WIDTH)
      expect(p[1]).toBeGreaterThan(0)
      // Some hang over the edge on purpose, propped on their neighbours;
      // the stillness test below is what proves they rest.
      expect(overEdge(stage.table.layout ?? CLASSIC_LAYOUT, p[2])).toBeLessThan(reach / 2)
      expect(Math.hypot(...q)).toBeCloseTo(1, 3)
    }
  })

  it('is uneven, not a grid', () => {
    const heights = new Set(STARTING_PILE.map(c => c.p[1].toFixed(2)))
    // Ducks floating in a tub mostly sit at one height.
    const tub = playableStage(name)?.table.drain !== undefined
    expect(heights.size).toBeGreaterThan(tub ? 3 : 10)
  })

  it('holds still until the player drops something — a fair start', async () => {
    await initPhysics()
    const engine = new PusherEngine({ pile: STARTING_PILE, ...table(name) })
    let fell = 0
    for (let i = 0; i < 60 * 4; i++) fell += engine.step().length
    expect(fell).toBe(0)
    engine.dispose()
  })
})
