import { PHYSICS_STEP_S } from '@/app/meteor-coins/lib/cabinet'
import { deliveryOf } from '@/app/meteor-coins/lib/deliveries'
import {
  SOFT_FALL,
  SPIDER_REACH,
  type SpiderConfig,
  SpiderDelivery,
  spiderCueLit,
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
    for (let i = 0; i < Math.round(seconds / PHYSICS_STEP_S); i++) {
      host.dropperTime += PHYSICS_STEP_S
      spider.beforeStep()
    }
  }
  const tap = () => {
    spider.input({ type: 'press' })
    return spider.input({ type: 'release' })
  }
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

  it('walks toward the pointer at a limited speed', () => {
    const { spider, run } = fakeHost()
    spider.input({ type: 'point', x: 2.2, z: 0 })
    run(0.25)
    expect(spider.x).toBeCloseTo(CONFIG.speed * 0.25, 1)
    run(2)
    expect(spider.x).toBeCloseTo(2.2, 6)
    // Never off the end of the rail.
    spider.input({ type: 'point', x: -20, z: 0 })
    run(5)
    expect(spider.x).toBeCloseTo(-CONFIG.halfWidth, 6)
  })

  it('walks while an arrow key is held, and stops when it is let go', () => {
    const { spider, run } = fakeHost()
    spider.input({ type: 'steer', x: 1, z: 0 })
    run(0.5)
    const moved = spider.x
    expect(moved).toBeCloseTo(CONFIG.speed * 0.5, 1)
    spider.input({ type: 'steer', x: 0, z: 0 })
    run(0.5)
    expect(spider.x).toBe(moved)
  })

  it('lets go of its coin from where it is, then fetches the next', () => {
    const { spider, launched, run, tap } = fakeHost()
    run(CONFIG.bobPeriodS / 2)
    expect(tap()).toBe(true)
    expect(launched).toHaveLength(1)
    expect(launched[0].x).toBe(0)
    expect(launched[0].y).toBeCloseTo(CONFIG.lowY, 2)
    expect(launched[0].z).toBe(CONFIG.z)
    // Nothing to let go of while it fetches the next coin.
    expect(spider.holding).toBe(false)
    expect(tap()).toBe(false)
    run(CONFIG.reloadS + 0.05)
    expect(tap()).toBe(true)
    expect(launched).toHaveLength(2)
  })

  it('takes a tap far from it as an aim, so a phone taps twice: walk there, then drop', () => {
    const { spider, launched, run, tap } = fakeHost()
    spider.input({ type: 'point', x: -2.2, z: 0 })
    expect(Math.abs(-2.2 - spider.x)).toBeGreaterThan(SPIDER_REACH)
    expect(tap()).toBe(true)
    expect(launched).toHaveLength(0)
    run(1)
    spider.input({ type: 'point', x: -2.2, z: 0 })
    expect(tap()).toBe(true)
    expect(launched[0].x).toBeCloseTo(-2.2, 6)
  })

  it('never lets go inside a tower that has grown up to it', () => {
    const { launched, run, tap, spider } = fakeHost([0, 20, 0])
    run(CONFIG.bobPeriodS / 2)
    expect(spider.x).toBe(0)
    tap()
    expect(launched[0].y).toBeGreaterThan(0.8 + 20 * 0.18)
  })

  it('lights the dot only for a drop square on a post and soft', () => {
    const on = { x: 0, y: 0.8, z: 1.2, post: 1, offset: 0 }
    expect(spiderCueLit(on, { x: 0, y: 0.8 + SOFT_FALL - 0.1, z: 1.2 })).toBe(true)
    expect(spiderCueLit(on, { x: 0, y: 0.8 + SOFT_FALL + 0.1, z: 1.2 })).toBe(false)
    const off = { ...on, post: null, offset: Infinity }
    expect(spiderCueLit(off, { x: 0, y: 1, z: 1.2 })).toBe(false)
  })
})
