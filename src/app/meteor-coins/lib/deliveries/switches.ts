import RAPIER from '@dimforge/rapier3d-compat'

import {
  FIELD_HALF_WIDTH,
  PHYSICS_STEP_S,
  PUSHER_HEIGHT,
  deckFaceZ,
  deckStroke,
} from '@/app/meteor-coins/lib/cabinet'
import type { Vec } from '@/app/meteor-coins/lib/cannon'
import type { Delivery, DeliveryHost, DeliveryInput } from '@/app/meteor-coins/lib/deliveries/types'
import type { GameEvent } from '@/app/meteor-coins/lib/game'
import { hoopHit } from '@/app/meteor-coins/lib/rules'

/**
 * The Cascade Engine's delivery: track switches. Coins roll from a hopper
 * down a network of glass tubes that steps down the stairs; each junction
 * sends a coin left or right, and the tubes end over every lane of every
 * step. The player sets the junctions and sends coins in. The trip down
 * the tubes is animated along the track, not simulated: a coin only
 * becomes physics at the exit.
 *
 * It also runs the stage's plates, since where coins go is what sets them
 * off. The middle and bottom steps each have a gold plate and a red plate
 * on their pusher's top, under the lip of the step above: the tubes drop
 * onto them, and the step above spills onto them. Coins that land on a
 * plate fill it; it drains as it waits. A full gold plate tips the bonus
 * hopper hanging over it; a full red one raises a bar across its own
 * step's lip for a few seconds. The plate that went off then moves to its
 * step's empty lane, so the route that pays keeps changing, one step of
 * it at a time.
 */

export type Way = 'left' | 'right'
/** Lanes across a deck, from the player's left: 0, 1, 2. */
export type Lane = 0 | 1 | 2

/** A length of tube: the bends it passes through, and what it runs into. */
export type Track = { via?: readonly Vec[]; to: { junction: number } | { exit: number } }

/**
 * A junction. Junctions may sit at different heights: a tap is matched
 * along the pointer's ray (see junctionAt). Its `left` branch heads to the
 * player's left of its `right` one, so the arrow keys mean what they say.
 */
export type Junction = { at: Vec; left: Track; right: Track; start: Way }

/** A tube's end: a spout pointing straight down at `at`, over a deck's lane. */
export type Exit = { at: Vec; deck: number; lane: Lane; name: string }

export type PlateDeck = {
  /** The deck the plates are on (an index into the layout, bottom first); never the top one. */
  deck: number
  /** What it's called in plain words: "middle step". */
  name: string
  /** The lanes the gold and red plates start in. */
  start: readonly [gold: Lane, red: Lane]
}

export type SwitchesConfig = {
  hopper: Vec
  /** The tube from the hopper to the first junction. */
  first: Track
  junctions: readonly Junction[]
  exits: readonly Exit[]
  /** How fast a coin rolls down the tubes, units per second of stage time. */
  speed: number
  plates: {
    decks: readonly PlateDeck[]
    /**
     * Coins that have to land on a plate to set it off. A plate is a scale
     * that springs back: each coin's weight drains off over `leakS`, so
     * only coins arriving close together set it off, the way a routed
     * tube drops them, and not the odd stray from the pile.
     */
    goldCoins: number
    redCoins: number
    leakS: number
    /** Bonus coins a gold plate's hopper pours. */
    bonus: number
    /** Seconds a red plate's bar stays up. */
    barS: number
    /** How far across the lip the bar reaches from the middle. */
    barHalfWidth: number
    /**
     * Said when each goes off. Plain: it's the only place the rule is put
     * in words, so it says what just happened.
     */
    voice: { gold: string; red: string }
  }
}

/** Seconds between coins sent into the tubes: back to back they'd overlap. */
export const SEND_GAP_S = 0.35
/** Coins rolling in the tubes at once. */
const MAX_IN_TUBES = 4
/**
 * How near a junction a tap must pass to flip it: its distance from the
 * pointer's ray, in units. About 50px on a 390px-wide phone at the back of
 * the table, where the junctions are smallest.
 */
