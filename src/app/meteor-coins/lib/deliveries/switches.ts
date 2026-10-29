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
 * down a little network of glass tubes; each junction sends a coin left or
 * right, and the tubes end over different lanes and decks. The player sets
 * the junctions and sends coins in. The trip down the tubes is animated
 * along the track, not simulated: a coin only becomes physics at the exit.
 *
 * It also runs the stage's chain reactions, since which lane coins go down
 * is what sets them off. Each lower deck has a gold plate and a red plate
 * on its pusher's top, under the lip of the deck above, where that deck's
 * spill lands. Enough coins landing on gold open the bonus hopper, which
 * pours bonus coins down the stairs from the top. Enough on red raise a
 * bar across that deck's own lip for a few seconds, blocking the flow.
 * Either one resets the deck's plates and moves them to new lanes, in a
 * fixed order, so the right route keeps changing.
 */

export type Way = 'left' | 'right'
/** Lanes across a deck, from the player's left: 0, 1, 2. */
export type Lane = 0 | 1 | 2

/** A length of tube: the bends it passes through, and what it runs into. */
export type Track = { via?: readonly Vec[]; to: { junction: number } | { exit: number } }

export type Junction = { at: Vec; left: Track; right: Track; start: Way }

/** A tube's end: a spout pointing straight down at `at`, over a deck's lane. */
export type Exit = { at: Vec; deck: number; lane: Lane; name: string }

export type PlateDeck = {
  /** The deck the plates are on (an index into the layout, bottom first); never the top one. */
  deck: number
  /** What it's called in plain words: "middle step". */
  name: string
  /** Lanes the gold and red plates take, in turn: the next one after each trigger. */
  arrangements: readonly (readonly [gold: Lane, red: Lane])[]
}

export type SwitchesConfig = {
  hopper: Vec
  /** The tube from the hopper to the first junction. */
  first: Track
  junctions: readonly Junction[]
  exits: readonly Exit[]
  /** How fast a coin rolls down the tubes, units per second of stage time. */
  speed: number
  /** Where the bonus hopper pours: stepping across `halfWidth` either side of the middle, from `y` at `z`. */
  bonusPour: { y: number; z: number; halfWidth: number }
  plates: {
    decks: readonly PlateDeck[]
    /**
     * Coins that have to land on a plate to trip it. A plate is a scale
     * that springs back: each coin's weight drains off over `leakS`, so
     * only coins arriving close together trip it, the way a routed lane
     * spills, and not the trickle every lane gets from the pile.
     */
    goldCoins: number
    redCoins: number
    leakS: number
    /** Bonus coins a gold plate pours. */
    bonus: number
    /** Seconds a red plate's bar stays up. */
    barS: number
    /** How far across the lip the bar reaches from the middle. */
    barHalfWidth: number
    /** Said when each trips, in the stage's voice. */
    voice: { gold: string; red: string }
  }
}

/** Seconds between coins sent into the tubes: back to back they'd overlap. */
export const SEND_GAP_S = 0.35
/** Coins rolling in the tubes at once. */
const MAX_IN_TUBES = 4
/** How near a junction (in units, on the aim plane) a tap must be to flip it. */
export const JUNCTION_REACH = 0.95
/** A coin counts as landing on a plate if it was on the deck above this recently. */
const FELL_WITHIN_S = 1.2
/** Seconds a deck's plates sit dark after tripping, while they move lanes. */
export const PLATE_RESET_S = 1.2
/** The red plate's bar: a wall across the lip that rises out of the deck. */
export const BAR = { height: 0.5, depth: 0.25, riseS: 0.25 }
/** Seconds the bonus hopper's gate stands open after a gold plate. */
const GATE_OPEN_S = 2

/** The middle of a lane, and which lane an x is in. */
export const laneX = (lane: Lane) => ((lane - 1) * 2 * FIELD_HALF_WIDTH) / 3
export const laneOf = (x: number): Lane =>
  x < -FIELD_HALF_WIDTH / 3 ? 0 : x > FIELD_HALF_WIDTH / 3 ? 2 : 1

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
  // A network is a tree, so this ends; the cap guards a config with a loop.
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

