import {
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
  deckDir,
} from '@/app/meteor-coins/lib/cabinet'
import { type CannonConfig } from '@/app/meteor-coins/lib/cannon'
import { ARM_PERIOD_S, type ArmConfig, type RingConfig } from '@/app/meteor-coins/lib/dropper'
import type { Obstacle } from '@/app/meteor-coins/lib/engine'
import type { MoonConfig } from '@/app/meteor-coins/lib/moon'
import {
  AMBER,
  AMBER_BONUS,
  CHOCOLATE,
  COIN,
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
    pusherPeriodS: number
    obstacles?: readonly Obstacle[]
    floorFriction?: number
    floorDrift?: number
    /** The table's decks; one unless the stage stacks them. */
    layout?: Layout
    /** What the floor and pushers are made of, if not the cabinet's usual. */
    floorTone?: Tone
    pusherTone?: Tone
  }
  arm: ArmConfig
  /** A cannon at the front instead of the arm: coins are fired, not dropped. */
  cannon?: CannonConfig
  /** A moon circling over the table that bends everything falling. */
  moon?: MoonConfig
  /** Special objects that drop in on a timetable, each counted down where it will land. */
  meteors?: MeteorShower
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

export type PileRecipe = {
  seed: number
  /**
   * Drop-object count scattered over the shelf, and on the pusher's top. On
   * a table of several decks, both are per deck, bottom first.
   */
  floor: number | readonly number[]
  top: number | readonly number[]
  /** Special objects, placed first so the pile settles around them, spread across a zone. */
  specials?: { object: ObjectId; count: number; x: [number, number]; z: [number, number] }[]
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

const MOONSTONE_PORCH: StageDef = {
  number: 2,
  slug: 'moonstone-porch',
  name: 'Moonstone Porch',
  pitch:
    "Last night's meteor shower left nine moonstones on the porch. Nudge them into the jar at your own pace.",
  playable: true,
  // No gutters: low rails along both sides, so everything off the front is
  // jarred. Everything is slower than Penny Falls.
  table: { chuteHalfWidth: FIELD_HALF_WIDTH, pusherPeriodS: 4 },
  arm: { periodS: 3.4 },
  ring: { enabled: false },
  objects: { drop: COIN },
  cue: 'shadow',
  pile: 'moonstone-porch',
  bake: {
    seed: 2,
    floor: 175,
    top: 14,
    // Three near the lip so the first refunds come early; six further back.
    specials: [
      { object: 'moonstone', count: 3, x: [-2.4, 2.4], z: [2, 2.6] },
      { object: 'moonstone', count: 6, x: [-2.8, 2.8], z: [-0.3, 1.6] },
    ],
  },
  rules: {
    // Each moonstone jarred refunds 3 coins, so a good run plays on. No ring:
    // the pusher is the game. From the sim (12 games each): a random tapper
    // finishes for one star; following the drop cue makes two ~75% of the
    // time; following it and aiming behind the moonstone nearest the lip
    // makes three ~67% of the time.
    coins: 55,
    bonusForStreak: () => 0,
    // Can't fail: finishing is a star.
    goal: { type: 'collect', object: MOONSTONE.id, total: 9, stars: [0, 5, 9] },
  },
  measure: { label: 'Moonstones', caption: 'moonstones in the jar' },
  voice: {
    start: "Take your time — the porch isn't going anywhere.",
    clear: 'Into the jar, glowing softly.',
    miss: 'The moonstones will wait for you.',
  },
}

const BRAMBLES_MIDNIGHT_SNACK: StageDef = {
  number: 3,
  slug: 'brambles-midnight-snack',
  name: "Bramble's Midnight Snack",
  pitch:
    'A big, polite monster lives under the bakery counter. Push 30 chocolates into its mouth before your tin runs out.',
  playable: true,
  table: { chuteHalfWidth: 3, pusherPeriodS: PUSHER_PERIOD_S },
  arm: { periodS: ARM_PERIOD_S },
  ring: { enabled: false },
  objects: { drop: CHOCOLATE },
  cue: 'chevrons',
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
    // No ring: the pusher is the game.
    bonusForStreak: () => 0,
    // A cherry truffle feeds 3. Stars count chocolates left in the tin. From
    // the sim (12 games each): a random tapper doesn't reach 30; following
    // the drop cue reaches it ~92% of the time; also aiming for the truffles
    // leaves a median of 19.
    goal: { type: 'target', count: 30, stars: [0, 6, 16] },
  },
  measure: { label: 'Fed', caption: 'chocolates left in the tin' },
  voice: {
    start: "Bramble's hungry. Thirty chocolates, please.",
    clear: 'Bramble pats its tummy. "Thank you kindly."',
    miss: 'Bramble is still a little peckish.',
  },
}

