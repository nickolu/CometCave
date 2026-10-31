import { PHYSICS_STEP_S } from '@/app/meteor-coins/lib/cabinet'
import { deliveryOf } from '@/app/meteor-coins/lib/deliveries'
import {
  SOFT_FALL,
  type SpiderConfig,
  SpiderDelivery,
  spiderCueLit,
  spiderX,
  spiderY,
} from '@/app/meteor-coins/lib/deliveries/spider'
import type { DeliveryHost, Spawn } from '@/app/meteor-coins/lib/deliveries/types'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'

const CAIRN = playableStage('the-cairn') as StageDef
const CONFIG = deliveryOf(CAIRN) as { kind: 'spider' } & SpiderConfig

/** Enough of a game for the spider: a clock, the stage, and a record of what it launched. */
function fakeHost(towers = [0, 0, 0]) {
  const launched: Spawn[] = []
  const host = {
    stage: CAIRN,
    dropperTime: 0,
    speed: 1,
    canDrop: true,
    state: { towers },
    launch(spawn: Spawn) {
      launched.push(spawn)
      return launched.length - 1
    },
  } as unknown as DeliveryHost & { dropperTime: number }
  const spider = new SpiderDelivery(host, CONFIG)
  const run = (seconds: number) => {
    host.dropperTime += seconds
  }
  const tap = () => spider.input({ type: 'press' })
  return { host, spider, launched, run, tap }
}

describe('SpiderDelivery', () => {
  it('is The Cairn delivery', () => {
    expect(CONFIG.kind).toBe('spider')
  })

  it('bobs between its low and high points on its own', () => {
    expect(spiderY(0, CONFIG)).toBeCloseTo(CONFIG.highY)
    expect(spiderY(CONFIG.bobPeriodS / 2, CONFIG)).toBeCloseTo(CONFIG.lowY)
    // The low point is soft onto a bare post; the high point isn't.
    const post = CAIRN.table.obstacles?.find(o => o.type === 'post') as { height: number }
    expect(CONFIG.lowY - post.height).toBeLessThanOrEqual(SOFT_FALL)
    expect(CONFIG.highY - post.height).toBeGreaterThan(SOFT_FALL)
  })

  it('walks the rail on its own, end to end and back, never past the ends', () => {
    const posts = [-2.2, 0, 2.2]
    const at = (t: number) => spiderX(t, CONFIG, posts)
    expect(at(0)).toBeCloseTo(0, 6)
    // Walking right from the middle, then back, a full lap in two crossings.
    expect(at(CONFIG.crossS / 4)).toBeGreaterThan(0)
    expect(at(CONFIG.crossS / 2)).toBeCloseTo(CONFIG.halfWidth, 6)
    expect(at((CONFIG.crossS * 3) / 2)).toBeCloseTo(-CONFIG.halfWidth, 6)
    expect(at(2 * CONFIG.crossS)).toBeCloseTo(0, 6)
    let lo = Infinity
    let hi = -Infinity
    let fastest = 0
    for (let t = 0; t < 4 * CONFIG.crossS; t += PHYSICS_STEP_S) {
      lo = Math.min(lo, at(t))
      hi = Math.max(hi, at(t))
      fastest = Math.max(fastest, Math.abs(at(t + PHYSICS_STEP_S) - at(t)) / PHYSICS_STEP_S)
    }
    expect(lo).toBeGreaterThanOrEqual(-CONFIG.halfWidth - 1e-9)
    expect(hi).toBeLessThanOrEqual(CONFIG.halfWidth + 1e-9)
    // No jumps: it walks.
    expect(fastest).toBeLessThan(10)
  })

  it('stands over each post for a moment on its way past', () => {
    const posts = [-2.2, 0, 2.2]
    // At t = 0 it is halfway through its pause over the middle post.
    expect(spiderX(CONFIG.postPauseS * 0.45, CONFIG, posts)).toBe(0)
    expect(spiderX(-CONFIG.postPauseS * 0.45, CONFIG, posts)).toBe(0)
    let still = 0
    for (let t = 0; t < 2 * CONFIG.crossS; t += PHYSICS_STEP_S) {
      if (posts.includes(spiderX(t, CONFIG, posts))) still += PHYSICS_STEP_S
    }
    // Three posts, passed twice a lap.
    expect(still).toBeCloseTo(6 * CONFIG.postPauseS, 1)
  })

  it('ignores the pointer, the arrow keys and letting go: only a press drops', () => {
    const { spider, launched, run } = fakeHost()
    run(0.4)
    const x = spider.x
    expect(spider.input({ type: 'point', x: 2.2, z: 0 })).toBe(false)
    expect(spider.input({ type: 'steer', x: 1, z: 0 })).toBe(false)
    expect(spider.input({ type: 'release' })).toBe(false)
    expect(spider.x).toBe(x)
    expect(launched).toHaveLength(0)
    expect(spider.input({ type: 'press' })).toBe(true)
    expect(launched).toHaveLength(1)
    expect(launched[0].x).toBeCloseTo(x, 6)
  })

  it('lets go of its coin from where it is, then fetches the next', () => {
    const { spider, launched, run, tap } = fakeHost()
    run(CONFIG.bobPeriodS / 2)
    expect(tap()).toBe(true)
    expect(launched).toHaveLength(1)
    expect(launched[0].x).toBeCloseTo(spider.x, 6)
    expect(launched[0].y).toBeCloseTo(CONFIG.lowY, 2)
    expect(launched[0].z).toBe(CONFIG.z)
    // Nothing to let go of while it fetches the next coin.
    expect(spider.holding).toBe(false)
    expect(tap()).toBe(false)
    run(CONFIG.reloadS + 0.05)
    expect(tap()).toBe(true)
    expect(launched).toHaveLength(2)
  })

  it('never lets go inside a tower that has grown up to it', () => {
    // Taller than the top of the bob, with the spider standing over it.
    const { launched, tap, spider } = fakeHost([0, 40, 0])
    expect(spider.x).toBe(0)
    tap()
    expect(launched[0].y).toBeGreaterThan(0.8 + 40 * 0.18)
  })

  it('lights the dot only for a drop square on a post and soft', () => {
    const on = { x: 0, y: 0.8, z: 1.2, post: 1, offset: 0 }
    expect(spiderCueLit(on, { x: 0, y: 0.8 + SOFT_FALL - 0.1, z: 1.2 })).toBe(true)
    expect(spiderCueLit(on, { x: 0, y: 0.8 + SOFT_FALL + 0.1, z: 1.2 })).toBe(false)
    const off = { ...on, post: null, offset: Infinity }
    expect(spiderCueLit(off, { x: 0, y: 1, z: 1.2 })).toBe(false)
  })
})
