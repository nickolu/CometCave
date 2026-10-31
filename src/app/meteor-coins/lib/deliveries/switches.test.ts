import {
  SwitchesDelivery,
  type Way,
  junctionAt,
  laneX,
  otherLane,
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

const key = (game: DropGame, x: number, z: number) => {
  game.input({ type: 'steer', x, z })
  game.input({ type: 'steer', x: 0, z: 0 })
}

/** Steps until `done`, or a few seconds; returns every event raised. */
function run(game: DropGame, steps: number, done: () => boolean = () => false): GameEvent[] {
  const events: GameEvent[] = []
  for (let i = 0; i < steps && !done(); i++) events.push(...game.step())
  return events
}

/** Sets the junctions so the next coin comes out at `exit`. */
function routeTo(d: SwitchesDelivery, exit: number) {
  const n = d.config.junctions.length
  for (let mask = 0; mask < 1 << n; mask++) {
    d.config.junctions.forEach((_, j) => (d.ways[j] = (mask >> j) & 1 ? 'right' : 'left'))
    if (d.route().exit === exit) return
  }
  throw new Error(`no route to ${exit}`)
}

const exitOver = (d: SwitchesDelivery, deck: number, lane: number) =>
  d.config.exits.findIndex(e => e.deck === deck && e.lane === lane)

describe('the track switches', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('reaches every lane of every step, by some setting of the junctions', () => {
    const c = CASCADE.delivery as { kind: 'switches' } & SwitchesDelivery['config']
    const reached = new Set<number>()
    const n = c.junctions.length
    for (let mask = 0; mask < 1 << n; mask++) {
      const ways = c.junctions.map((_, j): Way => ((mask >> j) & 1 ? 'right' : 'left'))
      reached.add(routeOf(c, ways).exit)
    }
    expect([...reached].sort((a, b) => a - b)).toEqual(c.exits.map((_, i) => i))
    for (const deck of [0, 1, 2]) {
      for (const lane of [0, 1, 2]) {
        expect(c.exits.some(e => e.deck === deck && e.lane === lane)).toBe(true)
      }
    }
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

  it('matches a tap to a lower junction along the pointer ray', () => {
    const { d } = setup()
    const c = d.config
    const aimY = c.junctions[0].at.y
    // A camera in front and above: up the ray, the point comes toward the player.
    const rise = { x: 0, z: 0.8 }
    const low = c.junctions.findIndex(j => j.at.y < aimY - 2)
    const j = c.junctions[low].at
    const x = j.x
    const z = j.z + rise.z * (aimY - j.y)
    expect(junctionAt(c, x, z, rise)).toBe(low)
    // Read straight down, the same point is nowhere near it.
    expect(junctionAt(c, x, z)).not.toBe(low)
  })

  it('sets a route with the arrow keys, one junction at a time down the lit tube', () => {
    const { game, d } = setup()
    expect(d.selected).toBe(0)
    // Right at every junction: the right lane, all the way to the bottom step.
    for (let k = 0; k < 4; k++) key(game, 1, 0)
    expect(d.route().exit).toBe(exitOver(d, 0, 2))
    expect(d.keyboard).toBe(true)
    // Up goes back along the route; left there drops the coin on the top step.
    const last = d.route().junctions
    key(game, 0, -1)
    expect(d.selected).toBe(last[last.length - 2])
    key(game, -1, 0)
    expect(d.route().exit).toBe(exitOver(d, 2, 2))
    // Held, a key does nothing more.
    game.input({ type: 'steer', x: -1, z: 0 })
    const ways = [...d.ways]
    game.input({ type: 'steer', x: -1, z: 0 })
    expect(d.ways).toEqual(ways)
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

  it('tips the gold hopper when enough coins drop on gold, there, and moves gold to the empty lane', () => {
    const { game, d } = setup()
    const i = d.config.plates.decks.findIndex(p => p.deck === 0)
    const { gold, red } = d.plateLanes(i)
    routeTo(d, exitOver(d, 0, gold))
    const events: GameEvent[] = []
    for (let s = 0; s < 60 * 10 && d.plates[i].tripped === null; s++) {
      d.send()
      events.push(...game.step())
    }
    const trip = events.find(e => e.type === 'plate')
    expect(trip).toMatchObject({ type: 'plate', plate: 'gold', deck: 'bottom step' })
    // The first bonus coin pours from over the plate that went off.
    expect(game.state.showerLeft).toBe(d.config.plates.bonus - 1)
    expect(Math.abs(d.bonusAt().x - laneX(gold))).toBeLessThan(0.6)
    expect(d.plateLanes(i)).toEqual({ gold: otherLane(gold, red), red })
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

  it('raises a bar across the lip when coins spill onto red, lowers it after, and moves red', () => {
    const { game, d } = setup()
    const i = d.config.plates.decks.findIndex(p => p.deck === 1)
    const { gold, red } = d.plateLanes(i)
    // Red only goes off while the stage is being played.
    game.state = { ...game.state, phase: 'playing' }
    spill(game, red, d.config.plates.redCoins + 1)
    const events = run(game, 120, () => d.plates[i].tripped !== null)
    expect(events.find(e => e.type === 'plate')).toMatchObject({ plate: 'red' })
    expect(d.plateLanes(i)).toEqual({ gold, red: otherLane(gold, red) })
    run(game, 30)
    const lip = game.engine.layout[1]
    expect(d.bars[i].raised).toBe(1)
    expect(d.bars[i].body.translation().y).toBeGreaterThan(lip.floorY)
    run(game, Math.ceil(d.config.plates.barS * 60))
    expect(d.bars[i].raised).toBe(0)
    expect(d.bars[i].body.translation().y).toBeLessThan(lip.floorY)
    game.dispose()
  })
})
