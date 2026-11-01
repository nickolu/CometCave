import { PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import {
  BowlingDelivery,
  FULL_SWIPE,
  MIN_SWIPE,
  meterAt,
  pinSpots,
  swipeShot,
} from '@/app/meteor-coins/lib/deliveries/bowling'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame, type GameEvent } from '@/app/meteor-coins/lib/game'
import { PILES } from '@/app/meteor-coins/lib/piles'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'

const LANES = playableStage('moonlight-lanes') as StageDef

function setUp(): { game: DropGame; lanes: BowlingDelivery } {
  const game = new DropGame(LANES, { pile: [] })
  return { game, lanes: game.delivery as BowlingDelivery }
}

function steps(game: DropGame, n: number): GameEvent[] {
  const events: GameEvent[] = []
  for (let i = 0; i < n; i++) events.push(...game.step())
  return events
}

/** Steps until the pinsetter is done and the ball is back, collecting events. */
function untilReady(game: DropGame, lanes: BowlingDelivery): GameEvent[] {
  const events: GameEvent[] = []
  for (let i = 0; i < 60 * 12 && lanes.phase !== 'ready'; i++) events.push(...game.step())
  return events
}

/** Coins on the pin deck: above the lane, over it, in front of the pit. */
function onDeck(game: DropGame, lanes: BowlingDelivery) {
  const c = lanes.config
  return game.engine.pucks.filter((p, i) => {
    if (!p.active || i === lanes.ball) return false
    const t = p.body.translation()
    return t.y > c.y && Math.abs(t.x) < c.halfWidth && t.z > c.endZ
  })
}

/** A swipe up the lane from the ball, as the UI sends it. */
function swipe(game: DropGame, lanes: BowlingDelivery, dx: number, length: number): boolean {
  const z = lanes.config.ballZ
  game.input({ type: 'point', x: 0, z })
  game.press()
  steps(game, 6)
  const k = length / Math.hypot(dx, 1)
  game.input({ type: 'point', x: dx * k, z: z - k })
  return game.release()
}

const config = LANES.delivery?.kind === 'bowling' ? LANES.delivery : null

describe('bowling, pure', () => {
  it('sets six pins in a triangle, head pin nearest the ball', () => {
    if (!config) throw new Error('Moonlight Lanes bowls')
    const spots = pinSpots(config)
    expect(spots).toHaveLength(6)
    expect(spots[0]).toEqual({ x: 0, z: config.headZ })
    // The back row spans the lane, inside its edges.
    const back = spots.slice(3)
    expect(back.map(s => s.x)).toEqual([-config.pinSpacing, 0, config.pinSpacing])
    for (const s of spots) expect(Math.abs(s.x) + 0.5).toBeLessThan(config.halfWidth)
    for (const s of spots) expect(s.z - 0.5).toBeGreaterThan(config.endZ)
  })

  it('reads a swipe up the lane as aim and strength, and a tap or a pull back as nothing', () => {
    if (!config) throw new Error('Moonlight Lanes bowls')
    const from = { x: 0, z: 3 }
    expect(swipeShot(from, { x: 0.05, z: 2.9 }, config)).toBeNull()
    expect(swipeShot(from, { x: 0, z: 5 }, config)).toBeNull()
    const straight = swipeShot(from, { x: 0, z: 3 - FULL_SWIPE }, config)
    expect(straight?.aim).toBeCloseTo(0, 6)
    expect(straight?.power).toBeCloseTo(1, 6)
    const half = swipeShot(from, { x: 0, z: 3 - (MIN_SWIPE + FULL_SWIPE) / 2 }, config)
    expect(half?.power).toBeCloseTo(0.5, 6)
    // Far to the side: the aim stops at the lane's limit.
    expect(swipeShot(from, { x: 3, z: 2 }, config)?.aim).toBeCloseTo(config.maxAim, 6)
  })

  it('runs the strength meter up to full and back down', () => {
    expect(meterAt(0, 1)).toBe(0)
    expect(meterAt(0.5, 1)).toBeCloseTo(0.5, 6)
    expect(meterAt(1, 1)).toBeCloseTo(1, 6)
    expect(meterAt(1.25, 1)).toBeCloseTo(0.75, 6)
    expect(meterAt(2, 1)).toBeCloseTo(0, 6)
  })

  it("hangs the lane clear of the stage's baked pile", () => {
    if (!config) throw new Error('Moonlight Lanes bowls')
    const underside = config.y - 0.2
    const under = PILES['moonlight-lanes'].filter(
      c => Math.abs(c.p[0]) < config.halfWidth + 0.5 && c.p[2] < config.frontZ + 0.5
    )
    expect(under.length).toBeGreaterThan(0)
    for (const c of under) expect(c.p[1] + PUCK_THICKNESS / 2).toBeLessThan(underside)
  })
})

