import { initPhysics } from './engine'
import { DropGame } from './game'
import { COIN_BUDGET } from './rules'

/**
 * Plays whole games headless against real physics. Slow-ish (a few seconds)
 * because it simulates a minute or more of table time.
 */
describe('DropGame', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('plays 50 coins to a finished game with a score', () => {
    const game = new DropGame()
    let steps = 0
    while (game.state.phase !== 'over' && steps < 60 * 300) {
      if (steps % 50 === 0) game.tapDrop()
      game.step()
      steps++
    }
    expect(game.state.phase).toBe('over')
    expect(game.state.coinsLeft).toBe(0)
    expect(game.state.shots).toBe(COIN_BUDGET)
    expect(game.state.score).toBeGreaterThan(0)
    game.dispose()
  }, 60_000)

  it('pours a bonus out of the arm after a ring hit', () => {
    const game = new DropGame({ seedLayers: 0 })
    // Keep dropping until one passes through the ring, stopping on that step.
    let hit = false
    for (let attempt = 0; attempt < COIN_BUDGET && !hit; attempt++) {
      game.tapDrop()
      for (let i = 0; i < 60 && !hit; i++) {
        for (const e of game.step()) if (e.type === 'shot' && e.hit) hit = true
      }
    }
    expect(hit).toBe(true)
    // A first hit is worth 5; the first of them pours on the hit's own step.
    expect(game.state.showerLeft).toBe(4)
    const before = game.engine.countActive().live
    for (let i = 0; i < 60; i++) game.step()
    expect(game.state.showerLeft).toBe(0)
    expect(game.engine.countActive().live).toBe(before + 4)
    game.dispose()
  }, 60_000)

  it('refuses taps once the budget is spent', () => {
    const game = new DropGame()
    for (let i = 0; i < COIN_BUDGET; i++) {
      expect(game.tapDrop()).toBe(true)
      for (let s = 0; s < 3; s++) game.step()
    }
    expect(game.tapDrop()).toBe(false)
    game.dispose()
  }, 60_000)
})