export const JUNCTION_REACH = 0.85
/** A coin counts as landing on a plate if it was on the step above, or left a tube over it, this recently. */
const FELL_WITHIN_S = 1.2
/**
 * How high over the pusher top a coin may come to rest and count as on a
 * plate. Measured: the pusher top under a lip carries a heap, and with half
 * a unit only about half of the coins a tube dropped there counted.
 */
const LANDED_ABOVE = 0.9
/** Seconds a deck's plates sit dark after one goes off, while it moves lanes. */
export const PLATE_RESET_S = 1.6
/** Of that, the seconds the plate that went off stays put first, so its effect plays where it was. */
export const PLATE_HOLD_S = 1.0
/** The red plate's bar: a wall across the lip that rises out of the deck. */
export const BAR = { height: 0.5, depth: 0.25, riseS: 0.25 }
/**
 * Where a gold plate's hopper hangs and pours from, over its plate: this
 * far above the pusher top, and this far in front of the step above's lip.
 */
export const HOPPER = { above: 1.4, ahead: 1.0 }

/** The middle of a lane, and which lane an x is in. */
export const laneX = (lane: Lane) => ((lane - 1) * 2 * FIELD_HALF_WIDTH) / 3
export const laneOf = (x: number): Lane =>
  x < -FIELD_HALF_WIDTH / 3 ? 0 : x > FIELD_HALF_WIDTH / 3 ? 2 : 1

/** The one lane of three that's neither of these two. */
export const otherLane = (a: Lane, b: Lane): Lane => (3 - a - b) as Lane

/** The points a track runs through, from where it starts to what it runs into. */
export function trackPoints(config: SwitchesConfig, from: Vec, track: Track): Vec[] {
  const end =
    'junction' in track.to
      ? config.junctions[track.to.junction].at
      : // An exit's tube comes down a short spout to its mouth.
        config.exits[track.to.exit].at
  const spout = 'exit' in track.to ? [{ x: end.x, y: end.y + 0.4, z: end.z }] : ([] as Vec[])
  return [from, ...(track.via ?? []), ...spout, end]
}

/**
 * The exit a coin sent now would come out of, the junctions it passes, and
 * the tubes it rolls through, each named by trackKey.
 */
export function routeOf(
  config: SwitchesConfig,
  ways: readonly Way[]
): { exit: number; junctions: number[]; tracks: string[] } {
  const junctions: number[] = []
  const tracks = [trackKey(null)]
  let track = config.first
  // Tubes may merge but never loop back, so this ends; the cap guards a config that does.
  for (let i = 0; i <= config.junctions.length; i++) {
    if ('exit' in track.to) return { exit: track.to.exit, junctions, tracks }
    const j = track.to.junction
    junctions.push(j)
    track = config.junctions[j][ways[j]]
    tracks.push(trackKey(j, ways[j]))
  }
  throw new Error('The track network loops')
}

/** A name for a length of tube: the hopper's, or a junction's left or right branch. */
export const trackKey = (junction: number | null, way?: Way) =>
  junction === null ? 'first' : `${junction}-${way}`

/**
 * The junction a tap hits, if any. The tap is the point (x, z) on the aim
 * plane y = `aimY`, and `rise` is how that point moves per unit of height
 * along the pointer's ray (none: straight down, as the sim taps). Each
 * junction is judged by its distance from the ray, so a junction low over
 * the bottom step is as easy to hit as one up by the hopper.
 */
export function junctionAt(
  config: SwitchesConfig,
  x: number,
  z: number,
  rise: { x: number; z: number } = { x: 0, z: 0 }
): number | null {
  const aimY = config.junctions[0].at.y
  const len = Math.hypot(rise.x, 1, rise.z)
  const dir = { x: rise.x / len, y: 1 / len, z: rise.z / len }
  let best: number | null = null
  let bestD = JUNCTION_REACH
  config.junctions.forEach((j, i) => {
    const v = { x: j.at.x - x, y: j.at.y - aimY, z: j.at.z - z }
    const along = v.x * dir.x + v.y * dir.y + v.z * dir.z
    const d = Math.hypot(v.x - along * dir.x, v.y - along * dir.y, v.z - along * dir.z)
    if (d < bestD) {
      best = i
      bestD = d
    }
  })
  return best
}

