import { type Board, staggeredPins } from '@/app/meteor-coins/lib/board'
import {
  BACK_WALL_Z,
  CHUTE_HALF_WIDTH,
  DROP_Z,
  type Deck,
  FIELD_FRONT_Z,
  FIELD_HALF_WIDTH,
  type Layout,
  PUSHER_AMP_Z,
  PUSHER_DEPTH,
  PUSHER_MID_Z,
  PUSHER_PERIOD_S,
  WALL_HEIGHT,
} from '@/app/meteor-coins/lib/cabinet'
import { type CannonConfig } from '@/app/meteor-coins/lib/cannon'
import type { DeliveryConfig } from '@/app/meteor-coins/lib/deliveries'
import type { OwlsConfig } from '@/app/meteor-coins/lib/deliveries/owls'
import { ARM_PERIOD_S, type ArmConfig, type RingConfig } from '@/app/meteor-coins/lib/dropper'
import type { Drain, Obstacle } from '@/app/meteor-coins/lib/engine'
import type { MoonConfig } from '@/app/meteor-coins/lib/moon'
import {
  AMBER,
  AMBER_BONUS,
  CHOCOLATE,
  COIN,
  CORE,
  DUCK,
  METEORITE,
  MOONSTONE,
  type ObjectId,
  type ObjectSpec,
  SILVER,
  type Tone,
  WORD,
} from '@/app/meteor-coins/lib/objects'
import { type PileName } from '@/app/meteor-coins/lib/piles'
import { type RuleConfig } from '@/app/meteor-coins/lib/rules'

/**
 * The campaign: twelve stages, played in order, one star unlocks the next.
 * Designs are in the campaign doc (https://claude.ai/artifact/Qjj2HPLFGNr56y4ZJJHQTX).
 *
 * A stage is data. Everything that differs between stages — the table, the
 * arm, the ring, the coins, the pile, the stars — lives here, and the engine,
 * rules and scene read it. Stages that aren't built yet are listed by name so
 * the map can show what's coming.
 */

export type StageDef = {
  number: number
  /** URL segment, also the pile's name. */
  slug: string
  name: string
  /** One line in the stage's own voice, shown on the map and before play. */
  pitch: string
  playable: true
  table: {
    chuteHalfWidth: number
    /** The chute roams along the front edge (see EngineOptions.chuteSweep). */
    chuteSweep?: { ampX: number; periodS: number }
    pusherPeriodS: number
    obstacles?: readonly Obstacle[]
    floorFriction?: number
    floorDrift?: number
    /** The table's decks; one unless the stage stacks them. */
    layout?: Layout
    /** A pachinko board over the drop line: coins drop through it on edge. */
    board?: Board
    /** A glass jar under the lip, drawn only: where the stage's specials are collected. */
    jar?: boolean
    /** A drain in the floor, which does the scoring instead of the front edge. */
    drain?: Drain
    /** What the floor and pushers are made of, if not the cabinet's usual. */
    floorTone?: Tone
    pusherTone?: Tone
    /**
     * A stage that dresses its own table: the scene skips the plain
     * cabinet's floors, walls, edge strips and pusher blocks and draws
     * this set instead (the physics is unchanged).
     */
    dressing?: 'book'
  }
  arm: ArmConfig
  /** A cannon at the front instead of the arm: coins are fired, not dropped. */
  cannon?: CannonConfig
  /**
   * How coins get onto the table, where it's neither the arm nor the cannon
   * (see lib/deliveries). The arm's settings still matter where bonus coins
   * pour from its tip.
   */
  delivery?: DeliveryConfig
  /** A moon circling over the table that bends everything falling. */
  moon?: MoonConfig
  /** Special objects that drop in on a timetable, each counted down where it will land. */
  meteors?: MeteorShower
  /**
   * Phases, in order, each lasting its share of the coins (they add up to
   * the budget). Obstacles with `phases` stand only in theirs.
   */
  phases?: readonly StagePhase[]
  /** When this object reaches the chute, the pushers reach twice as far for `seconds`. */
  lastPush?: { object: string; seconds: number }
  ring: { enabled: boolean } & RingConfig
  /**
   * What the arm drops and the pile is mostly made of, and how bonus coins
   * look where they're marked apart (they play as the drop object).
   */
  objects: { drop: ObjectSpec; bonus?: ObjectSpec }
  /**
   * The on-table timing cue, if any. Chevrons and the shadow light when a drop
   * now would land on bare shelf; the dot sits where a drop now would land and
   * lights when that's square on a post.
   */
  cue: 'chevrons' | 'shadow' | 'dot' | null
  /** The starting pile, or null for a bare table. */
  pile: PileName | null
  /** How scripts/meteor-coins-bake-pile.ts builds this stage's pile. */
  bake?: PileRecipe
  rules: RuleConfig
  /** Plain words for the goal's number: the HUD label, and the result's caption. */
  measure: { label: string; caption: string }
  /** In-game lines in the stage's voice. */
  voice: { start: string; clear: string; miss: string }
  /** How to play, in plain words, where tapping to drop isn't the whole story. */
  hint?: string
}

/**
 * A timetable of special objects dropping in from `y`: each is announced
 * right after the player's `afterDrop`th coin and drops in `warnS` later.
 * Tied to drops rather than the clock, so every run sees all of them.
 */
export type MeteorShower = {
  object: ObjectSpec
  y: number
  warnS: number
  schedule: readonly { afterDrop: number; x: number; z: number }[]
}

export type StagePhase = {
  name: string
  coins: number
  /** Whether the ring is out in this phase (where the stage has one). */
  ring: boolean
  /** Gravity as a share of the usual. */
  gravityScale?: number
  /**
   * A gentle pull toward the chute on the stage's last-push object (the
   * comet core) while it lies on the shelf: too weak to move it alone, but
   * enough that the pile's pushes carry it.
   */
  homing?: number
  /** Said as the phase starts, in the stage's voice. */
  line: string
}

export type PileRecipe = {
  seed: number
  /**
   * Drop-object count scattered over the shelf, and on the pusher's top. On
   * a table of several decks, both are per deck, bottom first.
   */
  floor: number | readonly number[]
  top: number | readonly number[]
  /**
   * Special objects, spread across a zone: placed first so the pile settles
   * around them, or with `onTop`, laid on the heap once the coins are down,
   * so they sit on the surface where they can be seen.
   */
  specials?: {
    object: ObjectId
    count: number
    x: [number, number]
    z: [number, number]
    onTop?: boolean
  }[]
}

export type ComingSoon = {
  number: number
  slug: string
  name: string
  pitch: string
  playable: false
}

export type Stage = StageDef | ComingSoon

