import { initPhysics } from './engine'
import { DropGame } from './game'
import { type StageDef, playableStage } from './stages'

const PENNY_FALLS = playableStage('penny-falls') as StageDef
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

  it('refuses taps once the budget is spent', () => {
    const game = new DropGame(PENNY_FALLS)
    for (let i = 0; i < BUDGET; i++) {
      expect(game.tapDrop()).toBe(true)
      for (let s = 0; s < 3; s++) game.step()
    }
    expect(game.tapDrop()).toBe(false)
    game.dispose()
  }, 60_000)
})
