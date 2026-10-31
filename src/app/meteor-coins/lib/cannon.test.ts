import { chargeAfter, flightPath, launchVelocity, muzzleAt, throughHoop } from './cannon'
import { CannonDelivery } from './deliveries/cannon'
import { PusherEngine, initPhysics } from './engine'
import { DropGame } from './game'
import { type StageDef, playableStage } from './stages'

const HOOP_LA = playableStage('hoop-la-cannon') as StageDef
const CANNON = HOOP_LA.cannon!

function cannon(game: DropGame): CannonDelivery {
  if (!(game.delivery instanceof CannonDelivery)) throw new Error('no cannon')
  return game.delivery
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

  it('counts a hoop only when the whole coin clears the rim', () => {
    const hoop = { x: 0, y: 2, z: 0, radius: 0.8, bonus: 3 }
    const through = (x: number, y: number) =>
      throughHoop(hoop, { x, y, z: 0.1 }, { x, y, z: -0.1 }, 0.5, 0.09)
    expect(through(0, 2)).toBe(true)
    expect(through(0.25, 2)).toBe(true)
    // The coin's edge would touch the rim.
    expect(through(0.35, 2)).toBe(false)
    expect(through(0, 2.8)).toBe(false)
    // Moving away from the hoop, or not reaching it, isn't a pass.
    expect(throughHoop(hoop, { x: 0, y: 2, z: -0.1 }, { x: 0, y: 2, z: 0.1 }, 0.5, 0.09)).toBe(
      false
    )
  })

  it('reaches every hoop with some charge, and clears them all at full charge', () => {
    for (const hoop of CANNON.hoops) {
      const yaw = Math.atan2(hoop.x - CANNON.pivot.x, CANNON.pivot.z - hoop.z)
      expect(Math.abs(yaw)).toBeLessThan(CANNON.maxYaw)
      const threads = (power: number) => {
        const path = flightPath(
          muzzleAt(yaw, CANNON),
          launchVelocity(yaw, power, CANNON),
          p => p.y < 0.7
        )
        return path.some((p, i) => i > 0 && throughHoop(hoop, path[i - 1], p, 0.5, 0.09))
      }
      const powers = Array.from({ length: 101 }, (_, i) => i / 100)
      expect(powers.some(threads)).toBe(true)
      expect(threads(1)).toBe(false)
    }
  })

  it("locks the aim on press, fires on release, and pours a hoop's bonus", () => {
    const game = new DropGame(HOOP_LA, { pile: [] })
    const hoop = CANNON.hoops[0]
    // Wait for the swing to point at the hoop, then hold for its charge.
    const target = Math.atan2(hoop.x - CANNON.pivot.x, CANNON.pivot.z - hoop.z)
    while (Math.abs(cannon(game).yaw - target) > 0.01) game.step()
    expect(game.press()).toBe(true)
    const locked = cannon(game).yaw
    let hooped = false
    for (let i = 0; i < 200 && !hooped; i++) {
      const path = cannon(game).previewPath()
      const lines = path.some((p, k) => k > 0 && throughHoop(hoop, path[k - 1], p, 0.5, 0.09))
      if (lines && cannon(game).charge !== null) {
        expect(cannon(game).yaw).toBe(locked)
        expect(game.release()).toBe(true)
        expect(game.state.coinsLeft).toBe((HOOP_LA.rules.coins as number) - 1)
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

  it('fires on a second tap in tap mode', () => {
    const game = new DropGame(HOOP_LA, { pile: [] })
    cannon(game).mode = 'tap'
    expect(game.press()).toBe(true)
    for (let i = 0; i < 30; i++) game.step()
    expect(game.release()).toBe(false)
    expect(game.state.coinsLeft).toBe(HOOP_LA.rules.coins)
    expect(game.press()).toBe(true)
    expect(game.state.coinsLeft).toBe((HOOP_LA.rules.coins as number) - 1)
    game.dispose()
  })
})
