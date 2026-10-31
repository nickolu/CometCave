import { FIELD_FRONT_Z } from '@/app/meteor-coins/lib/cabinet'
import { BeltDelivery } from '@/app/meteor-coins/lib/deliveries/belt'
import { PusherEngine, initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame } from '@/app/meteor-coins/lib/game'
import { CHOCOLATE } from '@/app/meteor-coins/lib/objects'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'

const BRAMBLE = playableStage('brambles-midnight-snack') as StageDef

function belt(game: DropGame): BeltDelivery {
  if (!(game.delivery instanceof BeltDelivery)) throw new Error('no belt')
  return game.delivery
}

/** Steps until a chocolate is over the shelf, ready to drop. */
function waitForNext(game: DropGame) {
  for (let i = 0; i < 600 && !belt(game).next(); i++) game.step()
}

describe('the bakery belt', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('brings chocolates out of the oven, spaced out, and carries them across', () => {
    const game = new DropGame(BRAMBLE, { pile: [] })
    const c = belt(game).config
    for (let i = 0; i < 120; i++) game.step()
    const on = belt(game).chocolates()
    expect(on.length).toBeGreaterThan(1)
    for (let i = 1; i < on.length; i++) expect(on[i - 1].x - on[i].x).toBeCloseTo(c.spacing, 5)
    const lead = on[0].x
    game.step()
    expect(belt(game).chocolates()[0].x).toBeGreaterThan(lead)
    game.dispose()
  })

  it('drops the marked chocolate straight down where it is, and only over the shelf', () => {
    const game = new DropGame(BRAMBLE, { pile: [] })
    // At the start the only chocolate is just out of the oven, beside the shelf.
    game.step()
    expect(belt(game).next()).toBeNull()
    expect(game.press()).toBe(false)
    waitForNext(game)
    const next = belt(game).next()
    expect(next).not.toBeNull()
    const before = game.state.coinsLeft as number
    expect(game.press()).toBe(true)
    expect(game.state.coinsLeft).toBe(before - 1)
    const dropped = game.engine.pucks.find(p => p.active)
    expect(dropped?.spec).toBe(CHOCOLATE)
    const at = dropped?.body.translation()
    expect(at?.x).toBeCloseTo(next?.x ?? NaN, 5)
    expect(Math.abs(dropped?.body.linvel().x ?? 1)).toBeLessThan(1e-6)
    expect(
      belt(game)
        .chocolates()
        .some(p => Math.abs(p.x - (next?.x ?? 0)) < 0.01)
    ).toBe(false)
    game.dispose()
  })

  it("takes a chocolate nobody drops back to the oven, and doesn't spend it", () => {
    const game = new DropGame(BRAMBLE, { pile: [] })
    const c = belt(game).config
    // Long enough for the first chocolates to ride the whole belt twice over.
    const steps = Math.ceil((2 * 60 * (c.toX - c.fromX)) / c.speed)
    let most = 0
    for (let i = 0; i < steps; i++) {
      game.step()
      most = Math.max(most, belt(game).chocolates().length)
      for (const p of belt(game).chocolates()) expect(p.x).toBeLessThanOrEqual(c.toX)
    }
    expect(game.state.coinsLeft).toBe(BRAMBLE.rules.coins)
    expect(most).toBeLessThanOrEqual(Math.ceil((c.toX - c.fromX) / c.spacing) + 1)
    game.dispose()
  })

  it('never carries more chocolates than the tin holds', () => {
    const stage: StageDef = {
      ...BRAMBLE,
      rules: { ...BRAMBLE.rules, coins: 2, goal: { type: 'target', count: 2, stars: [0, 1, 2] } },
    }
    const game = new DropGame(stage, { pile: [] })
    for (let i = 0; i < 600; i++) {
      game.step()
      expect(belt(game).chocolates().length).toBeLessThanOrEqual(game.state.coinsLeft as number)
    }
    waitForNext(game)
    expect(game.press()).toBe(true)
    for (let i = 0; i < 600; i++) {
      game.step()
      expect(belt(game).chocolates().length).toBeLessThanOrEqual(1)
    }
    game.dispose()
  })
})

describe("Bramble's mouth", () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('roams along the front edge, and only what falls into it counts', () => {
    const sweep = BRAMBLE.table.chuteSweep
    expect(sweep).toBeDefined()
    const engine = new PusherEngine({
      chuteHalfWidth: BRAMBLE.table.chuteHalfWidth,
      chuteSweep: sweep,
    })
    expect(engine.chuteX(0)).toBeCloseTo(0, 5)
    expect(engine.chuteX((sweep?.periodS ?? 0) / 4)).toBeCloseTo(sweep?.ampX ?? NaN, 5)
    // Let the mouth roam right, then drop one into it and one well beside it.
    while (engine.time < (sweep?.periodS ?? 0) / 4) engine.step()
    const mouth = engine.chuteX()
    engine.spawn(mouth, -0.5, FIELD_FRONT_Z + 0.5, 'player')
    engine.spawn(mouth - 3, -0.5, FIELD_FRONT_Z + 0.5, 'player')
    const falls = []
    for (let i = 0; i < 60 && falls.length < 2; i++) falls.push(...engine.step())
    const byX = falls.sort((a, b) => b.x - a.x).map(f => f.result)
    expect(byX).toEqual(['chute', 'gutter'])
    engine.dispose()
  })

  it('stays in the middle on every stage without one', () => {
    const engine = new PusherEngine()
    expect(engine.chuteSweep).toBeNull()
    expect(engine.chuteX(7)).toBe(0)
    engine.dispose()
  })
})