/** A coin in the tubes: the points it rolls through, and how far along it is. */
type Rolling = {
  path: Vec[]
  /** What the tube it's in runs into. */
  to: Track['to']
  leg: number
  along: number
  exit: number | null
  at: Vec
}

type PlateState = {
  /** The lanes the plates are in now. */
  lanes: { gold: Lane; red: Lane }
  /** How full each is, in coins; it drains between landings. */
  gold: number
  red: number
  /** Stage time one last went off, which, and the lane it went off in. */
  tripped: { plate: 'gold' | 'red'; at: number; lane: Lane } | null
}

const flip = (w: Way): Way => (w === 'left' ? 'right' : 'left')

export class SwitchesDelivery implements Delivery {
  readonly kind = 'switches'
  /** Which way each junction is set. */
  readonly ways: Way[]
  /**
   * The arrow keys work along the lit route: this is how far down it the
   * selected junction is. Whether they've been used (to show it).
   */
  depth = 0
  keyboard = false
  /** Coins on their way down the tubes. */
  readonly rolling: Rolling[] = []
  readonly plates: PlateState[]
  /** How far up each plate deck's bar is, 0 to 1, and the stage time it comes down. */
  readonly bars: { raised: number; until: number; body: RAPIER.RigidBody }[]
  /** Where the last gold plate's hopper is pouring from. */
  pourAt: Vec = { x: 0, y: 0, z: 0 }
  private lastSendAt = -Infinity
  private lastSteer = { x: 0, z: 0 }
  private point: { x: number; z: number; rise?: { x: number; z: number } } | null = null
  /** Per coin: when it was last on the deck above each plate deck (or left a tube over it), and the last such time counted. */
  private readonly above: Map<number, number>[]
  private readonly counted: Map<number, number>[]
  private pours = 0