const PENNY_FALLS: StageDef = {
  number: 1,
  slug: 'penny-falls',
  name: 'Penny Falls',
  pitch:
    'The seaside cabinet you remember. The lip is already loaded, so your first coin knocks some over.',
  playable: true,
  // A wider chute than the classic 2.6 so aim doesn't matter yet; gutters are
  // only the outer unit on each side.
  table: { chuteHalfWidth: 3, pusherPeriodS: PUSHER_PERIOD_S },
  // The arm swings on the pusher's beat, so the good moment comes back at the
  // same point of every swing and players pick up the rhythm unprompted.
  arm: { periodS: PUSHER_PERIOD_S },
  ring: { enabled: true },
  objects: { drop: COIN },
  cue: 'chevrons',
  pile: 'penny-falls',
  // The saved pile predates the object-spec engine; this recipe now bakes a
  // slightly different one (158 coins, not 159) that plays the same in the
  // sim but leaves a coin propped too far over the lip, so the original stays.
  bake: { seed: 1, floor: 150, top: 16 },
  rules: {
    coins: 40,
    // A flat +3 per ring hit. The arm runs on the pusher's slower beat here,
    // which makes ring lineups easy; with the escalating classic table a
    // well-timed bot averaged 308 against a random tapper's 37, so the ring
    // drowned out the pusher this stage exists to teach.
    bonusForStreak: () => 3,
    // From scripts/meteor-coins-sim.ts (20 games each): a random tapper
    // clears one star ~85% of the time; two needs real timing; three is
    // around the well-timed bot's median, which plays near-perfectly.
    goal: { type: 'score', stars: [22, 50, 90] },
  },
  measure: { label: 'Score', caption: 'coins into the chute' },
  voice: {
    start: 'Drop when the pusher slides forward.',
    clear: 'Over the edge! Every coin is yours.',
    miss: 'The pier keeps its pennies this time.',
  },
}

/**
 * Moonstone Porch's claw crane (lib/deliveries/crane). It hangs low, so a
 * coin lands where its marker says, and reaches from the back wall to
 * part-way up the shelf: far enough to set a coin behind any moonstone,
 * not so far that coins can be dropped straight over the lip.
 */
const PORCH_CRANE = {
  y: 3.2,
  x: [-3.4, 3.4],
  z: [BACK_WALL_Z + 0.6, 2],
  speed: 3.5,
  accel: 7,
  cable: 1.4,
  damping: 0.3,
  reloadS: 0.9,
  start: { x: 0, z: -2 },
} as const

const MOONSTONE_PORCH: StageDef = {
  number: 2,
  slug: 'moonstone-porch',
  name: 'Moonstone Porch',
  pitch:
    "Last night's meteor shower left nine moonstones on the porch. Nudge them into the jar at your own pace.",
  playable: true,
  // No gutters: low rails along both sides, so everything off the front is
  // jarred. Everything is slower than Penny Falls.
  table: { chuteHalfWidth: FIELD_HALF_WIDTH, pusherPeriodS: 4, jar: true },
  // Unused: a crane sets every coin down by hand.
  arm: { periodS: 3.4 },
  delivery: { kind: 'crane', ...PORCH_CRANE },
  ring: { enabled: false },
  objects: { drop: COIN },
  // The crane draws its own landing marker.
  cue: null,
  pile: 'moonstone-porch',
  bake: {
    // A thinner heap than before (110 objects, not ~150). On a deeper one
    // with the moonstones on top, even careful play jarred only ~6.5 of 9
    // in 55 coins, so three stars were out of reach. Seed picked from a
    // sweep of five that baked cleanly.
    seed: 3,
    floor: 120,
    top: 14,
    // Laid on top of the heap, so every moonstone can be seen: three near
    // the lip so the first refunds come early, six further back.
    specials: [
      { object: 'moonstone', count: 3, x: [-2.4, 2.4], z: [1.4, 2], onTop: true },
      { object: 'moonstone', count: 6, x: [-2.8, 2.8], z: [-0.4, 1], onTop: true },
    ],
  },
  rules: {
    // Each moonstone jarred refunds 3 coins, so a good run plays on. No ring:
    // the pusher is the game. From the sim (10 games each): dropping
    // anywhere jars ~3 (the three near the lip) for one star; letting the
    // claw settle and setting coins in front of the pusher jars ~5.5;
    // doing that in line with the moonstone nearest the lip, while the
    // pusher is pulled back, jars ~8. 40 coins, not 55: with 55 the
    // careful and the skilled bot both cleared all nine.
    coins: 40,
    bonusForStreak: () => 0,
    // Can't fail: finishing is a star. Two stars: random 0%, careful 80%,
    // skilled 100%; three (8, a little short of all nine, as an early
    // stage): careful 20%, skilled 60%.
    goal: { type: 'collect', object: MOONSTONE.id, total: 9, stars: [0, 5, 8] },
  },
  measure: { label: 'Moonstones', caption: 'moonstones in the jar' },
  voice: {
    start: "Take your time — the porch isn't going anywhere.",
    clear: 'Into the jar, glowing softly.',
    miss: 'The moonstones will wait for you.',
  },
  hint: 'Set coins down just in front of the pusher, in line with a moonstone, and the pusher nudges it toward the jar.',
}

/**
 * Bramble waits under the front edge with its mouth open across part of
 * the lip; only chocolates that fall in count, and the rest land on the
 * floor. The mouth roams slowly side to side, so you build the pile where
 * it's heading.
 *
 * Under half the lip wide, reaching each side wall. A third of it (half
 * width 1.3) made stage 3 a wall: following the drop cue fed 18 of 20 and
 * cleared it 40% of the time, though one star unlocks stage 4. At 1.8
 * the cue bot clears it every time and leading the mouth still pays for
 * the second and third stars (see the goal). Measured at the narrower
 * mouth (3 games per
 * bot): roaming every 24s, cue 18 fed against skilled 26; every 36s, 16
 * against 28, so leading the mouth pays more; every 50s the mouth sat on
 * one side for most of a tin and the cue bot fed only 10.
 */
const BRAMBLE_MOUTH_HALF_WIDTH = 1.8
const BRAMBLE_MOUTH_SWEEP = { ampX: 2.1, periodS: 36 }

/**
 * Chocolates ride from the oven on the left, high over the back of the
 * shelf, one passing any spot every 1.1s: about the arm's pace. The drop
 * line is the arm's, hard against the back wall, so timing the pusher
 * still lands a chocolate on bare shelf.
 */
const BAKERY_BELT: DeliveryConfig = {
  kind: 'belt',
  y: 4,
  z: DROP_Z,
  fromX: -4.8,
  toX: 4.8,
  spacing: 2.2,
  speed: 2,
  dropHalfWidth: 3.4,
}

