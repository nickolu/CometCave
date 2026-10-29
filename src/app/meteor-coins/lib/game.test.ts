import { POOL_SIZE, initPhysics } from './engine'
import { DropGame, type GameEvent } from './game'
import { CHOCOLATE, MOONSTONE } from './objects'
import { type StageDef, playableStage } from './stages'

const PENNY_FALLS = playableStage('penny-falls') as StageDef
const REDLINE = playableStage('redline') as StageDef
const BUDGET = PENNY_FALLS.rules.coins as number

/**
 * Plays whole games headless against real physics. Slow-ish (a few seconds)
 * because it simulates a minute or more of table time.
 */
describe('DropGame', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('plays a stage budget to a finished game with a score', () => {
    const game = new DropGame(PENNY_FALLS)
    let steps = 0
    while (game.state.phase !== 'over' && steps < 60 * 300) {
      if (steps % 50 === 0) game.tapDrop()
      game.step()
      steps++
    }
    expect(game.state.phase).toBe('over')
    expect(game.state.coinsLeft).toBe(0)
    expect(game.state.shots).toBe(BUDGET)
    expect(game.state.score).toBeGreaterThan(0)
    game.dispose()
  }, 60_000)

  it('pours a bonus out of the arm after a ring hit', () => {
    const game = new DropGame(PENNY_FALLS, { pile: [] })
    // Keep dropping until one passes through the ring, stopping on that step.
    let hit = false
    for (let attempt = 0; attempt < BUDGET && !hit; attempt++) {
      game.tapDrop()
      for (let i = 0; i < 60 && !hit; i++) {
        for (const e of game.step()) if (e.type === 'shot' && e.hit) hit = true
      }
    }
    expect(hit).toBe(true)
    // The first bonus coin pours on the hit's own step.
    const bonus = PENNY_FALLS.rules.bonusForStreak(1)
    expect(game.state.showerLeft).toBe(bonus - 1)
    const before = game.engine.countActive().live
    for (let i = 0; i < 60; i++) game.step()
    expect(game.state.showerLeft).toBe(0)
    expect(game.engine.countActive().live).toBe(before + bonus - 1)
    game.dispose()
  }, 60_000)

  it('sets up the table and arm from the stage', () => {
    const game = new DropGame(PENNY_FALLS)
    expect(game.engine.chuteHalfWidth).toBe(PENNY_FALLS.table.chuteHalfWidth)
    expect(game.engine.pusherPeriodS).toBe(PENNY_FALLS.table.pusherPeriodS)
    // One full arm period later the tip is back where it started.
    const start = game.armTip()
    game.dropperTime += PENNY_FALLS.arm.periodS
    expect(game.armTip().x).toBeCloseTo(start.x, 6)
    game.dispose()
  })

  it('counts no shots on a stage without a ring', () => {
    const game = new DropGame({ ...PENNY_FALLS, ring: { enabled: false } })
    for (let i = 0; i < 5; i++) {
      game.tapDrop()
      for (let s = 0; s < 90; s++) expect(game.step().some(e => e.type === 'shot')).toBe(false)
    }
    expect(game.state.shots).toBe(0)
    game.dispose()
  }, 60_000)

  it('scores a special object by kind and refunds its coins', () => {
    const porch = playableStage('moonstone-porch') as StageDef
    // One moonstone already over the lip: it falls in on the first steps.
    const game = new DropGame(porch, {
      pile: [{ p: [0, 0.2, 4.4], q: [0, 0, 0, 1], o: 'moonstone' }],
    })
    const falls: GameEvent[] = []
    for (let i = 0; i < 60; i++) falls.push(...game.step())
    expect(falls).toEqual([{ type: 'fall', result: 'chute', object: MOONSTONE }])
    expect(game.state.collected).toEqual({ moonstone: 1 })
    expect(game.state.coinsLeft).toBe((porch.rules.coins as number) + MOONSTONE.refund)
    // Specials aren't pooled: the pool is untouched, and the moonstone is gone.
    expect(game.engine.freeCount).toBe(POOL_SIZE)
    expect(game.engine.countActive().live).toBe(0)
    game.dispose()
  })

  it("drops the stage's own object from the arm", () => {
    const game = new DropGame(playableStage('brambles-midnight-snack') as StageDef, { pile: [] })
    game.tapDrop()
    const dropped = game.engine.pucks.find(p => p.active)
    expect(dropped?.spec).toBe(CHOCOLATE)
    game.dispose()
  })

  it('refuses taps once the budget is spent', () => {
    const game = new DropGame(PENNY_FALLS)
    for (let i = 0; i < BUDGET; i++) {
      expect(game.tapDrop()).toBe(true)
      for (let s = 0; s < 3; s++) game.step()
    }
    expect(game.tapDrop()).toBe(false)
    game.dispose()
  }, 60_000)

  it('moves the middle Cairn post with the pusher and counts a coin landed on it', () => {
    const cairn = playableStage('the-cairn') as StageDef
    const game = new DropGame(cairn)
    expect(game.state.towers).toEqual([0, 0, 0])
    // Wait for a drop that lands square on the middle post, then drop it.
    let steps = 0
    while (!(game.landing().post === 1 && game.landing().offset < 0.1) && steps < 60 * 60) {
      game.step()
      steps++
    }
    expect(game.tapDrop()).toBe(true)
    const zAtDrop = game.engine.pusherZ
    for (let i = 0; i < 90; i++) game.step()
    expect(game.engine.pusherZ).not.toBeCloseTo(zAtDrop, 1)
    expect(game.state.towers).toEqual([0, 1, 0])
    game.dispose()
  })

  it('slides whatever misses the posts off the ice', () => {
    const cairn = playableStage('the-cairn') as StageDef
    const game = new DropGame(cairn, { pile: [{ p: [1.1, 0.09, 0.6], q: [0, 0, 0, 1] }] })
    let fell = 0
    for (let i = 0; i < 60 * 5; i++) fell += game.step().filter(e => e.type === 'fall').length
    expect(fell).toBe(1)
    game.dispose()
  })

  it("scores what falls into The Bedtime Book's spine", () => {
    const book = playableStage('the-bedtime-book') as StageDef
    const game = new DropGame(book, { pile: [] })
    // Words come from the owls (lib/deliveries/owls.test.ts).
    expect(game.delivery.kind).toBe('owls')
    // A word dropped straight into the spine falls through and scores.
    game.engine.spawn(0, 1, 0, 'player')
    for (let i = 0; i < 60; i++) game.step()
    expect(game.state.score).toBe(1)
    expect(game.state.lost).toBe(0)
    game.dispose()
  })

  it("runs Redline's clock on arm time from the first drop, and keeps the tempo", () => {
    const game = new DropGame(REDLINE, { pile: [] })
    game.setSpeed(0.5)
    for (let i = 0; i < 60; i++) game.step()
    // No clock before the first drop.
    expect(game.timeLeftS).toBe(90)
    while (!game.dropLandsClear) game.step()
    expect(game.tapDrop()).toBe(true)
    expect(game.state.tempo).toBe(2)
    while (game.dropLandsClear) game.step()
    expect(game.tapDrop()).toBe(true)
    expect(game.state.tempo).toBe(1)
    // A minute of table time at half speed is 30s on the clock.
    for (let i = 0; i < 60 * 60; i++) game.step()
    expect(game.timeLeftS).toBeCloseTo(60, 0)
    expect(game.slowed).toBe(true)
    game.dispose()
  })
})
