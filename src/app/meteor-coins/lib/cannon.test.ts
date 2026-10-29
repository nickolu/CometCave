import {
  type Hoop,
  type Vec,
  chargeAfter,
  dropsThroughHoop,
  flightPath,
  hoopX,
  launchVelocity,
  muzzleAt,
  throughHoop,
} from './cannon'
import { CannonDelivery } from './deliveries/cannon'
import { deliveryHowTo, deliveryOf } from './deliveries/index'
import { PusherEngine, initPhysics } from './engine'
import { DropGame } from './game'
import { type StageDef, playableStage } from './stages'

const HOOP_LA = playableStage('hoop-la-cannon') as StageDef
const CANNON = HOOP_LA.cannon!

function cannon(game: DropGame): CannonDelivery {
  if (!(game.delivery instanceof CannonDelivery)) throw new Error('no cannon')
  return game.delivery
}

/** Whether a path drops down through `hoop`, centered at `x`. */
function dropsThrough(path: Vec[], hoop: Hoop, x = hoop.x): boolean {
  return path.some((p, i) => i > 0 && dropsThroughHoop(hoop, x, path[i - 1], p, 0.5))
}

/** The aim that points the cannon's flat line over `x` at depth `z`. */
function yawAt(x: number, z: number): number {
  return Math.atan2(x - CANNON.pivot.x, CANNON.pivot.z - z)
}