const BRAMBLES_MIDNIGHT_SNACK: StageDef = {
  number: 3,
  slug: 'brambles-midnight-snack',
  name: "Bramble's Midnight Snack",
  pitch:
    'A big, polite monster lives under the bakery counter. Push 20 chocolates into its mouth before your tin runs out.',
  playable: true,
  table: {
    chuteHalfWidth: BRAMBLE_MOUTH_HALF_WIDTH,
    chuteSweep: BRAMBLE_MOUTH_SWEEP,
    pusherPeriodS: PUSHER_PERIOD_S,
  },
  arm: { periodS: ARM_PERIOD_S },
  delivery: BAKERY_BELT,
  ring: { enabled: false },
  objects: { drop: CHOCOLATE },
  // The belt's rig draws its own marker under the chocolate a press drops.
  cue: null,
  pile: 'brambles-midnight-snack',
  bake: {
    seed: 3,
    floor: 150,
    top: 8,
    // Mid-shelf: close enough to reach within one tin, far enough back that
    // none drop in by luck in the first seconds.
    specials: [{ object: 'truffle', count: 3, x: [-2, 2], z: [2, 2.8] }],
  },
  rules: {
    coins: 45,
    // No ring: the pusher and the mouth are the game.
    bonusForStreak: () => 0,
    // A cherry truffle feeds 3. Stars count chocolates left in the tin. From
    // the sim (10 games each): a random presser reaches 20 30% of the time;
    // dropping on bare shelf wherever the chocolate is reaches it every
    // time, with a median of 7 to spare (two stars 50%, three 10%); also
    // leading the mouth (dropping where it will be ~6s on) leaves a median
    // of 28: two stars 90%, three 80%. (How far ahead to lead barely
    // mattered, 3–9s.)
    goal: { type: 'target', count: 20, stars: [0, 6, 16] },
  },
  measure: { label: 'Fed', caption: 'chocolates left in the tin' },
  hint: "Only chocolates that fall into Bramble's mouth count, and its mouth moves: drop where it's heading.",
  voice: {
    start: "Bramble's hungry. Twenty chocolates, please.",
    clear: 'Bramble pats its tummy. "Thank you kindly."',
    miss: 'Bramble is still a little peckish.',
  },
}

/**
 * Rubber Ducky Rumble's tub. The front edge is walled off with a rubber rim,
 * so nothing scores off it: the only way out is the drain in the floor, with
 * a whirlpool around it that drags in whatever drifts close. The rims and
 * the soap bars are as bouncy as the ducks.
 */
const TUB_RIM = { height: 0.9, restitution: 0.8, tone: 'tub' } as const
// The drain sits a little right of center, just past where slide ducks land
// (0.6 beyond the landing arc), so a duck pointed at it lands short and
// slides in, plowing in whatever lies in the way. A gentle whirlpool takes
// in ducks that end up beside it.
const DUCK_DRAIN: Drain = {
  x: 1.1,
  z: 1.4,
  size: 1.3,
  swirl: { radius: 1.1, pull: 1.5, spin: 1.5 },
}
const TUB: Obstacle[] = [
  // Glass above the front rim: bouncing ducks popped clean over the rim alone.
  {
    type: 'block',
    x: 0,
    z: FIELD_FRONT_Z - 0.1,
    width: FIELD_HALF_WIDTH * 2,
    depth: 0.2,
    height: WALL_HEIGHT,
    glass: true,
  },
  {
    type: 'block',
    x: 0,
    z: FIELD_FRONT_Z - 0.25,
    width: FIELD_HALF_WIDTH * 2,
    depth: 0.5,
    ...TUB_RIM,
  },
  ...[-1, 1].map(
    (side): Obstacle => ({
      type: 'block',
      x: side * (FIELD_HALF_WIDTH - 0.125),
      z: 1.55,
      width: 0.25,
      depth: 3.9,
      ...TUB_RIM,
    })
  ),
  // Two soap bars to bonk off, either side of the drain.
  ...[
    { x: -2.2, z: 1.3 },
    { x: 2.9, z: 2.6 },
  ].map(
    ({ x, z }): Obstacle => ({
      type: 'block',
      x,
      z,
      width: 0.9,
      depth: 0.45,
      height: 0.18,
      restitution: 0.8,
      tone: 'soap',
    })
  ),
]

/**
 * The waterslide hangs from the back wall, over the pusher, and shoots its
 * duck off the lip at ~4.3 units/s, landing on an arc just past the
 * pusher's reach. The lip sits high (1.8) so a
 * duck leaving it clears ducks stacked on the pusher.
 */
const WATERSLIDE: DeliveryConfig = {
  kind: 'slide',
  pivot: { x: 0, y: 3.6, z: BACK_WALL_Z + 0.6 },
  bend: { forward: 2, y: 1.8 },
  lip: { forward: 4.1, y: 1.8 },
  periodS: 3.6,
  maxYaw: 0.5,
  pull: 0.2,
  startSpeed: 2,
}

const RUBBER_DUCKY_RUMBLE: StageDef = {
  number: 6,
  slug: 'rubber-ducky-rumble',
  name: 'Rubber Ducky Rumble',
  pitch:
    '"WHAT IF THE COINS WERE RUBBER DUCKS?!" They whizz down the waterslide, bonk and boing, and swirl down the drain.',
  playable: true,
  // Slippery water: about half the usual floor's grip. Measured: slicker
  // than this (0.08–0.18) and the whole tub drifts into the drain whatever
  // you do, so a random sender scored as well as an aimed one.
  table: {
    chuteHalfWidth: CHUTE_HALF_WIDTH,
    pusherPeriodS: PUSHER_PERIOD_S,
    obstacles: TUB,
    floorFriction: 0.25,
    floorTone: 'water',
    drain: DUCK_DRAIN,
  },
  arm: { periodS: ARM_PERIOD_S },
  delivery: WATERSLIDE,
  ring: { enabled: false },
  objects: { drop: DUCK },
  cue: null,
  pile: 'rubber-ducky-rumble',
  // Ducks afloat in one layer, not a heap: in a packed tub every send
  // stirred the whole pile and aim stopped mattering. Peak ~60 live bodies.
  bake: {
    seed: 8,
    floor: 30,
    top: 6,
    specials: [{ object: 'mama-duck', count: 3, x: [-3, 3], z: [-0.2, 0.6] }],
  },
  rules: {
    coins: 40,
    // No ring, so no bonus.
    bonusForStreak: () => 0,
    // A Mama Duck is worth 5. From the sim (10 games each): sending ducks at
    // random averages 21 (one star 80% of the time, two 10%); pointing the
    // slide at the drain averages 37 (two stars every time); also aiming at
    // ducks lying just short of the drain and landing on the pusher's beat
    // averages 38, three stars 30%. Most points are ducks sent straight down
    // the drain; three stars needs a few knocked in from the tub on top.
    goal: { type: 'score', stars: [15, 30, 40] },
  },
  measure: { label: 'Score', caption: 'points down the drain' },
  hint: 'Ducks that go down the drain score. A Mama Duck is worth 5.',
  voice: {
    start: 'Bonk them down the drain!',
    clear: 'Quack-tastic! Down the drain they go!',
    miss: 'The ducks want one more swim.',
  },
}

