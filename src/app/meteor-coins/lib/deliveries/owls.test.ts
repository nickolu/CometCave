import { PHYSICS_STEP_S, PUSHER_PERIOD_S, deckFaceZ } from '@/app/meteor-coins/lib/cabinet'
import {
  FADE_S,
  OWL_EXIT_X,
  type OwlsConfig,
  OwlsDelivery,
  RELOAD_S,
  landsWell,
  peaAt,
  peaHits,
  peaShot,
} from '@/app/meteor-coins/lib/deliveries/owls'
import type { DeliveryHost, Spawn } from '@/app/meteor-coins/lib/deliveries/types'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame } from '@/app/meteor-coins/lib/game'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'

const BOOK = playableStage('the-bedtime-book') as StageDef
const CONFIG = BOOK.delivery as { kind: 'owls' } & OwlsConfig

/** Just enough of DropGame for the delivery: a clock, a word budget, and a launch to watch. */
function fakeHost(coinsLeft = 40) {
  const launched: Spawn[] = []
  const host = {
    stage: BOOK,
    engine: { time: 0, layout: BOOK.table.layout, pusherPeriodS: PUSHER_PERIOD_S },
    dropperTime: 0,
    speed: 1,
    get canDrop() {
      return (host.state.coinsLeft ?? 1) > 0
    },
    state: { coinsLeft },
    launch(spawn: Spawn) {
      launched.push(spawn)
      host.state.coinsLeft--
      return launched.length - 1
    },
    emit() {},
  }
  return { host, launched, asHost: host as unknown as DeliveryHost }
}

/** One step of the game's loop, as far as the delivery sees it. */
function tick(owls: OwlsDelivery, host: ReturnType<typeof fakeHost>['host']) {
  host.dropperTime += PHYSICS_STEP_S * host.speed
  owls.beforeStep()
  host.engine.time += PHYSICS_STEP_S
  owls.step()
}