describe('bowling, in play', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('stands a full rack of coin stacks that stays up on its own', () => {
    const { game, lanes } = setUp()
    steps(game, 300)
    const pins = lanes.measurePins()
    expect(pins.every(p => p?.length === lanes.config.pinCoins)).toBe(true)
    expect(lanes.pinsStanding).toBe(6)
    game.dispose()
  })

  it('bowls on a swipe: a coin off the budget drops into the pit, and the ball rolls up the lane', () => {
    const { game, lanes } = setUp()
    steps(game, 10)
    const coins = game.state.coinsLeft as number
    expect(swipe(game, lanes, 0, 2)).toBe(true)
    expect(game.state.coinsLeft).toBe(coins - 1)
    expect(lanes.phase).toBe('rolling')
    expect(lanes.busy).toBe(1)
    const ball = game.engine.pucks[lanes.ball].body
    expect(ball.linvel().z).toBeLessThan(-2)
    // The coin it bought is in the pit, behind the deck.
    const paid = game.engine.pucks.filter(p => p.active && p.kind === 'player')
    expect(paid).toHaveLength(1)
    expect(paid[0].body.translation().z).toBeLessThan(lanes.config.endZ)
    game.dispose()
  })

  it("doesn't bowl on a tap, or while the pinsetter is working", () => {
    const { game, lanes } = setUp()
    steps(game, 10)
    expect(swipe(game, lanes, 0, 0.1)).toBe(false)
    expect(lanes.phase).toBe('ready')
    expect(swipe(game, lanes, 0, 3)).toBe(true)
    expect(swipe(game, lanes, 0, 3)).toBe(false)
    game.dispose()
  })

  it('aims with the arrow keys and bowls with Space: held for the meter, let go to roll', () => {
    const { game, lanes } = setUp()
    steps(game, 10)
    game.input({ type: 'steer', x: 1, z: 0 })
    steps(game, 30)
    game.input({ type: 'steer', x: 0, z: 0 })
    expect(lanes.aim).toBeGreaterThan(0.1)
    expect(game.press()).toBe(true)
    steps(game, 30)
    expect(lanes.meter).toBeGreaterThan(0.3)
    expect(lanes.phase).toBe('ready')
    expect(game.release()).toBe(true)
    expect(lanes.phase).toBe('rolling')
    const v = game.engine.pucks[lanes.ball].body.linvel()
    expect(v.x).toBeGreaterThan(0)
    game.dispose()
  })

  it('in tap mode, starts the meter on one tap and bowls on the next', () => {
    const { game, lanes } = setUp()
    lanes.setMode('tap')
    steps(game, 10)
    expect(game.press()).toBe(true)
    steps(game, 20)
    expect(game.release()).toBe(false)
    expect(lanes.phase).toBe('ready')
    expect(game.press()).toBe(true)
    expect(lanes.phase).toBe('rolling')
    game.dispose()
  })

  it('a hard roll near the head pin is a strike: bonus coins, and a second ball at what it left', () => {
    // Which hard rolls strike depends on how the pins scatter; most within
    // a few degrees of the head pin do. Take the first that does.
    let struck: { game: DropGame; lanes: BowlingDelivery; events: GameEvent[] } | null = null
    for (const aim of [0, 0.04, -0.04, 0.08, -0.08]) {
      const { game, lanes } = setUp()
      steps(game, 10)
      lanes.aim = aim
      expect(lanes.bowl(1)).toBe(true)
      const events = untilReady(game, lanes)
      if (lanes.strikes === 1) {
        struck = { game, lanes, events }
        break
      }
      game.dispose()
    }
    if (!struck) throw new Error('No hard roll near the head pin struck')
    const { game, lanes, events } = struck
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'callout', text: 'Strike! +5 coins' })
    )
    // The bonus pours into the pit.
    expect(game.state.showerLeft + game.engine.pucks.filter(p => p.kind === 'bonus').length).toBe(
      lanes.config.strikeBonus
    )
    // No pin stands, but the frame goes on: the second ball rolls at the
    // coins the strike left lying on the deck. Nothing was swept away.
    expect(lanes.pinsStanding).toBe(0)
    expect(lanes.frame).toBe(1)
    expect(lanes.ballInFrame).toBe(2)
    const left = onDeck(game, lanes).length
    expect(left).toBe(6 * lanes.config.pinCoins - lanes.lastOff)
    expect(lanes.lastOff).toBeGreaterThan(0)
    // The second ball: no spare for a rack already down, and whatever it
    // knocks off the deck is called as coins.
    lanes.aim = 0
    expect(lanes.bowl(1)).toBe(true)
    const second = untilReady(game, lanes)
    expect(lanes.spares).toBe(0)
    expect(second.some(e => e.type === 'callout' && /coins? off|Gutter/.test(e.text))).toBe(true)
    expect(lanes.frame).toBe(2)
    expect(lanes.pinsStanding).toBe(6)
    game.dispose()
  })

  it('a gentle roll leaves the rack as it fell for the second ball: nothing swept, nothing moved', () => {
    const { game, lanes } = setUp()
    steps(game, 10)
    lanes.aim = 0.2
    expect(lanes.bowl(0.3)).toBe(true)
    untilReady(game, lanes)
    expect(lanes.ballInFrame).toBe(2)
    const standing = lanes.pinsStanding
    expect(standing).toBeGreaterThan(0)
    expect(standing).toBeLessThan(6)
    // Every standing pin is still on its spot, whole.
    const pins = lanes.measurePins()
    expect(pins.filter(p => p !== null)).toHaveLength(standing)
    // The knocked-down coins lie where they fell: only what the ball sent
    // off the deck is gone.
    expect(onDeck(game, lanes)).toHaveLength(6 * lanes.config.pinCoins - lanes.lastOff)
    expect(lanes.coinsOff).toBe(lanes.lastOff)
    game.dispose()
  })

  it('after the second ball, whatever is left on the lane is lifted away and a fresh rack set', () => {
    const { game, lanes } = setUp()
    steps(game, 10)
    lanes.aim = 0.2
    expect(lanes.bowl(0.3)).toBe(true)
    untilReady(game, lanes)
    // Coins live off the lane (on the pusher, in the pit), the ball aside.
    const offLane = () => game.engine.countActive().live - onDeck(game, lanes).length - 1
    const before = offLane()
    lanes.aim = -0.4
    expect(lanes.bowl(0.5)).toBe(true)
    // Judged, then the pinsetter runs: a reset, not a second ball.
    for (let i = 0; i < 60 * 6 && lanes.phase !== 'resetting'; i++) game.step()
    expect(lanes.phase).toBe('resetting')
    expect(lanes.lift).toBeGreaterThanOrEqual(0)
    untilReady(game, lanes)
    expect(lanes.frame).toBe(2)
    expect(lanes.ballInFrame).toBe(1)
    expect(lanes.pinsStanding).toBe(6)
    // Exactly a fresh rack on the deck, and the old one gone back to the pool,
    // not onto the pusher: the only coins newly off the lane are the one the
    // ball cost, what the ball knocked off, and any bonus poured so far.
    expect(onDeck(game, lanes)).toHaveLength(6 * lanes.config.pinCoins)
    const bonus = lanes.spares > 0 ? lanes.config.spareBonus - game.state.showerLeft : 0
    expect(offLane()).toBe(before + 1 + lanes.lastOff + bonus)
    game.dispose()
  })

  it('a ball rolled off the side runs down the gutter, past the pins, and knocks none', () => {
    const { game, lanes } = setUp()
    steps(game, 10)
    lanes.aim = lanes.config.maxAim
    lanes.bowl(0.6)
    const events = untilReady(game, lanes)
    expect(events).toContainEqual(expect.objectContaining({ type: 'callout', text: 'Gutter ball' }))
    expect(lanes.pinsStanding).toBe(6)
    expect(lanes.lastKnocked).toBe(0)
    game.dispose()
  })

  it('ends the stage once the last ball has rolled, with no fresh rack', () => {
    const { game, lanes } = setUp()
    game.state = { ...game.state, coinsLeft: 2 }
    steps(game, 10)
    lanes.aim = 0
    expect(lanes.bowl(1)).toBe(true)
    untilReady(game, lanes)
    expect(lanes.bowl(1)).toBe(true)
    untilReady(game, lanes)
    // No fresh rack after the last ball: what's on the deck stays there.
    expect(lanes.frame).toBe(1)
    for (let i = 0; i < 60 * 60 && game.state.phase !== 'over'; i++) game.step()
    expect(game.state.phase).toBe('over')
    game.dispose()
  })
})