describe('the cannon', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('previews exactly the arc a fired coin flies', () => {
    for (const [yaw, power] of [
      [0, 0],
      [0.2, 0.5],
      [-0.25, 1],
    ]) {
      const engine = new PusherEngine({ pile: [] })
      const start = muzzleAt(yaw, CANNON)
      const v = launchVelocity(yaw, power, CANNON)
      const index = engine.spawn(start.x, start.y, start.z, 'player', 0, v) as number
      // Up to where it would meet the pile or the backboard.
      const path = flightPath(start, v, p => p.y < 1 || p.z < -4.8)
      for (let i = 1; i < path.length; i++) {
        engine.step()
        const t = engine.pucks[index].body.translation()
        expect(Math.hypot(t.x - path[i].x, t.y - path[i].y, t.z - path[i].z)).toBeLessThan(1e-3)
      }
      engine.dispose()
    }
  })

  it('fills the charge in its time and stops', () => {
    expect(chargeAfter(0, CANNON)).toBe(0)
    expect(chargeAfter(CANNON.chargeS / 2, CANNON)).toBeCloseTo(0.5)
    expect(chargeAfter(CANNON.chargeS * 3, CANNON)).toBe(1)
  })

  it('counts a flat hoop only when the whole coin drops down inside the rim', () => {
    const hoop = { x: 0, y: 2, z: 0, radius: 0.8, bonus: 3 }
    const down = (x: number, z: number) =>
      dropsThroughHoop(hoop, 0, { x, y: 2.1, z }, { x, y: 1.9, z }, 0.5)
    expect(down(0, 0)).toBe(true)
    expect(down(0.2, -0.2)).toBe(true)
    // The coin's edge would touch the rim.
    expect(down(0.35, 0)).toBe(false)
    expect(down(0, 0.35)).toBe(false)
    // Going up through it, or passing beside it, isn't a basket.
    expect(dropsThroughHoop(hoop, 0, { x: 0, y: 1.9, z: 0 }, { x: 0, y: 2.1, z: 0 }, 0.5)).toBe(
      false
    )
    expect(dropsThroughHoop(hoop, 0, { x: 0, y: 2.5, z: 0 }, { x: 0, y: 2.1, z: 0 }, 0.5)).toBe(
      false
    )
    // Judged where it crosses the rim's height: halfway between the steps here.
    expect(
      dropsThroughHoop(hoop, 0, { x: 0, y: 2.2, z: 0.6 }, { x: 0, y: 1.8, z: -0.6 }, 0.5)
    ).toBe(true)
    // The rim moves with a sliding hoop.
    expect(dropsThroughHoop(hoop, 1, { x: 1, y: 2.1, z: 0 }, { x: 1, y: 1.9, z: 0 }, 0.5)).toBe(
      true
    )
    expect(
      down(0, 0) && !dropsThroughHoop(hoop, 1, { x: 0, y: 2.1, z: 0 }, { x: 0, y: 1.9, z: 0 }, 0.5)
    ).toBe(true)
  })

  it('keeps the upright crossing for any stage that hangs hoops facing the player', () => {
    const hoop = { x: 0, y: 2, z: 0, radius: 0.8, bonus: 3 }
    expect(throughHoop(hoop, { x: 0, y: 2, z: 0.1 }, { x: 0, y: 2, z: -0.1 }, 0.5, 0.09)).toBe(true)
    expect(
      throughHoop(hoop, { x: 0.35, y: 2, z: 0.1 }, { x: 0.35, y: 2, z: -0.1 }, 0.5, 0.09)
    ).toBe(false)
  })

  it('slides only the hoops with a sweep, within their track', () => {
    const sliding = CANNON.hoops.filter(h => h.sweep)
    expect(sliding.map(h => h.bonus)).toEqual([10])
    for (const hoop of CANNON.hoops) {
      const xs = Array.from({ length: 100 }, (_, i) => hoopX(hoop, i * 0.05))
      if (!hoop.sweep) expect(new Set(xs).size).toBe(1)
      else {
        expect(Math.max(...xs)).toBeGreaterThan(hoop.x + hoop.sweep.ampX * 0.9)
        expect(Math.min(...xs)).toBeLessThan(hoop.x - hoop.sweep.ampX * 0.9)
      }
    }
  })

  it('reaches every hoop with a narrow band of charge, and clears them all at full charge', () => {
    for (const hoop of CANNON.hoops) {
      // Anywhere along a sliding hoop's track, as well as its middle.
      const xs = hoop.sweep
        ? [hoop.x - hoop.sweep.ampX, hoop.x, hoop.x + hoop.sweep.ampX]
        : [hoop.x]
      for (const x of xs) {
        const yaw = yawAt(x, hoop.z)
        expect(Math.abs(yaw)).toBeLessThan(CANNON.maxYaw)
        const threads = (power: number) =>
          dropsThrough(
            flightPath(muzzleAt(yaw, CANNON), launchVelocity(yaw, power, CANNON), p => p.y < 0.7),
            hoop,
            x
          )
        const powers = Array.from({ length: 201 }, (_, i) => i / 200)
        const band = powers.filter(threads)
        expect(band.length).toBeGreaterThan(0)
        // A real challenge: well under a tenth of a second of the hold does it.
        expect(band.length / 200).toBeLessThan(0.1 / CANNON.chargeS)
        expect(threads(1)).toBe(false)
      }
    }
  })

  it('shows the flat line while it swings, and the arc only once the direction is locked', () => {
    const game = new DropGame(HOOP_LA, { pile: [] })
    const c = cannon(game)
    const line = c.aimLine()
    expect(line.length).toBeGreaterThan(5)
    expect(new Set(line.map(p => p.y)).size).toBe(1)
    expect(c.previewPath()).toEqual([])
    expect(game.press()).toBe(true)
    expect(c.isLocked).toBe(true)
    expect(c.aimLine()).toEqual([])
    const short = c.previewPath()
    expect(short.length).toBeGreaterThan(5)
    expect(Math.max(...short.map(p => p.y))).toBeGreaterThan(line[0].y + 0.5)
    // Pressing again starts the charge, and the arc grows with it.
    expect(game.press()).toBe(true)
    for (let i = 0; i < 20; i++) game.step()
    const longer = c.previewPath()
    expect(longer[longer.length - 1].z).toBeLessThan(short[short.length - 1].z)
    game.dispose()
  })

  it('holds the locked direction while the cannon would have swung on', () => {
    const game = new DropGame(HOOP_LA, { pile: [] })
    for (let i = 0; i < 20; i++) game.step()
    game.press()
    const locked = cannon(game).yaw
    for (let i = 0; i < 60; i++) game.step()
    expect(cannon(game).yaw).toBe(locked)
    // Letting go of the locking press doesn't fire: nothing's charged.
    expect(game.release()).toBe(false)
    expect(game.state.coinsLeft).toBe(HOOP_LA.rules.coins)
    game.dispose()
  })

  it('locks on a hoop, charges for it, and pours its bonus', () => {
    const game = new DropGame(HOOP_LA, { pile: [] })
    const c = cannon(game)
    const hoop = CANNON.hoops.find(h => h.bonus === 6) as Hoop
    // Wait for the swing to point at the hoop, and lock there.
    const target = yawAt(hoop.x, hoop.z)
    while (Math.abs(c.yaw - target) > 0.01) game.step()
    expect(game.press()).toBe(true)
    expect(game.press()).toBe(true)
    let hooped = false
    for (let i = 0; i < 200 && !hooped; i++) {
      if (c.charge !== null && dropsThrough(c.previewPath(), hoop)) {
        expect(game.release()).toBe(true)
        expect(game.state.coinsLeft).toBe((HOOP_LA.rules.coins as number) - 1)
        expect(c.isLocked).toBe(false)
        for (let s = 0; s < 120; s++) {
          if (game.step().some(e => e.type === 'hoop' && e.bonus === hoop.bonus)) hooped = true
        }
      } else {
        game.step()
      }
    }
    expect(hooped).toBe(true)
    expect(game.state.hits).toBe(1)
    game.dispose()
  })

  it('takes three taps in tap mode: direction, power, fire', () => {
    const game = new DropGame(HOOP_LA, { pile: [] })
    cannon(game).mode = 'tap'
    expect(game.press()).toBe(true)
    expect(game.release()).toBe(false)
    expect(game.press()).toBe(true)
    for (let i = 0; i < 30; i++) game.step()
    expect(game.release()).toBe(false)
    expect(game.state.coinsLeft).toBe(HOOP_LA.rules.coins)
    expect(game.press()).toBe(true)
    expect(game.state.coinsLeft).toBe((HOOP_LA.rules.coins as number) - 1)
    game.dispose()
  })

  it('explains both steps in plain words', () => {
    const delivery = deliveryOf(HOOP_LA)
    expect(deliveryHowTo(delivery, false)).toMatch(/direction.*hold.*let go/i)
    expect(deliveryHowTo(delivery, true)).toMatch(/direction.*again.*once more/i)
  })
})
