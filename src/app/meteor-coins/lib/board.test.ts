import { CUP_FLOOR, SWEEPER_SCALE, inCup, sweeperKnock, sweeperVX, sweeperX } from './board'
import { FIELD_HALF_WIDTH, PUCK_RADIUS } from './cabinet'
import { initPhysics } from './engine'
import { DropGame, type GameEvent } from './game'
import { type StageDef, playableStage } from './stages'

const PACHINKO = playableStage('starfall-pachinko') as StageDef
const BOARD = PACHINKO.table.board!
const COIN = 2 * PUCK_RADIUS

describe('the pachinko board', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('leaves no gap a coin could wedge in', () => {
    // Between any two pins, a coin either passes or doesn't fit at all.
    const margin = 0.2
    const atWall = (p: { x: number }) => FIELD_HALF_WIDTH - Math.abs(p.x) < 0.3
    for (const a of BOARD.pins) {
      for (const b of BOARD.pins) {
        // Wall pins stack up the wall: no coin gets between them.
        if (a === b || (atWall(a) && atWall(b))) continue
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - 2 * BOARD.pinRadius
        expect(gap).toBeGreaterThan(COIN + margin)
      }
      // A pin is against the wall, or a coin passes between them.
      const toWall = FIELD_HALF_WIDTH - Math.abs(a.x) - BOARD.pinRadius
      expect(toWall < 0.2 || toWall > COIN + margin).toBe(true)
    }
  })

  it('counts an upright coin standing in a cup, and nothing beside it', () => {
    const [cup] = BOARD.cups
    const standing = cup.y + CUP_FLOOR + PUCK_RADIUS
    expect(inCup(cup, cup.x, standing)).toBe(true)
    expect(inCup(cup, cup.x + cup.width, standing)).toBe(false)
    expect(inCup(cup, cup.x, cup.y + 2)).toBe(false)
  })

  it('knocks a coin away from the sweeping star, and never pulls one in', () => {
    const [s] = BOARD.sweepers
    const reach = PUCK_RADIUS + BOARD.pinRadius * SWEEPER_SCALE
    // A quarter period in, the star stands at the end of its sweep, still.
    const t = s.periodS / 4
    const x = sweeperX(s, t)
    expect(Math.abs(sweeperVX(s, t))).toBeLessThan(1e-9)
    // A coin falling onto it from above is bounced back up.
    const down = sweeperKnock(s, BOARD.pinRadius, t, { x, y: s.y + reach - 0.05 }, { x: 0, y: -3 })
    expect(down!.y).toBeGreaterThan(0)
    // Moving away already, or out of reach: left alone.
    expect(sweeperKnock(s, BOARD.pinRadius, t, { x, y: s.y + 0.5 }, { x: 0, y: 1 })).toBeNull()
    expect(
      sweeperKnock(s, BOARD.pinRadius, t, { x, y: s.y + reach + 0.01 }, { x: 0, y: -3 })
    ).toBeNull()
    // The star never pushes a coin that isn't coming down onto it: sweeping
    // into one at rest, or one rolling at it level with it, it passes over.
    const vx = sweeperVX(s, 0)
    const level = { x: Math.sign(vx) * 0.5, y: s.y - 0.05 }
    expect(sweeperKnock(s, BOARD.pinRadius, 0, level, { x: 0, y: 0 })).toBeNull()
    expect(sweeperKnock(s, BOARD.pinRadius, 0, level, { x: -Math.sign(vx), y: 0 })).toBeNull()
    // A coin falling onto it while it sweeps is knocked up and along with it.
    const onto = { x: Math.sign(vx) * 0.3, y: s.y + 0.4 }
    const knocked = sweeperKnock(s, BOARD.pinRadius, 0, onto, { x: 0, y: -3 })
    expect(knocked!.y).toBeGreaterThan(0)
    expect(knocked!.x * Math.sign(vx)).toBeGreaterThan(0)
  })

  it('lets a stuck coin fall straight through the board, then collide again', () => {
    const game = new DropGame(PACHINKO, { pile: [] })
    const [cup] = BOARD.cups
    // Standing on the cup's floor, as a coin wedged on the board would be held.
    const index = game.engine.spawn(cup.x, cup.y + 1, BOARD.z, 'player', 0, undefined, true)!
    game.engine.dropThroughBoard(index)
    let lowest = Infinity
    for (let i = 0; i < 90; i++) {
      game.engine.step()
      lowest = Math.min(lowest, game.engine.pucks[index].body.translation().y)
    }
    // Through the cup, the bins and the gate, onto the shelf below.
    expect(lowest).toBeLessThan(BOARD.bottomY - PUCK_RADIUS)
    expect(game.engine.pucks[index].body.collider(0).collisionGroups()).toBe(0xffffffff)
    game.dispose()
  })

  it('takes one coin at a time, catches it in the cup, and lays coins flat as they leave', () => {
    const game = new DropGame(PACHINKO, { pile: [] })
    const [cup] = BOARD.cups
    // Straight over the cup, under the pins above it.
    const index = game.engine.spawn(cup.x, cup.y + 0.9, BOARD.z, 'player', 0, undefined, true)!
    expect(game.boardBusy).toBe(true)
    expect(game.canDrop).toBe(false)
    let bonus = 0
    for (let i = 0; i < 120 && !bonus; i++) {
      for (const e of game.step()) if (e.type === 'cup') bonus = e.bonus
    }
    expect(bonus).toBe(cup.bonus)
    // Taken off the board (its slot in the pool may already be pouring a bonus).
    const caught = game.engine.pucks[index]
    expect(!caught.active || caught.kind === 'bonus').toBe(true)
    expect(game.canDrop).toBe(true)
    // The bonus comes out under the board, lying flat.
    let poured = -1
    for (let i = 0; i < 30 && poured < 0; i++) {
      game.step()
      poured = game.engine.pucks.findIndex(p => p.active && p.kind === 'bonus')
    }
    expect(poured).toBeGreaterThanOrEqual(0)
    const at = game.engine.pucks[poured].body.translation()
    expect(at.y).toBeLessThan(BOARD.bottomY)
    expect(Math.abs(at.z - BOARD.z)).toBeLessThan(BOARD.slot)
    game.dispose()
  })

  it('gets every dropped coin through the board and lays it flat on the way out', () => {
    const game = new DropGame(PACHINKO, { pile: [] })
    const events: GameEvent[] = []
    for (let n = 0; n < 12; n++) {
      for (let i = 0; i < 7 + n * 5; i++) game.step()
      let wait = 0
      while (!game.canDrop && wait++ < 600) events.push(...game.step())
      expect(game.canDrop).toBe(true)
      expect(game.tapDrop()).toBe(true)
    }
    for (let i = 0; i < 600; i++) events.push(...game.step())
    for (const p of game.engine.pucks) {
      if (!p.active || p.kind !== 'player') continue
      const t = p.body.translation()
      // Nothing left on the board…
      expect(t.y < BOARD.bottomY || Math.abs(t.z - BOARD.z) > BOARD.slot).toBe(true)
      // …and nothing standing on edge below it.
      const r = p.body.rotation()
      const upY = 1 - 2 * (r.x * r.x + r.z * r.z)
      expect(Math.abs(upY)).toBeGreaterThan(0.5)
    }
    game.dispose()
  })
})
