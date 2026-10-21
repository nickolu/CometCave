import { CHUTE_HALF_WIDTH, FIELD_HALF_WIDTH, PUSHER_PERIOD_S } from '@/app/meteor-coins/lib/cabinet'
import { ARM_PERIOD_S } from '@/app/meteor-coins/lib/dropper'
import type { Obstacle } from '@/app/meteor-coins/lib/engine'
import {
  CHOCOLATE,
  COIN,
  DUCK,
  MOONSTONE,
  type ObjectId,
  type ObjectSpec,
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
  table: { chuteHalfWidth: number; pusherPeriodS: number; obstacles?: readonly Obstacle[] }
  arm: { periodS: number }
  ring: { enabled: boolean }
  /** What the arm drops and the pile is mostly made of. */
  objects: { drop: ObjectSpec }
  /** The on-table timing cue, if any: lit when a drop now would land on bare shelf. */
  cue: 'chevrons' | 'shadow' | null
  pile: PileName
  /** How scripts/meteor-coins-bake-pile.ts builds this stage's pile. */
  bake: PileRecipe
  rules: RuleConfig
  /** Plain words for the goal's number: the HUD label, and the result's caption. */
  measure: { label: string; caption: string }
  /** In-game lines in the stage's voice. */
  voice: { start: string; clear: string; miss: string }
}

export type PileRecipe = {
  seed: number
  /** Drop-object count scattered over the shelf, and on the pusher's top. */
  floor: number
  top: number
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
  ring: { enabled: true },
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
    // Each moonstone jarred refunds 3 coins, so a good run plays on.
    coins: 40,
    bonusForStreak: () => 2,
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
  ring: { enabled: true },
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
    // The sprinkle hoop: +2, +3, then +4 per hit in a streak.
    bonusForStreak: streak => Math.min(streak + 1, 4),
    // A cherry truffle feeds 3. Stars count chocolates left in the tin.
    goal: { type: 'target', count: 30, stars: [0, 5, 12] },
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
  soon(4, 'hoop-la-cannon', 'Hoop-La Cannon', 'Lob coins in an arc through three hanging hoops.'),
  soon(5, 'the-cairn', 'The Cairn', 'Stack towers that hold on three stone posts.'),
  RUBBER_DUCKY_RUMBLE,
  soon(
    7,
    'the-cascade-engine',
    'The Cascade Engine',
    'Three stacked pushers, each feeding the next.'
  ),
  soon(
    8,
    'the-doorstop',
    'The Doorstop',
    'Eight coins and a wedged bar that only swings from one end.'
  ),
  soon(9, 'gravity-assist', 'Gravity Assist', 'A small moon bends every falling coin.'),
  soon(10, 'the-bedtime-book', 'The Bedtime Book', 'Two pages push toward the fold in the middle.'),
  soon(11, 'redline', 'Redline', 'Ninety seconds. Stay on the beat.'),
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