/** The junction nearest a point on the aim plane, if one is within reach. */
export function junctionAt(config: SwitchesConfig, x: number, z: number): number | null {
  let best: number | null = null
  let bestD = JUNCTION_REACH
  config.junctions.forEach((j, i) => {
    const d = Math.hypot(j.at.x - x, j.at.z - z)
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
  arrangement: number
  gold: number
  red: number
  /** Stage time it last tripped, and which plate. */
  tripped: { plate: 'gold' | 'red'; at: number } | null
}

const flip = (w: Way): Way => (w === 'left' ? 'right' : 'left')

export class SwitchesDelivery implements Delivery {
  readonly kind = 'switches'
  /** Which way each junction is set. */
  readonly ways: Way[]
  /** The junction the arrow keys work on, and whether they've been used (to show it). */
  selected = 0
  keyboard = false
  /** Coins on their way down the tubes. */
  readonly rolling: Rolling[] = []
  readonly plates: PlateState[]
  /** How far up each plate deck's bar is, 0 to 1, and the stage time it comes down. */
  readonly bars: { raised: number; until: number; body: RAPIER.RigidBody }[]
  /** How open the bonus hopper's gate is, 0 to 1. */
  gate = 0
  private gateUntil = -Infinity
  private lastSendAt = -Infinity
  private lastSteer = { x: 0, z: 0 }
  private point: { x: number; z: number } | null = null
  /** Per coin: when it was last on the deck above each plate deck, and the last such time counted. */
  private readonly above: Map<number, number>[]
  private readonly counted: Map<number, number>[]
  private pours = 0

  constructor(
    private readonly host: DeliveryHost,
    readonly config: SwitchesConfig
  ) {
    this.ways = config.junctions.map(j => j.start)
    this.plates = config.plates.decks.map(() => ({
      arrangement: 0,
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

  /** Each plate deck's plates now: the lanes they're in, and coins landed on each so far. */
  plateLanes(i: number): { gold: Lane; red: Lane } {
    const { arrangements } = this.config.plates.decks[i]
    const [gold, red] = arrangements[this.plates[i].arrangement % arrangements.length]
    return { gold, red }
  }

  get busy(): number {
    // A raised bar holds coins back, so the stage waits for it too.
    return this.rolling.length + this.bars.filter(b => b.raised > 0).length
  }

  input(e: DeliveryInput): boolean {
    if (e.type === 'point') {
      this.point = { x: e.x, z: e.z }
      return false
    }
    if (e.type === 'steer') {
      // Edges only: a key going down does one thing, held does nothing more.
      const { x, z } = e
      const was = this.lastSteer
      this.lastSteer = { x, z }
      const n = this.ways.length
      if (z !== 0 && z !== was.z) {
        this.keyboard = true
        // Up is toward the hopper, the first junction.
        this.selected = (this.selected + (z < 0 ? n - 1 : 1)) % n
        return true
      }
      if (x !== 0 && x !== was.x) {
        this.keyboard = true
        this.ways[this.selected] = x < 0 ? 'left' : 'right'
        return true
      }
      return false
    }
    if (e.type === 'release') return false
    // A press on a junction flips it; anywhere else sends a coin.
    const j = this.point ? junctionAt(this.config, this.point.x, this.point.z) : null
    this.point = null
    if (j !== null) {
      this.ways[j] = flip(this.ways[j])
      this.selected = j
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
    const roll = this.config.speed * PHYSICS_STEP_S * host.speed
    for (let i = this.rolling.length - 1; i >= 0; i--) {
      const coin = this.rolling[i]
      if (coin.exit === null) this.advance(coin, roll)
      if (coin.exit === null) continue
      // At the spout's mouth: it drops onto the table. A full pool holds it there.
      const mouth = this.config.exits[coin.exit].at
      if (host.launch({ ...mouth, velocity: { x: 0, y: -2, z: 0 } }) !== null) {
        this.rolling.splice(i, 1)
      }
    }
    // Bars rise when tripped and sink when their time is up.
    const now = host.engine.time
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
    const by = PHYSICS_STEP_S / 0.3
    this.gate += Math.max(-by, Math.min(by, (now < this.gateUntil ? 1 : 0) - this.gate))
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

  /** Watches coins spilling onto each plate, and trips the plates that fill. */
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
      const resetting = state.tripped !== null && now - state.tripped.at < PLATE_RESET_S
      const top = deck.floorY + PUSHER_HEIGHT
      const face = deckFaceZ(deck, deckStroke(deck, now, engine.pusherPeriodS))
      const { gold, red } = this.plateLanes(i)
      const above = this.above[i]
      const counted = this.counted[i]
      engine.pucks.forEach((puck, index) => {
        if (!puck.active) return
        const p = puck.body.translation()
        if (p.y > upper.floorY - 0.05 && p.z < upper.frontZ + 0.1) {
          above.set(index, now)
          return
        }
        if (p.y < top || p.y > top + 0.5 || p.z < deck.backZ - 0.3 || p.z > face) return
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
        this.trip(i, 'gold')
        host.state = hoopHit(host.state, plates.bonus)
        this.gateUntil = now + GATE_OPEN_S
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

  /** Resets a deck's plates and moves them on to their next lanes. */
  private trip(i: number, plate: 'gold' | 'red') {
    const state = this.plates[i]
    state.tripped = { plate, at: this.host.engine.time }
    state.gold = 0
    state.red = 0
    state.arrangement++
  }

  /** Bonus coins pour from the bonus hopper, stepping across the back of the top deck. */
  bonusAt(): Vec {
    const { y, z, halfWidth } = this.config.bonusPour
    return { x: halfWidth * Math.sin(this.pours++ * 2.4), y, z }
  }
}

/** A bar's centre height: sunk just under its deck's floor (0) to standing on it (1). */
export function barY(floorY: number, raised: number): number {
  return floorY + BAR.height / 2 - (1 - raised) * (BAR.height + 0.02)
}

/** A bar stands just inside its deck's lip. */
export const barZ = (frontZ: number) => frontZ - BAR.depth / 2 - 0.02

/** What the camera must keep in view: the hopper, every junction and spout, the bonus hopper. */
export function switchesPoints(c: SwitchesConfig): Vec[] {
  const { y, z, halfWidth } = c.bonusPour
  return [
    { ...c.hopper, y: c.hopper.y + 0.8 },
    ...c.junctions.map(j => ({ ...j.at, y: j.at.y + 0.5 })),
    ...c.exits.map(e => e.at),
    { x: -halfWidth - 0.6, y: y + 1, z },
  ]
}