/**
 * Three hoops lying flat like basketball hoops, at near, middle and far
 * depth, tighter and worth more the further back. A coin only counts
 * dropping down through a rim, so a shot has to come down on it from
 * above: the right direction and the right distance. The +10 slides left
 * and right on its track over the pusher, so it has to be led. A full
 * charge clears all three and drops against the back wall onto the
 * pusher, like a coin from the arm.
 *
 * The rims are tight: a coin is 1 across, so the +10's leaves it 0.16 to
 * spare each side. Hoops are only drawn, not physical, so the table (and
 * its pile) is unchanged.
 */
const HOOPS = [
  { x: -1, y: 2.4, z: 1.4, radius: 0.75, bonus: 3 },
  { x: 1.2, y: 2.8, z: -1, radius: 0.7, bonus: 6 },
  { x: 0, y: 2.6, z: -3.2, radius: 0.66, bonus: 10, sweep: { ampX: 1.5, periodS: 2.6 } },
]

const HOOP_LA_CANNON: StageDef = {
  number: 4,
  slug: 'hoop-la-cannon',
  name: 'Hoop-La Cannon',
  pitch:
    'A brass cannon at the front lobs coins back over the pile. Sink them through three hoops, one on the move.',
  playable: true,
  table: { chuteHalfWidth: CHUTE_HALF_WIDTH, pusherPeriodS: PUSHER_PERIOD_S },
  arm: { periodS: ARM_PERIOD_S },
  cannon: {
    pivot: { x: 0, y: 0.9, z: 5.4 },
    barrel: 0.8,
    periodS: 3,
    // Swings far enough that a full shot reaches just inside the walls.
    maxYaw: 0.28,
    // Steep, so shots come down onto the flat hoops rather than skimming them.
    elevation: (62 * Math.PI) / 180,
    minSpeed: 8,
    maxSpeed: 16,
    chargeS: 0.8,
    hoops: HOOPS,
  },
  ring: { enabled: false },
  objects: { drop: COIN },
  cue: null,
  pile: 'hoop-la-cannon',
  bake: { seed: 4, floor: 110, top: 12 },
  rules: {
    coins: 40,
    // Hoops pour their own bonuses (above), not a streak. From the sim (10
    // games each, aiming in two steps): firing at random averages 17 and
    // sinks a hoop once in five games, a star 30% of the time; full shots
    // timed to land on bare shelf average 26, always a star, never a hoop;
    // also locking on a hoop and charging for it (leading the sliding
    // +10), 0–100ms late, sinks about 11 of 40 and averages 70: two stars
    // 90% of the time, three half the time. The tight rims and a 0.8s charge keep that to about a
    // shot in four: with a 0.9s charge and wider rims it sank half.
    bonusForStreak: () => 0,
    goal: { type: 'score', stars: [20, 40, 75] },
  },
  measure: { label: 'Score', caption: 'coins into the chute' },
  hint: 'Hoops pour +3, +6 and +10 coins. The +10 slides.',
  voice: {
    start: 'Step right up! Drop one through a hoop.',
    clear: 'Off the boards! Still counts on the shelf.',
    miss: 'Step right up and try again!',
  },
}

/** The Cairn's drop line, forward over its posts. */
const CAIRN_DROP_Z = 1.2
const CAIRN_POST = { type: 'post', radius: 0.7, height: 0.8 } as const
/** The middle post slides this far either side of the drop line. */
const CAIRN_SLIDE = { ampZ: 0.7, periodS: 4.6 }

/**
 * Two stone posts at the sides, and one in the middle that slides forward
 * and back on its own across the drop line, so it lines up twice a trip.
 * (It used to ride the pusher on a bracket and only lined up at the front
 * of the stroke: almost impossible to hit, in Nick's playtest.)
 */
const CAIRN_POSTS: Obstacle[] = [
  { ...CAIRN_POST, x: -2.2, z: CAIRN_DROP_Z, tower: 'Left' },
  { ...CAIRN_POST, x: 0, z: CAIRN_DROP_Z, slide: CAIRN_SLIDE, tower: 'Middle' },
  { ...CAIRN_POST, x: 2.2, z: CAIRN_DROP_Z, tower: 'Right' },
]
// Guard: at the back of its slide the middle post stays clear of the
// pusher's face at full reach, with room to spare so no coin is pinched.
if (
  CAIRN_DROP_Z - CAIRN_SLIDE.ampZ - CAIRN_POST.radius <
  PUSHER_MID_Z + PUSHER_AMP_Z + PUSHER_DEPTH / 2 + 0.25
) {
  throw new Error("The Cairn's middle post would slide into the pusher")
}

const THE_CAIRN: StageDef = {
  number: 5,
  slug: 'the-cairn',
  name: 'The Cairn',
  pitch:
    'Build towers that hold on three stone posts. A spider lets the coins down. The middle post slides back and forth, so catch it as it passes.',
  playable: true,
  // An icy floor, sloping gently to the front: whatever misses a post, or
  // falls off one, slides away.
  table: {
    chuteHalfWidth: FIELD_HALF_WIDTH,
    pusherPeriodS: PUSHER_PERIOD_S,
    obstacles: CAIRN_POSTS,
    floorFriction: 0.05,
    floorDrift: 2,
  },
  // Unused (the spider delivers), but kept over the posts.
  arm: { periodS: 4, pivotY: 10.6, dropZ: CAIRN_DROP_Z },
  // A spider on a thread lets the coins down, bobbing so that only some
  // moments give a soft drop. A coin dropped from high hits a tower hard
  // enough to knock it down: in the headless prototype, falls of ~4 kept a
  // third as many coins up as falls of ~2.5.
  delivery: {
    kind: 'spider',
    z: CAIRN_DROP_Z,
    halfWidth: 3.2,
    lowY: 3.4,
    highY: 6.4,
    bobPeriodS: 2.8,
    speed: 3.5,
    reloadS: 0.6,
  },
  ring: { enabled: false },
  objects: { drop: COIN },
  // The spider draws its own landing dot (scene/SpiderRig).
  cue: null,
  pile: null,
  rules: {
    coins: 30,
    bonusForStreak: () => 0,
    // From the sim (10 games each): letting go at random averages 4.6 (one
    // star 30% of the time: drops from high in the bob knock towers down);
    // letting go on any post when the dot fills averages 28.5, two stars
    // 90% and three 10%, but its middle tower stays short (a perfect middle
    // drop waits ~2.8s for the post and the bob to line up, a side one
    // ~0.7s); spreading the coins and letting the middle run a few taller,
    // waiting for the dot square on its center, averages 35.6 (p50 41),
    // three stars 60%. Towers past a dozen coins tend to come down, still
    // or sliding, so no tower needs more than 13 coins for three stars.
    goal: { type: 'stack', weights: [1, 2, 1], stars: [6, 22, 38] },
  },
  measure: { label: 'Height', caption: 'coins high, middle counted twice' },
  hint: 'Land coins on the posts to build towers. The dot fills in when a drop would land square and soft: let go when the spider is low. The middle post counts twice.',
  voice: {
    start: 'Stack it true. The ice only takes what falls.',
    clear: 'The cairn stands. Someone will find their way by it.',
    miss: 'The stones will stand still for another try.',
  },
}