  constructor(
    private readonly host: DeliveryHost,
    readonly config: SwitchesConfig
  ) {
    this.ways = config.junctions.map(j => j.start)
    this.plates = config.plates.decks.map(pd => ({
      lanes: { gold: pd.start[0], red: pd.start[1] },
      gold: 0,
      red: 0,
      tripped: null,
    }))
    this.above = config.plates.decks.map(() => new Map())
    this.counted = config.plates.decks.map(() => new Map())
    // The bars are kinematic walls sunk into each plate deck's lip, made
    // after everything else so the pile builds and settles as it always has.
    const world = host.engine.world
    this.bars = config.plates.decks.map(({ deck }) => {
      const d = host.engine.layout[deck]
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          0,
          barY(d.floorY, 0),
          barZ(d.frontZ)
        )
      )
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          config.plates.barHalfWidth,
          BAR.height / 2,
          BAR.depth / 2
        ).setFriction(0.4),
        body
      )
      return { raised: 0, until: -Infinity, body }
    })
  }

  /** The exit a coin sent now would come out of, and the tubes it would roll through. */
  route() {
    return routeOf(this.config, this.ways)
  }

  /** The junction the arrow keys work on: the one `depth` down the lit route. */
  get selected(): number {
    const { junctions } = this.route()
    return junctions[Math.min(this.depth, junctions.length - 1)]
  }

  /** Whether a coin can be sent into the tubes now. */
  get ready(): boolean {
    const left = this.host.state.coinsLeft
    return (
      this.host.canDrop &&
      (left === null || left > this.rolling.length) &&
      this.rolling.length < MAX_IN_TUBES &&
      this.host.dropperTime - this.lastSendAt >= SEND_GAP_S * this.host.speed
    )
  }

  /** A plate deck's plates now: the lanes they're in. */
  plateLanes(i: number): { gold: Lane; red: Lane } {
    return this.plates[i].lanes
  }

  /** Whether a plate deck's plates are dark and moving, having just gone off. */
  resetting(i: number): boolean {
    const t = this.plates[i].tripped
    return t !== null && this.host.engine.time - t.at < PLATE_RESET_S
  }

  get busy(): number {
    // A raised bar holds coins back, so the stage waits for it too.
    return this.rolling.length + this.bars.filter(b => b.raised > 0).length
  }

  input(e: DeliveryInput): boolean {
    if (e.type === 'point') {
      this.point = { x: e.x, z: e.z, rise: e.rise }
      return false
    }
    if (e.type === 'steer') {
      // Edges only: a key going down does one thing, held does nothing more.
      const { x, z } = e
      const was = this.lastSteer
      this.lastSteer = { x, z }
      const along = this.route().junctions.length
      this.depth = Math.min(this.depth, along - 1)
      if (z !== 0 && z !== was.z) {
        this.keyboard = true
        // Up is toward the hopper; down follows the lit route toward its spout.
        this.depth = Math.max(0, Math.min(along - 1, this.depth + (z < 0 ? -1 : 1)))
        return true
      }
      if (x !== 0 && x !== was.x) {
        this.keyboard = true
        this.ways[this.selected] = x < 0 ? 'left' : 'right'
        // Then on to the next junction down the new route, so a route is
        // set in one press per junction, top to bottom.
        this.depth = Math.min(this.depth + 1, this.route().junctions.length - 1)
        return true
      }
      return false
    }
    if (e.type === 'release') return false
    // A press on a junction flips it; anywhere else sends a coin.
    const p = this.point
    const j = p ? junctionAt(this.config, p.x, p.z, p.rise) : null
    this.point = null
    if (j !== null) {
      this.ways[j] = flip(this.ways[j])
      const at = this.route().junctions.indexOf(j)
      if (at >= 0) this.depth = at
      return true
    }
    return this.send()
  }

  /** Sends the next coin from the hopper into the tubes. */
  send(): boolean {
    if (!this.ready) return false
    this.lastSendAt = this.host.dropperTime
    const { hopper, first } = this.config
    this.rolling.push({
      path: trackPoints(this.config, hopper, first),
      to: first.to,
      leg: 0,
      along: 0,
      exit: null,
      at: { ...hopper },
    })
    return true
  }

  beforeStep(events: GameEvent[]) {
    const host = this.host
    const now = host.engine.time
    const roll = this.config.speed * PHYSICS_STEP_S * host.speed
    for (let i = this.rolling.length - 1; i >= 0; i--) {
      const coin = this.rolling[i]
      if (coin.exit === null) this.advance(coin, roll)
      if (coin.exit === null) continue
      // At the spout's mouth: it drops onto the table. A full pool holds it there.
      const exit = this.config.exits[coin.exit]
      const index = host.launch({ ...exit.at, velocity: { x: 0, y: -2, z: 0 } })
      if (index === null) continue
      this.rolling.splice(i, 1)
      // A spout over a plate deck drops straight onto its plates.
      const plateDeck = this.config.plates.decks.findIndex(p => p.deck === exit.deck)
      if (plateDeck >= 0) this.above[plateDeck].set(index, now)
    }
    // Bars rise when tripped and sink when their time is up.
    const layout = host.engine.layout
    this.bars.forEach((bar, i) => {
      const toward = now < bar.until ? 1 : 0
      const by = PHYSICS_STEP_S / BAR.riseS
      bar.raised += Math.max(-by, Math.min(by, toward - bar.raised))
      const deck = layout[this.config.plates.decks[i].deck]
      bar.body.setNextKinematicTranslation({
        x: 0,
        y: barY(deck.floorY, bar.raised),
        z: barZ(deck.frontZ),
      })
    })
    void events
  }

  /** Rolls a coin `by` along its tubes, turning at junctions the way they're set when it gets there. */
  private advance(coin: Rolling, by: number) {
    let left = by
    while (left > 0) {
      const a = coin.path[coin.leg]
      const b = coin.path[coin.leg + 1]
      const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
      if (coin.along + left < len) {
        coin.along += left
        const t = coin.along / len
        coin.at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
        return
      }
      left -= len - coin.along
      coin.along = 0
      coin.leg++
      coin.at = { ...b }
      if (coin.leg < coin.path.length - 1) continue
      // The end of a tube: a junction (read now, as the coin reaches it) or an exit.
      const end = coin.to
      if ('exit' in end) {
        coin.exit = end.exit
        return
      }
      const junction = this.config.junctions[end.junction]
      const next = junction[this.ways[end.junction]]
      coin.path = trackPoints(this.config, junction.at, next)
      coin.to = next.to
      coin.leg = 0
    }
  }

  /** Watches coins landing on each plate, and sets off the plates that fill. */
  step(events: GameEvent[]) {
    const host = this.host
    const engine = host.engine
    const layout = engine.layout
    const now = engine.time
    const { plates } = this.config
    plates.decks.forEach((plateDeck, i) => {
      const deck = layout[plateDeck.deck]
      const upper = layout[plateDeck.deck + 1]
      const state = this.plates[i]
      const resetting = this.resetting(i)
      const top = deck.floorY + PUSHER_HEIGHT
      const face = deckFaceZ(deck, deckStroke(deck, now, engine.pusherPeriodS))
      const { gold, red } = state.lanes
      const above = this.above[i]
      const counted = this.counted[i]
      engine.pucks.forEach((puck, index) => {
        if (!puck.active) return
        const p = puck.body.translation()
        if (p.y > upper.floorY - 0.05 && p.z < upper.frontZ + 0.1) {
          above.set(index, now)
          return
        }
        if (p.y < top || p.y > top + LANDED_ABOVE || p.z < deck.backZ - 0.3 || p.z > face) return
        const fellAt = above.get(index)
        if (fellAt === undefined || now - fellAt > FELL_WITHIN_S || counted.get(index) === fellAt) {
          return
        }
        counted.set(index, fellAt)
        if (resetting) return
        const lane = laneOf(p.x)
        if (lane === gold) state.gold++
        else if (lane === red) state.red++
      })
      if (resetting) return
      const leak = PHYSICS_STEP_S / plates.leakS
      state.gold = Math.max(0, state.gold - leak)
      state.red = Math.max(0, state.red - leak)
      // Red only costs while coins are still to play: once they're all in,
      // the player can't route around it, so the last coins aren't held back.
      const playing = host.state.phase === 'playing' || host.state.phase === 'ready'
      if (state.gold >= plates.goldCoins) {
        this.pourAt = {
          x: laneX(gold),
          y: top + HOPPER.above,
          z: deck.backZ + HOPPER.ahead,
        }
        this.trip(i, 'gold')
        host.state = hoopHit(host.state, plates.bonus)
        events.push({
          type: 'plate',
          plate: 'gold',
          deck: plateDeck.name,
          bonus: plates.bonus,
          seconds: 0,
          line: plates.voice.gold,
        })
      } else if (state.red >= plates.redCoins && playing) {
        this.trip(i, 'red')
        this.bars[i].until = now + plates.barS
        events.push({
          type: 'plate',
          plate: 'red',
          deck: plateDeck.name,
          bonus: 0,
          seconds: plates.barS,
          line: plates.voice.red,
        })
      }
    })
  }

  /** Empties the plate that went off and moves it to its step's empty lane. */
  private trip(i: number, plate: 'gold' | 'red') {
    const state = this.plates[i]
    const lane = state.lanes[plate]
    state.tripped = { plate, at: this.host.engine.time, lane }
    state[plate] = 0
    state.lanes = { ...state.lanes, [plate]: otherLane(state.lanes.gold, state.lanes.red) }
  }

  /** Bonus coins pour from the hopper over the gold plate that went off, a little spread. */
  bonusAt(): Vec {
    const k = this.pours++
    const { x, y, z } = this.pourAt
    return { x: x + 0.5 * Math.sin(k * 2.4), y, z: z + 0.3 * Math.cos(k * 1.7) }
  }
}

/** A bar's centre height: sunk just under its deck's floor (0) to standing on it (1). */
export function barY(floorY: number, raised: number): number {
  return floorY + BAR.height / 2 - (1 - raised) * (BAR.height + 0.02)
}

/** A bar stands just inside its deck's lip. */
export const barZ = (frontZ: number) => frontZ - BAR.depth / 2 - 0.02

/** What the camera must keep in view: the hopper, every junction and spout. */
export function switchesPoints(c: SwitchesConfig): Vec[] {
  return [
    { ...c.hopper, y: c.hopper.y + 0.8 },
    ...c.junctions.map(j => ({ ...j.at, y: j.at.y + 0.5 })),
    ...c.exits.map(e => e.at),
  ]
}
