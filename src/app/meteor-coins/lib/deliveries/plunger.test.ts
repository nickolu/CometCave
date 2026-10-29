import { FIELD_HALF_WIDTH } from '@/app/meteor-coins/lib/cabinet'
import { PlungerDelivery } from '@/app/meteor-coins/lib/deliveries/plunger'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame } from '@/app/meteor-coins/lib/game'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'

const GRAVITY_ASSIST = playableStage('gravity-assist') as StageDef

function setUp(): { game: DropGame; plunger: PlungerDelivery } {
  const game = new DropGame(GRAVITY_ASSIST, { pile: [] })
  return { game, plunger: game.delivery as PlungerDelivery }
}

function steps(game: DropGame, n: number) {
  for (let i = 0; i < n; i++) game.step()
}

/** The coin a launch just put on the table. */
function launched(game: DropGame, before: Set<number>): number {
  return game.engine.pucks.findIndex((p, i) => p.active && !before.has(i))
}

function activeSet(game: DropGame): Set<number> {
  return new Set(game.engine.pucks.flatMap((p, i) => (p.active ? [i] : [])))
}

describe('the plunger', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('pulls back while held and launches on letting go, a coin off the budget', () => {
    const { game, plunger } = setUp()
    expect(plunger.charge).toBeNull()
    expect(game.press()).toBe(true)
    steps(game, 30)
    expect(plunger.charge).toBeCloseTo(30 / 60 / plunger.config.chargeS, 2)
    expect(plunger.busy).toBe(1)
    steps(game, 120)
    // Fully back, and it stays there.
    expect(plunger.charge).toBe(1)
    const coins = game.state.coinsLeft
    expect(game.release()).toBe(true)
    expect(game.state.coinsLeft).toBe((coins as number) - 1)
    expect(plunger.charge).toBeNull()
    expect(plunger.balls).toHaveLength(1)
    game.dispose()
  })

  it('launches on a second tap in tap mode, and ignores letting go', () => {
    const { game, plunger } = setUp()
    plunger.setMode('tap')
    game.press()
    steps(game, 20)
    expect(game.release()).toBe(false)
    expect(plunger.balls).toHaveLength(0)
    expect(game.press()).toBe(true)
    expect(plunger.balls).toHaveLength(1)
    game.dispose()
  })

  it('flies exactly the dotted path, then breaks where it comes down', () => {
    const { game, plunger } = setUp()
    for (const hold of [20, 50, 90]) {
      game.press()
      steps(game, hold)
      const path = plunger.flight()
      const preview = plunger.previewPath()
      const before = activeSet(game)
      game.release()
      const index = launched(game, before)
      let k = 0
      while (plunger.balls.length > 0 && k < 400) {
        game.step()
        k++
        const t = game.engine.pucks[index].body.translation()
        if (plunger.balls.length && k < path.length) {
          const p = path[k]
          expect(Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z)).toBeLessThan(1e-3)
        }
      }
      const broke = plunger.shatters[plunger.shatters.length - 1]
      const end = preview[preview.length - 1]
      // On a bare table it breaks on the pusher's top or the glass, where the path ended.
      expect(Math.hypot(broke.x - end.x, broke.z - end.z)).toBeLessThan(0.6)
      steps(game, 90)
    }
    game.dispose()
  })

  it('lands where the moon throws it: the same pull lands far apart at different moments', () => {
    const { game, plunger } = setUp()
    const xs: number[] = []
    for (let i = 0; i < 8; i++) {
      xs.push(plunger.landing(1, (i * GRAVITY_ASSIST.moon!.periodS) / 8).x)
    }
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2.5)
    // And how hard it's pulled moves it too, at nearly every moment.
    let apart = 0
    for (let i = 0; i < 8; i++) {
      const at = (i * GRAVITY_ASSIST.moon!.periodS) / 8
      const soft = plunger.landing(0.2, at)
      const hard = plunger.landing(1, at)
      if (Math.hypot(soft.x - hard.x, soft.z - hard.z) > 1.5) apart++
    }
    expect(apart).toBeGreaterThanOrEqual(6)
    game.dispose()
  })

  it('never throws a coin out of the cabinet, however the moon slings it', () => {
    const { game } = setUp()
    let lostOverSide = 0
    for (let n = 0; n < 12; n++) {
      game.press()
      steps(game, 10 + n * 9)
      const before = activeSet(game)
      game.release()
      const index = launched(game, before)
      for (let i = 0; i < 150; i++) {
        game.step()
        const puck = game.engine.pucks[index]
        if (!puck.active) break
        if (Math.abs(puck.body.translation().x) > FIELD_HALF_WIDTH + 0.1) lostOverSide++
      }
      steps(game, 13)
    }
    expect(lostOverSide).toBe(0)
    game.dispose()
  })
})