/** Three low soap bars across the tub floor for ducks to bonk over. */
const SOAP_BARS: Obstacle[] = [-2.3, 0, 2.3].map(x => ({
  type: 'block',
  x,
  z: 1.6,
  width: 0.9,
  depth: 0.4,
  height: 0.16,
}))

const RUBBER_DUCKY_RUMBLE: StageDef = {
  number: 6,
  slug: 'rubber-ducky-rumble',
  name: 'Rubber Ducky Rumble',
  pitch:
    '"WHAT IF THE COINS WERE RUBBER DUCKS?!" They wobble, bonk and tip, and you push them down the drain.',
  playable: true,
  table: { chuteHalfWidth: CHUTE_HALF_WIDTH, pusherPeriodS: PUSHER_PERIOD_S, obstacles: SOAP_BARS },
  arm: { periodS: ARM_PERIOD_S },
  ring: { enabled: true },
  objects: { drop: DUCK },
  cue: null,
  pile: 'rubber-ducky-rumble',
  bake: {
    seed: 6,
    floor: 150,
    top: 10,
    specials: [{ object: 'mama-duck', count: 3, x: [-2.4, 2.4], z: [-0.2, 1.2] }],
  },
  rules: {
    coins: 40,
    // The splash ring: +2, +3, +4, then +5 a hit.
    bonusForStreak: streak => Math.min(streak + 1, 5),
    // A Mama Duck is worth 5. From the sim (10 games each): a random tapper
    // makes one star 80% of the time; timing the drop barely matters with
    // bouncy ducks, so two and three stars are for the splash ring — the
    // near-perfect ring bot scores 61–72.
    goal: { type: 'score', stars: [15, 32, 60] },
  },
  measure: { label: 'Score', caption: 'points down the drain' },
  voice: {
    start: 'Bonk them down the drain!',
    clear: 'Quack-tastic! Down the drain they go!',
    miss: 'The ducks want one more swim.',
  },
}

/**
 * Three hoops at near, middle and far depth, smaller and worth more the
 * further back. Each hangs where a part-charged shot passes: about 40%,
 * 75% and 85%. A full charge clears all three and drops off the backboard
 * onto the pusher, like a coin from the arm.
 */
const HOOPS = [
  { x: -0.8, y: 2.6, z: 1.5, radius: 0.95, bonus: 3 },
  { x: 1.3, y: 3.0, z: -1, radius: 0.82, bonus: 6 },
  { x: 0, y: 2.1, z: -3, radius: 0.72, bonus: 10 },
]

const HOOP_LA_CANNON: StageDef = {
  number: 4,
  slug: 'hoop-la-cannon',
  name: 'Hoop-La Cannon',
  pitch:
    'A brass cannon at the front lobs coins back over the pile. Thread them through three hanging hoops.',
  playable: true,
  table: { chuteHalfWidth: CHUTE_HALF_WIDTH, pusherPeriodS: PUSHER_PERIOD_S },
  arm: { periodS: ARM_PERIOD_S },
  cannon: {
    pivot: { x: 0, y: 0.9, z: 5.4 },
    barrel: 0.8,
    periodS: 3,
    // Swings far enough that a full shot reaches just inside the walls.
    maxYaw: 0.28,
    elevation: (52 * Math.PI) / 180,
    minSpeed: 7,
    maxSpeed: 15,
    chargeS: 1.2,
    hoops: HOOPS,
  },
  ring: { enabled: false },
  objects: { drop: COIN },
  cue: null,
  pile: 'hoop-la-cannon',
  bake: { seed: 4, floor: 110, top: 12 },
  rules: {
    coins: 40,
    // Hoops pour their own bonuses (above), not a streak. From the sim (8
    // games each): firing at random averages 19, a star half the time;
    // full shots timed to land on bare shelf average 25, always a star;
    // also threading a hoop whenever the swing lines one up averages 56,
    // two stars every time and three half the time.
    bonusForStreak: () => 0,
    goal: { type: 'score', stars: [20, 35, 55] },
  },
  measure: { label: 'Score', caption: 'coins into the chute' },
  hint: 'Hoops pour +3, +6 and +10 coins.',
  voice: {
    start: 'Step right up! Thread the hoops.',
    clear: 'Off the boards! Still counts on the shelf.',
    miss: 'Step right up and try again!',
  },
}