/** Three decks stepping down toward the player, each the same shape. */
const CASCADE_STEP = 4.2
const cascadeDeck = (level: number, lagS: number): Deck => {
  const frontZ = FIELD_FRONT_Z - level * CASCADE_STEP
  // A shelf of 2 in front of the pusher at full reach, a stroke of 1.2, and
  // 1 of pusher top showing behind its face when pulled back.
  const faceMax = frontZ - 2
  return {
    floorY: level * 1.2,
    frontZ,
    backZ: faceMax - 2.2,
    pusher: { midZ: faceMax - 0.6 - 1.5, ampZ: 0.6, depth: 3, lagS },
  }
}
/**
 * Each pusher runs a third of a stroke behind the one above, so a forward
 * push rolls down the stairs: the top deck spills onto the middle pusher
 * just as it starts forward, and so on down.
 */
const CASCADE: Layout = [
  cascadeDeck(0, (PUSHER_PERIOD_S * 2) / 3),
  cascadeDeck(1, PUSHER_PERIOD_S / 3),
  cascadeDeck(2, 0),
]

/**
 * The Cascade Engine's track switches: a hopper over the back of the top
 * deck feeds three junctions. The first sends coins left or right; the left
 * one picks the top deck's left or middle lane, the right one its right lane
 * or a long tube that runs over the top deck and drops straight onto the
 * middle step. All three junctions sit at one height, the plane taps are
 * read on.
 *
 * The top deck's spouts drop just in front of its pusher at full reach.
 * Measured: a lane fed there spills ~90% of the middle step's landings
 * into that lane (at the back wall ~75%), so the route decides the plate.
 */
const SWITCH_Y = 5.8
const SPOUT_Y = 4.5
const SPOUT_Z = CASCADE[2].backZ + 0.7
const CASCADE_SWITCHES: DeliveryConfig = {
  kind: 'switches',
  hopper: { x: 0, y: SWITCH_Y + 1, z: SPOUT_Z },
  first: { to: { junction: 0 } },
  junctions: [
    {
      at: { x: 0, y: SWITCH_Y, z: SPOUT_Z },
      left: { to: { junction: 1 } },
      right: { to: { junction: 2 } },
      start: 'left',
    },
    {
      at: { x: -1.7, y: SWITCH_Y, z: SPOUT_Z },
      left: { to: { exit: 0 } },
      right: { to: { exit: 1 } },
      start: 'right',
    },
    {
      at: { x: 1.7, y: SWITCH_Y, z: SPOUT_Z },
      left: {
        via: [
          { x: 1.3, y: 5.3, z: SPOUT_Z + 1.2 },
          { x: 0.9, y: 4.3, z: CASCADE[1].frontZ - 2.4 },
        ],
        to: { exit: 3 },
      },
      right: { to: { exit: 2 } },
      start: 'right',
    },
  ],
  exits: [
    { at: { x: -2.7, y: SPOUT_Y, z: SPOUT_Z + 1.5 }, deck: 2, lane: 0, name: 'top step, left' },
    { at: { x: -0.4, y: SPOUT_Y, z: SPOUT_Z + 1.5 }, deck: 2, lane: 1, name: 'top step, middle' },
    { at: { x: 2.7, y: SPOUT_Y, z: SPOUT_Z + 1.5 }, deck: 2, lane: 2, name: 'top step, right' },
    {
      at: { x: 0.9, y: CASCADE[1].floorY + 2.2, z: CASCADE[1].frontZ - 1.7 },
      deck: 1,
      lane: 1,
      name: 'middle step',
    },
  ],
  speed: 7,
  // Poured at the top's back, bonus coins mostly ended in the pile, not the
  // chute (a gold was worth ~2 points); over the middle step's front they
  // tumble down the last two steps and about three in four reach the chute.
  // Low, so the hopper hangs in front of the middle step's plates, not over them.
  bonusPour: { y: CASCADE[1].floorY + 1.3, z: CASCADE[1].frontZ - 0.7, halfWidth: 2.6 },
  plates: {
    // Gold and red, by lane (0 is the player's left), in the order they
    // move to. Each deck starts with them set against each other: the lane
    // that pays on the middle step spills onto red on the bottom one.
    decks: [
      {
        deck: 0,
        name: 'bottom step',
        arrangements: [
          [1, 0],
          [2, 1],
          [0, 2],
          [1, 2],
          [0, 1],
          [2, 0],
        ],
      },
      {
        deck: 1,
        name: 'middle step',
        arrangements: [
          [0, 2],
          [2, 1],
          [1, 0],
          [2, 0],
          [0, 1],
          [1, 2],
        ],
      },
    ],
    // Measured: with no drain, every lane's plates filled from the pile's
    // trickle, and a random switcher tripped as much gold as a careful one.
    // Three coins with a 4s drain only trips under a routed lane's spill.
    goldCoins: 3,
    redCoins: 3,
    leakS: 4,
    bonus: 14,
    // A bar across the whole lip only delays coins (no cost in the sim);
    // across the chute alone, the pushers squeeze some round its ends into
    // the gutters. Still small: red's real cost is the gold progress it
    // wipes and the plates it moves.
    barS: 8,
    barHalfWidth: 3,
    voice: { gold: 'The gate swings open!', red: 'Clunk! The lip is jammed.' },
  },
}

const THE_CASCADE_ENGINE: StageDef = {
  number: 7,
  slug: 'the-cascade-engine',
  name: 'The Cascade Engine',
  pitch:
    'Three stacked pushers and a tangle of glass tubes. Route your coins onto the gold plates and the whole machine pays out.',
  playable: true,
  table: { chuteHalfWidth: 3, pusherPeriodS: PUSHER_PERIOD_S, layout: CASCADE },
  arm: { periodS: PUSHER_PERIOD_S, dropZ: CASCADE[2].backZ + 0.9 },
  delivery: CASCADE_SWITCHES,
  ring: { enabled: false },
  objects: { drop: COIN },
  cue: null,
  pile: 'the-cascade-engine',
  // Seeds swing this a lot (8 and 11 shed half their coins); 7 settles
  // with ~150 across the decks and the lip loaded, so early drops pay.
  bake: { seed: 7, floor: [85, 70, 55], top: [0, 0, 14] },
  rules: {
    coins: 40,
    // No ring: the plates are the bonus. From the sim (10 games each): a
    // random switcher averages 66 (one star 90%, two 40%, never three);
    // routing once to the first gold and leaving it is no better, 59 (two
    // stars 10%); re-routing every coin as the plates move averages 92
    // (two stars 80%, three 60%), with twice the gold plates (5.1 to 2.4).
    bonusForStreak: () => 0,
    goal: { type: 'score', stars: [40, 70, 95] },
  },
  measure: { label: 'Score', caption: 'coins into the chute' },
  hint: 'Spill coins onto a gold plate (star) for bonus coins; a red one (cross) blocks that step for a while. Plates move each time one goes off.',
  voice: {
    start: 'Top step pushes, middle step catches, bottom step pays.',
    clear: 'All the way down! The engine hums along.',
    miss: 'The engine needs a few more turns.',
  },
}

