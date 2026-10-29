import { PHYSICS_STEP_S } from './cabinet'
import { AIM_ARRIVED, CraneDelivery } from './deliveries/crane'
import { initPhysics } from './engine'
import { DropGame } from './game'
import { type StageDef, playableStage } from './stages'

const PORCH = playableStage('moonstone-porch') as StageDef

function crane(game: DropGame): CraneDelivery {
  if (!(game.delivery instanceof CraneDelivery)) throw new Error('no crane')
  return game.delivery
}

/** A bare porch, so nothing on the table gets in the way. */
const bare = () => new DropGame(PORCH, { pile: [] })

function run(game: DropGame, seconds: number) {
  for (let i = 0; i < Math.round(seconds / PHYSICS_STEP_S); i++) game.step()
}

describe('the crane', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('glides toward the pointer at no more than its top speed', () => {
    const game = bare()
    const c = crane(game)
    const start = { ...c.trolley }
    game.input({ type: 'point', x: 3, z: 1 })
    run(game, 0.5)
    const moved = Math.hypot(c.trolley.x - start.x, c.trolley.z - start.z)
    expect(moved).toBeGreaterThan(0.3)
    expect(moved).toBeLessThanOrEqual(c.config.speed * 0.5 + 1e-6)
    run(game, 4)
    expect(c.trolley.x).toBeCloseTo(3, 1)
    expect(c.trolley.z).toBeCloseTo(1, 1)
    game.dispose()
  })

  it('is steered by the arrow keys, and stops at the ends of the gantry', () => {
    const game = bare()
    const c = crane(game)
    game.input({ type: 'steer', x: 1, z: 0 })
    run(game, 0.5)
    expect(c.trolley.x).toBeGreaterThan(0.5)
    run(game, 5)
    expect(c.trolley.x).toBe(c.config.x[1])
    game.input({ type: 'steer', x: 0, z: -1 })
    run(game, 6)
    expect(c.trolley.z).toBe(c.config.z[0])
    game.dispose()
  })

  it('swings behind its motion, then settles', () => {
    const game = bare()
    const c = crane(game)
    game.input({ type: 'steer', x: 1, z: 0 })
    run(game, 0.4)
    // Speeding up to the right, the claw trails to the left.
    expect(c.claw.x).toBeLessThan(c.trolley.x - 0.05)
    game.input({ type: 'steer', x: 0, z: 0 })
    run(game, 0.6)
    expect(c.swing).toBeGreaterThan(0.05)
    run(game, 6)
    expect(c.swing).toBeLessThan(0.01)
    game.dispose()
  })

  it('drops the coin from the claw, moving as the claw was', () => {
    const game = bare()
    const c = crane(game)
    game.input({ type: 'steer', x: 1, z: 0 })
    run(game, 0.6)
    const at = c.claw
    const v = c.clawVelocity
    expect(game.press()).toBe(true)
    const puck = game.engine.pucks.find(p => p.active && p.kind === 'player')
    expect(puck).toBeDefined()
    const t = puck!.body.translation()
    expect(t.x).toBeCloseTo(at.x, 5)
    expect(t.z).toBeCloseTo(at.z, 5)
    expect(puck!.body.linvel().x).toBeCloseTo(v.x, 5)
    expect(game.state.coinsLeft).toBe((PORCH.rules.coins as number) - 1)
    game.dispose()
  })

  it('lands where its marker says', () => {
    const game = bare()
    const c = crane(game)
    game.input({ type: 'steer', x: -1, z: 1 })
    run(game, 0.5)
    // On the move, so the coin flies on as it falls.
    const land = c.landing()
    expect(game.press()).toBe(true)
    const index = game.engine.pucks.findIndex(p => p.active && p.kind === 'player')
    for (let i = 0; i < 120; i++) {
      game.step()
      if (game.engine.pucks[index].body.translation().y < land.y + 0.05) break
    }
    const t = game.engine.pucks[index].body.translation()
    expect(Math.hypot(t.x - land.x, t.z - land.z)).toBeLessThan(0.1)
    game.dispose()
  })

  it('reloads before it can drop again', () => {
    const game = bare()
    const c = crane(game)
    expect(game.press()).toBe(true)
    expect(c.loaded).toBe(false)
    expect(game.press()).toBe(false)
    run(game, c.config.reloadS + 0.05)
    expect(c.loaded).toBe(true)
    expect(game.press()).toBe(true)
    expect(game.state.coinsLeft).toBe((PORCH.rules.coins as number) - 2)
    game.dispose()
  })

  it('on a tap well away from the claw, only moves there', () => {
    const game = bare()
    const c = crane(game)
    game.input({ type: 'point', x: c.trolley.x + AIM_ARRIVED + 1, z: c.trolley.z })
    expect(game.press()).toBe(true)
    expect(game.state.coinsLeft).toBe(PORCH.rules.coins)
    run(game, 2)
    expect(game.press()).toBe(true)
    expect(game.state.coinsLeft).toBe((PORCH.rules.coins as number) - 1)
    game.dispose()
  })

  it('slows down in slow mode', () => {
    const game = bare()
    const c = crane(game)
    game.setSpeed(0.5)
    game.input({ type: 'steer', x: 1, z: 0 })
    run(game, 1)
    const slow = c.trolley.x
    game.dispose()
    const fast = bare()
    fast.input({ type: 'steer', x: 1, z: 0 })
    run(fast, 0.5)
    // The same motion, stepped twice as finely.
    expect(crane(fast).trolley.x).toBeCloseTo(slow, 1)
    fast.dispose()
  })
})