describe('the owls and the pea-shooter', () => {
  it('fires a pea that passes through the aim point at the aim height', () => {
    const from = CONFIG.shooter
    const aim = { x: 1.5, y: CONFIG.aimY, z: -3 }
    const { velocity, reach } = peaShot(from, aim)
    const at = peaAt(from, velocity, reach)
    expect(at.x).toBeCloseTo(aim.x, 6)
    expect(at.y).toBeCloseTo(aim.y, 6)
    expect(at.z).toBeCloseTo(aim.z, 6)
    // About a second to the far page: long enough that owls need leading.
    expect(reach).toBeGreaterThan(0.8)
  })

  it('catches a pea passing through an owl, and not one going by', () => {
    const owl = { x: 0, y: 4.4, z: -3 }
    expect(peaHits({ x: -1, y: 4.4, z: -3 }, { x: 1, y: 4.4, z: -3 }, owl)).toBe(true)
    expect(peaHits({ x: -1, y: 4.4, z: -4 }, { x: 1, y: 4.4, z: -4 }, owl)).toBe(false)
    // Taller than wide: a pea a little above or below still counts.
    expect(peaHits({ x: -1, y: 5.2, z: -3 }, { x: 1, y: 5.2, z: -3 }, owl)).toBe(true)
  })

  it('knocks the word loose where the owl is, at its speed, and the owl flies on', () => {
    const { host, launched, asHost } = fakeHost()
    const owls = new OwlsDelivery(asHost, CONFIG)
    const owl = owls.owls.find(o => o.backAt === null && o.carrying)
    if (!owl) throw new Error('no owl carrying a word at the start')
    owl.x = 0
    // Lead it: aim where it will be when the pea gets there.
    const reach = peaShot(CONFIG.shooter, { x: 0, y: CONFIG.aimY, z: owl.z }).reach
    const ahead = owls.owlAhead(owl, reach)
    owls.aimAt(ahead.x, owl.z)
    owls.aim = { ...owls.aim, y: owl.y }
    expect(owls.input({ type: 'press' })).toBe(true)
    expect(owls.busy).toBe(1)
    for (let i = 0; i < 120 && !launched.length; i++) tick(owls, host)
    expect(launched).toHaveLength(1)
    const word = launched[0]
    expect(word.z).toBeCloseTo(owl.z, 6)
    expect(word.y).toBeLessThan(owl.y)
    expect(Math.sign(word.velocity?.x ?? 0)).toBe(Math.sign(owl.vx))
    expect(owl.carrying).toBe(false)
    expect(owl.hooAt).not.toBeNull()
    expect(owls.busy).toBe(0)
    // Unharmed: still flying the same way.
    const x = owl.x
    tick(owls, host)
    expect(Math.sign(owl.x - x)).toBe(Math.sign(owl.vx))
  })

  it('lets a miss fade out, and reloads between shots', () => {
    const { host, launched, asHost } = fakeHost()
    const owls = new OwlsDelivery(asHost, CONFIG)
    for (const o of owls.owls) o.backAt = 1e9
    owls.aimAt(0, -3)
    expect(owls.input({ type: 'press' })).toBe(true)
    expect(owls.input({ type: 'press' })).toBe(false)
    const reach = owls.shot().reach
    const steps = Math.ceil((reach + FADE_S) / PHYSICS_STEP_S) + 2
    for (let i = 0; i < steps; i++) tick(owls, host)
    expect(owls.busy).toBe(0)
    expect(launched).toHaveLength(0)
    expect(host.engine.time).toBeGreaterThan(RELOAD_S)
    expect(owls.input({ type: 'press' })).toBe(true)
  })

  it('aims by the pointer and by the arrow keys, kept over the book', () => {
    const { host, asHost } = fakeHost()
    const owls = new OwlsDelivery(asHost, CONFIG)
    owls.input({ type: 'point', x: 50, z: 0 })
    expect(owls.aim.x).toBeLessThan(5)
    owls.input({ type: 'point', x: 0, z: -3 })
    owls.input({ type: 'steer', x: 1, z: 0 })
    for (let i = 0; i < 30; i++) tick(owls, host)
    owls.input({ type: 'steer', x: 0, z: 0 })
    expect(owls.aim.x).toBeCloseTo(3, 1)
    expect(owls.aim.z).toBeCloseTo(-3, 6)
  })

  it('always has a word in the sky while there are words left, and none after', () => {
    const { host, asHost } = fakeHost(3)
    const owls = new OwlsDelivery(asHost, CONFIG)
    let longestGap = 0
    let gap = 0
    // Two minutes without a hit: owls keep coming, each with a word.
    for (let i = 0; i < 120 * 60; i++) {
      tick(owls, host)
      const words = owls.owls.filter(o => o.backAt === null && o.carrying)
      expect(words.length).toBeLessThanOrEqual(3)
      gap = words.some(o => Math.abs(o.x) < OWL_EXIT_X - 1) ? 0 : gap + PHYSICS_STEP_S
      longestGap = Math.max(longestGap, gap)
    }
    expect(longestGap).toBeLessThan(3)
    // The budget runs out: nobody holds a word, and nothing is waited on.
    host.state.coinsLeft = 0
    tick(owls, host)
    expect(owls.owls.some(o => o.carrying)).toBe(false)
    expect(owls.busy).toBe(0)
    expect(owls.input({ type: 'press' })).toBe(false)
  })

  it('says a word pays on bare page just in front of a pulled-back pusher', () => {
    const layout = BOOK.table.layout ?? []
    const far = layout.find(d => !d.pusher.reversed)
    if (!far) throw new Error('no far page')
    // The far page is pulled right back (stroke -1) three quarters of a stroke in.
    const back = (PUSHER_PERIOD_S * 3) / 4 + far.pusher.lagS
    const face = deckFaceZ(far, -1)
    expect(landsWell(layout, face + 1, back, PUSHER_PERIOD_S)).toBe(true)
    // On the pusher's top, too far out, or with the pusher forward: no.
    expect(landsWell(layout, face - 1, back, PUSHER_PERIOD_S)).toBe(false)
    expect(landsWell(layout, face + 3, back, PUSHER_PERIOD_S)).toBe(false)
    expect(landsWell(layout, face + 1, back - PUSHER_PERIOD_S / 2, PUSHER_PERIOD_S)).toBe(false)
  })

  describe('in the game', () => {
    beforeAll(async () => {
      await initPhysics()
    })

    it('plays a whole stage of words to the end by shooting owls', () => {
      const game = new DropGame(BOOK, { pile: [] })
      const owls = game.delivery as OwlsDelivery
      let steps = 0
      while (game.state.phase !== 'over' && steps < 60 * 400) {
        // Shoot straight at the first owl carrying a word, led by the pea's flight.
        const owl = owls.owls.find(o => o.backAt === null && o.carrying)
        if (owl && owls.ready) {
          const reach = owls.shot({ x: owl.x, y: CONFIG.aimY, z: owl.z }).reach
          const at = owls.owlAhead(owl, reach)
          game.input({ type: 'point', x: at.x, z: at.z })
          game.press()
        }
        game.step()
        steps++
      }
      expect(game.state.phase).toBe('over')
      expect(game.state.coinsLeft).toBe(0)
      game.dispose()
    }, 120_000)
  })
})