/**
 * One page of The Bedtime Book: the back one pushes toward the player, the
 * front one (reversed) is its mirror and pushes away, and the slot between
 * their edges is the book's spine. A page is shallower than the usual
 * shelf (2.8 in front of the pusher, not 4.5), so the two together fit on
 * a phone.
 */
const SPINE_HALF_WIDTH = 0.7
const PAGE_SHELF = 2.8
const bookPage = (reversed: boolean, lagS: number): Deck => {
  const side = reversed ? 1 : -1
  // 2 of pusher top shows in front of the wall when it's pulled back.
  const faceMax = SPINE_HALF_WIDTH + PAGE_SHELF
  return {
    floorY: 0,
    frontZ: side * SPINE_HALF_WIDTH,
    backZ: side * (faceMax + 2 * PUSHER_AMP_Z + 2),
    pusher: {
      midZ: side * (faceMax + PUSHER_AMP_Z + 2),
      ampZ: PUSHER_AMP_Z,
      depth: 4,
      lagS,
      reversed,
    },
  }
}
/** Half a stroke apart: one page pushes while the other pulls back. */
const BOOK: Layout = [bookPage(false, 0), bookPage(true, PUSHER_PERIOD_S / 2)]

/**
 * The Bedtime Book's owls and pea-shooter (lib/deliveries/owls). Owls fly
 * lanes over each page's shelf, never over the spine, in a band of heights
 * the aim's plane sits in the middle of. The shooter stands on the near
 * edge of the book, behind the front page's pusher.
 */
const BOOK_OWLS: OwlsConfig = {
  shooter: { x: 0, y: 1.3, z: 9.9 },
  aimY: 4.4,
  pages: [
    [-6, -1.3],
    [1.3, 5.8],
  ],
  height: [3.8, 5],
  speed: [1, 1.9],
  owls: 4,
  seed: 10,
}

const THE_BEDTIME_BOOK: StageDef = {
  number: 10,
  slug: 'the-bedtime-book',
  name: 'The Bedtime Book',
  pitch:
    'A huge open picture book. Both pages slide toward the crease, and anything that falls into the fold becomes part of the story.',
  playable: true,
  // No outer edges: everything that falls goes into the spine.
  table: {
    chuteHalfWidth: FIELD_HALF_WIDTH,
    pusherPeriodS: PUSHER_PERIOD_S,
    layout: BOOK,
    floorTone: 'page',
    pusherTone: 'pageEdge',
    dressing: 'book',
  },
  // No arm: words come from the owls (the arm config is required, and unused).
  arm: { periodS: PUSHER_PERIOD_S },
  delivery: { kind: 'owls', ...BOOK_OWLS },
  ring: { enabled: false },
  objects: { drop: WORD },
  // The shooter draws its own aim: the dotted arc and a mark on the page.
  cue: null,
  pile: 'the-bedtime-book',
  bake: {
    seed: 10,
    floor: [55, 55],
    top: [10, 10],
    specials: [
      { object: 'dream', count: 6, x: [-2.8, 2.8], z: [-3.2, -2.2] },
      { object: 'dream', count: 6, x: [-2.8, 2.8], z: [2.2, 3.2] },
    ],
  },
  rules: {
    coins: 40,
    // No ring: the pages are the game. From the sim (10 games each): a
    // random shooter averages 53 (one star every time, two about a third
    // of the time, never three). Leading whichever owl is nearest, as fast
    // as the shooter reloads, averages only 35 (one star 70%): words
    // rained down anywhere, on alternate pages, are more than a page's
    // pusher can carry. The skilled player leads owls too but waits for
    // one whose word would land on bare page in front of a pulled-back
    // pusher (the filled aim circle), and averages 86: two stars every
    // time, three half the time. Where and when matter more than how often.
    bonusForStreak: () => 0,
    goal: { type: 'score', stars: [30, 60, 85] },
  },
  measure: { label: 'Story', caption: 'points into the story' },
  hint: 'Hit an owl with a pea to drop its word. The circle on the page fills in when a word landing there will get a good push. A dream is worth 5.',
  voice: {
    start: 'Every story starts in the middle.',
    clear: 'The book closes softly. What a story.',
    miss: 'The pages are waiting for the rest.',
  },
}

/**
 * Starfall Pachinko's board: seven staggered rows of pins over the drop
 * line, filling its width, and one narrow cup in the middle of the bottom
 * row with a star sweeping across its mouth. Measured one coin at a time:
 * about 1 drop in 10 lands in it, and no spot more than about half the
 * time. (Cups out at the sides caught every drop near the walls, straight
 * down the empty outer lanes; a fixed board had a spot over the cup that
 * caught every drop.)
 */
// Raised clear of the heap the pusher carries under it, which grows to
// about 1.5 by the back wall and jammed a lower board's exit.
const PACHINKO_BOARD: Board = {
  // Seven rows, so a coin's path is a long chain of bounces. Pins 2.4 apart,
  // over twice a coin's width, so each pin sends a coin one way or the
  // other: at 2 apart a coin rattled down a zig-zag channel between them
  // and a drop over the cup landed in it every time (52 of 52).
  pins: staggeredPins(7, 2.5, 1, 2.4, 2.5).filter(p => !(p.x === 0 && p.y === 2.5)),
  pinRadius: 0.1,
  z: DROP_Z,
  slot: 0.3,
  bottomY: 1.8,
  topY: 9.4,
  cups: [{ x: 0, y: 2.45, width: 1.04, bonus: 3 }],
  // Under the bottom row's pins, so each bin sits between two of them.
  dividers: [-2, 0, 2],
  dividerTop: 2.4,
  gated: true,
  // A star sweeping across the cup's mouth, a row up. It bounces coins that
  // fall onto it, and passes over the rest: as a solid it wedged coins
  // against the pins beside it and the cup's walls, into the glass (21 of
  // 2,000 drops stuck for good, each one holding up every drop after it).
  sweepers: [{ y: 3.5, ampX: 1, periodS: 2.3 }],
}