/** The Cairn's drop line, forward over its posts. */
const CAIRN_DROP_Z = 0.6
const CAIRN_POST = { type: 'post', radius: 0.7, height: 0.8 } as const

/**
 * Two stone posts at the sides, and one in the middle mounted on the pusher's
 * front on a short bracket. The middle post reaches the drop line only at the
 * front of its stroke, so you catch it as it arrives.
 */
const CAIRN_POSTS: Obstacle[] = [
  { ...CAIRN_POST, x: -2.2, z: CAIRN_DROP_Z, tower: 'Left' },
  { ...CAIRN_POST, x: 0, z: CAIRN_DROP_Z - PUSHER_AMP_Z, rides: true, tower: 'Middle' },
  { ...CAIRN_POST, x: 2.2, z: CAIRN_DROP_Z, tower: 'Right' },
]
const PUSHER_FACE_Z = PUSHER_MID_Z + PUSHER_DEPTH / 2
const CAIRN_BRACKET: Obstacle = {
  type: 'block',
  x: 0,
  z: (PUSHER_FACE_Z - 0.1 + CAIRN_DROP_Z - PUSHER_AMP_Z) / 2,
  width: 0.5,
  depth: CAIRN_DROP_Z - PUSHER_AMP_Z - PUSHER_FACE_Z + 0.1,
  height: 0.3,
  rides: true,
}

