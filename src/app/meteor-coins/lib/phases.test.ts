import { deckPusherZ } from './cabinet'
import { PhasedDelivery } from './deliveries/phased'
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

  it('tours a delivery a phase, with gravity, the moon and the sleeping comet to match', () => {
    const game = new DropGame(HOMECOMING)
    const phased = game.delivery as PhasedDelivery
    const events: GameEvent[] = []
    const run = (steps: number) => {
      for (let i = 0; i < steps; i++) events.push(...game.step())
    }
    const comet = game.engine.pucks.find(p => p.spec.id === CORE.id)!
    const at = () => comet.body.translation()

    // Wake: the crane, normal gravity, no moon, and the comet asleep: the
    // pusher works the pile against it for a while and it doesn't move.
    expect(phased.active.kind).toBe('crane')
    expect(game.moonConfig).toBeUndefined()
    const before = at()
    run(400)
    expect(at().x).toBeCloseTo(before.x, 5)
    expect(at().z).toBeCloseTo(before.z, 5)
    for (let n = 0; n < 20; n++) {
      expect(game.press()).toBe(true)
      run(60)
    }

    // Orbit: the plunger, low gravity, the moon out, the comet awake.
    expect(game.phase).toBe(1)
    expect(phased.active.kind).toBe('plunger')
    expect(game.engine.world.gravity.y).toBeCloseTo(-20 * HOMECOMING.phases![1].gravityScale!)
    expect(game.moonConfig).toBe(HOMECOMING.phases![1].moon)
    for (let n = 0; n < 20; n++) {
      expect(game.press()).toBe(true)
      run(20)
      expect(game.release()).toBe(true)
      // The last ball flies on under the moon: the phase waits for it, and
      // nothing more can go meanwhile.
      if (n === 19) {
        expect(game.phase).toBe(1)
        expect(game.canDrop).toBe(false)
        expect(game.press()).toBe(false)
      }
      while (phased.busy > 0) run(1)
      run(5)
    }

    // Homecoming: the cannon, gravity back, the moon gone.
    expect(game.phase).toBe(2)
    expect(phased.active.kind).toBe('cannon')
    expect(game.canDrop).toBe(true)
    expect(game.engine.world.gravity.y).toBeCloseTo(-20)
    expect(game.moonConfig).toBeUndefined()
    expect(events.filter(e => e.type === 'phase').map(e => (e as { index: number }).index)).toEqual(
      [1, 2]
    )
    game.dispose()
  })

  it('starts the Last Push when the core goes home, reaching further forward only', () => {
    const game = new DropGame(HOMECOMING, { pile: [] })
    // Inside the chute, about to go over the lip.
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
