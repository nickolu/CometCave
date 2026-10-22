import { deckPusherZ } from './cabinet'
import { PusherEngine, initPhysics } from './engine'
import { DropGame, type GameEvent } from './game'
import { CORE } from './objects'
import { type GameState, initialState, starsFor } from './rules'
import { STAGES, type StageDef, playableStage } from './stages'

const HOMECOMING = playableStage('comet-homecoming') as StageDef

describe('stages with phases', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it("splits every phased stage's budget exactly across its phases", () => {
    for (const stage of STAGES) {
      if (!stage.playable || !stage.phases) continue
      expect(stage.phases.reduce((n, p) => n + p.coins, 0)).toBe(stage.rules.coins)
    }
  })

  it('reconfigures the cabinet as each phase starts', () => {
    const game = new DropGame(HOMECOMING, { pile: [] })
    const phases = HOMECOMING.phases!
    const events: GameEvent[] = []
    const dropPhase = () => {
      for (let n = 0; n < phases[game.phase].coins; n++) {
        expect(game.tapDrop()).toBe(true)
        for (let i = 0; i < 4; i++) events.push(...game.step())
      }
      // Give the obstacles time to rise and sink.
      for (let i = 0; i < 60; i++) events.push(...game.step())
    }
    const heights = () => game.engine.moverPositions().map(p => p.y)
    // Wake: pegs up, bumper down, the ring out, normal gravity.
    const [pegL, pegR, bumper] = heights()
    expect(pegL).toBeGreaterThan(0)
    expect(pegR).toBeGreaterThan(0)
    expect(bumper).toBeLessThan(0)
    expect(game.ringOn).toBe(true)
    dropPhase()
    // Orbit: low gravity, and the bumper is up and sweeping.
    expect(game.phase).toBe(1)
    expect(game.engine.world.gravity.y).toBeCloseTo(-20 * (phases[1].gravityScale ?? 1))
    expect(heights()[2]).toBeGreaterThan(0)
    const x0 = game.engine.moverPositions()[2].x
    for (let i = 0; i < 60; i++) game.step()
    expect(game.engine.moverPositions()[2].x).not.toBeCloseTo(x0)
    dropPhase()
    // Homecoming: pegs and bumper sunk, the ring away, gravity back.
    expect(game.phase).toBe(2)
    expect(heights().every(y => y < 0)).toBe(true)
    expect(game.ringOn).toBe(false)
    expect(game.engine.world.gravity.y).toBeCloseTo(-20)
    expect(events.filter(e => e.type === 'phase').map(e => (e as { index: number }).index)).toEqual(
      [1, 2]
    )
    game.dispose()
  })

  it('starts the Last Push when the core goes home, reaching further forward only', () => {
    const game = new DropGame(HOMECOMING, { pile: [] })
    // Clear of the pegs, inside the chute, about to go over the lip.
    game.engine.addSpecial(CORE, { p: [-1.8, 0.3, 3.7], q: [0, 0, 0, 1] })
    const core = game.engine.pucks[game.engine.pucks.length - 1]
    core.body.setLinvel({ x: 0, y: 0, z: 3 }, true)
    let pushed = false
    for (let i = 0; i < 120 && !pushed; i++) pushed = game.step().some(e => e.type === 'lastPush')
    expect(pushed).toBe(true)
    expect(game.state.collected.core).toBe(1)
    const deck = game.engine.layout[0]
    let front = -Infinity
    let back = Infinity
    while (game.engine.pushing) {
      game.step()
      const z = game.engine.pusherZ
      front = Math.max(front, z)
      back = Math.min(back, z)
    }
    const amp = deck.pusher.ampZ
    expect(front).toBeGreaterThan(deck.pusher.midZ + amp * 1.9)
    expect(back).toBeGreaterThanOrEqual(deck.pusher.midZ - amp - 1e-6)
    // Its back end never comes out from under the back wall.
    expect(front - deck.pusher.depth / 2).toBeLessThanOrEqual(deck.backZ + 1e-6)
    // And afterwards it's back to its usual stroke.
    for (let i = 0; i < 10; i++) game.step()
    expect(game.engine.pusherZ).toBeCloseTo(deckPusherZ(deck, game.engine.time), 5)
    game.dispose()
  })

  it('gives a star for finishing, and needs the core home for more', () => {
    const goal = HOMECOMING.rules.goal
    const end = (score: number, home: boolean): GameState => ({
      ...initialState(HOMECOMING.rules),
      phase: 'over',
      score,
      collected: home ? { core: 1 } : {},
    })
    expect(starsFor(end(5, false), goal)).toBe(1)
    expect(starsFor(end(200, false), goal)).toBe(1)
    expect(starsFor(end(goal.stars[1], true), goal)).toBe(2)
    expect(starsFor(end(goal.stars[2], true), goal)).toBe(3)
    expect(starsFor({ ...end(200, true), phase: 'playing' }, goal)).toBe(3)
    expect(starsFor({ ...end(50, false), phase: 'playing' }, goal)).toBe(0)
  })

  it('leaves movers out of an engine with none', () => {
    expect(new PusherEngine().moverPositions()).toEqual([])
  })
})