const THE_CAIRN: StageDef = {
  number: 5,
  slug: 'the-cairn',
  name: 'The Cairn',
  pitch:
    'Build towers that hold on three stone posts. The middle one rides the pusher, so catch it as it slides by.',
  playable: true,
  // An icy floor, sloping gently to the front: whatever misses a post, or
  // falls off one, slides away.
  table: {
    chuteHalfWidth: FIELD_HALF_WIDTH,
    pusherPeriodS: PUSHER_PERIOD_S,
    obstacles: [...CAIRN_POSTS, CAIRN_BRACKET],
    floorFriction: 0.05,
    floorDrift: 2,
  },
  // Lowered and moved forward to just above the posts. A coin dropped from
  // the usual height hits a tower hard enough to knock it down: in the
  // headless prototype, falls of ~4 kept a third as many coins up as falls
  // of ~2.5.
  arm: { periodS: 4, pivotY: 10.6, dropZ: CAIRN_DROP_Z },
  ring: { enabled: false },
  objects: { drop: COIN },
  cue: 'dot',
  pile: null,
  rules: {
    coins: 30,
    bonusForStreak: () => 0,
    // From the sim (16 games each): a random tapper makes one star about half
    // the time; tapping when the dot fills makes two ~90% of the time but
    // rarely catches the middle post; holding out for the middle makes three
    // ~30% of the time. No tower needs more than 13 coins for three stars.
    goal: { type: 'stack', weights: [1, 2, 1], stars: [6, 18, 32] },
  },
  measure: { label: 'Height', caption: 'coins high, middle counted twice' },
  hint: 'Land coins on the posts to build towers. The dot fills in when a drop would land square. The middle post counts twice.',
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

const THE_CASCADE_ENGINE: StageDef = {
  number: 7,
  slug: 'the-cascade-engine',
  name: 'The Cascade Engine',
  pitch:
    'Three stacked pushers, one per step, timed so each feeds the next. Time your drop at the top and watch it fall all the way down.',
  playable: true,
  table: { chuteHalfWidth: 3, pusherPeriodS: PUSHER_PERIOD_S, layout: CASCADE },
  arm: { periodS: PUSHER_PERIOD_S, dropZ: CASCADE[2].backZ + 0.9 },
  ring: { enabled: false },
  objects: { drop: COIN },
  cue: 'chevrons',
  pile: 'the-cascade-engine',
  // Seeds swing this a lot (8 and 11 shed half their coins); 7 settles
  // with ~150 across the decks and the lip loaded, so early drops pay.
  bake: { seed: 7, floor: [85, 70, 55], top: [0, 0, 14] },
  rules: {
    coins: 40,
    // No ring: the pushers are the game. From the sim (10 games each): a
    // random tapper makes one star ~80% of the time; dropping on the
    // chevron cue makes two ~80% and three ~30%.
    bonusForStreak: () => 0,
    goal: { type: 'score', stars: [25, 40, 55] },
  },
  measure: { label: 'Score', caption: 'coins into the chute' },
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
  },
  // An arm over each page, by its wall; they take turns.
  arm: {
    periodS: PUSHER_PERIOD_S,
    pivotY: 11,
    dropZ: BOOK.map(page => page.backZ + deckDir(page) * 0.6),
  },
  ring: { enabled: false },
  objects: { drop: WORD },
  cue: 'shadow',
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
    // No ring: the pages are the game. From the sim (12 games each): a word
    // landing while its page is pulled back rides the pusher top and never
    // reaches the wall, so timing matters more here than anywhere yet. A
    // random tapper averages 19 (one star ~30% of the time); dropping on
    // the shadow cue averages 74, making two stars every time and three
    // about half the time.
    bonusForStreak: () => 0,
    goal: { type: 'score', stars: [25, 50, 75] },
  },
  measure: { label: 'Story', caption: 'points into the story' },
  hint: 'The arms take turns: back page, then front page. A dream is worth 5.',
  voice: {
    start: 'Every story starts in the middle.',
    clear: 'The book closes softly. What a story.',
    miss: 'The pages are waiting for the rest.',
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
    'A small moon orbits above the table and bends every falling coin, visibly. Meteorites land on a fixed timetable.',
  playable: true,
  table: {
    chuteHalfWidth: CHUTE_HALF_WIDTH,
    pusherPeriodS: PUSHER_PERIOD_S,
    obstacles: GRAVITY_POSTS,
  },
  // Hung higher than usual, so coins fall long enough for the bend to show.
  arm: { periodS: ARM_PERIOD_S, pivotY: 14.5 },
  // In front of the drop line, out over the shelf: falling coins pass by it
  // and bend toward its side (see lib/moon for why never forward).
  moon: {
    center: { x: 0, y: 5.5, z: DROP_Z + 2 },
    radiusX: 2.6,
    radiusZ: 0.4,
    periodS: 7,
    strength: 30,
    softening: 0.6,
    minY: 1.6,
  },
  // Worth a single coin: the pusher is the game. The moon moves where a
  // coin crosses it, so the dotted line is how you line it up.
  ring: { enabled: true },
  objects: { drop: SILVER },
  cue: 'chevrons',
  pile: 'gravity-assist',
  bake: { seed: 9, floor: 150, top: 14 },
  meteors: {
    object: METEORITE,
    y: 6,
    warnS: 3,
    // Near the lip, inside the chute, so a few well-timed pushes bring each one home.
    schedule: [
      { afterDrop: 4, x: -1.2, z: 2.4 },
      { afterDrop: 10, x: 1.1, z: 2.0 },
      { afterDrop: 16, x: 0, z: 2.6 },
      { afterDrop: 22, x: -0.7, z: 1.8 },
      { afterDrop: 28, x: 1.5, z: 2.4 },
      { afterDrop: 34, x: 0.4, z: 2.1 },
    ],
  },
  rules: {
    coins: 40,
    bonusForStreak: () => 1,
    // From the sim (12 games each): a random tapper averages 24 (a star a
    // quarter of the time). Dropping on the beat, judged where the bent coin
    // lands, averages 50 (★★ 58%, ★★★ 25%); also aiming behind meteorites
    // and taking ring lineups off the dotted line averages 58 (★★★ 50%).
    goal: { type: 'score', stars: [25, 45, 60] },
  },
  measure: { label: 'Score', caption: 'points into the chute' },
  hint: 'The moon bends every falling coin; the dotted line shows where. A meteorite is worth 5.',
  voice: {
    start: 'Watch the moon. It pulls on everything that falls.',
    clear: 'Gravity assist! Your coins borrowed a little speed from the moon.',
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

const soon = (number: number, slug: string, name: string, pitch: string): ComingSoon => ({
  number,
  slug,
  name,
  pitch,
  playable: false,
})

export const STAGES: readonly Stage[] = [
  PENNY_FALLS,
  MOONSTONE_PORCH,
  BRAMBLES_MIDNIGHT_SNACK,
  HOOP_LA_CANNON,
  THE_CAIRN,
  RUBBER_DUCKY_RUMBLE,
  THE_CASCADE_ENGINE,
  soon(
    8,
    'the-doorstop',
    'The Doorstop',
    'Eight coins and a wedged bar that only swings from one end.'
  ),
  GRAVITY_ASSIST,
  THE_BEDTIME_BOOK,
  REDLINE,
  soon(12, 'comet-homecoming', 'Comet Homecoming', 'Help a sleepy giant comet back home.'),
]

/** Looks a stage up by its slug or its number ("1"). */
export function findStage(key: string): Stage | undefined {
  return STAGES.find(s => s.slug === key || String(s.number) === key)
}

export function playableStage(key: string): StageDef | undefined {
  const stage = findStage(key)
  return stage?.playable ? stage : undefined
}