const STARFALL_PACHINKO: StageDef = {
  number: 8,
  slug: 'starfall-pachinko',
  name: 'Starfall Pachinko',
  pitch:
    'Coins tumble down a board of star pins before they land. Drop where the pins will carry you.',
  playable: true,
  // A wider chute, as at Penny Falls: the outer bins drop coins near the walls.
  table: {
    chuteHalfWidth: 3,
    pusherPeriodS: PUSHER_PERIOD_S,
    board: PACHINKO_BOARD,
  },
  // Raised to clear the board's top row of pins.
  arm: { periodS: ARM_PERIOD_S, pivotY: 16.3 },
  // The board takes the ring's place.
  ring: { enabled: false },
  objects: { drop: COIN },
  cue: null,
  pile: 'starfall-pachinko',
  bake: { seed: 28, floor: 150, top: 14 },
  rules: {
    coins: 40,
    bonusForStreak: () => 0,
    // From the sim (20 games each): a random tapper averages 40 (★★ 45%,
    // ★★★ 15%); dropping on the beat, 42 (★★ 55%, ★★★ 20%); aiming over the
    // cup, 58, catching 24 of its 40 drops (★★ every time, ★★★ 65%). Luck
    // counts for a lot here, as on any pachinko board; aim gives an edge.
    // Since the star stopped bulldozing coins off the cup's mouth (it used
    // to wedge them against the pins and cup), aiming catches more (it was
    // 14 of 40, averaging 52) and nothing else moved, so the stars stayed.
    goal: { type: 'score', stars: [30, 42, 52] },
  },
  measure: { label: 'Score', caption: 'coins into the chute' },
  hint: 'Coins bounce down the pins before they land. One caught in the middle cup pours 3 more.',
  voice: {
    start: 'Pick your spot. The stars do the rest.',
    clear: 'Starfall! The board was kind tonight.',
    miss: 'The pins will shuffle you a better night.',
  },
}

/** Gravity Assist's posts: one at each front corner, narrowing the way into the gutters. */
const GRAVITY_POSTS: Obstacle[] = [-3.2, 3.2].map(x => ({
  type: 'post',
  x,
  z: 3.1,
  radius: 0.3,
  height: 0.9,
}))

const GRAVITY_ASSIST: StageDef = {
  number: 9,
  slug: 'gravity-assist',
  name: 'Gravity Assist',
  pitch:
    'A small moon orbits above the table. Shoot a glass ball past it and watch it swing round.',
  playable: true,
  table: {
    chuteHalfWidth: CHUTE_HALF_WIDTH,
    pusherPeriodS: PUSHER_PERIOD_S,
    obstacles: GRAVITY_POSTS,
  },
  arm: { periodS: ARM_PERIOD_S },
  // A pinball plunger at the front right, angled up, back and a little in.
  // With no moon a full pull lands just in front of the back wall and a
  // light one on the front of the pile; the moon swings that line across
  // the whole table.
  delivery: {
    kind: 'plunger',
    at: { x: 3.4, y: 1.2, z: 3.8 },
    elevation: (62 * Math.PI) / 180,
    yaw: (-19 * Math.PI) / 180,
    minSpeed: 9,
    maxSpeed: 15,
    chargeS: 1.2,
  },
  // Over the middle of the table, under the top of the ball's flight, so
  // every shot passes close by it. Twice the arm-era strength (30): within
  // about 1.6 of it, it pulls harder than gravity. It pulls front to back as
  // well (pullZ), unlike under the arm: there the forward pull dragged coins
  // off the back strip and timing stopped mattering, but here the pull on
  // the spring makes up the distance and the dotted line shows it. Measured
  // (6 games each): with it, random 20 against 40 on the landing cue; across
  // and up or down only, random 34 against 40, so skill barely paid.
  // Strength 40 and 85 both narrowed the gap (to 17 and 11 points).
  moon: {
    center: { x: 0, y: 4.5, z: -1.5 },
    radiusX: 3,
    radiusZ: 1.2,
    periodS: 7,
    strength: 60,
    softening: 0.7,
    minY: 1.6,
    pullZ: true,
  },
  ring: { enabled: false },
  objects: { drop: SILVER },
  cue: null,
  pile: 'gravity-assist',
  bake: { seed: 9, floor: 150, top: 14 },
  meteors: {
    object: METEORITE,
    // Dropped from low down, so the moon (which pulls front to back now)
    // only nudges them: from 6 up it dragged them 0.5–1.8 back from the lip.
    y: 3.5,
    warnS: 3,
    // Near the lip, inside the chute, so a few well-timed pushes bring each
    // one home. Each lands about 0.3 behind where it starts.
    schedule: [
      { afterDrop: 4, x: -1.2, z: 2.7 },
      { afterDrop: 10, x: 1.1, z: 2.3 },
      { afterDrop: 16, x: 0, z: 2.9 },
      { afterDrop: 22, x: -0.7, z: 2.1 },
      { afterDrop: 28, x: 1.5, z: 2.7 },
      { afterDrop: 34, x: 0.4, z: 2.4 },
    ],
  },
  rules: {
    coins: 40,
    bonusForStreak: () => 1,
    // From the sim (12 games each): a random tapper averages 24 (a star a
    // quarter of the time). Dropping on the beat, judged where the bent coin
    // lands, averages 50 (★★ 58%, ★★★ 25%); also aiming behind meteorites
    // and taking ring lineups off the dotted line averages 58 (★★★ 50%).
    // From the sim (10 games each): pulling random amounts at random
    // moments averages 24 (★ 20%). Letting go when the landing marker fills
    // (down on the back strip, pusher forward) averages 54 (★★ 80%, ★★★
    // 30%); also waiting for the path to end behind the meteorite nearest
    // the lip averages 50 (★★ 100%, ★★★ 20%). That aim gains nothing
    // measurable over the marker alone: the moon and the beat are the skill.
    goal: { type: 'score', stars: [30, 42, 58] },
  },
  measure: { label: 'Score', caption: 'points into the chute' },
  hint: 'The moon bends the ball; the dots show where it lands. Aim behind a meteorite (worth 5).',
  voice: {
    start: 'Pull back, wait for the moon, let go.',
    clear: 'Gravity assist! The moon threw every one of them home.',
    miss: 'The moon will come round again.',
  },
}

/** Redline's pegs: two posts near the lip that split the flow off the front. */
const REDLINE_PEGS: Obstacle[] = [-1.4, 1.4].map(x => ({
  type: 'post',
  x,
  z: 2.6,
  radius: 0.28,
  height: 0.9,
}))

