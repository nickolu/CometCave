import {
  SwitchesDelivery,
  type Way,
  junctionAt,
  laneX,
  routeOf,
} from '@/app/meteor-coins/lib/deliveries/switches'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame, type GameEvent } from '@/app/meteor-coins/lib/game'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'

const CASCADE = playableStage('the-cascade-engine') as StageDef

function setup(): { game: DropGame; d: SwitchesDelivery } {
  const game = new DropGame(CASCADE, { pile: [] })
  if (!(game.delivery instanceof SwitchesDelivery)) throw new Error('no switches')
  return { game, d: game.delivery }
}

const tap = (game: DropGame, x: number, z: number) => {
  game.input({ type: 'point', x, z })
  return game.input({ type: 'press' })
}

/** Steps until `done`, or a few seconds; returns every event raised. */
function run(game: DropGame, steps: number, done: () => boolean = () => false): GameEvent[] {
  const events: GameEvent[] = []
  for (let i = 0; i < steps && !done(); i++) events.push(...game.step())
  return events
}

describe('the track switches', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('routes to every exit by some setting of the junctions', () => {
    const c = CASCADE.delivery as { kind: 'switches' } & SwitchesDelivery['config']
    const reached = new Set<number>()
    const n = c.junctions.length
    for (let mask = 0; mask < 1 << n; mask++) {
      const ways = c.junctions.map((_, j): Way => ((mask >> j) & 1 ? 'right' : 'left'))
      reached.add(routeOf(c, ways).exit)
    }
    expect([...reached].sort()).toEqual(c.exits.map((_, i) => i))
  })

  it('flips a junction on a tap there, and sends a coin on a tap anywhere else', () => {
    const { game, d } = setup()
    const j = d.config.junctions[1].at
    expect(junctionAt(d.config, j.x + 0.3, j.z)).toBe(1)
    const before = d.ways[1]
    expect(tap(game, j.x, j.z)).toBe(true)
    expect(d.ways[1]).not.toBe(before)
    expect(d.rolling.length).toBe(0)
    expect(tap(game, 0, 0)).toBe(true)
    expect(d.rolling.length).toBe(1)
    // Too soon after the last one: the next coin waits its turn.
    expect(tap(game, 0, 0)).toBe(false)
    game.dispose()
  })

  it('picks and sets junctions with the arrow keys', () => {
    const { game, d } = setup()
    expect(d.selected).toBe(0)
    game.input({ type: 'steer', x: 0, z: 1 })
    game.input({ type: 'steer', x: 0, z: 0 })
    expect(d.selected).toBe(1)
    game.input({ type: 'steer', x: -1, z: 0 })
    expect(d.ways[1]).toBe('left')
    // Held, it does nothing more.
    game.input({ type: 'steer', x: -1, z: 0 })
    game.input({ type: 'steer', x: 0, z: 0 })
    game.input({ type: 'steer', x: 1, z: 0 })
    expect(d.ways[1]).toBe('right')
    game.input({ type: 'steer', x: 0, z: -1 })
    expect(d.selected).toBe(0)
    expect(d.keyboard).toBe(true)
    game.dispose()
  })

  it('rolls a coin down the tubes and drops it from the spout it reaches', () => {
    const { game, d } = setup()
    const coins = game.state.coinsLeft as number
    expect(tap(game, 0, 0)).toBe(true)
    // The coins aren't spent until one leaves the tubes.
    expect(game.state.coinsLeft).toBe(coins)
    // Flipped while the coin is still above it: the junction is read on arrival.
    const second = d.config.junctions[1].at
    tap(game, second.x, second.z)
    const exit = d.route().exit
    run(game, 240, () => d.rolling.length === 0)
    expect(d.rolling.length).toBe(0)
    expect(game.state.coinsLeft).toBe(coins - 1)
    const mouth = d.config.exits[exit].at
    const coin = game.engine.pucks.find(p => p.active && p.kind === 'player')
    expect(coin).toBeDefined()
    const at = coin!.body.translation()
    expect(Math.abs(at.x - mouth.x)).toBeLessThan(0.3)
    expect(Math.abs(at.z - mouth.z)).toBeLessThan(0.3)
    game.dispose()
  })

  /**
   * Drops coins off the top deck's lip into a lane, side by side, onto the
   * middle step's plates. One more than a plate needs, as the first ones'
   * weight has begun to drain by the time the last lands.
   */
  function spill(game: DropGame, lane: 0 | 1 | 2, count: number) {
    const lip = game.engine.layout[2].frontZ
    for (let k = 0; k < count; k++) {
      const x = laneX(lane) + ((k % 3) - 1) * 0.8
      game.engine.spawn(x, 2.7 + Math.floor(k / 3) * 0.4, lip - 0.15, 'seed', 0, {
        x: 0,
        y: 0,
        z: 2,
      })
    }
  }

  it('pours bonus coins when enough land on gold, and moves the plates on', () => {
    const { game, d } = setup()
    const { gold } = d.plateLanes(1)
    spill(game, gold, d.config.plates.goldCoins + 1)
    const events = run(game, 120, () => d.plates[1].tripped !== null)
    const trip = events.find(e => e.type === 'plate')
    expect(trip).toMatchObject({ type: 'plate', plate: 'gold', deck: 'middle step' })
    // The first bonus coin pours on the same step.
    expect(game.state.showerLeft).toBe(d.config.plates.bonus - 1)
    expect(d.plateLanes(1).gold).not.toBe(gold)
    game.dispose()
  })

  it('raises a bar across the lip when enough land on red, and lowers it after', () => {
    const { game, d } = setup()
    const { red } = d.plateLanes(1)
    // Red only trips while the stage is being played.
    game.state = { ...game.state, phase: 'playing' }
    spill(game, red, d.config.plates.redCoins + 1)
    const events = run(game, 120, () => d.plates[1].tripped !== null)
    expect(events.find(e => e.type === 'plate')).toMatchObject({ plate: 'red' })
    run(game, 30)
    const lip = game.engine.layout[1]
    expect(d.bars[1].raised).toBe(1)
    expect(d.bars[1].body.translation().y).toBeGreaterThan(lip.floorY)
    run(game, Math.ceil(d.config.plates.barS * 60))
    expect(d.bars[1].raised).toBe(0)
    expect(d.bars[1].body.translation().y).toBeLessThan(lip.floorY)
    game.dispose()
  })
})