const REDLINE: StageDef = {
  number: 11,
  slug: 'redline',
  name: 'Redline',
  pitch:
    'Forty coins, ninety seconds, one tempo. Stay on the beat and the table pays more the longer you hold it.',
  playable: true,
  table: {
    chuteHalfWidth: CHUTE_HALF_WIDTH,
    pusherPeriodS: 2.4,
    obstacles: REDLINE_PEGS,
  },
  arm: { periodS: ARM_PERIOD_S },
  // Faster and narrower than the usual ring (3.9s, 0.8). The pusher runs
  // faster too (2.4s, not 3.2): at the usual pace, ring bonuses were still
  // on the shelf when the clock ran out.
  ring: { enabled: true, periodS: 2.9, radius: 0.7 },
  objects: { drop: AMBER, bonus: AMBER_BONUS },
  // The beat lane: the chevrons on the back wall light on the beat.
  cue: 'chevrons',
  pile: 'redline',
  bake: { seed: 12, floor: 150, top: 14 },
  rules: {
    coins: 40,
    // Ninety seconds of arm time, so the slower arm stretches it (and its
    // results say so).
    timeLimitS: 90,
    // A drop on the beat raises the tempo a step, up to 6; off the beat it
    // falls back to 1, and every 3s without a drop costs a step. A ring hit
    // pours 3 coins times the tempo the drop was made at.
    tempo: { max: 6, idleS: 3 },
    bonusForStreak: () => 3,
    // The doc's guesses (45 / 120 / 200) are out of reach: a pusher only
    // moves so many coins in 90s. From the sim (12 games each): a random
    // tapper averages 12 (a star 17% of the time); dropping on the beat
    // averages 28 and reaches Redline every game (★ 92%, ★★ 42%); on the
    // beat plus ring lineups averages 40 (★★ every game, ★★★ 42%).
    goal: { type: 'score', stars: [15, 30, 45] },
  },
  measure: { label: 'Score', caption: 'coins into the chute' },
  hint: 'Drop when the chevrons light to build tempo. Ring hits pay 2 coins times your tempo.',
  voice: {
    start: 'Ninety seconds. Find the beat.',
    clear: 'Tempo held. The table paid out.',
    miss: 'Lost the beat. Run it back.',
  },
}

/**
 * Comet Homecoming's table: the usual deck with a deeper pusher, so the
 * Last Push (twice the reach, forward) never pulls its back out from under
 * the back wall.
 */
const HOMECOMING_DECK: Deck = {
  floorY: 0,
  frontZ: FIELD_FRONT_Z,
  backZ: BACK_WALL_Z,
  pusher: { midZ: PUSHER_MID_Z, ampZ: PUSHER_AMP_Z, depth: 6.5, lagS: 0 },
}

/** Where the core starts: in front of the pusher, behind the pegs. */
const CORE_START_Z = 2.6

const HOMECOMING_OBSTACLES: Obstacle[] = [
  // Two pegs closer together than the core is wide: coins get through, the
  // core doesn't. They sink when Homecoming starts.
  ...[-0.7, 0.7].map(
    (x): Obstacle => ({ type: 'post', x, z: 3.75, radius: 0.25, height: 0.9, phases: [0, 1] })
  ),
  // The moon bumper: rises for Orbit and sweeps the shelf between the
  // pusher and the core, stirring the pile. Kept near the middle: a wide
  // sweep shoved the low-gravity pour into the gutters (31 coins lost in
  // Orbit, against 21 at this width and 12 with no bumper).
  {
    type: 'post',
    x: 0,
    z: 0.9,
    radius: 0.3,
    height: 0.5,
    phases: [1],
    sweep: { ampX: 1.2, periodS: 9 },
  },
]

const COMET_HOMECOMING: StageDef = {
  number: 12,
  slug: 'comet-homecoming',
  name: 'Comet Homecoming',
  pitch:
    'A sleepy giant comet has landed on your shelf. Wake it, carry it through low gravity, then push it home.',
  playable: true,
  table: {
    chuteHalfWidth: CHUTE_HALF_WIDTH,
    pusherPeriodS: PUSHER_PERIOD_S,
    layout: [HOMECOMING_DECK],
    obstacles: HOMECOMING_OBSTACLES,
  },
  arm: { periodS: ARM_PERIOD_S },
  ring: { enabled: true },
  objects: { drop: COIN },
  cue: 'chevrons',
  pile: 'comet-homecoming',
  bake: {
    seed: 26,
    floor: 150,
    top: 14,
    specials: [
      { object: 'core', count: 1, x: [-0.05, 0.05], z: [CORE_START_Z, CORE_START_Z + 0.05] },
    ],
  },
  // 20 coins a phase, not the doc's 25 / 20 / 15: the core needs the
  // Homecoming phase's extra coins to get home.
  phases: [
    { name: 'Wake', coins: 20, ring: true, line: 'Build the shelf up behind the pegs.' },
    {
      name: 'Orbit',
      coins: 20,
      ring: true,
      gravityScale: 0.45,
      line: 'Low gravity! The moon bumper is sweeping the shelf.',
    },
    {
      name: 'Homecoming',
      coins: 20,
      ring: false,
      // A wide disc on the floor soaks up the pile's push: with no help it
      // moved under a unit in a whole phase and never got home.
      homing: 8,
      line: "The pegs are down. Push me home, I'll light the way!",
    },
  ],
  lastPush: { object: CORE.id, seconds: 6 },
  rules: {
    coins: 60,
    bonusForStreak: () => 2,
    // Finishing is a star; the core home is needed for two and three. The
    // doc's 90 / 140 were guesses: the best runs score about 100. From the
    // sim (12 games each): a random tapper averages 72 and gets the core
    // home 10 of 12 times (★★ 58%); on the beat, 92, core home every time
    // (★★ 100%, ★★★ 8%); also aiming behind the core, 94 (★★★ 50%).
    goal: { type: 'homecoming', object: CORE.id, stars: [0, 80, 95] },
  },
  measure: { label: 'Score', caption: 'points into the chute' },
  hint: 'Three phases. The comet core is worth 40, and getting it home starts the Last Push.',
  voice: {
    start: 'A sleepy comet has landed on your shelf.',
    clear: 'Home at last. Thank you for the push.',
    miss: 'The comet will wait for you.',
  },
}

export const STAGES: readonly Stage[] = [
  PENNY_FALLS,
  MOONSTONE_PORCH,
  BRAMBLES_MIDNIGHT_SNACK,
  HOOP_LA_CANNON,
  THE_CAIRN,
  RUBBER_DUCKY_RUMBLE,
  THE_CASCADE_ENGINE,
  STARFALL_PACHINKO,
  GRAVITY_ASSIST,
  THE_BEDTIME_BOOK,
  REDLINE,
  COMET_HOMECOMING,
]

/** Looks a stage up by its slug or its number ("1"). */
export function findStage(key: string): Stage | undefined {
  return STAGES.find(s => s.slug === key || String(s.number) === key)
}

export function playableStage(key: string): StageDef | undefined {
  const stage = findStage(key)
  return stage?.playable ? stage : undefined
}
